const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());
// Onbellegi tamamen kapat: tarayici asla eski app.js/style.css dosyalarini
// onbellekten okumasin. Bu, gelistirme sirasinda "degisiklik gorunmuyor"
// sikayetlerinin en sik nedenidir.
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  cacheControl: false
}));

// Surum bilgisi: tarayicida dogru surumun yuklendigini dogrulamak icin
const APP_VERSION = 'v2026-08-15-19-giris-yetki-admin-paneli';
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

// ---------- Basit cookie ayristirma ----------
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) cookies[k] = decodeURIComponent(v);
    }
  });
  return cookies;
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    return false;
  }
}

const ROL_SEVIYE = { izleyici: 0, yazici: 1, kidemli: 2, admin: 3 };
function rolSeviyesi(user) {
  return ROL_SEVIYE[(user && user.rol) || 'izleyici'] ?? 0;
}

app.use((req, res, next) => {
  const cookies = parseCookies(req);
  const token = cookies['wct_session'];
  if (token) {
    try {
      const db = readDB();
      const session = (db.sessions || []).find(s => s.token === token);
      if (session) {
        const user = (db.personel || []).find(p => p.id === session.personelId);
        if (user) req.currentUser = user;
      }
    } catch (err) { /* db henuz yok olabilir */ }
  }
  next();
});

app.post('/api/auth/login', (req, res) => {
  const { kullaniciAdi, sifre } = req.body || {};
  const db = readDB();
  const user = (db.personel || []).find(p => p.kullaniciAdi && p.kullaniciAdi.toLowerCase() === String(kullaniciAdi || '').toLowerCase().trim());
  if (!user || !verifyPassword(sifre || '', user.sifreSalt, user.sifreHash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions = db.sessions || [];
  db.sessions.push({ token, personelId: user.id, createdAt: new Date().toISOString() });
  writeDB(db);
  res.setHeader('Set-Cookie', `wct_session=${token}; HttpOnly; Path=/; Max-Age=31536000; SameSite=Lax`);
  res.json({ ok: true, user: { id: user.id, ad: user.ad, rol: user.rol, kullaniciAdi: user.kullaniciAdi } });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies['wct_session'];
  if (token) {
    const db = readDB();
    db.sessions = (db.sessions || []).filter(s => s.token !== token);
    writeDB(db);
  }
  res.setHeader('Set-Cookie', `wct_session=; HttpOnly; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.currentUser) return res.status(401).json({ error: 'Giriş yapılmamış' });
  const u = req.currentUser;
  res.json({ id: u.id, ad: u.ad, rol: u.rol, kullaniciAdi: u.kullaniciAdi });
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/version') return next();
  if (!req.currentUser) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  next();
});

function requireRole(minRol) {
  return (req, res, next) => {
    if (rolSeviyesi(req.currentUser) < ROL_SEVIYE[minRol]) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  };
}

function auditEkle(db, req, islem, detay) {
  db.auditLog = db.auditLog || [];
  db.auditLog.unshift({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    zaman: new Date().toISOString(),
    personelId: req.currentUser ? req.currentUser.id : '',
    personelAd: req.currentUser ? req.currentUser.ad : 'Bilinmeyen',
    rol: req.currentUser ? req.currentUser.rol : '',
    islem,
    detay: detay || ''
  });
  if (db.auditLog.length > 1000) db.auditLog = db.auditLog.slice(0, 1000);
}


// ---------- DB yardımcı fonksiyonları ----------
const CATEGORIES = ['guvenlik', 'kalite', 'teslimat', 'verimlilik', 'kalibrasyon'];

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
      gunlukSiralama: ['guvenlik', 'kalite', 'teslimat', 'verimlilik', 'kalibrasyon'],
      ozetUstSiralama: ['notlar', 'personel'],
      ozetKartSiralama: ['kaza', 'skt', 'aksiyonlar']
    },
    sessions: [],
    auditLog: [],
    departmanlar: ['Hammadde Laboratuvarı'],
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

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = defaultDB();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  // eski db dosyalarinda eksik alanlari tamamla (geriye donuk uyumluluk)
  const def = defaultDB();
  const merged = { ...def, ...parsed };
  merged.ayarlar = { ...def.ayarlar, ...(parsed.ayarlar || {}) };
  merged.ayarlar.categoryColors = { ...def.ayarlar.categoryColors, ...((parsed.ayarlar || {}).categoryColors || {}) };
  merged.ayarlar.gunlukSiralama = ((parsed.ayarlar || {}).gunlukSiralama && (parsed.ayarlar || {}).gunlukSiralama.length === 5) ? parsed.ayarlar.gunlukSiralama : def.ayarlar.gunlukSiralama;
  merged.ayarlar.ozetUstSiralama = ((parsed.ayarlar || {}).ozetUstSiralama && (parsed.ayarlar || {}).ozetUstSiralama.length === 2) ? parsed.ayarlar.ozetUstSiralama : def.ayarlar.ozetUstSiralama;
  merged.ayarlar.ozetKartSiralama = ((parsed.ayarlar || {}).ozetKartSiralama && (parsed.ayarlar || {}).ozetKartSiralama.length === 3) ? parsed.ayarlar.ozetKartSiralama : def.ayarlar.ozetKartSiralama;
  merged.duyurular = { ...def.duyurular, ...(parsed.duyurular || {}) };
  merged.sktTakip = parsed.sktTakip || [];
  merged.sessions = parsed.sessions || [];
  merged.auditLog = parsed.auditLog || [];
  merged.departmanlar = (parsed.departmanlar && parsed.departmanlar.length) ? parsed.departmanlar : def.departmanlar;
  merged.unvanlar = (parsed.unvanlar && parsed.unvanlar.length) ? parsed.unvanlar : def.unvanlar;
  merged.asdSapmaKayitlari = parsed.asdSapmaKayitlari || [];
  return merged;
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- Gunluk kategori verileri ----------

// Belirli bir kategori + ay icin tum gunlerin verisini getir
app.get('/api/data/:category/:yearMonth', (req, res) => {
  const { category, yearMonth } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Gecersiz kategori' });
  }
  const db = readDB();
  const data = (db[category] && db[category][yearMonth]) || {};
  res.json(data);
});

// Belirli bir gunun verisini kaydet / guncelle (tam gun objesini gonderin)
app.post('/api/data/:category/:yearMonth/:day', requireRole('yazici'), (req, res) => {
  const { category, yearMonth, day } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Gecersiz kategori' });
  }
  const db = readDB();
  if (!db[category][yearMonth]) db[category][yearMonth] = {};
  const existing = db[category][yearMonth][day] || {};
  if (existing.reviewed === true && rolSeviyesi(req.currentUser) < ROL_SEVIYE.kidemli) {
    return res.status(403).json({ error: 'Bu gün zaten kaydedilmiş ve kilitlenmiş. Değiştirmek için kıdemli veya admin yetkisi gerekir.' });
  }
  const merged = { ...existing, ...req.body };
  Object.keys(merged).forEach(k => {
    if (merged[k] === null) delete merged[k];
  });
  db[category][yearMonth][day] = merged;
  auditEkle(db, req, `${category} verisi kaydedildi`, `${yearMonth} ayı, ${day}. gün`);
  writeDB(db);
  res.json(db[category][yearMonth][day]);
});

// Belirli bir gunu tamamen temizle (gri duruma dondurur)
app.delete('/api/data/:category/:yearMonth/:day', requireRole('yazici'), (req, res) => {
  const { category, yearMonth, day } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Gecersiz kategori' });
  }
  const db = readDB();
  const existing = (db[category][yearMonth] && db[category][yearMonth][day]) || {};
  if (existing.reviewed === true && rolSeviyesi(req.currentUser) < ROL_SEVIYE.kidemli) {
    return res.status(403).json({ error: 'Bu gün zaten kaydedilmiş ve kilitlenmiş. Silmek için kıdemli veya admin yetkisi gerekir.' });
  }
  if (db[category][yearMonth]) {
    delete db[category][yearMonth][day];
  }
  auditEkle(db, req, `${category} günü temizlendi`, `${yearMonth} ayı, ${day}. gün`);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Personel ----------

app.get('/api/personel', (req, res) => {
  const db = readDB();
  const safeList = (db.personel || []).map(({ sifreHash, sifreSalt, ...rest }) => rest);
  res.json(safeList);
});

app.post('/api/personel', requireRole('admin'), (req, res) => {
  const db = readDB();
  const newPerson = {
    id: Date.now().toString(),
    ad: req.body.ad || '',
    departman: req.body.departman || '',
    unvan: req.body.unvan || '',
    fotoBase64: req.body.fotoBase64 || '',
    sorumluluklar: Array.isArray(req.body.sorumluluklar) ? req.body.sorumluluklar : [],
    kullaniciAdi: req.body.kullaniciAdi ? String(req.body.kullaniciAdi).trim() : '',
    rol: req.body.rol || 'izleyici'
  };
  if (newPerson.kullaniciAdi) {
    if ((db.personel || []).some(p => p.kullaniciAdi && p.kullaniciAdi.toLowerCase() === newPerson.kullaniciAdi.toLowerCase())) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
    }
    if (!req.body.sifre) {
      return res.status(400).json({ error: 'Kullanıcı adı belirttiyseniz bir şifre de girmelisiniz.' });
    }
    const { salt, hash } = hashPassword(req.body.sifre);
    newPerson.sifreSalt = salt;
    newPerson.sifreHash = hash;
  }
  db.personel = db.personel || [];
  db.personel.push(newPerson);
  auditEkle(db, req, 'Personel eklendi', newPerson.ad + (newPerson.kullaniciAdi ? ` (kullanıcı: ${newPerson.kullaniciAdi}, rol: ${newPerson.rol})` : ''));
  writeDB(db);
  const { sifreHash, sifreSalt, ...safePerson } = newPerson;
  res.json(safePerson);
});

app.put('/api/personel/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const idx = (db.personel || []).findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Personel bulunamadi' });

  const body = { ...req.body };
  if (body.kullaniciAdi) {
    body.kullaniciAdi = String(body.kullaniciAdi).trim();
    const cakisan = (db.personel || []).some(p => p.id !== req.params.id && p.kullaniciAdi && p.kullaniciAdi.toLowerCase() === body.kullaniciAdi.toLowerCase());
    if (cakisan) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
  }
  if (body.sifre) {
    const { salt, hash } = hashPassword(body.sifre);
    body.sifreSalt = salt;
    body.sifreHash = hash;
  }
  delete body.sifre;

  db.personel[idx] = { ...db.personel[idx], ...body };
  auditEkle(db, req, 'Personel güncellendi', db.personel[idx].ad);
  writeDB(db);
  const { sifreHash, sifreSalt, ...safePerson } = db.personel[idx];
  res.json(safePerson);
});

app.delete('/api/personel/:id', requireRole('admin'), (req, res) => {
  const db = readDB();
  const kisi = (db.personel || []).find(p => p.id === req.params.id);
  db.personel = (db.personel || []).filter(p => p.id !== req.params.id);
  db.sessions = (db.sessions || []).filter(s => s.personelId !== req.params.id);
  auditEkle(db, req, 'Personel silindi', kisi ? kisi.ad : req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Departmanlar ve Unvanlar (Admin Paneli'nden yonetilir) ----------

app.get('/api/departmanlar', (req, res) => {
  const db = readDB();
  res.json(db.departmanlar || []);
});

app.post('/api/departmanlar', requireRole('admin'), (req, res) => {
  const ad = String((req.body && req.body.ad) || '').trim();
  if (!ad) return res.status(400).json({ error: 'Departman adı boş olamaz.' });
  const db = readDB();
  db.departmanlar = db.departmanlar || [];
  if (!db.departmanlar.some(d => d.toLowerCase() === ad.toLowerCase())) {
    db.departmanlar.push(ad);
    auditEkle(db, req, 'Departman eklendi', ad);
    writeDB(db);
  }
  res.json(db.departmanlar);
});

app.delete('/api/departmanlar/:ad', requireRole('admin'), (req, res) => {
  const db = readDB();
  db.departmanlar = (db.departmanlar || []).filter(d => d !== req.params.ad);
  auditEkle(db, req, 'Departman silindi', req.params.ad);
  writeDB(db);
  res.json(db.departmanlar);
});

app.get('/api/unvanlar', (req, res) => {
  const db = readDB();
  res.json(db.unvanlar || []);
});

app.post('/api/unvanlar', requireRole('admin'), (req, res) => {
  const ad = String((req.body && req.body.ad) || '').trim();
  if (!ad) return res.status(400).json({ error: 'Ünvan adı boş olamaz.' });
  const db = readDB();
  db.unvanlar = db.unvanlar || [];
  if (!db.unvanlar.some(u => u.toLowerCase() === ad.toLowerCase())) {
    db.unvanlar.push(ad);
    auditEkle(db, req, 'Ünvan eklendi', ad);
    writeDB(db);
  }
  res.json(db.unvanlar);
});

app.delete('/api/unvanlar/:ad', requireRole('admin'), (req, res) => {
  const db = readDB();
  db.unvanlar = (db.unvanlar || []).filter(u => u !== req.params.ad);
  auditEkle(db, req, 'Ünvan silindi', req.params.ad);
  writeDB(db);
  res.json(db.unvanlar);
});

// ---------- Audit Trail (yalnizca admin goruntuleyebilir) ----------

app.get('/api/audit', requireRole('admin'), (req, res) => {
  const db = readDB();
  res.json(db.auditLog || []);
});

// ---------- Ayarlar (bolum adi vb.) ----------

app.get('/api/ayarlar', (req, res) => {
  const db = readDB();
  res.json(db.ayarlar || { bolumAdi: '' });
});

app.post('/api/ayarlar', requireRole('admin'), (req, res) => {
  const db = readDB();
  db.ayarlar = { ...db.ayarlar, ...req.body };
  writeDB(db);
  res.json(db.ayarlar);
});

// ---------- Duyurular (OPL / See Card-Oneri Karekodu / Kalibrasyon Tablosu gorselleri) ----------

app.get('/api/duyurular', (req, res) => {
  const db = readDB();
  res.json(db.duyurular || {});
});

app.post('/api/duyurular', requireRole('yazici'), (req, res) => {
  const db = readDB();
  db.duyurular = { ...db.duyurular, ...req.body };
  writeDB(db);
  res.json(db.duyurular);
});

// ---------- SKT Takibi (son kullanma tarihi takip edilen malzemeler/cozeltiler) ----------

app.get('/api/skt', (req, res) => {
  const db = readDB();
  res.json(db.sktTakip || []);
});

app.post('/api/skt', requireRole('yazici'), (req, res) => {
  const db = readDB();
  const newItem = {
    id: Date.now().toString(),
    ad: req.body.ad || '',
    hazirlanmaTarihi: req.body.hazirlanmaTarihi || '',
    sureGun: Number(req.body.sureGun) || 0,
    olusturmaTarihi: new Date().toISOString()
  };
  db.sktTakip = db.sktTakip || [];
  db.sktTakip.push(newItem);
  writeDB(db);
  res.json(newItem);
});

app.delete('/api/skt/:id', requireRole('yazici'), (req, res) => {
  const db = readDB();
  db.sktTakip = (db.sktTakip || []).filter(s => s.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Aksiyonlar ----------

app.get('/api/actions', (req, res) => {
  const db = readDB();
  res.json(db.aksiyonlar || []);
});

app.post('/api/actions', requireRole('yazici'), (req, res) => {
  const db = readDB();
  const newAction = {
    id: Date.now().toString(),
    baslik: req.body.baslik || '',
    aciklama: req.body.aciklama || '',
    baslangic: req.body.baslangic || '',
    bitis: req.body.bitis || '',
    durum: req.body.durum || 'Devam ediyor',
    sahibiId: req.body.sahibiId || '',
    olusturmaTarihi: new Date().toISOString()
  };
  db.aksiyonlar = db.aksiyonlar || [];
  db.aksiyonlar.unshift(newAction);
  writeDB(db);
  res.json(newAction);
});

app.put('/api/actions/:id', requireRole('yazici'), (req, res) => {
  const db = readDB();
  const idx = (db.aksiyonlar || []).findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Aksiyon bulunamadi' });
  db.aksiyonlar[idx] = { ...db.aksiyonlar[idx], ...req.body };
  writeDB(db);
  res.json(db.aksiyonlar[idx]);
});

app.delete('/api/actions/:id', requireRole('yazici'), (req, res) => {
  const db = readDB();
  db.aksiyonlar = (db.aksiyonlar || []).filter(a => a.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Notlar / Gorevler (kisiye gorev atama veya lab geneli duyuru) ----------

app.get('/api/notlar', (req, res) => {
  const db = readDB();
  res.json(db.toplantiNotlari || []);
});

app.post('/api/notlar', requireRole('yazici'), (req, res) => {
  const db = readDB();
  const newNote = {
    id: Date.now().toString(),
    tip: req.body.tip === 'gorev' ? 'gorev' : 'duyuru', // 'gorev' = kisiye atanan gorev, 'duyuru' = lab geneli
    personelId: req.body.tip === 'gorev' ? (req.body.personelId || '') : '',
    baslik: req.body.baslik || '',
    not: req.body.not || '',
    bitisTarihi: req.body.bitisTarihi || '',
    durum: req.body.tip === 'gorev' ? (req.body.durum || 'Devam ediyor') : '',
    olusturmaTarihi: new Date().toISOString(),
    // eski surumle geriye donuk uyumluluk icin (eski kayitlarda 'tarih' alani vardi)
    tarih: req.body.tarih || ''
  };
  db.toplantiNotlari = db.toplantiNotlari || [];
  db.toplantiNotlari.unshift(newNote);
  writeDB(db);
  res.json(newNote);
});

app.put('/api/notlar/:id', requireRole('yazici'), (req, res) => {
  const db = readDB();
  const idx = (db.toplantiNotlari || []).findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not bulunamadi' });
  db.toplantiNotlari[idx] = { ...db.toplantiNotlari[idx], ...req.body };
  writeDB(db);
  res.json(db.toplantiNotlari[idx]);
});

app.delete('/api/notlar/:id', requireRole('yazici'), (req, res) => {
  const db = readDB();
  db.toplantiNotlari = (db.toplantiNotlari || []).filter(n => n.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Katilim (WCT toplantisina kimin katildigi) ----------

app.get('/api/katilim/:yearMonth/:day', (req, res) => {
  const { yearMonth, day } = req.params;
  const db = readDB();
  const data = (db.katilim[yearMonth] && db.katilim[yearMonth][day]) || {};
  res.json(data);
});

// Secili ayin TUM gunlerinin katilim verisi (izin/rapor kilit hesaplamasi icin)
app.get('/api/katilim/:yearMonth', (req, res) => {
  const { yearMonth } = req.params;
  const db = readDB();
  res.json(db.katilim[yearMonth] || {});
});

// Ozet sayfasi ve Personel Detay Karti icin: TUM aylarin/gunlerin katilim verisi
app.get('/api/all-katilim', (req, res) => {
  const db = readDB();
  res.json(db.katilim || {});
});

app.post('/api/katilim/:yearMonth/:day', requireRole('yazici'), (req, res) => {
  const { yearMonth, day } = req.params;
  const db = readDB();
  const existing = (db.katilim[yearMonth] && db.katilim[yearMonth][day]) || {};
  if (Object.keys(existing).length > 0 && rolSeviyesi(req.currentUser) < ROL_SEVIYE.kidemli) {
    return res.status(403).json({ error: 'Bu günün katılım listesi zaten kaydedilmiş. Değiştirmek için kıdemli veya admin yetkisi gerekir.' });
  }
  if (!db.katilim[yearMonth]) db.katilim[yearMonth] = {};
  db.katilim[yearMonth][day] = req.body || {};
  auditEkle(db, req, 'WCT katılım listesi kaydedildi', `${yearMonth} ayı, ${day}. gün`);
  writeDB(db);
  res.json(db.katilim[yearMonth][day]);
});

// ---------- Ozet sayfasi icin: bir kategori altindaki BUTUN aylarin verisini getir ----------
// (personel bazli toplu ozet / gecmis aylar icin kullanilabilir, opsiyonel)
app.get('/api/all/:category', (req, res) => {
  const { category } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Gecersiz kategori' });
  }
  const db = readDB();
  res.json(db[category] || {});
});

// ---------- Ilk kurulum: hic kullanici yoksa otomatik bir admin hesabi olustur ----------
// (aksi halde kimse giris yapamayacagi icin sisteme hic girilemez - tavuk-yumurta sorunu)
function ilkAdminHesabiniOlusturVarsayilan() {
  const db = readDB();
  const hicKullaniciYok = !(db.personel || []).some(p => p.kullaniciAdi);
  if (!hicKullaniciYok) return;

  const varsayilanSifre = 'admin123';
  const { salt, hash } = hashPassword(varsayilanSifre);
  const adminPerson = {
    id: Date.now().toString(),
    ad: 'Admin (İlk Kurulum)',
    departman: '',
    unvan: 'Bölüm Sorumlusu',
    fotoBase64: '',
    sorumluluklar: [],
    kullaniciAdi: 'admin',
    rol: 'admin',
    sifreSalt: salt,
    sifreHash: hash
  };
  db.personel = db.personel || [];
  db.personel.push(adminPerson);
  writeDB(db);

  console.log('');
  console.log('========================================================');
  console.log('[İLK KURULUM] Henüz hiç kullanıcı yoktu, otomatik bir admin hesabı oluşturuldu:');
  console.log('  Kullanıcı adı: admin');
  console.log('  Şifre        : admin123');
  console.log('  ÖNEMLİ: Giriş yaptıktan sonra Admin Paneli > Personel bölümünden');
  console.log('  bu hesabın şifresini hemen değiştirin veya kendi admin hesabınızı');
  console.log('  oluşturup bu geçici hesabı silin.');
  console.log('========================================================');
  console.log('');
}
ilkAdminHesabiniOlusturVarsayilan();

app.listen(PORT, () => {
  console.log(`WCT Dashboard sunucusu calisiyor: http://localhost:${PORT}`);
});
