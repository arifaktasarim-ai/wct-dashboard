const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
const APP_VERSION = 'v2026-07-29-18-masaustu-bildirim';
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

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
    }
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
app.post('/api/data/:category/:yearMonth/:day', (req, res) => {
  const { category, yearMonth, day } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Gecersiz kategori' });
  }
  const db = readDB();
  if (!db[category][yearMonth]) db[category][yearMonth] = {};
  const merged = { ...db[category][yearMonth][day], ...req.body };
  // null gonderilen alanlar o gunun verisinden tamamen silinir (griye donmesi icin)
  Object.keys(merged).forEach(k => {
    if (merged[k] === null) delete merged[k];
  });
  db[category][yearMonth][day] = merged;
  writeDB(db);
  res.json(db[category][yearMonth][day]);
});

// Belirli bir gunu tamamen temizle (gri duruma dondurur)
app.delete('/api/data/:category/:yearMonth/:day', (req, res) => {
  const { category, yearMonth, day } = req.params;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'Gecersiz kategori' });
  }
  const db = readDB();
  if (db[category][yearMonth]) {
    delete db[category][yearMonth][day];
  }
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Personel ----------

app.get('/api/personel', (req, res) => {
  const db = readDB();
  res.json(db.personel || []);
});

app.post('/api/personel', (req, res) => {
  const db = readDB();
  const newPerson = {
    id: Date.now().toString(),
    ad: req.body.ad || '',
    departman: req.body.departman || '',
    unvan: req.body.unvan || '',
    fotoBase64: req.body.fotoBase64 || '',
    sorumluluklar: Array.isArray(req.body.sorumluluklar) ? req.body.sorumluluklar : []
  };
  db.personel = db.personel || [];
  db.personel.push(newPerson);
  writeDB(db);
  res.json(newPerson);
});

app.put('/api/personel/:id', (req, res) => {
  const db = readDB();
  const idx = (db.personel || []).findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Personel bulunamadi' });
  db.personel[idx] = { ...db.personel[idx], ...req.body };
  writeDB(db);
  res.json(db.personel[idx]);
});

app.delete('/api/personel/:id', (req, res) => {
  const db = readDB();
  db.personel = (db.personel || []).filter(p => p.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ---------- Ayarlar (bolum adi vb.) ----------

app.get('/api/ayarlar', (req, res) => {
  const db = readDB();
  res.json(db.ayarlar || { bolumAdi: '' });
});

app.post('/api/ayarlar', (req, res) => {
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

app.post('/api/duyurular', (req, res) => {
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

app.post('/api/skt', (req, res) => {
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

app.delete('/api/skt/:id', (req, res) => {
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

app.post('/api/actions', (req, res) => {
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

app.put('/api/actions/:id', (req, res) => {
  const db = readDB();
  const idx = (db.aksiyonlar || []).findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Aksiyon bulunamadi' });
  db.aksiyonlar[idx] = { ...db.aksiyonlar[idx], ...req.body };
  writeDB(db);
  res.json(db.aksiyonlar[idx]);
});

app.delete('/api/actions/:id', (req, res) => {
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

app.post('/api/notlar', (req, res) => {
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

app.put('/api/notlar/:id', (req, res) => {
  const db = readDB();
  const idx = (db.toplantiNotlari || []).findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not bulunamadi' });
  db.toplantiNotlari[idx] = { ...db.toplantiNotlari[idx], ...req.body };
  writeDB(db);
  res.json(db.toplantiNotlari[idx]);
});

app.delete('/api/notlar/:id', (req, res) => {
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

app.post('/api/katilim/:yearMonth/:day', (req, res) => {
  const { yearMonth, day } = req.params;
  const db = readDB();
  if (!db.katilim[yearMonth]) db.katilim[yearMonth] = {};
  db.katilim[yearMonth][day] = req.body || {};
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

app.listen(PORT, () => {
  console.log(`WCT Dashboard sunucusu calisiyor: http://localhost:${PORT}`);
});
