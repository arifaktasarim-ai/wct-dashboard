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

const APP_VERSION = 'v2026-10-08-2';

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

function defaultBolumVerisi() {
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
        'ekipmanAriza',
        'asdSapma',
        'personel'
      ],

      ozetKartSiralama: [
        'kaza',
        'skt',
        'aksiyonlar'
      ]
    },

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

    asdSapmaKayitlari: [],

    // Ayarlar > Ekipman Ekle / Cikar (sadece admin yonetir)
    ekipmanlar: [],

    // Gunluk Takip > Verimlilik'te acilan arizali/eksik ekipman kayitlari
    ekipmanArizaKayitlari: []
  };
}

// ============================================================
// BOLUM VERISI NORMALIZE
// Eski db.json yapisiyla uyumluluk (bir bolumun kendi verisi icin)
// ============================================================

function normalizeBolumVerisi(parsed) {
  const def = defaultBolumVerisi();

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

  // Ozet ust bloklari artik 4 oge: notlar, ekipmanAriza, asdSapma, personel.
  // Eski (3 ogeli) kayitlar kullanicinin kendi sirasi korunarak yukseltilir:
  // yeni 'ekipmanAriza' blogu 'notlar'in hemen altina eklenir.
  (function () {
    const BILINEN = ['notlar', 'ekipmanAriza', 'asdSapma', 'personel'];
    const eski = (parsed.ayarlar || {}).ozetUstSiralama;

    if (!Array.isArray(eski)) {
      merged.ayarlar.ozetUstSiralama = def.ayarlar.ozetUstSiralama;
      return;
    }

    const liste = [];
    eski.forEach(k => {
      if (BILINEN.includes(k) && !liste.includes(k)) liste.push(k);
    });

    if (!liste.includes('ekipmanAriza')) {
      const notlarIdx = liste.indexOf('notlar');
      liste.splice(notlarIdx === -1 ? 0 : notlarIdx + 1, 0, 'ekipmanAriza');
    }

    BILINEN.forEach(k => {
      if (!liste.includes(k)) liste.push(k);
    });

    merged.ayarlar.ozetUstSiralama =
      liste.length === BILINEN.length
        ? liste
        : def.ayarlar.ozetUstSiralama;
  })();

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

  merged.ekipmanlar =
    Array.isArray(parsed.ekipmanlar) ? parsed.ekipmanlar : [];

  merged.ekipmanArizaKayitlari =
    Array.isArray(parsed.ekipmanArizaKayitlari)
      ? parsed.ekipmanArizaKayitlari
      : [];

  // Eski rol isimleriyle kaydedilmis personel varsa (izleyici/yazici/kidemli)
  // her yuklemede/yazmada otomatik olarak yeni 3 seviyeli role gecirilir.
  merged.personel = (merged.personel || []).map(p => ({
    ...p,
    rol: normalizeRol(p.rol)
  }));

  return merged;
}

// ============================================================
// GLOBAL DB NORMALIZE
// Bolumler + oturumlar + her bolumun kendi verisi.
//
// ONEMLI: Eskiden (tek bolumlu donemde) tum veri (guvenlik, kalite,
// personel, katilim, sessions vb.) dogrudan en ust seviyedeydi. Asagidaki
// blok, "bolumVerileri" alani hic yoksa bunun eski/duz bir kayit oldugunu
// anlar ve TUM mevcut veriyi kaybetmeden tek seferlik olarak "Ana Bölüm"
// adinda bir bolume tasir. Bu gecis her sunucu aciliminda kontrol edilir
// ama sadece bir kez calisir (bolumVerileri bir kere olusunca bir daha bu
// dala girilmez).
// ============================================================

const VARSAYILAN_BOLUM_ID = 'bolum-varsayilan';

function normalizeGlobalDB(parsed) {
  parsed = parsed || {};

  if (!parsed.bolumVerileri) {
    const eskiBolumAdi =
      (parsed.ayarlar && parsed.ayarlar.bolumAdi && parsed.ayarlar.bolumAdi.trim()) ||
      'Ana Bölüm';

    const eskiSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];

    // "sessions" disindaki her sey bolume ozel veridir; oldugu gibi tasinir.
    const {
      sessions,
      ...bolumVerisiKismi
    } = parsed;

    console.log('   Eski (tek bölümlü) veri yapısı tespit edildi.');
    console.log(`   Tüm mevcut veriler "${eskiBolumAdi}" adlı bölüme taşınıyor...`);

    return {
      bolumler: [
        {
          id: VARSAYILAN_BOLUM_ID,
          ad: eskiBolumAdi,
          olusturmaTarihi: new Date().toISOString()
        }
      ],
      sessions: eskiSessions.map(s => ({
        ...s,
        bolumId: s.bolumId || VARSAYILAN_BOLUM_ID
      })),
      bolumVerileri: {
        [VARSAYILAN_BOLUM_ID]: normalizeBolumVerisi(bolumVerisiKismi)
      }
    };
  }

  const merged = {
    bolumler: Array.isArray(parsed.bolumler) ? parsed.bolumler : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    bolumVerileri: {}
  };

  const kaynakVeriler = parsed.bolumVerileri || {};

  merged.bolumler.forEach(bolum => {
    merged.bolumVerileri[bolum.id] = normalizeBolumVerisi(
      kaynakVeriler[bolum.id]
    );
  });

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

    const initial = {
      bolumler: [],
      sessions: [],
      bolumVerileri: {}
    };

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

  const mevcutData = result.rows[0].data;
  const eskiYapi = !mevcutData.bolumVerileri;

  dbCache = normalizeGlobalDB(mevcutData);

  console.log('Supabase: mevcut dashboard verileri yuklendi.');

  if (eskiYapi) {
    await persistDbCache();
    console.log('Supabase: eski tek bolumlu veri yeni bolum yapisina kalici olarak donusturuldu.');
  }

  return dbCache;
}

// ============================================================
// DB OKUMA (GLOBAL - bolumler listesi + oturumlar)
// ============================================================

function readGlobalDB() {
  if (!dbCache) {
    throw new Error(
      'Veritabani henuz yuklenmedi. Sunucu baslatma islemi tamamlanmamis.'
    );
  }

  return dbCache;
}

// ============================================================
// DB OKUMA (BOLUME OZEL)
// ============================================================

function readDB(bolumId) {
  const db = readGlobalDB();

  db.bolumVerileri = db.bolumVerileri || {};

  if (!bolumId || !db.bolumVerileri[bolumId]) {
    // Beklenmedik durum: gecerli bir bolum olmadan buraya gelinmemeli
    // (oturum ortasindaki middleware bunu zaten garanti eder). Yine de
    // veri kaybini onlemek icin bos bir bolum verisiyle devam ediyoruz.
    db.bolumVerileri[bolumId] = defaultBolumVerisi();
  }

  return db.bolumVerileri[bolumId];
}

// ============================================================
// DB YAZMA (SUPABASE'E KAYDET)
// ============================================================

function persistDbCache() {
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
// DB YAZMA (BOLUME OZEL)
// ============================================================

function writeDB(db, bolumId) {
  if (!bolumId) {
    throw new Error('writeDB: bolumId belirtilmeli.');
  }

  dbCache.bolumVerileri = dbCache.bolumVerileri || {};
  dbCache.bolumVerileri[bolumId] = normalizeBolumVerisi(db);

  return persistDbCache();
}

// ============================================================
// SESSION / CURRENT USER
// ============================================================

app.use((req, res, next) => {
  const cookies = parseCookies(req);
  const token = cookies['wct_session'];

  if (token) {
    try {
      const db = readGlobalDB();

      const session = (db.sessions || []).find(
        s => s.token === token
      );

      if (session) {
        const bolumVerisi =
          (db.bolumVerileri || {})[session.bolumId];

        const user =
          bolumVerisi &&
          (bolumVerisi.personel || []).find(
            p => p.id === session.personelId
          );

        if (user) {
          req.currentUser = user;
          req.currentBolumId = session.bolumId;
        }
      }
    } catch {
      // DB henuz hazir degilse devam edilir.
    }
  }

  next();
});

// ============================================================
// BOLUMLER (herkese acik liste - giris ekraninda kullanilir)
// ============================================================

app.get('/api/bolumler', (req, res) => {
  const db = readGlobalDB();

  res.json(
    (db.bolumler || []).map(b => ({
      id: b.id,
      ad: b.ad
    }))
  );
});

// ============================================================
// LOGIN
// ============================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const {
      bolumId,
      kullaniciAdi,
      sifre,
      beniHatirla
    } = req.body || {};

    const db = readGlobalDB();

    const bolumVerisi =
      bolumId && (db.bolumVerileri || {})[bolumId];

    if (!bolumVerisi) {
      return res.status(400).json({
        error: 'Geçersiz bölüm seçimi.'
      });
    }

    const user = (bolumVerisi.personel || []).find(
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
      bolumId,
      createdAt: new Date().toISOString()
    });

    await persistDbCache();

    // "Beni hatırla" isaretliyse cerezin omrunu 1 yil yapiyoruz; degilse
    // tarayici oturum cerezi olarak birakiyoruz (tarayici kapaninca silinir).
    const cookieOmru = beniHatirla
      ? '; Max-Age=31536000'
      : '';

    res.setHeader(
      'Set-Cookie',
      `wct_session=${token}; HttpOnly; Path=/${cookieOmru}; SameSite=Lax`
    );

    const bolum =
      (db.bolumler || []).find(b => b.id === bolumId);

    res.json({
      ok: true,
      user: {
        id: user.id,
        ad: user.ad,
        rol: user.rol,
        kullaniciAdi: user.kullaniciAdi,
        bolum: bolum
          ? { id: bolum.id, ad: bolum.ad }
          : null
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
// SIFRE YENILEME (tamamen kullanicinin kendi kontrolunde)
// ============================================================
// Onceki surumlerde sifre sifirlama admin uzerinden (once dogrudan sifre
// alani, sonra admin'in urettigi tek kullanimlik kod ile) yapiliyordu. Bu,
// admin'in her zaman kullanicilarin sifresini degistirebilmesi/gorebilmesi
// anlamina geldigi icin bir guvenlik/gizlilik sorunuydu. Bu surumde admin
// artik sifreye hic dokunamiyor: sadece kullanici olusturabiliyor (ilk
// sifre, kullanici adiyla ayni atanir) ve rol atayabiliyor. Sifreyi
// degistirmek/yenilemek tamamen kullanicinin kendisine aittir: giris
// ekranindaki "Şifre Yenile" ile MEVCUT sifresini girerek kimligini
// kanitlar ve yeni sifresini kendisi belirler.

app.post('/api/auth/sifre-yenile', async (req, res) => {
  try {
    const {
      bolumId,
      kullaniciAdi,
      mevcutSifre,
      yeniSifre
    } = req.body || {};

    if (!yeniSifre || String(yeniSifre).length < 4) {
      return res.status(400).json({
        error: 'Yeni şifre en az 4 karakter olmalıdır.'
      });
    }

    const db = readGlobalDB();

    const bolumVerisi =
      bolumId && (db.bolumVerileri || {})[bolumId];

    const user =
      bolumVerisi &&
      (bolumVerisi.personel || []).find(
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
        String(mevcutSifre || ''),
        user.sifreSalt,
        user.sifreHash
      )
    ) {
      return res.status(401).json({
        error: 'Kullanıcı adı veya mevcut şifre hatalı.'
      });
    }

    const {
      salt,
      hash
    } = hashPassword(yeniSifre);

    user.sifreSalt = salt;
    user.sifreHash = hash;

    // Sifre yenilendiginde, o kullaniciya ait tum eski oturumlar
    // guvenlik icin kapatilir (bu oturum dahil; yeni sifreyle tekrar
    // giris yapmasi gerekir).
    db.sessions = (db.sessions || []).filter(
      s => s.personelId !== user.id
    );

    await persistDbCache();

    res.json({
      ok: true
    });
  } catch (err) {
    console.error('SIFRE YENILEME HATASI:', err);

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
      const db = readGlobalDB();

      db.sessions = (db.sessions || [])
        .filter(s => s.token !== token);

      await persistDbCache();
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

  const globalDb = readGlobalDB();
  const bolum =
    (globalDb.bolumler || []).find(
      b => b.id === req.currentBolumId
    );

  res.json({
    id: u.id,
    ad: u.ad,
    rol: u.rol,
    kullaniciAdi: u.kullaniciAdi,
    bolum: bolum
      ? { id: bolum.id, ad: bolum.ad }
      : null
  });
});

// ============================================================
// API AUTH
// ============================================================

app.use('/api', (req, res, next) => {
  if (
    req.path.startsWith('/auth/') ||
    req.path === '/version' ||
    (req.method === 'GET' && req.path === '/bolumler')
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
// BOLUM OLUSTURMA (sadece admin)
// ============================================================

app.post(
  '/api/bolumler',
  requireRole('admin'),
  async (req, res) => {
    try {
      const ad = String(
        (req.body && req.body.ad) || ''
      ).trim();

      const yoneticiKullaniciAdi = String(
        (req.body && req.body.yoneticiKullaniciAdi) || ''
      ).trim();

      const yoneticiSifre =
        (req.body && req.body.yoneticiSifre) || '';

      if (!ad) {
        return res.status(400).json({
          error: 'Bölüm adı boş olamaz.'
        });
      }

      if (!yoneticiKullaniciAdi || !yoneticiSifre) {
        return res.status(400).json({
          error:
            'Yeni bölümün ilk yöneticisi için kullanıcı adı ve şifre girilmelidir.'
        });
      }

      if (yoneticiSifre.length < 4) {
        return res.status(400).json({
          error: 'Şifre en az 4 karakter olmalıdır.'
        });
      }

      const globalDb = readGlobalDB();

      globalDb.bolumler = globalDb.bolumler || [];
      globalDb.bolumVerileri = globalDb.bolumVerileri || {};

      const adCakisiyor = globalDb.bolumler.some(
        b => b.ad.toLowerCase() === ad.toLowerCase()
      );

      if (adCakisiyor) {
        return res.status(400).json({
          error: 'Bu isimde bir bölüm zaten var.'
        });
      }

      const bolumId =
        'bolum-' +
        Date.now().toString() +
        Math.random().toString(36).slice(2, 6);

      const {
        salt,
        hash
      } = hashPassword(yoneticiSifre);

      const yeniBolumVerisi = defaultBolumVerisi();
      yeniBolumVerisi.ayarlar.bolumAdi = ad;

      yeniBolumVerisi.personel.push({
        id: Date.now().toString(),
        ad: 'Bölüm Yöneticisi',
        departman: '',
        unvan: '',
        fotoBase64: '',
        sorumluluklar: [],
        kullaniciAdi: yoneticiKullaniciAdi,
        rol: 'admin',
        sifreSalt: salt,
        sifreHash: hash
      });

      globalDb.bolumler.push({
        id: bolumId,
        ad,
        olusturmaTarihi: new Date().toISOString()
      });

      globalDb.bolumVerileri[bolumId] = yeniBolumVerisi;

      // Bu islemi yapan admin'in KENDI bolumunun audit logina da yazilir.
      const kendiBolumDb =
        globalDb.bolumVerileri[req.currentBolumId];

      if (kendiBolumDb) {
        auditEkle(
          kendiBolumDb,
          req,
          'Yeni bölüm oluşturuldu',
          ad
        );
      }

      await persistDbCache();

      res.json({
        id: bolumId,
        ad
      });
    } catch (err) {
      console.error('BOLUM OLUSTURMA HATASI:', err);

      res.status(500).json({
        error: 'Bölüm oluşturulamadı.'
      });
    }
  }
);

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

    const db = readDB(req.currentBolumId);

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

      const db = readDB(req.currentBolumId);

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

      // "Kalite" kategorisinde, ASD/Sapma icin numara girilmis ama henuz
      // bir kayda baglanmamis (kayitId'si olmayan) her yeni oge icin
      // otomatik olarak hem ASD/Sapma kayit defterine (asdSapmaKayitlari)
      // hem de Aksiyonlar sayfasina bagli bir aksiyon acilir. Ayni oge
      // ikinci kez kaydedildiginde (kayitId zaten varsa) tekrar islenmez.
      let yeniAsdSapmaSayisi = 0;
      if (category === 'kalite') {
        ['asd', 'sapma'].forEach(alanAdi => {
          const liste = merged[alanAdi];
          if (!Array.isArray(liste)) return;

          liste.forEach(item => {
            if (!item || !item.numara || item.kayitId) return;

            const tur = alanAdi; // 'asd' | 'sapma'
            const tarih = `${yearMonth}-${String(day).padStart(2, '0')}`;

            const kayit = {
              id:
                Date.now().toString() +
                Math.random().toString(36).slice(2, 6),
              numara: item.numara,
              tur,
              personelId: item.personelId || '',
              tarih,
              neden: item.not || '',
              hammaddeAdi: item.hammaddeAdi || '',
              partiNo: item.partiNo || '',
              olusturmaTarihi: new Date().toISOString()
            };

            db.asdSapmaKayitlari = db.asdSapmaKayitlari || [];
            db.asdSapmaKayitlari.push(kayit);

            const yeniAksiyon = {
              id:
                Date.now().toString() +
                Math.random().toString(36).slice(2, 6) +
                'a',
              baslik: `${tur === 'asd' ? 'ASD' : 'Sapma'} ${item.numara} takibi`,
              aciklama: item.not || '',
              baslangic: tarih,
              bitis: '',
              durum: 'Devam ediyor',
              sahibiId: item.personelId || '',
              kaynakTur: tur,
              kaynakNumara: item.numara,
              olusturmaTarihi: new Date().toISOString()
            };

            db.aksiyonlar = db.aksiyonlar || [];
            db.aksiyonlar.push(yeniAksiyon);

            kayit.aksiyonId = yeniAksiyon.id;
            item.kayitId = kayit.id;

            yeniAsdSapmaSayisi++;
          });
        });
      }

      // "Verimlilik" kategorisinde, Arizali/Eksik Ekipman listesine eklenen ve
      // henuz bir kayda baglanmamis (kayitId'si olmayan) her yeni oge icin
      // otomatik olarak hem arizali ekipman kayit defterine
      // (ekipmanArizaKayitlari) hem de Aksiyonlar sayfasina bagli bir aksiyon
      // acilir. Ayni oge ikinci kez kaydedilince (kayitId varsa) tekrar islenmez.
      // Dogrulama, hicbir veri degistirilmeden ONCE yapilir.
      let yeniEkipmanArizaSayisi = 0;
      if (
        category === 'verimlilik' &&
        Array.isArray(merged.arizaliEkipmanList)
      ) {
        for (const item of merged.arizaliEkipmanList) {
          if (!item || item.kayitId) continue;

          const ekp = (db.ekipmanlar || []).find(
            e => e.id === item.ekipmanId
          );

          if (!ekp) {
            return res.status(400).json({
              error:
                'Seçilen ekipman bulunamadı. Ekipman listesi değişmiş olabilir; sayfayı yenileyip tekrar deneyin.'
            });
          }

          if (!String(item.arizaKodu || '').trim()) {
            return res.status(400).json({
              error:
                'Arızalı/Eksik ekipman için arıza kodu girilmelidir.'
            });
          }
        }

        merged.arizaliEkipmanList.forEach(item => {
          if (!item || item.kayitId) return;

          const ekp = (db.ekipmanlar || []).find(
            e => e.id === item.ekipmanId
          );

          const arizaKodu = String(item.arizaKodu).trim();
          const tarih = `${yearMonth}-${String(day).padStart(2, '0')}`;
          const rnd = Math.random().toString(36).slice(2, 6);

          const kayit = {
            id: 'arz' + Date.now().toString() + rnd,
            ekipmanId: ekp.id,
            ekipmanAd: ekp.ad,
            ekipmanNumara: ekp.numara,
            ekipmanMarka: ekp.marka,
            arizaKodu,
            aciklama: item.not || '',
            personelId: item.personelId || '',
            tarih,
            olusturanId: req.currentUser ? req.currentUser.id : '',
            olusturmaTarihi: new Date().toISOString()
          };

          const yeniAksiyon = {
            id:
              Date.now().toString() +
              Math.random().toString(36).slice(2, 6) +
              'e',
            baslik: `Arızalı/Eksik Ekipman: ${ekp.ad} (${ekp.numara}) — Arıza Kodu ${arizaKodu}`,
            aciklama: item.not || '',
            baslangic: tarih,
            bitis: '',
            durum: 'Devam ediyor',
            sahibiId: item.personelId || '',
            kaynakTur: 'ekipmanAriza',
            kaynakNumara: arizaKodu,
            ekipmanArizaId: kayit.id,
            olusturmaTarihi: new Date().toISOString()
          };

          db.ekipmanArizaKayitlari = db.ekipmanArizaKayitlari || [];
          db.ekipmanArizaKayitlari.push(kayit);

          db.aksiyonlar = db.aksiyonlar || [];
          db.aksiyonlar.push(yeniAksiyon);

          kayit.aksiyonId = yeniAksiyon.id;
          item.arizaKodu = arizaKodu;
          item.kayitId = kayit.id;

          yeniEkipmanArizaSayisi++;
        });

        // Eski "adet" alani (Ozet/renk hesabi) uyumlu kalsin: ekipman
        // secilmeden girilmis eski adet + listedeki ekipman sayisi.
        merged.arizaliEkipman =
          (Number(merged.arizaliEkipmanEski) || 0) +
          merged.arizaliEkipmanList.length;
      }

      db[category][yearMonth][day] =
        merged;

      auditEkle(
        db,
        req,
        `${category} verisi kaydedildi`,
        `${yearMonth} ayı, ${day}. gün`
      );

      if (yeniAsdSapmaSayisi > 0) {
        auditEkle(
          db,
          req,
          'ASD/Sapma numarasından otomatik aksiyon açıldı',
          `${yeniAsdSapmaSayisi} adet — ${yearMonth}/${day}`
        );
      }

      if (yeniEkipmanArizaSayisi > 0) {
        auditEkle(
          db,
          req,
          'Arızalı/Eksik ekipman kaydı ve otomatik aksiyon açıldı',
          `${yeniEkipmanArizaSayisi} adet — ${yearMonth}/${day}`
        );
      }

      await writeDB(db, req.currentBolumId);

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

      const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);

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
  const db = readDB(req.currentBolumId);

  const safeList =
    (db.personel || []).map(
      ({
        sifreHash,
        sifreSalt,
        guvenlikSorusu,
        guvenlikCevabiHash,
        guvenlikCevabiSalt,
        sifirlamaKoduHash,
        sifirlamaKoduSalt,
        sifirlamaKoduSonKullanma,
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
      const db = readDB(req.currentBolumId);
      const globalDb = readGlobalDB();

      const mevcutBolum =
        (globalDb.bolumler || []).find(
          b => b.id === req.currentBolumId
        );

      const departman =
        mevcutBolum ? mevcutBolum.ad : '';

      const newPerson = {
        id: Date.now().toString(),
        ad: req.body.ad || '',
        departman,
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

        // Admin sifreyi hicbir zaman dogrudan belirlemez. Ilk sifre,
        // kullanici adiyla ayni olacak sekilde otomatik atanir; kullanici
        // ilk girisinden sonra giris ekranindaki "Şifre Yenile" ile kendi
        // sifresini belirlemelidir.
        const {
          salt,
          hash
        } = hashPassword(
          newPerson.kullaniciAdi
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

      await writeDB(db, req.currentBolumId);

      const {
        sifreHash,
        sifreSalt,
        sifirlamaKoduHash,
        sifirlamaKoduSalt,
        sifirlamaKoduSonKullanma,
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
      const db = readDB(req.currentBolumId);

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

      const globalDb = readGlobalDB();

      const mevcutBolum =
        (globalDb.bolumler || []).find(
          b => b.id === req.currentBolumId
        );

      body.departman =
        mevcutBolum ? mevcutBolum.ad : '';

      // Admin sifreyi hicbir sekilde dogrudan belirleyemez/degistiremez;
      // istemciden boyle alanlar gelse bile yok sayilir.
      delete body.sifre;
      delete body.sifreHash;
      delete body.sifreSalt;

      const mevcutKisi =
        (db.personel || []).find(
          p => p.id === req.params.id
        );

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

        // Bir personele ILK KEZ giris yetkisi (kullanici adi) atandiginda,
        // ilk sifre kullanici adiyla ayni olacak sekilde otomatik atanir.
        // Kullanici ilk girisinden sonra giris ekranindaki "Şifre Yenile"
        // ile kendi sifresini belirlemelidir. Zaten bir kullanici adi olan
        // kisinin sifresine admin hicbir zaman dokunamaz/goremez.
        if (mevcutKisi && !mevcutKisi.kullaniciAdi) {
          const {
            salt,
            hash
          } = hashPassword(
            body.kullaniciAdi
          );

          body.sifreSalt = salt;
          body.sifreHash = hash;
        }
      }

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

      await writeDB(db, req.currentBolumId);

      const {
        sifreHash,
        sifreSalt,
        sifirlamaKoduHash,
        sifirlamaKoduSalt,
        sifirlamaKoduSonKullanma,
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
      const db = readDB(req.currentBolumId);

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

      // Silinen personelin oturumlari global oturum listesinden
      // ayrica temizlenir (oturumlar artik bolume ozel degil).
      const globalDb = readGlobalDB();

      globalDb.sessions =
        (globalDb.sessions || []).filter(
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

      await writeDB(db, req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

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

    const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);
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
    const db = readDB(req.currentBolumId);

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

    await writeDB(db, req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

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

    const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);
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
    const db = readDB(req.currentBolumId);

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

    await writeDB(db, req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

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
    const db = readDB(req.currentBolumId);
    const globalDb = readGlobalDB();

    const yeniBolumAdi =
      String((req.body && req.body.bolumAdi) || '').trim();

    if (!yeniBolumAdi) {
      return res.status(400).json({
        error: 'Bolum adi bos birakilamaz.'
      });
    }

    const mevcutBolum =
      (globalDb.bolumler || []).find(
        b => b.id === req.currentBolumId
      );

    if (!mevcutBolum) {
      return res.status(404).json({
        error: 'Mevcut bolum bulunamadi.'
      });
    }

    const ayniAdliBolum =
      (globalDb.bolumler || []).some(
        b =>
          b.id !== req.currentBolumId &&
          String(b.ad || '').trim().toLowerCase() ===
            yeniBolumAdi.toLowerCase()
      );

    if (ayniAdliBolum) {
      return res.status(400).json({
        error: 'Bu isimde baska bir bolum zaten mevcut.'
      });
    }

    db.ayarlar = {
      ...db.ayarlar,
      ...req.body,
      bolumAdi: yeniBolumAdi
    };

    mevcutBolum.ad = yeniBolumAdi;

    globalDb.bolumVerileri[req.currentBolumId] =
      normalizeBolumVerisi(db);

    await persistDbCache();

    res.json(
      globalDb.bolumVerileri[req.currentBolumId].ayarlar
    );
  }
);

// ============================================================
// DUYURULAR
// ============================================================

app.get(
  '/api/duyurular',
  (req, res) => {
    const db = readDB(req.currentBolumId);

    res.json(
      db.duyurular || {}
    );
  }
);

app.post(
  '/api/duyurular',
  requireRole('kontrolcu'),
  async (req, res) => {
    const db = readDB(req.currentBolumId);

    db.duyurular = {
      ...db.duyurular,
      ...req.body
    };

    await writeDB(db, req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

    res.json(
      db.sktTakip || []
    );
  }
);

app.post(
  '/api/skt',
  requireRole('kontrolcu'),
  async (req, res) => {
    const db = readDB(req.currentBolumId);

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

    await writeDB(db, req.currentBolumId);

    res.json(newItem);
  }
);

app.delete(
  '/api/skt/:id',
  requireRole('admin'),
  async (req, res) => {
    const db = readDB(req.currentBolumId);

    db.sktTakip =
      (db.sktTakip || []).filter(
        s =>
          s.id !== req.params.id
      );

    await writeDB(db, req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

    res.json(
      db.aksiyonlar || []
    );
  }
);

app.post(
  '/api/actions',
  requireRole('kontrolcu'),
  async (req, res) => {
    const db = readDB(req.currentBolumId);

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

    await writeDB(db, req.currentBolumId);

    res.json(newAction);
  }
);

app.put(
  '/api/actions/:id',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

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

      const guncelAksiyon = db.aksiyonlar[idx];

      // Bu aksiyon bir ASD/Sapma kaydindan otomatik acilmis olabilir
      // (bkz. POST /api/data/kalite/.../:day). Oyle ise, kapatma nedeni
      // ASD/Sapma kayit defterindeki karsiliginda da gorunsun diye oraya
      // da yaziyoruz.
      if ('kapatmaNedeni' in req.body) {
        const baglıKayit =
          (db.asdSapmaKayitlari || []).find(
            k => k.aksiyonId === guncelAksiyon.id
          );

        if (baglıKayit) {
          baglıKayit.kapatmaNedeni = guncelAksiyon.kapatmaNedeni || '';
        }
      }

      // Ayni sekilde, arizali/eksik ekipman kaydindan acilmis bir aksiyonsa
      // kapatma nedeni ekipman ariza kaydinda da gorunsun.
      if ('kapatmaNedeni' in req.body) {
        const baglıAriza =
          (db.ekipmanArizaKayitlari || []).find(
            k => k.aksiyonId === guncelAksiyon.id
          );

        if (baglıAriza) {
          baglıAriza.kapatmaNedeni = guncelAksiyon.kapatmaNedeni || '';
        }
      }

      auditEkle(
        db,
        req,
        'Aksiyon güncellendi',
        db.aksiyonlar[idx].baslik || req.params.id
      );

      await writeDB(db, req.currentBolumId);

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
      const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

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
      const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);

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
      const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);

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
      const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);

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
  '/api/katilim/:yearMonth/:day',
  (req, res) => {
    const db = readDB(req.currentBolumId);

    const yearMonth = req.params.yearMonth;
    const day = String(Number(req.params.day));

    const monthData =
      (db.katilim || {})[yearMonth] || {};

    res.json(monthData[day] || {});
  }
);

app.get(
  '/api/katilim/:yearMonth',
  (req, res) => {
    const db = readDB(req.currentBolumId);

    res.json(
      (db.katilim || {})[req.params.yearMonth] || {}
    );
  }
);

app.post(
  '/api/katilim/:yearMonth/:day',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      db.katilim =
        db.katilim || {};

      const yearMonth = req.params.yearMonth;
      const day = String(Number(req.params.day));

      db.katilim[yearMonth] =
        db.katilim[yearMonth] || {};

      const existing =
        db.katilim[yearMonth][day] || {};

      // G-K-T-V-K gunluk takip ile ayni kural: bir kez kaydedilen katilim
      // gunu kilitlenir, degistirmek icin admin yetkisi gerekir.
      if (
        existing._reviewed === true &&
        rolSeviyesi(req.currentUser) <
          ROL_SEVIYE.admin
      ) {
        return res.status(403).json({
          error:
            'Bu güne ait katılım zaten kaydedilmiş ve kilitlenmiş. Değiştirmek için admin yetkisi gerekir.'
        });
      }

      db.katilim[yearMonth][day] = {
        ...(req.body || {}),
        _reviewed: true
      };

      auditEkle(
        db,
        req,
        'Katilim kaydi guncellendi',
        `${yearMonth}/${day}`
      );

      await writeDB(db, req.currentBolumId);

      res.json(
        db.katilim[yearMonth][day]
      );
    } catch (err) {
      console.error(
        'KATILIM KAYDETME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Katilim kaydedilemedi.'
      });
    }
  }
);

app.delete(
  '/api/katilim/:yearMonth/:day/:personelId',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      db.katilim = db.katilim || {};

      const yearMonth = req.params.yearMonth;
      const day = String(Number(req.params.day));
      const personelId = req.params.personelId;

      if (
        db.katilim[yearMonth] &&
        db.katilim[yearMonth][day]
      ) {
        delete db.katilim[yearMonth][day][personelId];
      }

      auditEkle(
        db,
        req,
        'Katılım kaydı silindi',
        `${yearMonth}/${day} - personel ${personelId}`
      );

      await writeDB(db, req.currentBolumId);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error(
        'KATILIM SILME HATASI:',
        err
      );

      res.status(500).json({
        error: 'Katılım kaydı silinemedi.'
      });
    }
  }
);

app.get(
  '/api/all-katilim',
  (req, res) => {
    const db = readDB(req.currentBolumId);

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

    const db = readDB(req.currentBolumId);

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
    const db = readDB(req.currentBolumId);

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
      const db = readDB(req.currentBolumId);

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

      await writeDB(db, req.currentBolumId);

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

// Verilen "YYYY-MM-DD" tarihine karsilik gelen gunun Kalite verisini
// (db.kalite[yearMonth][gun]) bulur. Gun anahtari "5" veya "05" olarak
// saklanmis olabilir; sayisal karsilastirarak buluyoruz. Hem DELETE hem
// PUT /api/asd-sapma/:id tarafindan, kayit defteriyle kaynak gunun
// (Gunluk Takip > Kalite) verisini senkron tutmak icin kullanilir.
function kaliteGununuBul(db, tarih) {
  if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return null;

  const yearMonth = tarih.slice(0, 7);
  const gunNo = parseInt(tarih.slice(8, 10), 10);

  const ayVerisi = db.kalite && db.kalite[yearMonth];
  if (!ayVerisi) return null;

  const gunAnahtari = Object.keys(ayVerisi).find(
    k => parseInt(k, 10) === gunNo
  );

  return gunAnahtari ? ayVerisi[gunAnahtari] : null;
}

app.put(
  '/api/asd-sapma/:id',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

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

      const guncelKayit = db.asdSapmaKayitlari[idx];

      // Hammadde Parti No / Açma Nedeni gibi alanlar kayit defterinde
      // guncellenince, kaynak gunun (Gunluk Takip > Kalite) ayni ogesinde
      // de guncel kalsin diye orayi da senkronluyoruz.
      if (
        ('partiNo' in req.body ||
          'hammaddeAdi' in req.body ||
          'neden' in req.body) &&
        guncelKayit.tarih
      ) {
        const gunVerisi = kaliteGununuBul(db, guncelKayit.tarih);

        if (gunVerisi) {
          ['asd', 'sapma'].forEach(alanAdi => {
            if (!Array.isArray(gunVerisi[alanAdi])) return;

            const ogeIdx = gunVerisi[alanAdi].findIndex(
              item => item.kayitId === guncelKayit.id
            );

            if (ogeIdx === -1) return;

            if ('partiNo' in req.body) {
              gunVerisi[alanAdi][ogeIdx].partiNo = guncelKayit.partiNo || '';
            }
            if ('hammaddeAdi' in req.body) {
              gunVerisi[alanAdi][ogeIdx].hammaddeAdi = guncelKayit.hammaddeAdi || '';
            }
            if ('neden' in req.body) {
              gunVerisi[alanAdi][ogeIdx].not = guncelKayit.neden || '';
            }
          });
        }
      }

      auditEkle(
        db,
        req,
        'ASD sapma kaydı güncellendi',
        req.params.id
      );

      await writeDB(db, req.currentBolumId);

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

// ONEMLI: Bu, tek seferlik bir bakim rotasidir. Onceki surumlerde ASD/Sapma
// kaydi silindiginde (bkz. asagidaki DELETE /api/asd-sapma/:id), kaynak
// gundeki asd/sapma ogesi silinmiyordu; sadece kayit defterinden ve
// (kullanici ayrica silmisse) aksiyondan kalkiyordu. Bu da Personel Bazli
// Ozet'in hala sayan "hayalet" ogeler birakiyordu. Bu rota, kayitId'si olup
// artik asdSapmaKayitlari'nda karsiligi bulunmayan tum ogeleri bulup
// kaynagindan (Kalite gunluk verisi) temizler. Bundan sonraki silmeler
// zaten DELETE /api/asd-sapma/:id icinde otomatik temizleniyor; bu rota
// sadece GECMISTE olusmus yetimleri temizlemek icindir.
app.post(
  '/api/asd-sapma/yetim-temizle',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      const gecerliKayitIdSeti = new Set(
        (db.asdSapmaKayitlari || []).map(k => k.id)
      );

      let temizlenenSayisi = 0;
      const temizlenenler = [];

      Object.entries(db.kalite || {}).forEach(([yearMonth, gunler]) => {
        Object.entries(gunler || {}).forEach(([gunAnahtari, gunVerisi]) => {
          ['asd', 'sapma'].forEach(alanAdi => {
            if (!Array.isArray(gunVerisi[alanAdi])) return;

            const oncekiUzunluk = gunVerisi[alanAdi].length;

            gunVerisi[alanAdi] = gunVerisi[alanAdi].filter(item => {
              const yetim =
                item.kayitId && !gecerliKayitIdSeti.has(item.kayitId);

              if (yetim) {
                temizlenenler.push(
                  `${yearMonth}-${String(gunAnahtari).padStart(2, '0')} · ${alanAdi === 'asd' ? 'ASD' : 'Sapma'}${item.numara ? ' #' + item.numara : ''}`
                );
              }

              return !yetim;
            });

            temizlenenSayisi +=
              oncekiUzunluk - gunVerisi[alanAdi].length;
          });
        });
      });

      if (temizlenenSayisi > 0) {
        auditEkle(
          db,
          req,
          'Yetim ASD/Sapma öğeleri temizlendi',
          `${temizlenenSayisi} adet — ${temizlenenler.join(', ')}`
        );

        await writeDB(db, req.currentBolumId);
      }

      res.json({
        ok: true,
        temizlenenSayisi,
        detaylar: temizlenenler
      });
    } catch (err) {
      console.error('YETIM ASD/SAPMA TEMIZLEME HATASI:', err);

      res.status(500).json({
        error: 'Temizlik işlemi başarısız oldu.'
      });
    }
  }
);

app.delete(
  '/api/asd-sapma/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      const kayit =
        (db.asdSapmaKayitlari || []).find(
          x => x.id === req.params.id
        );

      db.asdSapmaKayitlari =
        (db.asdSapmaKayitlari || []).filter(
          x => x.id !== req.params.id
        );

      // ONEMLI: Bu kayit, Gunluk Takip > Kalite bolumunde ilgili gunun
      // asd/sapma listesindeki bir ogeden otomatik turetilmisti (bkz. POST
      // /api/data/kalite/.../:day, "item.kayitId = kayit.id"). Kayit
      // defterinden silmek tek basina yetmez: Personel Bazli Ozet ve kisi
      // detay kartlari sayimlarini dogrudan o gunun ham verisinden
      // (day.asd / day.sapma) yaptigi icin, kaynak oge orada kalmaya devam
      // ederse silinen kayit "hayalet" olarak sayilmaya devam eder. Bu
      // yuzden kaynak gundeki ogeyi de burada temizliyoruz.
      let kaynakTemizlendi = false;

      if (kayit) {
        const gunVerisi = kaliteGununuBul(db, kayit.tarih);

        if (gunVerisi) {
          ['asd', 'sapma'].forEach(alanAdi => {
            if (Array.isArray(gunVerisi[alanAdi])) {
              const oncekiUzunluk = gunVerisi[alanAdi].length;

              gunVerisi[alanAdi] =
                gunVerisi[alanAdi].filter(
                  item => item.kayitId !== kayit.id
                );

              if (gunVerisi[alanAdi].length !== oncekiUzunluk) {
                kaynakTemizlendi = true;
              }
            }
          });
        }
      }

      auditEkle(
        db,
        req,
        'ASD sapma kaydı silindi',
        req.params.id +
          (kaynakTemizlendi
            ? ' (kaynak günün verisinden de temizlendi)'
            : '')
      );

      await writeDB(db, req.currentBolumId);

      res.json({
        ok: true,
        kaynakTemizlendi
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
// EKIPMANLAR (Ayarlar > Ekipman Ekle / Cikar)
// Okuma: giris yapmis herkes (Kalibrasyon ve Verimlilik ekranlari kullanir)
// Ekleme / degistirme / silme: SADECE admin
// ============================================================

function ekipmanBilgisiTemizle(body) {
  body = body || {};

  return {
    ad: String(body.ad || '').trim(),
    numara: String(body.numara || '').trim(),
    marka: String(body.marka || '').trim()
  };
}

app.get(
  '/api/ekipmanlar',
  (req, res) => {
    const db = readDB(req.currentBolumId);

    res.json(
      db.ekipmanlar || []
    );
  }
);

app.post(
  '/api/ekipmanlar',
  requireRole('admin'),
  async (req, res) => {
    try {
      const bilgi = ekipmanBilgisiTemizle(req.body);

      if (!bilgi.ad || !bilgi.numara || !bilgi.marka) {
        return res.status(400).json({
          error: 'Ekipman adı, ekipman numarası ve markası zorunludur.'
        });
      }

      const db = readDB(req.currentBolumId);

      db.ekipmanlar = db.ekipmanlar || [];

      if (
        db.ekipmanlar.some(
          e =>
            String(e.numara).toLowerCase() ===
            bilgi.numara.toLowerCase()
        )
      ) {
        return res.status(400).json({
          error: 'Bu ekipman numarasıyla kayıtlı başka bir ekipman zaten var.'
        });
      }

      const yeni = {
        id:
          'ekp' +
          Date.now().toString() +
          Math.random().toString(36).slice(2, 6),
        ...bilgi,
        olusturmaTarihi: new Date().toISOString()
      };

      db.ekipmanlar.push(yeni);

      auditEkle(
        db,
        req,
        'Ekipman eklendi',
        `${yeni.ad} (${yeni.numara}) — ${yeni.marka}`
      );

      await writeDB(db, req.currentBolumId);

      res.json(yeni);
    } catch (err) {
      console.error('EKIPMAN EKLEME HATASI:', err);

      res.status(500).json({
        error: 'Ekipman eklenemedi.'
      });
    }
  }
);

app.put(
  '/api/ekipmanlar/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const bilgi = ekipmanBilgisiTemizle(req.body);

      if (!bilgi.ad || !bilgi.numara || !bilgi.marka) {
        return res.status(400).json({
          error: 'Ekipman adı, ekipman numarası ve markası zorunludur.'
        });
      }

      const db = readDB(req.currentBolumId);

      const idx =
        (db.ekipmanlar || []).findIndex(
          e => e.id === req.params.id
        );

      if (idx === -1) {
        return res.status(404).json({
          error: 'Ekipman bulunamadı.'
        });
      }

      if (
        db.ekipmanlar.some(
          (e, i) =>
            i !== idx &&
            String(e.numara).toLowerCase() ===
              bilgi.numara.toLowerCase()
        )
      ) {
        return res.status(400).json({
          error: 'Bu ekipman numarasıyla kayıtlı başka bir ekipman zaten var.'
        });
      }

      db.ekipmanlar[idx] = {
        ...db.ekipmanlar[idx],
        ...bilgi,
        id: db.ekipmanlar[idx].id
      };

      auditEkle(
        db,
        req,
        'Ekipman güncellendi',
        `${bilgi.ad} (${bilgi.numara}) — ${bilgi.marka}`
      );

      await writeDB(db, req.currentBolumId);

      res.json(db.ekipmanlar[idx]);
    } catch (err) {
      console.error('EKIPMAN GUNCELLEME HATASI:', err);

      res.status(500).json({
        error: 'Ekipman güncellenemedi.'
      });
    }
  }
);

// NOT: Ekipman silindiginde gecmis ariza kayitlari ve Kalibrasyon gecmisi
// bozulmaz; ariza kayitlari ekipman bilgisinin kopyasini (ad/numara/marka)
// kendi icinde tasir.
app.delete(
  '/api/ekipmanlar/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      const ekp =
        (db.ekipmanlar || []).find(
          e => e.id === req.params.id
        );

      if (!ekp) {
        return res.status(404).json({
          error: 'Ekipman bulunamadı.'
        });
      }

      db.ekipmanlar =
        db.ekipmanlar.filter(
          e => e.id !== req.params.id
        );

      auditEkle(
        db,
        req,
        'Ekipman silindi',
        `${ekp.ad} (${ekp.numara}) — ${ekp.marka}`
      );

      await writeDB(db, req.currentBolumId);

      res.json({
        ok: true
      });
    } catch (err) {
      console.error('EKIPMAN SILME HATASI:', err);

      res.status(500).json({
        error: 'Ekipman silinemedi.'
      });
    }
  }
);

// ============================================================
// ARIZALI / EKSIK EKIPMAN KAYITLARI (Ozet sayfasi)
// Kayitlar Gunluk Takip > Verimlilik'te sunucu tarafinda otomatik acilir
// (bkz. POST /api/data/:category/:yearMonth/:day). Acik/kapali durumu,
// ASD/Sapma ile ayni mantikla bagli aksiyonun durumundan turetilir.
// ============================================================

// Verilen "YYYY-MM-DD" tarihine karsilik gelen gunun verisini (herhangi bir
// kategoride) bulur. Gun anahtari "5" veya "05" olarak saklanmis olabilir.
function gunVerisiniBul(db, kategori, tarih) {
  if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return null;

  const yearMonth = tarih.slice(0, 7);
  const gunNo = parseInt(tarih.slice(8, 10), 10);

  const ayVerisi = db[kategori] && db[kategori][yearMonth];
  if (!ayVerisi) return null;

  const gunAnahtari = Object.keys(ayVerisi).find(
    k => parseInt(k, 10) === gunNo
  );

  return gunAnahtari ? ayVerisi[gunAnahtari] : null;
}

app.get(
  '/api/ekipman-ariza',
  (req, res) => {
    const db = readDB(req.currentBolumId);

    res.json(
      db.ekipmanArizaKayitlari || []
    );
  }
);

app.put(
  '/api/ekipman-ariza/:id',
  requireRole('kontrolcu'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      const kayit =
        (db.ekipmanArizaKayitlari || []).find(
          k => k.id === req.params.id
        );

      if (!kayit) {
        return res.status(404).json({
          error: 'Arıza kaydı bulunamadı.'
        });
      }

      // Sadece aciklama duzenlenebilir; ekipman ve ariza kodu sabittir.
      if ('aciklama' in req.body) {
        kayit.aciklama = String(req.body.aciklama || '').trim();

        // Kaynak gundeki (Verimlilik) ogede de guncel kalsin.
        const gunVerisi = gunVerisiniBul(db, 'verimlilik', kayit.tarih);

        if (gunVerisi && Array.isArray(gunVerisi.arizaliEkipmanList)) {
          const oge = gunVerisi.arizaliEkipmanList.find(
            item => item.kayitId === kayit.id
          );

          if (oge) oge.not = kayit.aciklama;
        }
      }

      auditEkle(
        db,
        req,
        'Arızalı/Eksik ekipman kaydı güncellendi',
        req.params.id
      );

      await writeDB(db, req.currentBolumId);

      res.json(kayit);
    } catch (err) {
      console.error('EKIPMAN ARIZA GUNCELLEME HATASI:', err);

      res.status(500).json({
        error: 'Arıza kaydı güncellenemedi.'
      });
    }
  }
);

app.delete(
  '/api/ekipman-ariza/:id',
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = readDB(req.currentBolumId);

      const kayit =
        (db.ekipmanArizaKayitlari || []).find(
          k => k.id === req.params.id
        );

      db.ekipmanArizaKayitlari =
        (db.ekipmanArizaKayitlari || []).filter(
          k => k.id !== req.params.id
        );

      // Kayit, Verimlilik gununden otomatik turetilmisti: kaynak ogeyi de
      // temizle ve gunun adet alanini yeniden hesapla (hayalet kayit kalmasin).
      let kaynakTemizlendi = false;

      if (kayit) {
        const gunVerisi = gunVerisiniBul(db, 'verimlilik', kayit.tarih);

        if (gunVerisi && Array.isArray(gunVerisi.arizaliEkipmanList)) {
          const onceki = gunVerisi.arizaliEkipmanList.length;

          gunVerisi.arizaliEkipmanList =
            gunVerisi.arizaliEkipmanList.filter(
              item => item.kayitId !== kayit.id
            );

          if (gunVerisi.arizaliEkipmanList.length !== onceki) {
            kaynakTemizlendi = true;

            gunVerisi.arizaliEkipman =
              (Number(gunVerisi.arizaliEkipmanEski) || 0) +
              gunVerisi.arizaliEkipmanList.length;
          }
        }
      }

      auditEkle(
        db,
        req,
        'Arızalı/Eksik ekipman kaydı silindi',
        req.params.id +
          (kaynakTemizlendi
            ? ' (kaynak günün verisinden de temizlendi)'
            : '')
      );

      await writeDB(db, req.currentBolumId);

      res.json({
        ok: true,
        kaynakTemizlendi
      });
    } catch (err) {
      console.error('EKIPMAN ARIZA SILME HATASI:', err);

      res.status(500).json({
        error: 'Arıza kaydı silinemedi.'
      });
    }
  }
);

// ============================================================
// ILK BOLUM VE ILK ADMIN
// ============================================================

function ensureInitialBolumVeAdmin(db) {
  db.bolumler = db.bolumler || [];
  db.bolumVerileri = db.bolumVerileri || {};

  let degisti = false;

  // Hic bolum yoksa (tamamen yeni kurulum), varsayilan bir tane olustur.
  if (db.bolumler.length === 0) {
    db.bolumler.push({
      id: VARSAYILAN_BOLUM_ID,
      ad: 'Ana Bölüm',
      olusturmaTarihi: new Date().toISOString()
    });

    degisti = true;
  }

  db.bolumler.forEach(bolum => {
    db.bolumVerileri[bolum.id] =
      db.bolumVerileri[bolum.id] || defaultBolumVerisi();

    const bolumDb = db.bolumVerileri[bolum.id];

    bolumDb.personel = bolumDb.personel || [];

    const adminVar =
      bolumDb.personel.some(
        p =>
          p.rol === 'admin' &&
          p.kullaniciAdi
      );

    if (adminVar) {
      return;
    }

    /*
     * Eğer bu bölümün verisinde personel varsa
     * mevcut kayıtları koruyoruz.
     *
     * Hiç admin yoksa sadece güvenli bir ilk admin
     * oluşturuyoruz.
     */

    const {
      salt,
      hash
    } = hashPassword('admin123');

    bolumDb.personel.push({
      id:
        Date.now().toString() +
        Math.random().toString(36).slice(2, 6),
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

    console.log(
      `   [${bolum.ad}] için ilk admin oluşturuldu (kullanıcı: admin, şifre: admin123)`
    );

    degisti = true;
  });

  return degisti;
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
      '3) İlk bölüm/admin kontrol ediliyor...'
    );

    const globalDb = readGlobalDB();

    if (ensureInitialBolumVeAdmin(globalDb)) {
      await persistDbCache();

      console.log(
        '   Eksik bölüm/admin tamamlandı (yeni kurulumda varsayılan: kullanıcı admin, şifre admin123).'
      );
    } else {
      console.log(
        '   Mevcut bölüm(ler) ve admin(ler) bulundu.'
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
