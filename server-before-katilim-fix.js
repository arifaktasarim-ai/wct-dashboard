require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SUPABASE / POSTGRESQL
// ============================================================

if (!process.env.DATABASE_URL) {
  console.error('');
  console.error('========================================================');
  console.error('HATA: DATABASE_URL bulunamadi!');
  console.error('.env dosyasinda DATABASE_URL tanimli olmali.');
  console.error('========================================================');
  console.error('');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const DASHBOARD_DATA_ID = 1;

// Bellekte tek DB nesnesi tutulur.
// Uygulamanin eski db.json yapisini bozmadan
// PostgreSQL'e JSONB olarak kaydediyoruz.
let dbCache = null;

// Ayni anda gelen yazma islemlerini siraya sokar.
let dbWriteQueue = Promise.resolve();

// ============================================================
// EXPRESS
// ============================================================

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Tarayici cache'ini kapat
app.use((req, res, next) => {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(
  express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    cacheControl: false
  })
);

// ============================================================
// SURUM
// ============================================================

const APP_VERSION = 'v2026-09-18-roles3';

app.get('/api/version', (req, res) => {
  res.json({
    version: APP_VERSION
  });
});

// ============================================================
// COOKIE
// ============================================================

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};

  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');

    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();

      if (k) {
        try {
          cookies[k] = decodeURIComponent(v);
        } catch {
          cookies[k] = v;
        }
      }
    }
  });

  return cookies;
}

// ============================================================
// SIFRE
// ============================================================

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');

  const hash = crypto
    .scryptSync(String(password), salt, 64)
    .toString('hex');

  return {
    salt,
    hash
  };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;

  const test = crypto
    .scryptSync(String(password), salt, 64)
    .toString('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(test, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch {
    return false;
  }
}

// ============================================================
// ROL
// ============================================================

const ROL_SEVIYE = {
  kullanici: 0,
  kontrolcu: 1,
  admin: 2
};

// Eski (4 seviyeli) rol isimlerinden yeni 3 seviyeli sisteme gecis haritasi.
// izleyici          -> kullanici  (sadece goruntuleme)
// yazici, kidemli   -> kontrolcu  (kullanabilir/duzenleyebilir, silemez)
// admin             -> admin      (tam yetki, silme dahil)
const ESKI_ROL_HARITASI = {
  izleyici: 'kullanici',
  yazici: 'kontrolcu',
  kidemli: 'kontrolcu',
  kullanici: 'kullanici',
  kontrolcu: 'kontrolcu',
  admin: 'admin'
};

function normalizeRol(rol) {
  return ESKI_ROL_HARITASI[rol] || 'kullanici';
}

function rolSeviyesi(user) {
  const rol = normalizeRol(user && user.rol);
  return ROL_SEVIYE[rol] ?? 0;
}

// ============================================================
// DEFAULT DATABASE
// ============================================================

const CATEGORIES = [
  'guvenlik',
  'kalite',
  'teslimat',
  'verimlilik',
  'kalibrasyon'
];

function defaultDB() {
  return {
    guvenlik: {},
    kalite: {},
    teslimat: {},
    verimlilik: {},
    kalibrasyon: {},

    aksiyonlar: [],

    personel: [],

    toplantiNotlari: [],

    katilim: {},

    duyurular: {
      opl: '',
      seeCardKarekod: '',
      kalibrasyonTablosu: '',
      diger1: '',
      diger2: '',
      diger3: ''
    },

    sktTakip: [],

    ayarlar: {
      firmaAdi: '',
      bolumAdi: '',
      logoBase64: '',
      accentColor: '#1b2a4a',
      bgColor: '#f2f4f7',
      bgImageBase64: '',
      pageWidth: 'genis',
      radius: 'normal',
      shadows: true,
      compact: false,

      categoryColors: {
        guvenlik: '#2563eb',
        kalite: '#7c3aed',
        teslimat: '#0d9488',
        verimlilik: '#ea580c',
        kalibrasyon: '#475569'
      },

      gunlukSiralama: [
        'guvenlik',
        'kalite',
        'teslimat',
        'verimlilik',
        'kalibrasyon'
      ],

      ozetUstSiralama: [
        'notlar',
        'personel'
      ],

      ozetKartSiralama: [
        'kaza',
        'skt',
        'aksiyonlar'
      ]
    },

    sessions: [],

    auditLog: [],

    departmanlar: [
      'Hammadde Laboratuvarı'
    ],

    unvanlar: [
      'Bölüm Sorumlusu',
      'Kalite Kontrol Uzmanı / Vardiya Sorumlusu',
      'Kalite Kontrol Kıdemli Analisti',
      'Kalite Kontrol Uzman Analisti',
      'Kalite Kontrol Analisti',
      'Kalite Kontrol Uzman Teknisyeni',
      'Kalite Kontrol Teknisyeni'
    ],

    asdSapmaKayitlari: []
  };
}

// ============================================================
// DB NORMALIZE
// Eski db.json yapisiyla uyumluluk
// ============================================================

function normalizeDB(parsed) {
  const def = defaultDB();

  parsed = parsed || {};

  const merged = {
    ...def,
    ...parsed
  };

  merged.ayarlar = {
    ...def.ayarlar,
    ...(parsed.ayarlar || {})
  };

  merged.ayarlar.categoryColors = {
    ...def.ayarlar.categoryColors,
    ...((parsed.ayarlar || {}).categoryColors || {})
  };

  merged.ayarlar.gunlukSiralama =
    (
      (parsed.ayarlar || {}).gunlukSiralama &&
      (parsed.ayarlar || {}).gunlukSiralama.length === 5
    )
      ? parsed.ayarlar.gunlukSiralama
      : def.ayarlar.gunlukSiralama;

  merged.ayarlar.ozetUstSiralama =
    (
      (parsed.ayarlar || {}).ozetUstSiralama &&
      (parsed.ayarlar || {}).ozetUstSiralama.length === 2
    )
      ? parsed.ayarlar.ozetUstSiralama
      : def.ayarlar.ozetUstSiralama;

  merged.ayarlar.ozetKartSiralama =
    (
      (parsed.ayarlar || {}).ozetKartSiralama &&
      (parsed.ayarlar || {}).ozetKartSiralama.length === 3
    )
      ? parsed.ayarlar.ozetKartSiralama
      : def.ayarlar.ozetKartSiralama;

  merged.duyurular = {
    ...def.duyurular,
    ...(parsed.duyurular || {})
  };

  merged.sktTakip = parsed.sktTakip || [];

  merged.sessions = parsed.sessions || [];

  merged.auditLog = parsed.auditLog || [];

  merged.departmanlar =
    parsed.departmanlar && parsed.departmanlar.length
      ? parsed.departmanlar
      : def.departmanlar;

  merged.unvanlar =
    parsed.unvanlar && parsed.unvanlar.length
      ? parsed.unvanlar
      : def.unvanlar;

  merged.asdSapmaKayitlari =
    parsed.asdSapmaKayitlari || [];

  // Eski rol isimleriyle kaydedilmis personel varsa (izleyici/yazici/kidemli)
  // her yuklemede/yazmada otomatik olarak yeni 3 seviyeli role gecirilir.
  merged.personel = (merged.personel || []).map(p => ({
    ...p,
    rol: normalizeRol(p.rol)
  }));

  return merged;
}

// ============================================================
// SUPABASE'DEN DB YUKLE
// ============================================================

async function loadDB() {
  const result = await pool.query(
    `
      SELECT data
      FROM dashboard_data
      WHERE id = $1
      LIMIT 1
    `,
    [DASHBOARD_DATA_ID]
  );

  if (result.rows.length === 0) {
    console.log('Supabase: dashboard_data kaydi bulunamadi.');
    console.log('Yeni varsayilan veritabani olusturuluyor...');

    const initial = defaultDB();

    await pool.query(
      `
        INSERT INTO dashboard_data (id, data, updated_at)
        VALUES ($1, $2::jsonb, NOW())
      `,
      [
        DASHBOARD_DATA_ID,
        JSON.stringify(initial)
      ]
    );

    dbCache = initial;

    return dbCache;
  }

  dbCache = normalizeDB(result.rows[0].data);

  console.log('Supabase: mevcut dashboard verileri yuklendi.');

  return dbCache;
}

// ============================================================
// DB OKUMA
// ============================================================

function readDB() {
  if (!dbCache) {
    throw new Error(
      'Veritabani henuz yuklenmedi. Sunucu baslatma islemi tamamlanmamis.'
    );
  }

  return dbCache;
}

// ============================================================
// DB YAZMA
// ============================================================

function writeDB(db) {
  dbCache = normalizeDB(db);

  const dataToSave = JSON.stringify(dbCache);

  dbWriteQueue = dbWriteQueue
    .catch(() => {})
    .then(async () => {
      await pool.query(
        `
          UPDATE dashboard_data
          SET
            data = $1::jsonb,
            updated_at = NOW()
          WHERE id = $2
        `,
        [
          dataToSave,
          DASHBOARD_DATA_ID
        ]
      );
    });

  return dbWriteQueue;
}

// ============================================================
// SESSION / CURRENT USER
// ============================================================

app.use((req, res, next) => {
  const cookies = parseCookies(req);
  const token = cookies['wct_session'];

  if (token) {
    try {
      const db = readDB();

      const session = (db.sessions || []).find(
        s => s.token === token
      );

      if (session) {
        const user = (db.personel || []).find(
          p => p.id === session.personelId
        );

        if (user) {
          req.currentUser = user;
        }
      }
    } catch {
      // DB henuz hazir degilse devam edilir.
    }
  }

  next();
});

// ============================================================
// LOGIN
// ============================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const {
      kullaniciAdi,
      sifre
    } = req.body || {};

    const db = readDB();

    const user = (db.personel || []).find(
      p =>
        p.kullaniciAdi &&
        p.kullaniciAdi
          .toLowerCase() ===
        String(kullaniciAdi || '')
          .toLowerCase()
          .trim()
    );

    if (
      !user ||
      !verifyPassword(
        sifre || '',
        user.sifreSalt,
        user.sifreHash
      )
    ) {
      return res.status(401).json({
        error: 'Kullanıcı adı veya şifre hatalı.'
      });
    }

    const token = crypto
      .randomBytes(32)
      .toString('hex');

    db.sessions = db.sessions || [];

    db.sessions.push({
      token,
      personelId: user.id,
      createdAt: new Date().toISOString()
    });

    await writeDB(db);

    res.setHeader(
      'Set-Cookie',
      `wct_session=${token}; HttpOnly; Path=/; Max-Age=31536000; SameSite=Lax`
    );

    res.json({
      ok: true,
      user: {
        id: user.id,
        ad: user.ad,
        rol: user.rol,
        kullaniciAdi: user.kullaniciAdi
      }
    });
  } catch (err) {
    console.error('LOGIN HATASI:', err);

    res.status(500).json({
      error: 'Sunucu hatası oluştu.'
    });
  }
});

// ============================================================
// LOGOUT
// ============================================================

app.post('/api/auth/logout', async (req, res) => {
  try {
    const cookies = parseCookies(req);
    const token = cookies['wct_session'];

    if (token) {
      const db = readDB();

      db.sessions = (db.sessions || [])
        .filter(s => s.token !== token);

      await writeDB(db);
    }

    res.setHeader(
      'Set-Cookie',
      `wct_session=; HttpOnly; Path=/; Max-Age=0`
    );

    res.json({
      ok: true
    });
  } catch (err) {
    console.error('LOGOUT HATASI:', err);

    res.status(500).json({
      error: 'Sunucu hatası oluştu.'
    });
  }
});

// ============================================================
// CURRENT USER
// ============================================================

app.get('/api/auth/me', (req, res) => {
  if (!req.currentUser) {
    return res.status(401).json({
      error: 'Giriş yapılmamış'
    });
  }

  const u = req.currentUser;

  res.json({
    id: u.id,
    ad: u.ad,
    rol: u.rol,
    kullaniciAdi: u.kullaniciAdi
  });
});

// ============================================================
// API AUTH
// ============================================================

app.use('/api', (req, res, next) => {
  if (
    req.path.startsWith('/auth/') ||
    req.path === '/version'
  ) {
    return next();
  }

  if (!req.currentUser) {
    return res.status(401).json({
      error: 'Giriş yapmanız gerekiyor.'
    });
  }

  next();
});

// ============================================================
// ROLE
// ============================================================

function requireRole(minRol) {
  return (req, res, next) => {
    if (
      rolSeviyesi(req.currentUser) <
      ROL_SEVIYE[minRol]
    ) {
      return res.status(403).json({
        error: 'Bu işlem için yetkiniz yok.'
      });
    }

    next();
  };
}

// ============================================================
// AUDIT
// ============================================================

function auditEkle(db, req, islem, detay) {
  db.auditLog = db.auditLog || [];

  db.auditLog.unshift({
    id:
      Date.now().toString() +
      Math.random().toString(36).slice(2, 6),

    zaman: new Date().toISOString(),

    personelId: req.currentUser
      ? req.currentUser.id
      : '',

    personelAd: req.currentUser
      ? req.currentUser.ad
      : 'Bilinmeyen',

    rol: req.currentUser
      ? req.currentUser.rol
      : '',

    islem,

    detay: detay || ''
  });

  if (db.auditLog.length > 1000) {
    db.auditLog =
      db.auditLog.slice(0, 1000);
  }
}

// ============================================================
// GUNLUK KATEGORI VERILERI
// ============================================================

app.get(
  '/api/data/:category/:yearMonth',
  (req, res) => {
    const {
      category,
      yearMonth
    } = req.params;

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'Gecersiz kategori'
      });
    }

    const db = readDB();

    const data =
      (
        db[category] &&
        db[category][yearMonth]
      ) || {};

    res.json(data);
  }
);

app.post(
  '/api/data/:category/:yearMonth/:day',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const {
        category,
        yearMonth,
        day
      } = req.params;

      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: 'Gecersiz kategori'
        });
      }

      const db = readDB();

      if (!db[category][yearMonth]) {
        db[category][yearMonth] = {};
      }

      const existing =
        db[category][yearMonth][day] || {};

      if (
        existing.reviewed === true &&
        rolSeviyesi(req.currentUser) <
          ROL_SEVIYE.admin
      ) {
        return res.status(403).json({
          error:
            'Bu gün zaten kaydedilmiş ve kilitlenmiş. Değiştirmek için admin yetkisi gerekir.'
        });
      }

      const merged = {
        ...existing,
        ...req.body
      };

      Object.keys(merged).forEach(k => {
        if (merged[k] === null) {
          delete merged[k];
        }
      });

      db[category][yearMonth][day] =
        merged;

      auditEkle(
        db,
        req,
        `${category} verisi kaydedildi`,
        `${yearMonth} ayı, ${day}. gün`
      );

      await writeDB(db);

      res.json(
        db[category][yearMonth][day]
      );
    } catch (err) {
      console.error(
        'KATEGORI KAYDETME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Veri kaydedilemedi.'
      });
    }
  }
);

app.delete(
  '/api/data/:category/:yearMonth/:day',
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        category,
        yearMonth,
        day
      } = req.params;

      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({
          error: 'Gecersiz kategori'
        });
      }

      const db = readDB();

      const existing =
        (
          db[category][yearMonth] &&
          db[category][yearMonth][day]
        ) || {};

      if (
        existing.reviewed === true &&
        rolSeviyesi(req.currentUser) <
          ROL_SEVIYE.admin
      ) {
        return res.status(403).json({
          error:
            'Bu gün zaten kaydedilmiş ve kilitlenmiş. Silmek için admin yetkisi gerekir.'
        });
      }

      if (db[category][yearMonth]) {
        delete db[category][yearMonth][day];
      }

      auditEkle(
        db,
        req,
        `${category} günü temizlendi`,
        `${yearMonth} ayı, ${day}. gün`
      );

      await writeDB(db);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error(
        'KATEGORI SILME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Veri silinemedi.'
      });
    }
  }
);

// ============================================================
// PERSONEL
// ============================================================

app.get('/api/personel', (req, res) => {
  const db = readDB();

  const safeList =
    (db.personel || []).map(
      ({
        sifreHash,
        sifreSalt,
        ...rest
      }) => rest
    );

  res.json(safeList);
});

app.post(
  '/api/personel',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB();

      const newPerson = {
        id: Date.now().toString(),
        ad: req.body.ad || '',
        departman: req.body.departman || '',
        unvan: req.body.unvan || '',
        fotoBase64: req.body.fotoBase64 || '',
        sorumluluklar:
          Array.isArray(req.body.sorumluluklar)
            ? req.body.sorumluluklar
            : [],
        kullaniciAdi:
          req.body.kullaniciAdi
            ? String(
                req.body.kullaniciAdi
              ).trim()
            : '',
        rol: normalizeRol(req.body.rol)
      };

      if (newPerson.kullaniciAdi) {
        if (
          (db.personel || []).some(
            p =>
              p.kullaniciAdi &&
              p.kullaniciAdi.toLowerCase() ===
                newPerson.kullaniciAdi.toLowerCase()
          )
        ) {
          return res.status(400).json({
            error:
              'Bu kullanıcı adı zaten kullanılıyor.'
          });
        }

        if (!req.body.sifre) {
          return res.status(400).json({
            error:
              'Kullanıcı adı belirttiyseniz bir şifre de girmelisiniz.'
          });
        }

        const {
          salt,
          hash
        } = hashPassword(
          req.body.sifre
        );

        newPerson.sifreSalt = salt;
        newPerson.sifreHash = hash;
      }

      db.personel = db.personel || [];

      db.personel.push(newPerson);

      auditEkle(
        db,
        req,
        'Personel eklendi',
        newPerson.ad +
          (
            newPerson.kullaniciAdi
              ? ` (kullanıcı: ${newPerson.kullaniciAdi}, rol: ${newPerson.rol})`
              : ''
          )
      );

      await writeDB(db);

      const {
        sifreHash,
        sifreSalt,
        ...safePerson
      } = newPerson;

      res.json(safePerson);
    } catch (err) {
      console.error(
        'PERSONEL EKLEME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Personel eklenemedi.'
      });
    }
  }
);

app.put(
  '/api/personel/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB();

      const idx =
        (db.personel || []).findIndex(
          p =>
            p.id === req.params.id
        );

      if (idx === -1) {
        return res.status(404).json({
          error: 'Personel bulunamadi'
        });
      }

      const body = {
        ...req.body
      };

      if (body.kullaniciAdi) {
        body.kullaniciAdi =
          String(
            body.kullaniciAdi
          ).trim();

        const cakisan =
          (db.personel || []).some(
            p =>
              p.id !== req.params.id &&
              p.kullaniciAdi &&
              p.kullaniciAdi.toLowerCase() ===
                body.kullaniciAdi.toLowerCase()
          );

        if (cakisan) {
          return res.status(400).json({
            error:
              'Bu kullanıcı adı zaten kullanılıyor.'
          });
        }
      }

      if (body.sifre) {
        const {
          salt,
          hash
        } = hashPassword(
          body.sifre
        );

        body.sifreSalt = salt;
        body.sifreHash = hash;
      }

      delete body.sifre;

      if (body.rol) {
        body.rol = normalizeRol(body.rol);

        // Sistemdeki son admin'in rolu, kendisi dahil, dusurulemez;
        // aksi halde paneli yonetecek kimse kalmaz.
        if (body.rol !== 'admin') {
          const hedefKisi =
            (db.personel || []).find(
              p => p.id === req.params.id
            );

          if (hedefKisi && hedefKisi.rol === 'admin') {
            const digerAdminSayisi =
              (db.personel || []).filter(
                p =>
                  p.id !== req.params.id &&
                  normalizeRol(p.rol) === 'admin'
              ).length;

            if (digerAdminSayisi === 0) {
              return res.status(400).json({
                error:
                  'Sistemde en az bir admin kalmalı. Bu kişinin rolünü değiştirmeden önce başka bir admin atayın.'
              });
            }
          }
        }
      }

      db.personel[idx] = {
        ...db.personel[idx],
        ...body
      };

      auditEkle(
        db,
        req,
        'Personel güncellendi',
        db.personel[idx].ad
      );

      await writeDB(db);

      const {
        sifreHash,
        sifreSalt,
        ...safePerson
      } = db.personel[idx];

      res.json(safePerson);
    } catch (err) {
      console.error(
        'PERSONEL GUNCELLEME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Personel güncellenemedi.'
      });
    }
  }
);

app.delete(
  '/api/personel/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB();

      const kisi =
        (db.personel || []).find(
          p =>
            p.id === req.params.id
        );

      db.personel =
        (db.personel || []).filter(
          p =>
            p.id !== req.params.id
        );

      db.sessions =
        (db.sessions || []).filter(
          s =>
            s.personelId !==
            req.params.id
        );

      auditEkle(
        db,
        req,
        'Personel silindi',
        kisi
          ? kisi.ad
          : req.params.id
      );

      await writeDB(db);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error(
        'PERSONEL SILME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Personel silinemedi.'
      });
    }
  }
);

// ============================================================
// DEPARTMANLAR
// ============================================================

app.get(
  '/api/departmanlar',
  (req, res) => {
    const db = readDB();

    res.json(
      db.departmanlar || []
    );
  }
);

app.post(
  '/api/departmanlar',
  requireRole('admin'),
  async (req, res) => {
    const ad = String(
      (req.body && req.body.ad) || ''
    ).trim();

    if (!ad) {
      return res.status(400).json({
        error:
          'Departman adı boş olamaz.'
      });
    }

    const db = readDB();

    db.departmanlar =
      db.departmanlar || [];

    if (
      !db.departmanlar.some(
        d =>
          d.toLowerCase() ===
          ad.toLowerCase()
      )
    ) {
      db.departmanlar.push(ad);

      auditEkle(
        db,
        req,
        'Departman eklendi',
        ad
      );

      await writeDB(db);
    }

    res.json(
      db.departmanlar
    );
  }
);

app.delete(
  '/api/departmanlar/:ad',
  requireRole('admin'),
  async (req, res) => {
    const db = readDB();

    db.departmanlar =
      (db.departmanlar || []).filter(
        d =>
          d !== req.params.ad
      );

    auditEkle(
      db,
      req,
      'Departman silindi',
      req.params.ad
    );

    await writeDB(db);

    res.json(
      db.departmanlar
    );
  }
);

// ============================================================
// UNVANLAR
// ============================================================

app.get(
  '/api/unvanlar',
  (req, res) => {
    const db = readDB();

    res.json(
      db.unvanlar || []
    );
  }
);

app.post(
  '/api/unvanlar',
  requireRole('admin'),
  async (req, res) => {
    const ad = String(
      (req.body && req.body.ad) || ''
    ).trim();

    if (!ad) {
      return res.status(400).json({
        error:
          'Ünvan adı boş olamaz.'
      });
    }

    const db = readDB();

    db.unvanlar =
      db.unvanlar || [];

    if (
      !db.unvanlar.some(
        u =>
          u.toLowerCase() ===
          ad.toLowerCase()
      )
    ) {
      db.unvanlar.push(ad);

      auditEkle(
        db,
        req,
        'Ünvan eklendi',
        ad
      );

      await writeDB(db);
    }

    res.json(
      db.unvanlar
    );
  }
);

app.delete(
  '/api/unvanlar/:ad',
  requireRole('admin'),
  async (req, res) => {
    const db = readDB();

    db.unvanlar =
      (db.unvanlar || []).filter(
        u =>
          u !== req.params.ad
      );

    auditEkle(
      db,
      req,
      'Ünvan silindi',
      req.params.ad
    );

    await writeDB(db);

    res.json(
      db.unvanlar
    );
  }
);

// ============================================================
// AUDIT
// ============================================================

app.get(
  '/api/audit',
  requireRole('admin'),
  (req, res) => {
    const db = readDB();

    res.json(
      db.auditLog || []
    );
  }
);

// ============================================================
// AYARLAR
// ============================================================

app.get(
  '/api/ayarlar',
  (req, res) => {
    const db = readDB();

    res.json(
      db.ayarlar || {
        bolumAdi: ''
      }
    );
  }
);

app.post(
  '/api/ayarlar',
  requireRole('admin'),
  async (req, res) => {
    const db = readDB();

    db.ayarlar = {
      ...db.ayarlar,
      ...req.body
    };

    await writeDB(db);

    res.json(
      db.ayarlar
    );
  }
);

// ============================================================
// DUYURULAR
// ============================================================

app.get(
  '/api/duyurular',
  (req, res) => {
    const db = readDB();

    res.json(
      db.duyurular || {}
    );
  }
);

app.post(
  '/api/duyurular',
  requireRole('kontrolcu'),
  async (req, res) => {
    const db = readDB();

    db.duyurular = {
      ...db.duyurular,
      ...req.body
    };

    await writeDB(db);

    res.json(
      db.duyurular
    );
  }
);

// ============================================================
// SKT
// ============================================================

app.get(
  '/api/skt',
  (req, res) => {
    const db = readDB();

    res.json(
      db.sktTakip || []
    );
  }
);

app.post(
  '/api/skt',
  requireRole('kontrolcu'),
  async (req, res) => {
    const db = readDB();

    const newItem = {
      id: Date.now().toString(),
      ad: req.body.ad || '',
      hazirlanmaTarihi:
        req.body.hazirlanmaTarihi || '',
      sureGun:
        Number(req.body.sureGun) || 0,
      olusturmaTarihi:
        new Date().toISOString()
    };

    db.sktTakip =
      db.sktTakip || [];

    db.sktTakip.push(
      newItem
    );

    await writeDB(db);

    res.json(newItem);
  }
);

app.delete(
  '/api/skt/:id',
  requireRole('admin'),
  async (req, res) => {
    const db = readDB();

    db.sktTakip =
      (db.sktTakip || []).filter(
        s =>
          s.id !== req.params.id
      );

    await writeDB(db);

    res.json({
      ok: true
    });
  }
);

// ============================================================
// AKSIYONLAR
// ============================================================

app.get(
  '/api/actions',
  (req, res) => {
    const db = readDB();

    res.json(
      db.aksiyonlar || []
    );
  }
);

app.post(
  '/api/actions',
  requireRole('kontrolcu'),
  async (req, res) => {
    const db = readDB();

    const newAction = {
      id: Date.now().toString(),
      baslik: req.body.baslik || '',
      aciklama: req.body.aciklama || '',
      baslangic: req.body.baslangic || '',
      bitis: req.body.bitis || '',
      durum:
        req.body.durum ||
        'Devam ediyor',
      sahibiId:
        req.body.sahibiId || '',
      olusturmaTarihi:
        new Date().toISOString()
    };
    db.aksiyonlar = db.aksiyonlar || [];

    db.aksiyonlar.push(newAction);

    auditEkle(
      db,
      req,
      'Aksiyon eklendi',
      newAction.baslik
    );

    await writeDB(db);

    res.json(newAction);
  }
);

app.put(
  '/api/actions/:id',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB();

      const idx =
        (db.aksiyonlar || []).findIndex(
          a => a.id === req.params.id
        );

      if (idx === -1) {
        return res.status(404).json({
          error: 'Aksiyon bulunamadi.'
        });
      }

      db.aksiyonlar[idx] = {
        ...db.aksiyonlar[idx],
        ...req.body,
        id: db.aksiyonlar[idx].id
      };

      auditEkle(
        db,
        req,
        'Aksiyon güncellendi',
        db.aksiyonlar[idx].baslik || req.params.id
      );

      await writeDB(db);

      res.json(db.aksiyonlar[idx]);
    } catch (err) {
      console.error('AKSIYON GUNCELLEME HATASI:', err);

      res.status(500).json({
        error: 'Aksiyon güncellenemedi.'
      });
    }
  }
);

app.delete(
  '/api/actions/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB();

      const action =
        (db.aksiyonlar || []).find(
          a => a.id === req.params.id
        );

      db.aksiyonlar =
        (db.aksiyonlar || []).filter(
          a => a.id !== req.params.id
        );

      auditEkle(
        db,
        req,
        'Aksiyon silindi',
        action
          ? action.baslik
          : req.params.id
      );

      await writeDB(db);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error('AKSIYON SILME HATASI:', err);

      res.status(500).json({
        error: 'Aksiyon silinemedi.'
      });
    }
  }
);

// ============================================================
// TOPLANTI NOTLARI
// ============================================================

app.get(
  '/api/notlar',
  (req, res) => {
    const db = readDB();

    res.json(
      db.toplantiNotlari || []
    );
  }
);

app.post(
  '/api/notlar',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB();

      const newNote = {
        id: Date.now().toString(),
        baslik: req.body.baslik || '',
        icerik: req.body.icerik || '',
        tarih:
          req.body.tarih ||
          new Date().toISOString(),
        olusturmaTarihi:
          new Date().toISOString()
      };

      db.toplantiNotlari =
        db.toplantiNotlari || [];

      db.toplantiNotlari.push(newNote);

      auditEkle(
        db,
        req,
        'Toplantı notu eklendi',
        newNote.baslik
      );

      await writeDB(db);

      res.json(newNote);
    } catch (err) {
      console.error(
        'TOPLANTI NOTU EKLEME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Toplantı notu eklenemedi.'
      });
    }
  }
);

app.put(
  '/api/notlar/:id',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB();

      const idx =
        (db.toplantiNotlari || []).findIndex(
          n => n.id === req.params.id
        );

      if (idx === -1) {
        return res.status(404).json({
          error: 'Toplantı notu bulunamadı.'
        });
      }

      db.toplantiNotlari[idx] = {
        ...db.toplantiNotlari[idx],
        ...req.body,
        id: db.toplantiNotlari[idx].id
      };

      auditEkle(
        db,
        req,
        'Toplantı notu güncellendi',
        db.toplantiNotlari[idx].baslik ||
          req.params.id
      );

      await writeDB(db);

      res.json(
        db.toplantiNotlari[idx]
      );
    } catch (err) {
      console.error(
        'TOPLANTI NOTU GUNCELLEME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Toplantı notu güncellenemedi.'
      });
    }
  }
);

app.delete(
  '/api/notlar/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB();

      const note =
        (db.toplantiNotlari || []).find(
          n => n.id === req.params.id
        );

      db.toplantiNotlari =
        (db.toplantiNotlari || []).filter(
          n => n.id !== req.params.id
        );

      auditEkle(
        db,
        req,
        'Toplantı notu silindi',
        note
          ? note.baslik
          : req.params.id
      );

      await writeDB(db);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error(
        'TOPLANTI NOTU SILME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Toplantı notu silinemedi.'
      });
    }
  }
);

// ============================================================
// KATILIM
// ============================================================

app.get(
  '/api/katilim/:tarih',
  (req, res) => {
    const db = readDB();

    res.json(
      (db.katilim || {})[req.params.tarih] || {}
    );
  }
);

app.post(
  '/api/katilim/:tarih',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB();

      db.katilim =
        db.katilim || {};

      db.katilim[req.params.tarih] =
        req.body || {};

      auditEkle(
        db,
        req,
        'Katılım kaydı güncellendi',
        req.params.tarih
      );

      await writeDB(db);

      res.json(
        db.katilim[req.params.tarih]
      );
    } catch (err) {
      console.error(
        'KATILIM KAYDETME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Katılım kaydedilemedi.'
      });
    }
  }
);

app.get(
  '/api/all-katilim',
  (req, res) => {
    const db = readDB();

    res.json(
      db.katilim || {}
    );
  }
);

// ============================================================
// ALL CATEGORY DATA
// ============================================================

app.get(
  '/api/all/:category',
  (req, res) => {
    const {
      category
    } = req.params;

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: 'Gecersiz kategori'
      });
    }

    const db = readDB();

    res.json(
      db[category] || {}
    );
  }
);

// ============================================================
// ASD SAPMA KAYITLARI
// ============================================================

app.get(
  '/api/asd-sapma',
  (req, res) => {
    const db = readDB();

    res.json(
      db.asdSapmaKayitlari || []
    );
  }
);

app.post(
  '/api/asd-sapma',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB();

      const kayit = {
        id: Date.now().toString(),
        ...req.body,
        olusturmaTarihi:
          new Date().toISOString()
      };

      db.asdSapmaKayitlari =
        db.asdSapmaKayitlari || [];

      db.asdSapmaKayitlari.push(kayit);

      auditEkle(
        db,
        req,
        'ASD sapma kaydı eklendi',
        kayit.id
      );

      await writeDB(db);

      res.json(kayit);
    } catch (err) {
      console.error(
        'ASD SAPMA EKLEME HATASI:',
        err
      );

      res.status(500).json({
        error: 'ASD sapma kaydı eklenemedi.'
      });
    }
  }
);

app.put(
  '/api/asd-sapma/:id',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB();

      const idx =
        (db.asdSapmaKayitlari || []).findIndex(
          x => x.id === req.params.id
        );

      if (idx === -1) {
        return res.status(404).json({
          error: 'ASD sapma kaydı bulunamadı.'
        });
      }

      db.asdSapmaKayitlari[idx] = {
        ...db.asdSapmaKayitlari[idx],
        ...req.body,
        id: db.asdSapmaKayitlari[idx].id
      };

      auditEkle(
        db,
        req,
        'ASD sapma kaydı güncellendi',
        req.params.id
      );

      await writeDB(db);

      res.json(
        db.asdSapmaKayitlari[idx]
      );
    } catch (err) {
      console.error(
        'ASD SAPMA GUNCELLEME HATASI:',
        err
      );

      res.status(500).json({
        error: 'ASD sapma kaydı güncellenemedi.'
      });
    }
  }
);

app.delete(
  '/api/asd-sapma/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB();

      db.asdSapmaKayitlari =
        (db.asdSapmaKayitlari || []).filter(
          x => x.id !== req.params.id
        );

      auditEkle(
        db,
        req,
        'ASD sapma kaydı silindi',
        req.params.id
      );

      await writeDB(db);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error(
        'ASD SAPMA SILME HATASI:',
        err
      );

      res.status(500).json({
        error: 'ASD sapma kaydı silinemedi.'
      });
    }
  }
);

// ============================================================
// ILK ADMIN
// ============================================================

function ensureInitialAdmin(db) {
  db.personel = db.personel || [];

  const adminExists =
    db.personel.some(
      p =>
        p.rol === 'admin' &&
        p.kullaniciAdi
    );

  if (adminExists) {
    return false;
  }

  /*
   * Eğer eski db.json içinde personel varsa
   * mevcut kayıtları koruyoruz.
   *
   * Hiç admin yoksa sadece güvenli bir ilk admin
   * oluşturuyoruz.
   */

  const {
    salt,
    hash
  } = hashPassword('admin123');

  db.personel.push({
    id: Date.now().toString(),
    ad: 'Sistem Yöneticisi',
    departman: 'Hammadde Laboratuvarı',
    unvan: 'Bölüm Sorumlusu',
    fotoBase64: '',
    sorumluluklar: [],
    kullaniciAdi: 'admin',
    rol: 'admin',
    sifreSalt: salt,
    sifreHash: hash
  });

  return true;
}

// ============================================================
// HEALTH
// ============================================================

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      ok: true,
      database: 'supabase',
      version: APP_VERSION,
      time: new Date().toISOString()
    });
  } catch (err) {
    console.error('HEALTH DB HATASI:', err);

    res.status(500).json({
      ok: false,
      database: 'error'
    });
  }
});

// ============================================================
// 404 API
// ============================================================

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint bulunamadı.'
  });
});

// ============================================================
// GLOBAL ERROR
// ============================================================

app.use((err, req, res, next) => {
  console.error('GLOBAL SERVER HATASI:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Beklenmeyen bir sunucu hatası oluştu.'
  });
});

// ============================================================
// SERVER START
// ============================================================

async function startServer() {
  try {
    console.log('');
    console.log('========================================================');
    console.log('WCT DASHBOARD');
    console.log('Supabase PostgreSQL Edition');
    console.log('========================================================');

    console.log('1) Supabase bağlantısı test ediliyor...');

    await pool.query('SELECT NOW()');

    console.log(
      '   Supabase bağlantısı BASARILI.'
    );

    console.log('2) Veritabanı yükleniyor...');

    await loadDB();

    console.log(
      '   Veritabanı BASARIYLA yüklendi.'
    );

    console.log(
      '3) İlk admin kontrol ediliyor...'
    );

    const db = readDB();

    if (ensureInitialAdmin(db)) {
      await writeDB(db);

      console.log(
        '   İlk admin oluşturuldu.'
      );
      console.log(
        '   Kullanıcı adı: admin'
      );
      console.log(
        '   Şifre: admin123'
      );
      console.log(
        '   NOT: İlk girişten sonra şifreyi değiştirin.'
      );
    } else {
      console.log(
        '   Mevcut admin bulundu.'
      );
    }

    console.log(
      '4) Sunucu başlatılıyor...'
    );

    app.listen(PORT, () => {
      console.log('');
      console.log('========================================================');
      console.log(
        `WCT Dashboard sunucusu çalışıyor: http://localhost:${PORT}`
      );
      console.log(
        `Sürüm: ${APP_VERSION}`
      );
      console.log(
        'Veritabanı: Supabase PostgreSQL'
      );
      console.log('========================================================');
      console.log('');
    });
  } catch (err) {
    console.error('');
    console.error('========================================================');
    console.error('SUNUCU BAŞLATILAMADI');
    console.error('========================================================');
    console.error(err);
    console.error('========================================================');

    try {
      await pool.end();
    } catch {}

    process.exit(1);
  }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown(signal) {
  console.log('');
  console.log(
    `${signal} alındı. Sunucu kapatılıyor...`
  );

  try {
    await dbWriteQueue;
  } catch (err) {
    console.error(
      'Bekleyen DB yazma hatası:',
      err
    );
  }

  try {
    await pool.end();
  } catch (err) {
    console.error(
      'Pool kapatma hatası:',
      err
    );
  }

  console.log(
    'Supabase bağlantısı kapatıldı.'
  );

  process.exit(0);
}

process.on(
  'SIGINT',
  () => shutdown('SIGINT')
);

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM')
);

// ============================================================
// BASLAT
// ============================================================

startServer();
