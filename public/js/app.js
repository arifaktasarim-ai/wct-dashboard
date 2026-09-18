// ================== AYARLAR / KATEGORI TANIMLARI ==================

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

// Organizasyon semasinda kullanilan sabit unvan hiyerarsisi (yukaridan asagiya)
const UNVAN_LIST = [
  'Bölüm Sorumlusu',
  'Kalite Kontrol Uzmanı / Vardiya Sorumlusu',
  'Kalite Kontrol Kıdemli Analisti',
  'Kalite Kontrol Uzman Analisti',
  'Kalite Kontrol Analisti',
  'Kalite Kontrol Uzman Teknisyeni',
  'Kalite Kontrol Teknisyeni'
];

const CONFIG = {
  guvenlik: {
    label: 'Güvenlik (G)',
    hedef: 'Hedef: Minör/Majör Kaza = 0, Ramak Kala = 0 (See Card ayrıca personel bazında takip edilir)',
    letter: 'guvenlik',
    fields: [
      { key: 'minor', label: 'Minör Kaza', type: 'personList' },
      { key: 'majör', label: 'Majör Kaza', type: 'personList' },
      { key: 'ramakKala', label: 'Ramak Kala', type: 'personList' },
      { key: 'seeCard', label: 'See Card', type: 'personList' }
    ],
    status(day) {
      if (!day || !day.reviewed) return 'neutral';
      const kotu = len(day.minor) > 0 || len(day.majör) > 0 || len(day.ramakKala) > 0;
      return kotu ? 'red' : 'green';
    }
  },
  kalite: {
    label: 'Kalite (K)',
    hedef: 'Hedef: Açılan ASD = 0/günlük, Açılan Sapma = 0/günlük',
    letter: 'kalite',
    fields: [
      { key: 'asd', label: 'Açılan ASD', type: 'personList' },
      { key: 'sapma', label: 'Açılan Sapma', type: 'personList' }
    ],
    status(day) {
      if (!day || !day.reviewed) return 'neutral';
      const kotu = len(day.asd) > 0 || len(day.sapma) > 0;
      return kotu ? 'red' : 'green';
    }
  },
  teslimat: {
    label: 'Teslimat (T)',
    hedef: 'Hedef: Teslimat % = 100',
    letter: 'teslimat',
    fields: [
      { key: 'istenenParti', label: 'İstenen Parti', type: 'number' },
      { key: 'onaylananParti', label: 'Onaylanan Parti', type: 'number' }
    ],
    compute(day) {
      const istenen = Number(day.istenenParti || 0);
      const onaylanan = Number(day.onaylananParti || 0);
      if (!istenen) return null;
      return Math.round((onaylanan / istenen) * 1000) / 10;
    },
    status(day) {
      if (!day || !day.reviewed) return 'neutral';
      const istenen = Number(day.istenenParti || 0);
      const onaylanan = Number(day.onaylananParti || 0);
      return onaylanan >= istenen ? 'green' : 'red';
    }
  },
  verimlilik: {
    label: 'Verimlilik (V)',
    hedef: 'Hedef: Fazla Mesai = 0 saat, Eksik/İzinli Personel = 0, Arızalı/Eksik Ekipman = 0',
    letter: 'verimlilik',
    fields: [
      { key: 'fazlaMesai', label: 'Fazla Mesai', type: 'personHours' },
      { key: 'izinliPersonel', label: 'Eksik/İzinli Personel (teslimatı etkileyen)', type: 'personList' },
      { key: 'arizaliEkipman', label: 'Arızalı/Eksik Ekipman (adet)', type: 'number' }
    ],
    status(day) {
      if (!day || !day.reviewed) return 'neutral';
      const kotu = len(day.fazlaMesai) > 0 || len(day.izinliPersonel) > 0 || (Number(day.arizaliEkipman) || 0) > 0;
      return kotu ? 'red' : 'green';
    }
  },
  kalibrasyon: {
    label: 'Kalibrasyonlar',
    hedef: 'Hedef: Planlanan tüm kalibrasyonların zamanında yapılması',
    fields: [
      { key: 'terazi1', label: 'Terazi 1', type: 'triState' },
      { key: 'terazi2', label: 'Terazi 2', type: 'triState' },
      { key: 'terazi3', label: 'Terazi 3', type: 'triState' },
      { key: 'karlFischer', label: 'Karl Fischer', type: 'triState' },
      { key: 'phMetre', label: 'pH Metre', type: 'triState' },
      { key: 'ftir', label: 'FT-IR', type: 'triState' },
      { key: 'turbidimetre', label: 'Türbidimetre', type: 'triState' }
    ],
    status(day) {
      if (!day || !day.reviewed) return 'neutral';
      const kotu = this.fields.some(f => day[f.key] === 'yapilmadi');
      return kotu ? 'red' : 'green';
    }
  }
};

function len(arr) { return Array.isArray(arr) ? arr.length : 0; }

// ================== HARF SEKLI YERLESIM HARITALARI ==================

const LETTER_LAYOUTS = {
  guvenlik: {
    cols: 4, rows: 9,
    cells: [
      { day: 1, row: 0, col: 0 }, { day: 2, row: 0, col: 1 }, { day: 3, row: 0, col: 2 }, { day: 4, row: 0, col: 3 },
      { day: 5, row: 1, col: 0 }, { day: 6, row: 1, col: 1 }, { day: 7, row: 1, col: 2 }, { day: 8, row: 1, col: 3 },
      { day: 9, row: 2, col: 0 }, { day: 10, row: 2, col: 1 }, { day: 11, row: 2, col: 2 }, { day: 12, row: 2, col: 3 },
      { day: 13, row: 3, col: 0 }, { day: 14, row: 3, col: 1 },
      { day: 15, row: 4, col: 0 }, { day: 16, row: 4, col: 1 },
      { day: 17, row: 5, col: 0 }, { day: 18, row: 5, col: 1 }, { day: 19, row: 5, col: 2 }, { day: 20, row: 5, col: 3 },
      { day: 21, row: 6, col: 0 }, { day: 22, row: 6, col: 1 }, { day: 23, row: 6, col: 2 }, { day: 24, row: 6, col: 3 },
      { day: 25, row: 7, col: 0 }, { day: 26, row: 7, col: 1 }, { day: 27, row: 7, col: 2 }, { day: 28, row: 7, col: 3 },
      { day: 29, row: 8, col: 0, span: 2 }, { day: 30, row: 8, col: 2 }, { day: 31, row: 8, col: 3 }
    ]
  },
  kalite: {
    cols: 5, rows: 7,
    cells: [
      { day: 1, row: 0, col: 0 }, { day: 2, row: 0, col: 1 }, { day: 3, row: 0, col: 2 }, { day: 4, row: 0, col: 3 }, { day: 5, row: 0, col: 4 },
      { day: 6, row: 1, col: 0 }, { day: 7, row: 1, col: 1 }, { day: 8, row: 1, col: 2 }, { day: 9, row: 1, col: 3 }, { day: 10, row: 1, col: 4 },
      { day: 11, row: 2, col: 0 }, { day: 12, row: 2, col: 1 }, { day: 13, row: 2, col: 2 }, { day: 14, row: 2, col: 3 },
      { day: 15, row: 3, col: 0 }, { day: 16, row: 3, col: 1 }, { day: 17, row: 3, col: 2 }, { day: 18, row: 3, col: 3 },
      { day: 19, row: 4, col: 0 }, { day: 20, row: 4, col: 1 }, { day: 21, row: 4, col: 2 }, { day: 22, row: 4, col: 3 }, { day: 23, row: 4, col: 4 },
      { day: 24, row: 5, col: 0 }, { day: 25, row: 5, col: 1 }, { day: 26, row: 5, col: 2 }, { day: 27, row: 5, col: 3 }, { day: 28, row: 5, col: 4 },
      { day: 29, row: 6, col: 0 }, { day: 30, row: 6, col: 1 }, { day: 31, row: 6, col: 2 }
    ]
  },
  teslimat: {
    cols: 7, rows: 9,
    cells: [
      { day: 1, row: 0, col: 0 }, { day: 2, row: 0, col: 1 }, { day: 3, row: 0, col: 2 }, { day: 4, row: 0, col: 3 }, { day: 5, row: 0, col: 4 }, { day: 6, row: 0, col: 5 }, { day: 7, row: 0, col: 6 },
      { day: 8, row: 1, col: 2 }, { day: 9, row: 1, col: 3 }, { day: 10, row: 1, col: 4 },
      { day: 11, row: 2, col: 2 }, { day: 12, row: 2, col: 3 }, { day: 13, row: 2, col: 4 },
      { day: 14, row: 3, col: 2 }, { day: 15, row: 3, col: 3 }, { day: 16, row: 3, col: 4 },
      { day: 17, row: 4, col: 2 }, { day: 18, row: 4, col: 3 }, { day: 19, row: 4, col: 4 },
      { day: 20, row: 5, col: 2 }, { day: 21, row: 5, col: 3 }, { day: 22, row: 5, col: 4 },
      { day: 23, row: 6, col: 2 }, { day: 24, row: 6, col: 3 }, { day: 25, row: 6, col: 4 },
      { day: 26, row: 7, col: 2 }, { day: 27, row: 7, col: 3 }, { day: 28, row: 7, col: 4 },
      { day: 29, row: 8, col: 2 }, { day: 30, row: 8, col: 3 }, { day: 31, row: 8, col: 4 }
    ]
  },
  verimlilik: {
    cols: 4, rows: 8,
    cells: [
      { day: 1, row: 0, col: 0 }, { day: 2, row: 0, col: 1 }, { day: 3, row: 0, col: 2 }, { day: 4, row: 0, col: 3 },
      { day: 5, row: 1, col: 0 }, { day: 6, row: 1, col: 1 }, { day: 7, row: 1, col: 2 }, { day: 8, row: 1, col: 3 },
      { day: 9, row: 2, col: 0 }, { day: 10, row: 2, col: 1 }, { day: 11, row: 2, col: 2 }, { day: 12, row: 2, col: 3 },
      { day: 13, row: 3, col: 0 }, { day: 14, row: 3, col: 1 }, { day: 15, row: 3, col: 2 }, { day: 16, row: 3, col: 3 },
      { day: 17, row: 4, col: 0 }, { day: 18, row: 4, col: 1 }, { day: 19, row: 4, col: 2 }, { day: 20, row: 4, col: 3 },
      { day: 21, row: 5, col: 0 }, { day: 22, row: 5, col: 1 }, { day: 23, row: 5, col: 2 }, { day: 24, row: 5, col: 3 },
      { day: 25, row: 6, col: 0 }, { day: 26, row: 6, col: 1 }, { day: 27, row: 6, col: 2 }, { day: 28, row: 6, col: 3 },
      { day: 29, row: 7, col: 0 }, { day: 30, row: 7, col: 1 }, { day: 31, row: 7, col: 2 }
    ]
  }
};

// Kalibrasyon icin duz takvim gorunumu (harf referansi verilmedi)
function buildCalendarLayout(totalDays) {
  const cols = 7;
  const cells = [];
  for (let d = 1; d <= totalDays; d++) {
    const idx = d - 1;
    cells.push({ day: d, row: Math.floor(idx / cols), col: idx % cols });
  }
  return { cols, rows: Math.ceil(totalDays / cols), cells };
}

// ================== DURUM ==================

const today = new Date();
let state = {
  year: today.getFullYear(),
  month: today.getMonth() + 1,
  category: 'ozet',
  categoryData: { guvenlik: {}, kalite: {}, teslimat: {}, verimlilik: {}, kalibrasyon: {} },
  katilimData: {},
  katilimExtraData: {},
  katilimGun: today.getDate(),
  actions: [],
  notlar: [],
  personelList: [],
  duyurular: {},
  sktList: [],
  ayarlar: { bolumAdi: '' },
  editingActionId: null,
  editingPersonId: null,
  personMonthlyBreakdown: {}
};

// ================== BASLANGIC ==================

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  initLoginForm();
  const user = await checkAuthStatus();
  if (user) {
    showAppAfterLogin(user);
  } else {
    showLoginScreen();
  }
});

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

function showLoginScreen() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
}

function showAppAfterLogin(user) {
  currentUser = user;
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  applyRolBasedUI();
  initAppAfterLogin();
}

function initLoginForm() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (err) { /* yine de devam */ }
      location.reload();
    });
  }
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const kullaniciAdi = document.getElementById('loginKullaniciAdi').value.trim();
    const sifre = document.getElementById('loginSifre').value;
    const hataBox = document.getElementById('loginHata');
    const btn = document.getElementById('loginBtn');
    hataBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Giriş yapılıyor…';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullaniciAdi, sifre })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Giriş başarısız.');
      showAppAfterLogin(data.user);
    } catch (err) {
      hataBox.textContent = '⚠ ' + err.message;
      hataBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Giriş Yap';
    }
  });
}

// Eski (4 seviyeli) rol isimleriyle gelen bir oturum varsa (tarayici onbellegi
// vb.) yeni 3 seviyeli sisteme cevirir. Sunucu zaten bu donusumu kalici olarak
// yapiyor; burasi sadece arayuzde gecici bir uyumsuzluk olmamasi icindir.
const ESKI_ROL_HARITASI = { izleyici: 'kullanici', yazici: 'kontrolcu', kidemli: 'kontrolcu' };
function normalizeRolClient(rol) {
  return ESKI_ROL_HARITASI[rol] || rol || 'kullanici';
}

function isAdmin() {
  return !!currentUser && normalizeRolClient(currentUser.rol) === 'admin';
}

function applyRolBasedUI() {
  const rol = normalizeRolClient(currentUser ? currentUser.rol : 'kullanici');
  document.body.dataset.userRole = rol;
  // kullanici (sadece goruntuleme) rolundeki kisiler hicbir yazma arayuzunu,
  // kontrolcu rolundeki kisiler ise sadece SILME arayuzunu gormemeli; CSS bu
  // data-user-role ozniteligine gore ilgili butonlari/formlari gizler (bkz. style.css)
  const userNameEl = document.getElementById('currentUserName');
  if (userNameEl) userNameEl.textContent = currentUser ? `${currentUser.ad} (${ROL_ETIKET[rol] || rol})` : '';

  // "Kullanıcı Yönetimi" sekmesi sadece admin'e gorunur.
  const kullaniciTab = document.querySelector('.tab-btn[data-tab="kullanicilar"]');
  if (kullaniciTab) kullaniciTab.style.display = rol === 'admin' ? '' : 'none';
}

const ROL_ETIKET = { admin: 'Yönetici', kontrolcu: 'Kontrolcü', kullanici: 'Kullanıcı' };

async function initAppAfterLogin() {
  // KRITIK: her init fonksiyonu ayri try/catch icinde cagrilir. Eskiden bu
  // cagrilar sirayla, korumasiz yapiliyordu; herhangi biri hata firlatirsa
  // (orn. bir elemani bulamazsa) kendisinden SONRAKI TUM init cagrilari hic
  // calismiyordu. Bu, "Ayarlar sayfasi hicbir sekilde kaydetmiyor" sikayetinin
  // kok nedeniydi: initAyarlarForm() cagrisi hic yapilamadigi icin "Kaydet"
  // butonunun tikla olayi hic baglanmiyordu. Artik her adim izole; biri
  // patlasa bile digerleri calismaya devam eder ve hata konsola yazilir.
  const steps = [
    ['initPeriodPickers', initPeriodPickers],
    ['initTabs', initTabs],
    ['initActionForm', initActionForm],
    ['initNotForm', initNotForm],
    ['initDuyuruUploads', initDuyuruUploads],
    ['initSktForm', initSktForm],
    ['initPersonelForm', initPersonelForm],
    ['initAyarlarForm', initAyarlarForm]
  ];
  steps.forEach(([name, fn]) => {
    try {
      fn();
    } catch (err) {
      console.error(`[BASLANGIC HATASI] ${name} calisirken hata olustu:`, err);
    }
  });

  try { fillUnvanSelect(document.getElementById('pUnvan')); } catch (err) { console.error('[BASLANGIC HATASI] fillUnvanSelect:', err); }
  // ONEMLI: initBildirimUI, personel listesi YUKLENDIKTEN SONRA cagrilmali;
  // aksi halde "Bildirimler" sekmesindeki personel secim kutusu bos kalir
  // (personel eklenmis olsa bile dropdown'da gorunmez). Daha once bu fonksiyon
  // steps[] icinde (personel listesi yuklenmeden once) cagriliyordu — bu hataya
  // sebep oluyordu.
  try { await loadPersonelList(); } catch (err) { console.error('[BASLANGIC HATASI] loadPersonelList:', err); }
  try { initBildirimUI(); } catch (err) { console.error('[BASLANGIC HATASI] initBildirimUI:', err); }
  try { await loadAyarlar(); renderSiralamaListleri(); } catch (err) { console.error('[BASLANGIC HATASI] loadAyarlar:', err); }
  try { await loadDuyurular(); } catch (err) { console.error('[BASLANGIC HATASI] loadDuyurular:', err); }
  try { await loadSktList(); } catch (err) { console.error('[BASLANGIC HATASI] loadSktList:', err); }
  try { showVersion(); } catch (err) { console.error('[BASLANGIC HATASI] showVersion:', err); }
  try { renderOzet(); } catch (err) { console.error('[BASLANGIC HATASI] renderOzet:', err); }
  try { checkSktWarningsAndPopup(); } catch (err) { console.error('[BASLANGIC HATASI] checkSktWarningsAndPopup:', err); }
  try { await checkGorevlerimVeUyar(); } catch (err) { console.error('[BASLANGIC HATASI] checkGorevlerimVeUyar:', err); }
}

async function showVersion() {
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    document.getElementById('versionFooter').textContent = `Sürüm: ${data.version} — bu numara güncel dosyaların yüklendiğini doğrular`;
  } catch (err) {
    document.getElementById('versionFooter').textContent = 'Sürüm bilgisi alınamadı (sunucu bağlantısı yok)';
  }
}

function initPeriodPickers() {
  const monthSelect = document.getElementById('monthSelect');
  MONTHS_TR.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.textContent = m;
    if (i + 1 === state.month) opt.selected = true;
    monthSelect.appendChild(opt);
  });

  const yearSelect = document.getElementById('yearSelect');
  const currentYear = today.getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === state.year) opt.selected = true;
    yearSelect.appendChild(opt);
  }

  monthSelect.addEventListener('change', () => {
    state.month = Number(monthSelect.value);
    reloadCurrentTab();
  });
  yearSelect.addEventListener('change', () => {
    state.year = Number(yearSelect.value);
    reloadCurrentTab();
  });
}

function reloadCurrentTab() {
  if (state.category === 'aksiyonlar') { loadActions(); loadNotlar(); return; }
  if (state.category === 'personel') { return; }
  if (state.category === 'organizasyon') { return; }
  if (state.category === 'ayarlar') { return; }
  if (state.category === 'kullanicilar') { return; }
  if (state.category === 'ozet') { renderOzet(); return; }
  if (state.category === 'gunluk') { loadAllCategoriesAndRender(); return; }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // "Kullanıcı Yönetimi" sekmesi yalnizca admin icindir; sunucu zaten
      // API seviyesinde bunu zorunlu kilar, bu sadece arayuz guvencesidir.
      if (btn.dataset.tab === 'kullanicilar' && !isAdmin()) return;

      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('grid-' + btn.dataset.tab);
      target.classList.add('active');

      state.category = btn.dataset.tab;
      if (state.category === 'aksiyonlar') {
        loadActions();
        loadNotlar();
        fillDuyuruPreviews();
        loadSktList().then(() => checkSktWarningsAndPopup());
      } else if (state.category === 'personel') {
        renderPersonelTable();
      } else if (state.category === 'organizasyon') {
        renderOrganizasyon();
      } else if (state.category === 'ayarlar') {
        fillAyarlarForm();
        renderSiralamaListleri();
        const bildirimSelect = document.getElementById('bildirimPersonelSelect');
        if (bildirimSelect) fillPersonelSelect(bildirimSelect, localStorage.getItem(MY_PERSONEL_ID_KEY) || '');
      } else if (state.category === 'kullanicilar') {
        renderKullaniciYonetimiTable();
      } else if (state.category === 'ozet') {
        renderOzet();
      } else if (state.category === 'gunluk') {
        loadAllCategoriesAndRender();
      }
    });
  });
}

// ================== PERSONEL ==================

async function loadPersonelList() {
  const res = await fetch('/api/personel');
  state.personelList = await res.json();
  fillPersonelSelect(document.getElementById('actSahibi'));
}

function getPersonName(id) {
  const p = state.personelList.find(p => p.id === id);
  return p ? p.ad : '(silinmiş personel)';
}

function fillPersonelSelect(selectEl, selectedId) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">— Personel seçin —</option>' +
    state.personelList.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.ad)}${p.departman ? ' · ' + escapeHtml(p.departman) : ''}</option>`).join('');
}

function initPersonelForm() {
  const form = document.getElementById('personelForm');
  if (!form) { console.error('[initPersonelForm] #personelForm bulunamadi'); return; }
  let pendingFoto; // undefined = degistirilmedi, string = yeni foto secildi
  let sorumluluklarDraft = []; // form uzerinde duzenlenen sorumluluk listesi

  const pFotoEl = document.getElementById('pFoto');
  if (pFotoEl) {
    pFotoEl.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingFoto = await fileToBase64(file);
      const preview = document.getElementById('pFotoPreview');
      preview.src = pendingFoto;
      preview.style.display = 'inline-block';
    });
  }

  function renderSorumlulukChips() {
    const list = document.getElementById('pSorumlulukChipList');
    if (!list) return;
    if (sorumluluklarDraft.length === 0) {
      list.innerHTML = `<div class="person-chip-empty">Henüz sorumluluk eklenmedi</div>`;
      return;
    }
    list.innerHTML = sorumluluklarDraft.map((s, idx) => `
      <div class="person-chip">
        <span>${escapeHtml(s)}</span>
        <button type="button" class="chip-remove" data-remove-sorumluluk="${idx}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('[data-remove-sorumluluk]').forEach(btn => {
      btn.addEventListener('click', () => {
        sorumluluklarDraft.splice(Number(btn.dataset.removeSorumluluk), 1);
        renderSorumlulukChips();
      });
    });
  }

  const sorumlulukAddBtn = document.getElementById('pSorumlulukAddBtn');
  const sorumlulukInput = document.getElementById('pSorumlulukInput');
  if (sorumlulukAddBtn && sorumlulukInput) {
    const addSorumluluk = () => {
      const val = sorumlulukInput.value.trim();
      if (!val) return;
      sorumluluklarDraft.push(val);
      sorumlulukInput.value = '';
      renderSorumlulukChips();
      sorumlulukInput.focus();
    };
    sorumlulukAddBtn.addEventListener('click', addSorumluluk);
    sorumlulukInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addSorumluluk(); }
    });
  }

  const cancelBtn = document.getElementById('pCancelEditBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      state.editingPersonId = null;
      pendingFoto = undefined;
      sorumluluklarDraft = [];
      renderSorumlulukChips();
      form.reset();
      document.getElementById('pFotoPreview').style.display = 'none';
      fillUnvanSelect(document.getElementById('pUnvan'));
      form.querySelector('button[type="submit"]').textContent = 'Personel Ekle';
      cancelBtn.style.display = 'none';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ad = document.getElementById('pAd').value.trim();
    const departman = document.getElementById('pDepartman').value.trim();
    const unvan = document.getElementById('pUnvan').value;
    if (!ad) return;

    const payload = { ad, departman, unvan, sorumluluklar: sorumluluklarDraft.slice() };
    if (pendingFoto !== undefined) payload.fotoBase64 = pendingFoto;

    if (state.editingPersonId) {
      if (pendingFoto === undefined) {
        // duzenlerken yeni foto secilmediyse mevcut fotografi koru
        const mevcut = state.personelList.find(p => p.id === state.editingPersonId);
        payload.fotoBase64 = mevcut ? (mevcut.fotoBase64 || '') : '';
      }
      const res = await fetch(`/api/personel/${state.editingPersonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { alert('Personel güncellenemedi.'); return; }
      state.editingPersonId = null;
      const cancelBtnEl = document.getElementById('pCancelEditBtn');
      if (cancelBtnEl) cancelBtnEl.style.display = 'none';
      form.querySelector('button[type="submit"]').textContent = 'Personel Ekle';
      showToast('Personel bilgileri güncellendi.');
    } else {
      if (payload.fotoBase64 === undefined) payload.fotoBase64 = '';
      await fetch('/api/personel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    form.reset();
    pendingFoto = undefined;
    sorumluluklarDraft = [];
    renderSorumlulukChips();
    document.getElementById('pFotoPreview').style.display = 'none';
    await loadPersonelList();
    renderPersonelTable();
  });

  // startEditPerson tarafindan cagrilabilmesi icin disariya acilan yardimci
  state.personelFormHelpers = {
    setSorumluluklar(list) { sorumluluklarDraft = Array.isArray(list) ? list.slice() : []; renderSorumlulukChips(); }
  };
  renderSorumlulukChips();
}

function startEditPerson(id) {
  const p = state.personelList.find(x => x.id === id);
  if (!p) return;
  state.editingPersonId = id;
  document.getElementById('pAd').value = p.ad || '';
  document.getElementById('pDepartman').value = p.departman || '';
  fillUnvanSelect(document.getElementById('pUnvan'), p.unvan || '');
  if (state.personelFormHelpers) state.personelFormHelpers.setSorumluluklar(p.sorumluluklar || []);
  const preview = document.getElementById('pFotoPreview');
  if (p.fotoBase64) {
    preview.src = p.fotoBase64;
    preview.style.display = 'inline-block';
  } else {
    preview.style.display = 'none';
  }
  const form = document.getElementById('personelForm');
  form.querySelector('button[type="submit"]').textContent = 'Personeli Güncelle';
  const cancelBtn = document.getElementById('pCancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
  form.scrollIntoView({ behavior: 'smooth' });
}

function fillUnvanSelect(selectEl, selected) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">— Unvan seçin (opsiyonel) —</option>' +
    UNVAN_LIST.map(u => `<option value="${u}" ${u === selected ? 'selected' : ''}>${u}</option>`).join('');
}

// Guvenlik/Kalite/Verimlilik kategorilerinin TUM aylara ait ham verisinden
// (server /api/all/:category ile alinir) her personel + her ay icin
// { kaza, ramakKala, seeCard, asd, sapma, fazlaMesaiSaat, izinliGun } kirilimi
// cikarir. Hem "tum zamanlar" kisi detayi hem de "yillik" bolum ozeti bu tek
// yapidan turetilir (ayni mantigin iki yerde tekrarlanmasini onler).
function buildPersonMonthlyBreakdown(allCategoryData) {
  const map = {}; // personId -> { yearMonth -> {...} }

  function ensure(personId, ym) {
    if (!personId) return null;
    if (!map[personId]) map[personId] = {};
    if (!map[personId][ym]) {
      map[personId][ym] = { kaza: 0, ramakKala: 0, seeCard: 0, asd: 0, sapma: 0, fazlaMesaiSaat: 0, izinliGun: 0 };
    }
    return map[personId][ym];
  }

  Object.entries(allCategoryData.guvenlik || {}).forEach(([ym, days]) => {
    Object.values(days || {}).forEach(day => {
      (day.minor || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.kaza++; });
      (day.majör || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.kaza++; });
      (day.ramakKala || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.ramakKala++; });
      (day.seeCard || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.seeCard++; });
    });
  });

  Object.entries(allCategoryData.kalite || {}).forEach(([ym, days]) => {
    Object.values(days || {}).forEach(day => {
      (day.asd || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.asd++; });
      (day.sapma || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.sapma++; });
    });
  });

  Object.entries(allCategoryData.verimlilik || {}).forEach(([ym, days]) => {
    Object.values(days || {}).forEach(day => {
      (day.fazlaMesai || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.fazlaMesaiSaat += Number(it.saat || 0); });
      (day.izinliPersonel || []).forEach(it => { const t = ensure(it.personelId, ym); if (t) t.izinliGun++; });
    });
  });

  return map;
}

// personMonthlyBreakdown map'inden bir personelin belirli bir yila (yearFilter)
// veya tum zamanlara (yearFilter=null) ait toplamini ve ay bazli kirilimini dondurur.
function summarizePersonBreakdown(personId, yearFilter) {
  const monthsMap = (state.personMonthlyBreakdown && state.personMonthlyBreakdown[personId]) || {};
  const totals = { kaza: 0, ramakKala: 0, seeCard: 0, asd: 0, sapma: 0, fazlaMesaiSaat: 0, izinliGun: 0 };
  const monthlyRows = [];
  Object.entries(monthsMap)
    .filter(([ym]) => !yearFilter || ym.startsWith(yearFilter + '-'))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([ym, vals]) => {
      totals.kaza += vals.kaza; totals.ramakKala += vals.ramakKala; totals.seeCard += vals.seeCard;
      totals.asd += vals.asd; totals.sapma += vals.sapma;
      totals.fazlaMesaiSaat += vals.fazlaMesaiSaat; totals.izinliGun += vals.izinliGun;
      monthlyRows.push({ ym, ...vals });
    });
  return { totals, monthlyRows };
}

// Katilim verisinden (tum aylar) her personelin izinli/raporlu oldugu gunlerde
// girilen izinGun/raporGun sayilarinin ay bazli kirilimini cikarir.
function buildKatilimMonthlyBreakdown(allKatilimData) {
  const map = {}; // personId -> { yearMonth -> {izinGun, raporGun} }
  Object.entries(allKatilimData || {}).forEach(([ym, days]) => {
    Object.values(days || {}).forEach(dayEntry => {
      Object.entries(dayEntry || {}).forEach(([personId, val]) => {
        if (getKatilimDurum(val) !== 'izinli') return;
        const extra = getKatilimExtra(val);
        if (!map[personId]) map[personId] = {};
        if (!map[personId][ym]) map[personId][ym] = { izinGun: 0, raporGun: 0 };
        map[personId][ym].izinGun += extra.izinGun;
        map[personId][ym].raporGun += extra.raporGun;
      });
    });
  });
  return map;
}

// yearFilter=null ise tum zamanlar, aksi halde sadece o yila ait toplam
function summarizeKatilimBreakdown(personId, yearFilter) {
  const monthsMap = (state.katilimMonthlyBreakdown && state.katilimMonthlyBreakdown[personId]) || {};
  const totals = { izinGun: 0, raporGun: 0 };
  Object.entries(monthsMap)
    .filter(([ym]) => !yearFilter || ym.startsWith(yearFilter + '-'))
    .forEach(([, vals]) => { totals.izinGun += vals.izinGun; totals.raporGun += vals.raporGun; });
  return totals;
}

// Sadece TEK bir aya (yearMonth) ait izin/rapor toplami (Personel Bazli Ozet - secili ay icin)
function getKatilimForMonth(personId, yearMonth) {
  const monthsMap = (state.katilimMonthlyBreakdown && state.katilimMonthlyBreakdown[personId]) || {};
  return monthsMap[yearMonth] || { izinGun: 0, raporGun: 0 };
}

function personAvatarHtml(p, size) {
  size = size || 32;
  if (p && p.fotoBase64) {
    return `<img src="${p.fotoBase64}" class="person-avatar" style="width:${size}px;height:${size}px;">`;
  }
  const initials = p && p.ad ? p.ad.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() : '?';
  return `<div class="person-avatar person-avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;">${initials}</div>`;
}

function sorumlulukBadgesHtml(sorumluluklar) {
  if (!sorumluluklar || sorumluluklar.length === 0) {
    return `<span style="color:#9ca3af;font-size:12px;">-</span>`;
  }
  return sorumluluklar.map(s => `<span class="badge badge-sorumluluk">${escapeHtml(s)}</span>`).join(' ');
}

function renderPersonelTable() {
  const tbody = document.getElementById('personelTableBody');
  if (state.personelList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6b7280;">Henüz personel eklenmedi.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.personelList.map(p => `
    <tr>
      <td>${personAvatarHtml(p, 40)}</td>
      <td>${escapeHtml(p.ad)}</td>
      <td>${escapeHtml(p.departman || '')}</td>
      <td>${escapeHtml(p.unvan || '-')}</td>
      <td>${sorumlulukBadgesHtml(p.sorumluluklar)}</td>
      <td>
        <button class="icon-btn" data-edit-person="${p.id}">Düzenle</button>
        <button class="icon-btn danger" data-del-person="${p.id}">Sil</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-person]').forEach(btn => {
    btn.addEventListener('click', () => startEditPerson(btn.dataset.editPerson));
  });

  tbody.querySelectorAll('[data-del-person]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Bu personeli silmek istediğinize emin misiniz? (Geçmiş kayıtlardaki ismi "silinmiş personel" olarak görünecektir.)')) return;
      await fetch(`/api/personel/${btn.dataset.delPerson}`, { method: 'DELETE' });
      await loadPersonelList();
      renderPersonelTable();
    });
  });
}

// ================== KULLANICI YONETIMI (sadece admin) ==================
// Personel kayitlarina giris bilgisi (kullanici adi/sifre) ve yetki rolu
// atamak icin admin'e ozel panel. Rol seviyeleri:
//   admin      -> tum yetkiler (silme dahil)
//   kontrolcu  -> ekleyebilir/duzenleyebilir, SILEMEZ
//   kullanici  -> sadece goruntuleme

const ROL_SECENEKLERI = [
  { value: 'kullanici', label: 'Kullanıcı (sadece görüntüleme)' },
  { value: 'kontrolcu', label: 'Kontrolcü (kullanır, silemez)' },
  { value: 'admin', label: 'Admin (tüm yetkiler)' }
];

function renderKullaniciYonetimiTable() {
  const tbody = document.getElementById('kullaniciYonetimiTableBody');
  if (!tbody) return;

  if (state.personelList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#6b7280;">Henüz personel eklenmedi. Önce "Personel" sekmesinden personel ekleyin.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.personelList.map(p => {
    const rol = normalizeRolClient(p.rol);
    return `
    <tr data-user-row="${p.id}">
      <td>${personAvatarHtml(p, 32)} ${escapeHtml(p.ad)}</td>
      <td><input type="text" class="ku-username" data-ku-username="${p.id}" value="${escapeHtml(p.kullaniciAdi || '')}" placeholder="kullanıcı adı (opsiyonel)"></td>
      <td><input type="password" class="ku-password" data-ku-password="${p.id}" placeholder="değiştirmek için girin" autocomplete="new-password"></td>
      <td>
        <select data-ku-rol="${p.id}">
          ${ROL_SECENEKLERI.map(r => `<option value="${r.value}" ${r.value === rol ? 'selected' : ''}>${r.label}</option>`).join('')}
        </select>
      </td>
      <td><button type="button" class="icon-btn" data-ku-save="${p.id}">Kaydet</button></td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('[data-ku-save]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.kuSave;
      const usernameEl = tbody.querySelector(`[data-ku-username="${id}"]`);
      const passwordEl = tbody.querySelector(`[data-ku-password="${id}"]`);
      const rolEl = tbody.querySelector(`[data-ku-rol="${id}"]`);

      const kullaniciAdi = usernameEl.value.trim();
      const sifre = passwordEl.value;
      const rol = rolEl.value;

      if (kullaniciAdi && !sifre) {
        const mevcut = state.personelList.find(p => p.id === id);
        if (!mevcut || !mevcut.kullaniciAdi) {
          alert('Bu kişi için yeni bir kullanıcı adı belirlediniz; ilk şifreyi de girmeniz gerekiyor.');
          return;
        }
      }

      const payload = { kullaniciAdi, rol };
      if (sifre) payload.sifre = sifre;

      btn.disabled = true;
      btn.textContent = 'Kaydediliyor…';
      try {
        const res = await fetch(`/api/personel/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Kaydedilemedi.');
        passwordEl.value = '';
        await loadPersonelList();
        showToast('Kullanıcı bilgileri güncellendi.');
        renderKullaniciYonetimiTable();
      } catch (err) {
        alert('⚠ ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Kaydet';
      }
    });
  });
}

// ================== GUNLUK KATEGORI VERISI ==================

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Her kategori artik ayni sayfada gosterildigi icin veriler kategoriye gore ayri tutulur
async function loadOneCategory(category) {
  const yearMonth = `${state.year}-${String(state.month).padStart(2, '0')}`;
  const res = await fetch(`/api/data/${category}/${yearMonth}`);
  const data = await res.json();
  state.categoryData[category] = data;
  return data;
}

async function loadAllCategoriesAndRender() {
  const categories = ['guvenlik', 'kalite', 'teslimat', 'verimlilik', 'kalibrasyon'];
  await Promise.all(categories.map(c => loadOneCategory(c)));
  renderGunlukTakip();
}

async function saveDay(category, day, patch) {
  if (!state.categoryData[category][day]) state.categoryData[category][day] = {};
  Object.assign(state.categoryData[category][day], patch);
  Object.keys(state.categoryData[category][day]).forEach(k => {
    if (state.categoryData[category][day][k] === null) delete state.categoryData[category][day][k];
  });
  const yearMonth = `${state.year}-${String(state.month).padStart(2, '0')}`;
  const res = await fetch(`/api/data/${category}/${yearMonth}/${day}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    // fetch HTTP hata kodlarinda (400/500) exception FIRLATMAZ; bunu biz
    // firlatiyoruz ki cagiran kod (Kaydet butonu) hatayi fark edebilsin.
    const text = await res.text().catch(() => '');
    throw new Error(`Sunucu kaydetmeyi reddetti (HTTP ${res.status}): ${text}`);
  }
  console.log(`[saveDay] ${category} gun ${day} kaydedildi:`, await res.clone().json().catch(() => null));
}

async function clearDay(category, day) {
  delete state.categoryData[category][day];
  const yearMonth = `${state.year}-${String(state.month).padStart(2, '0')}`;
  const res = await fetch(`/api/data/${category}/${yearMonth}/${day}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Sunucu silmeyi reddetti (HTTP ${res.status})`);
  }
}

function renderOneCategoryGrid(category, container) {
  const totalDays = daysInMonth(state.year, state.month);
  // Kullanicinin talebi uzerine tum kategoriler (Guvenlik, Kalite, Teslimat,
  // Verimlilik, Kalibrasyon) artik harf seklinde degil, Kalibrasyon
  // tablosuyla ayni sade takvim (7 sutunluk) duzeninde gosteriliyor.
  const layout = buildCalendarLayout(totalDays);
  renderDayGrid(category, container, layout, totalDays);
}

// ---------- Gunluk Takip sayfasi: 5 kategori + Katilim Listesi tek sayfada ----------

function renderGunlukTakip() {
  const categories = ['guvenlik', 'kalite', 'teslimat', 'verimlilik', 'kalibrasyon'];
  categories.forEach(c => {
    renderOneCategoryGrid(c, document.getElementById('subgrid-' + c));
  });
  applyGunlukSiralama();
  renderKatilimSection();
}

async function renderKatilimSection() {
  const container = document.getElementById('katilimSection');
  const totalDays = daysInMonth(state.year, state.month);
  if (state.katilimGun > totalDays) state.katilimGun = totalDays;

  let dayOptionsHtml = '';
  for (let d = 1; d <= totalDays; d++) {
    dayOptionsHtml += `<option value="${d}" ${d === state.katilimGun ? 'selected' : ''}>${String(d).padStart(2, '0')} ${MONTHS_TR[state.month - 1]}</option>`;
  }

  container.innerHTML = `
    <div class="category-hedef" style="margin-top:0;">Seçilen güne ait WCT toplantısına katılım durumu. Her gün ayrı ayrı kaydedilir.</div>
    <div class="katilim-toolbar">
      <label>Gün: <select id="katilimGunSelect">${dayOptionsHtml}</select></label>
      <span class="modal-save-status" id="katilimSaveStatus"></span>
    </div>
    <div id="katilimTableWrap"><p style="color:#6b7280;">Yükleniyor…</p></div>
    <button type="button" class="btn-primary" id="katilimKaydetBtn" style="margin-top:14px;">Katılımı Kaydet</button>
  `;

  document.getElementById('katilimGunSelect').addEventListener('change', async (e) => {
    state.katilimGun = Number(e.target.value);
    await loadAndRenderKatilimTable();
  });

  document.getElementById('katilimKaydetBtn').addEventListener('click', saveKatilim);

  await loadAndRenderKatilimTable();
}

// Katilim verisi eski surumde duz string ('katildi'/'katilmadi'/'izinli') idi.
// Yeni surumde 'izinli' secildiginde ek bilgi (izinGun, raporGun) tutulabilmesi
// icin deger bir obje de olabiliyor: { durum: 'izinli', izinGun, raporGun }.
function getKatilimDurum(entry) {
  if (!entry) return '';
  return typeof entry === 'object' ? (entry.durum || '') : entry;
}
function getKatilimExtra(entry) {
  if (entry && typeof entry === 'object') {
    return { izinGun: Number(entry.izinGun) || 0, raporGun: Number(entry.raporGun) || 0 };
  }
  return { izinGun: 0, raporGun: 0 };
}

// Bir personelin, secili gunden ONCEKI bir gunde girilmis izin/rapor kaydinin
// suresi icinde olup olmadigini hesaplar. Varsa o gun icin satir kilitlenir.
function computeKatilimKilit(personId, monthData, currentDay) {
  let bulunan = null;
  for (let d = 1; d < currentDay; d++) {
    const dayEntry = monthData[d];
    if (!dayEntry || !dayEntry[personId]) continue;
    if (getKatilimDurum(dayEntry[personId]) !== 'izinli') continue;
    const extra = getKatilimExtra(dayEntry[personId]);
    const toplamGun = (extra.izinGun || 0) + (extra.raporGun || 0);
    if (toplamGun <= 0) continue;
    const bitisGunu = d + toplamGun - 1;
    if (currentDay <= bitisGunu) {
      // en yakin (en son) kapsayan kaydi esas al
      bulunan = { anchorDay: d, izinGun: extra.izinGun, raporGun: extra.raporGun, toplamGun, bitisGunu };
    }
  }
  return bulunan;
}

async function loadAndRenderKatilimTable() {
  const yearMonth = `${state.year}-${String(state.month).padStart(2, '0')}`;
  const [dayRes, monthRes] = await Promise.all([
    fetch(`/api/katilim/${yearMonth}/${state.katilimGun}`),
    fetch(`/api/katilim/${yearMonth}`)
  ]);
  const data = await dayRes.json(); // { personelId: 'katildi'|'katilmadi'|{durum:'izinli',izinGun,raporGun} }
  const monthData = await monthRes.json(); // { "1": {...}, "2": {...}, ... }
  state.katilimData = data;
  state.katilimMonthData = monthData;
  // her personelin o gune ait izin/rapor ek bilgisini ayri tutuyoruz (popup'ta duzenlenir)
  state.katilimExtraData = {};
  Object.keys(data).forEach(pid => { state.katilimExtraData[pid] = getKatilimExtra(data[pid]); });

  const wrap = document.getElementById('katilimTableWrap');
  if (state.personelList.length === 0) {
    wrap.innerHTML = `<p style="color:#6b7280;">Henüz personel eklenmemiş. "Personel" sekmesinden ekleyin.</p>`;
    return;
  }

  wrap.innerHTML = `
    <table class="actions-table katilim-table">
      <thead><tr><th>Personel</th><th>Katıldı</th><th>Katılmadı</th><th>İzinli / Raporlu</th></tr></thead>
      <tbody>
        ${state.personelList.map(p => {
          const kilit = computeKatilimKilit(p.id, monthData, state.katilimGun);
          const durum = kilit ? 'izinli' : getKatilimDurum(data[p.id]);
          const extra = kilit ? { izinGun: kilit.izinGun, raporGun: kilit.raporGun } : getKatilimExtra(data[p.id]);
          const extraHint = durum === 'izinli' && (extra.izinGun || extra.raporGun)
            ? `${extra.izinGun ? extra.izinGun + ' gün izin' : ''}${extra.izinGun && extra.raporGun ? ' · ' : ''}${extra.raporGun ? extra.raporGun + ' gün rapor' : ''}`
            : '';
          const kilitliMi = !!kilit;
          const disabledAttr = kilitliMi ? 'disabled' : '';

          let ipucuHtml = '';
          if (kilitliMi) {
            const kalanGun = kilit.bitisGunu - state.katilimGun + 1;
            ipucuHtml = `<div class="katilim-extra-hint katilim-locked-hint">🔒 ${extraHint} — ${String(kilit.anchorDay).padStart(2, '0')}. günden itibaren kilitli (${kalanGun} gün daha)
              <button type="button" class="katilim-edit-link" data-duzenle-personel="${p.id}" data-duzenle-anchor="${kilit.anchorDay}">Düzenle</button>
            </div>`;
          } else if (extraHint) {
            ipucuHtml = `<div class="katilim-extra-hint">${extraHint}</div>`;
          }

          return `
          <tr class="${kilitliMi ? 'katilim-row-locked' : ''}">
            <td>${personAvatarHtml(p, 26)}<span style="margin-left:8px;">${escapeHtml(p.ad)}</span></td>
            <td class="katilim-cell"><input type="radio" name="katilim_${p.id}" value="katildi" ${durum === 'katildi' ? 'checked' : ''} data-katilim-personel="${p.id}" class="katilim-radio katilim-green" ${disabledAttr}></td>
            <td class="katilim-cell"><input type="radio" name="katilim_${p.id}" value="katilmadi" ${durum === 'katilmadi' ? 'checked' : ''} data-katilim-personel="${p.id}" class="katilim-radio katilim-red" ${disabledAttr}></td>
            <td class="katilim-cell">
              <input type="radio" name="katilim_${p.id}" value="izinli" ${durum === 'izinli' ? 'checked' : ''} data-katilim-personel="${p.id}" class="katilim-radio katilim-yellow" ${disabledAttr}>
              ${ipucuHtml}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // "Izinli/Raporlu" secildiginde kac gun izin / kac gun rapor oldugunu soran popup ac
  wrap.querySelectorAll('.katilim-radio.katilim-yellow:not(:disabled)').forEach(radio => {
    radio.addEventListener('click', () => {
      const personelId = radio.dataset.katilimPersonel;
      openIzinRaporPopup(personelId);
    });
  });

  // Kilitli satirlardaki "Duzenle" butonu: kaydin girildigi gune (anchor) atlar ve popup'i acar
  wrap.querySelectorAll('[data-duzenle-personel]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const personelId = btn.dataset.duzenlePersonel;
      const anchorDay = Number(btn.dataset.duzenleAnchor);
      state.katilimGun = anchorDay;
      const gunSelect = document.getElementById('katilimGunSelect');
      if (gunSelect) gunSelect.value = String(anchorDay);
      await loadAndRenderKatilimTable();
      openIzinRaporPopup(personelId);
    });
  });
}

function openIzinRaporPopup(personelId) {
  const mevcut = state.katilimExtraData[personelId] || { izinGun: 0, raporGun: 0 };
  const p = state.personelList.find(x => x.id === personelId);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:400px;">
      <div class="modal-header">
        <h3>İzinli / Raporlu — ${p ? escapeHtml(p.ad) : ''}</h3>
        <button class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-body">
        <label class="modal-field">
          <span>Kaç gün izinli</span>
          <input type="number" min="0" id="izinGunInput" value="${mevcut.izinGun || 0}">
        </label>
        <label class="modal-field">
          <span>Kaç gün raporlu</span>
          <input type="number" min="0" id="raporGunInput" value="${mevcut.raporGun || 0}">
        </label>
      </div>
      <div class="modal-footer">
        <span></span>
        <button type="button" class="btn-primary" id="izinRaporSaveBtn">Tamam</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#izinRaporSaveBtn').addEventListener('click', () => {
    const izinGun = Number(document.getElementById('izinGunInput').value) || 0;
    const raporGun = Number(document.getElementById('raporGunInput').value) || 0;
    state.katilimExtraData[personelId] = { izinGun, raporGun };
    close();
    // hint gorselini aninda guncellemek icin tabloyu yeniden ciz
    renderKatilimRadiosState();
  });
}

// Radyo secimlerini bozmadan sadece "izinli" satirindaki ipucu metnini yeniler
function renderKatilimRadiosState() {
  document.querySelectorAll('.katilim-radio.katilim-yellow').forEach(radio => {
    const personelId = radio.dataset.katilimPersonel;
    const extra = state.katilimExtraData[personelId] || { izinGun: 0, raporGun: 0 };
    const cell = radio.closest('td');
    let hint = cell.querySelector('.katilim-extra-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'katilim-extra-hint';
      cell.appendChild(hint);
    }
    if (radio.checked && (extra.izinGun || extra.raporGun)) {
      hint.innerHTML = `${extra.izinGun ? extra.izinGun + ' gün izin' : ''}${extra.izinGun && extra.raporGun ? ' · ' : ''}${extra.raporGun ? extra.raporGun + ' gün rapor' : ''}`;
    } else {
      hint.innerHTML = '';
    }
  });
}

async function saveKatilim() {
  const yearMonth = `${state.year}-${String(state.month).padStart(2, '0')}`;
  const wrap = document.getElementById('katilimTableWrap');
  const payload = {};
  wrap.querySelectorAll('.katilim-radio:checked').forEach(input => {
    // Kilitli (disabled) satirlar icin bu gune ozel bir kayit YAZILMAZ; kilit,
    // sadece kaynak (anchor) gunun kaydindan turetilen sanal bir durumdur.
    if (input.disabled) return;
    const personelId = input.dataset.katilimPersonel;
    if (input.value === 'izinli') {
      const extra = state.katilimExtraData[personelId] || { izinGun: 0, raporGun: 0 };
      payload[personelId] = { durum: 'izinli', izinGun: extra.izinGun, raporGun: extra.raporGun };
    } else {
      payload[personelId] = input.value;
    }
  });
  const statusEl = document.getElementById('katilimSaveStatus');
  statusEl.textContent = 'Kaydediliyor…';
  statusEl.className = 'modal-save-status saving';
  try {
    const res = await fetch(`/api/katilim/${yearMonth}/${state.katilimGun}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.katilimData = payload;
    statusEl.textContent = '✓ Kaydedildi';
    statusEl.className = 'modal-save-status saved';
  } catch (err) {
    console.error(err);
    statusEl.textContent = '⚠ Kaydedilemedi';
    statusEl.className = 'modal-save-status error';
  }
}

const CATEGORY_COLORS = {
  guvenlik: '#2563eb',
  kalite: '#7c3aed',
  teslimat: '#0d9488',
  verimlilik: '#ea580c',
  kalibrasyon: '#475569'
};

function renderDayGrid(category, container, layout, totalDays) {
  const cfg = CONFIG[category];
  const CELL = 40; // px - sabit hucre boyutu, sutun sayisindan bagimsiz (gun adi icin biraz buyutuldu)
  const GAP = 5;   // px
  const accent = (state.ayarlar.categoryColors && state.ayarlar.categoryColors[category]) || CATEGORY_COLORS[category] || '#1b2a4a';
  const GUN_KISALTMA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  let html = `<div class="category-card" style="--accent:${accent};">`;
  html += `<h2 class="category-title"><span class="category-title-dot" style="background:${accent};"></span>${cfg.label}</h2>`;
  html += `<div class="category-hedef">${cfg.hedef}</div>`;

  html += `<div class="letter-grid-wrapper">`;
  html += `<div class="letter-grid" style="grid-template-columns:repeat(${layout.cols},${CELL}px);grid-template-rows:repeat(${layout.rows},${CELL}px);gap:${GAP}px;">`;

  layout.cells.forEach(cell => {
    const disabled = cell.day > totalDays;
    const dayData = state.categoryData[category][cell.day] || {};
    const status = disabled ? 'disabled' : cfg.status(dayData);
    const span = cell.span ? `grid-column:${cell.col + 1} / span ${cell.span};` : `grid-column:${cell.col + 1};`;
    const gunAdi = disabled ? '' : GUN_KISALTMA[new Date(state.year, state.month - 1, cell.day).getDay()];
    html += `<div class="day-cell status-${status} ${disabled ? 'day-cell-disabled' : ''}"
                  style="grid-row:${cell.row + 1};${span}"
                  data-day="${cell.day}"
                  ${disabled ? '' : `data-clickable="1"`}>
                ${gunAdi ? `<span class="day-weekday">${gunAdi}</span>` : ''}
                <span class="day-number">${cell.day}</span>
              </div>`;
  });

  html += `</div></div>`;

  html += `<div class="legend">
    <div class="legend-item"><div class="legend-dot status-green"></div>Hedefe uygun</div>
    <div class="legend-item"><div class="legend-dot status-red"></div>Sapma var</div>
    <div class="legend-item"><div class="legend-dot status-neutral"></div>Veri girilmedi / henüz kaydedilmedi</div>
  </div>`;
  html += `</div>`;

  container.innerHTML = html;

  container.querySelectorAll('[data-clickable="1"]').forEach(cell => {
    cell.addEventListener('click', () => {
      openDayModal(category, Number(cell.dataset.day));
    });
  });
}

// ---------- Gun duzenleme penceresi (modal) ----------

function openDayModal(category, day) {
  const cfg = CONFIG[category];
  const existing = state.categoryData[category][day] || {};
  // modal icinde calisilan gecici kopya (Kaydet'e basana kadar sunucuya gitmez)
  const draft = JSON.parse(JSON.stringify(existing));
  cfg.fields.forEach(f => {
    if ((f.type === 'personList' || f.type === 'personHours') && !Array.isArray(draft[f.key])) {
      draft[f.key] = [];
    }
  });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const canClear = !!state.categoryData[category][day];

  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${cfg.label} — ${String(day).padStart(2, '0')} ${MONTHS_TR[state.month - 1]} ${state.year}</h3>
        <button class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-instruction">⚠️ "+ Ekle" ile personel eklemek/çıkarmak henüz KAYDETMEZ. Tüm değişiklikleri yaptıktan sonra mutlaka en alttaki <strong>"Kaydet"</strong> butonuna basmalısınız, aksi halde hiçbir şey kaydedilmez.</div>
      <div class="modal-body" id="modalBody"></div>
      ${cfg.compute ? `<div class="modal-computed" id="modalComputed"></div>` : ''}
      <div class="modal-verify-box" id="modalVerifyBox"></div>
      <div class="modal-footer">
        ${canClear ? `<button type="button" class="btn-secondary" id="modalClearBtn">Bu Günü Temizle</button>` : `<span></span>`}
        <button type="button" class="btn-primary" id="modalSaveBtn">✓ Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let hasUnsavedChanges = false;
  const modalBody = overlay.querySelector('#modalBody');

  function updateVerifyBox() {
    const verifyEl = overlay.querySelector('#modalVerifyBox');
    if (!verifyEl) return;
    const parts = cfg.fields.map(f => {
      if (f.type === 'personList' || f.type === 'personHours') {
        return `${f.label}: <strong>${len(draft[f.key])}</strong>`;
      }
      if (f.type === 'triState') {
        return `${f.label}: <strong>${draft[f.key] === 'yapildi' ? 'Yapıldı' : draft[f.key] === 'yapilmadi' ? 'Yapılmadı' : '-'}</strong>`;
      }
      return `${f.label}: <strong>${draft[f.key] ?? '-'}</strong>`;
    });
    const willBeRed = cfg.status({ ...draft, reviewed: true }) === 'red';
    verifyEl.innerHTML = `
      <div class="verify-title">Kaydet'e bastığınızda kaydedilecekler (kontrol edin):</div>
      <div class="verify-fields">${parts.join(' &nbsp;·&nbsp; ')}</div>
      <div class="verify-result">Sonuç durumu: <span class="status-pill ${willBeRed ? 'pill-red' : 'pill-green'}">${willBeRed ? 'KIRMIZI (sapma var)' : 'YEŞİL (uygun)'}</span></div>
    `;
  }

  function renderFields() {
    let html = '';
    cfg.fields.forEach(f => {
      if (f.type === 'number') {
        const val = draft[f.key] !== undefined && draft[f.key] !== null ? draft[f.key] : 0;
        html += `<label class="modal-field">
          <span>${f.label}</span>
          <input type="number" min="0" data-key="${f.key}" data-type="number" value="${val}">
        </label>`;
      } else if (f.type === 'triState') {
        const val = draft[f.key] === 'yapilmadi' ? 'yapilmadi' : 'yapildi'; // varsayilan: Yapildi
        html += `<label class="modal-field">
          <span>${f.label}</span>
          <select data-key="${f.key}" data-type="triState">
            <option value="yapildi" ${val === 'yapildi' ? 'selected' : ''}>Yapıldı</option>
            <option value="yapilmadi" ${val === 'yapilmadi' ? 'selected' : ''}>Yapılmadı</option>
          </select>
        </label>`;
      } else if (f.type === 'personList' || f.type === 'personHours') {
        const list = draft[f.key] || [];
        html += `<div class="modal-field-group">
          <div class="modal-field-group-label">${f.label}</div>
          <div class="person-chip-list" data-list-for="${f.key}">
            ${list.map(item => `
              <div class="person-chip">
                <span>${escapeHtml(getPersonName(item.personelId))}${f.type === 'personHours' ? ` — ${item.saat || 0} saat` : ''}${item.not ? `<em class="chip-note"> · ${escapeHtml(item.not)}</em>` : ''}</span>
                <button type="button" class="chip-remove" data-remove-item="${f.key}:${item.id}">✕</button>
              </div>
            `).join('') || `<div class="person-chip-empty">Kayıt yok</div>`}
          </div>
          <div class="person-add-row">
            <select data-add-select="${f.key}"></select>
            ${f.type === 'personHours' ? `<input type="number" min="0" step="0.5" placeholder="saat" data-add-hours="${f.key}" style="width:70px;">` : ''}
            <input type="text" placeholder="Not (opsiyonel)" data-add-note="${f.key}" style="flex:1;min-width:110px;">
            <button type="button" class="btn-small" data-add-btn="${f.key}">+ Ekle</button>
          </div>
          <div class="field-warning" data-warning-for="${f.key}" style="display:none;">Lütfen önce bir personel seçin.</div>
        </div>`;
      }
    });
    modalBody.innerHTML = html;

    // secim kutularini doldur
    cfg.fields.forEach(f => {
      if (f.type === 'personList' || f.type === 'personHours') {
        fillPersonelSelect(modalBody.querySelector(`[data-add-select="${f.key}"]`));
      }
    });

    // ekle butonlari (sadece taslagi/draft'i degistirir, sunucuya "Kaydet"e basinca gider)
    modalBody.querySelectorAll('[data-add-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.addBtn;
        const select = modalBody.querySelector(`[data-add-select="${key}"]`);
        const personelId = select.value;
        const warningEl = modalBody.querySelector(`[data-warning-for="${key}"]`);
        if (!personelId) {
          if (warningEl) warningEl.style.display = 'block';
          return;
        }
        if (warningEl) warningEl.style.display = 'none';
        const field = cfg.fields.find(f => f.key === key);
        const item = { id: 'i' + Date.now() + Math.random().toString(36).slice(2, 6), personelId };
        if (field.type === 'personHours') {
          const hoursInput = modalBody.querySelector(`[data-add-hours="${key}"]`);
          item.saat = Number(hoursInput.value || 0);
        }
        const noteInput = modalBody.querySelector(`[data-add-note="${key}"]`);
        if (noteInput && noteInput.value.trim()) item.not = noteInput.value.trim();
        if (!draft[key]) draft[key] = [];
        draft[key].push(item);
        renderFields();
        updateComputed();
        updateVerifyBox();
        hasUnsavedChanges = true;
      });
    });

    // sil butonlari
    modalBody.querySelectorAll('[data-remove-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [key, id] = btn.dataset.removeItem.split(':');
        draft[key] = (draft[key] || []).filter(it => it.id !== id);
        renderFields();
        updateComputed();
        updateVerifyBox();
        hasUnsavedChanges = true;
      });
    });

    // number / triState degisiklikleri sadece taslagi (draft) gunceller
    modalBody.querySelectorAll('[data-type="number"]').forEach(input => {
      input.addEventListener('input', () => {
        draft[input.dataset.key] = input.value === '' ? null : Number(input.value);
        updateComputed();
        updateVerifyBox();
        hasUnsavedChanges = true;
      });
    });
    modalBody.querySelectorAll('[data-type="triState"]').forEach(sel => {
      sel.addEventListener('change', () => {
        draft[sel.dataset.key] = sel.value === '' ? null : sel.value;
        updateVerifyBox();
        hasUnsavedChanges = true;
      });
    });
  }

  function updateComputed() {
    if (!cfg.compute) return;
    const el = overlay.querySelector('#modalComputed');
    const val = cfg.compute(draft);
    if (el) el.innerHTML = `Teslimat %: <strong>${val === null ? '-' : val + '%'}</strong>`;
  }

  renderFields();
  updateComputed();
  updateVerifyBox();

  const close = () => {
    if (hasUnsavedChanges) {
      if (!confirm('KAYDET\'e basmadınız! Yaptığınız değişiklikler (eklenen/çıkarılan personel, girilen sayılar) kaydedilmeyecek. Yine de kapatmak istiyor musunuz?')) {
        return;
      }
    }
    overlay.remove();
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.modal-close').addEventListener('click', close);

  const clearBtn = overlay.querySelector('#modalClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (!confirm('Bu güne ait tüm veriler silinecek. Emin misiniz?')) return;
      hasUnsavedChanges = false;
      await clearDay(category, day);
      close();
      renderOneCategoryGrid(category, document.getElementById('subgrid-' + category));
    });
  }

  overlay.querySelector('#modalSaveBtn').addEventListener('click', async () => {
    const patch = { reviewed: true };
    cfg.fields.forEach(f => {
      if (f.type === 'personList' || f.type === 'personHours') {
        patch[f.key] = draft[f.key] || [];
      } else {
        patch[f.key] = (draft[f.key] === undefined || draft[f.key] === '') ? null : draft[f.key];
      }
    });
    const btn = overlay.querySelector('#modalSaveBtn');
    btn.textContent = 'Kaydediliyor…';
    btn.disabled = true;
    try {
      await saveDay(category, day, patch);
      hasUnsavedChanges = false;
      close();
      renderOneCategoryGrid(category, document.getElementById('subgrid-' + category));
      showToast(`${cfg.label} — ${String(day).padStart(2, '0')} ${MONTHS_TR[state.month - 1]} günü başarıyla kaydedildi.`);
    } catch (err) {
      console.error('Kayıt hatası:', err);
      btn.textContent = 'Kaydet';
      btn.disabled = false;
      alert('Kaydedilemedi. Sunucu bağlantısını kontrol edin.');
    }
  });
}

// ================== OZET (SALT OKUNUR ANA SAYFA) ==================

async function renderOzet() {
  const container = document.getElementById('grid-ozet');
  container.innerHTML = `<div class="category-card"><p>Özet yükleniyor…</p></div>`;

  const yearMonth = `${state.year}-${String(state.month).padStart(2, '0')}`;
  const categories = ['guvenlik', 'kalite', 'teslimat', 'verimlilik', 'kalibrasyon'];

  const [dataResults, actionsRes, personelRes, notlarRes, duyurularRes, sktRes, allGuvenlik, allKalite, allVerimlilik, allKatilim] = await Promise.all([
    Promise.all(categories.map(c => fetch(`/api/data/${c}/${yearMonth}`).then(r => r.json()))),
    fetch('/api/actions').then(r => r.json()),
    fetch('/api/personel').then(r => r.json()),
    fetch('/api/notlar').then(r => r.json()),
    fetch('/api/duyurular').then(r => r.json()),
    fetch('/api/skt').then(r => r.json()),
    fetch('/api/all/guvenlik').then(r => r.json()),
    fetch('/api/all/kalite').then(r => r.json()),
    fetch('/api/all/verimlilik').then(r => r.json()),
    fetch('/api/all-katilim').then(r => r.json())
  ]);

  state.personelList = personelRes;
  state.duyurular = duyurularRes;
  state.sktList = sktRes;
  const monthData = {};
  categories.forEach((c, i) => { monthData[c] = dataResults[i]; });

  // Personel bazinda AY BAZLI kirilim: hem "tum zamanlar" (kisi detay popup'i)
  // hem de "yillik" (bolum bazli yillik ozet) hesaplamalari bu tek yapidan turetilir.
  const monthlyBreakdown = buildPersonMonthlyBreakdown({ guvenlik: allGuvenlik, kalite: allKalite, verimlilik: allVerimlilik });
  state.personMonthlyBreakdown = monthlyBreakdown;
  state.katilimMonthlyBreakdown = buildKatilimMonthlyBreakdown(allKatilim);

  const totalDays = daysInMonth(state.year, state.month);

  // ---- kategori bazli yesil/kirmizi/gri sayilari (her zaman gorunur, kompakt) ----
  let statCardsHtml = '';
  let toplamRed = 0;
  categories.forEach(c => {
    const cfg = CONFIG[c];
    let green = 0, red = 0, neutral = 0;
    for (let d = 1; d <= totalDays; d++) {
      const st = cfg.status(monthData[c][d] || {});
      if (st === 'green') green++; else if (st === 'red') { red++; toplamRed++; } else neutral++;
    }
    statCardsHtml += `
      <div class="ozet-stat-card" style="--accent:${CATEGORY_COLORS[c] || '#1b2a4a'};">
        <div class="ozet-stat-title">${cfg.label}</div>
        <div class="ozet-stat-row"><span class="dot status-green"></span> ${green} uygun</div>
        <div class="ozet-stat-row"><span class="dot status-red"></span> ${red} sapma</div>
        <div class="ozet-stat-row"><span class="dot status-neutral"></span> ${neutral} veri yok</div>
      </div>`;
  });

  // 6. kart: Yillik Ozet (Bolum Bazli) - tiklaninca asagidaki gizli tabloyu acar/kapatir
  statCardsHtml += `
    <div class="ozet-stat-card ozet-stat-card-clickable" id="ozetYillikToggleCard">
      <div class="ozet-stat-title">Yıllık Özet (Bölüm Bazlı)</div>
      <div class="ozet-stat-row">📊 ${state.year} yılı toplamları</div>
      <div class="ozet-stat-row ozet-stat-card-hint">Detay için tıklayın <span id="ozetYillikArrow">▾</span></div>
    </div>`;

  // ---- personel bazli ozet ----
  const personSummary = {};
  personelRes.forEach(p => {
    personSummary[p.id] = { id: p.id, ad: p.ad, departman: p.departman || 'Belirtilmemiş', kaza: 0, ramakKala: 0, seeCard: 0, asd: 0, sapma: 0, fazlaMesaiSaat: 0, izinliGun: 0, izinGunKatilim: 0, raporGunKatilim: 0 };
    const katilimBuAy = getKatilimForMonth(p.id, yearMonth);
    personSummary[p.id].izinGunKatilim = katilimBuAy.izinGun;
    personSummary[p.id].raporGunKatilim = katilimBuAy.raporGun;
  });

  function countInto(list, field) {
    (list || []).forEach(item => {
      if (personSummary[item.personelId]) personSummary[item.personelId][field]++;
    });
  }

  const olayNotlari = [];
  let kazaToplam = 0;
  let seeCardToplam = 0;
  let asdToplam = 0;
  let sapmaToplam = 0;

  for (let d = 1; d <= totalDays; d++) {
    const g = monthData.guvenlik[d] || {};
    (g.minor || []).forEach(it => {
      if (personSummary[it.personelId]) personSummary[it.personelId].kaza++;
      olayNotlari.push({ gun: d, tur: 'Minör Kaza', personelId: it.personelId, not: it.not || '' });
      kazaToplam++;
    });
    (g.majör || []).forEach(it => {
      if (personSummary[it.personelId]) personSummary[it.personelId].kaza++;
      olayNotlari.push({ gun: d, tur: 'Majör Kaza', personelId: it.personelId, not: it.not || '' });
      kazaToplam++;
    });
    (g.ramakKala || []).forEach(it => {
      if (personSummary[it.personelId]) personSummary[it.personelId].ramakKala++;
      olayNotlari.push({ gun: d, tur: 'Ramak Kala', personelId: it.personelId, not: it.not || '' });
    });
    seeCardToplam += len(g.seeCard);
    countInto(g.seeCard, 'seeCard');

    const k = monthData.kalite[d] || {};
    asdToplam += len(k.asd);
    sapmaToplam += len(k.sapma);
    countInto(k.asd, 'asd');
    countInto(k.sapma, 'sapma');

    const v = monthData.verimlilik[d] || {};
    (v.fazlaMesai || []).forEach(it => { if (personSummary[it.personelId]) personSummary[it.personelId].fazlaMesaiSaat += Number(it.saat || 0); });
    countInto(v.izinliPersonel, 'izinliGun');
  }

  const personRows = Object.values(personSummary);
  let personTableHtml = '';
  let bolumTableHtml = '';
  if (personRows.length === 0) {
    personTableHtml = `<p style="color:#6b7280;">Henüz personel eklenmemiş. "Personel" sekmesinden ekleyebilirsiniz.</p>`;
    bolumTableHtml = personTableHtml;
  } else {
    const genelToplam = personRows.reduce((acc, p) => {
      acc.kaza += p.kaza; acc.ramakKala += p.ramakKala; acc.seeCard += p.seeCard;
      acc.asd += p.asd; acc.sapma += p.sapma; acc.fazlaMesaiSaat += p.fazlaMesaiSaat; acc.izinliGun += p.izinliGun;
      acc.izinGunKatilim += p.izinGunKatilim; acc.raporGunKatilim += p.raporGunKatilim;
      return acc;
    }, { kaza: 0, ramakKala: 0, seeCard: 0, asd: 0, sapma: 0, fazlaMesaiSaat: 0, izinliGun: 0, izinGunKatilim: 0, raporGunKatilim: 0 });

    personTableHtml = `
      <table class="actions-table">
        <thead>
          <tr>
            <th>Personel</th><th>Kaza</th><th>Ramak Kala</th><th>See Card</th>
            <th>ASD</th><th>Sapma</th><th>Fazla Mesai (saat)</th><th>Eksik/İzinli (Teslimat)</th>
            <th>İzinli (gün)</th><th>Raporlu (gün)</th>
          </tr>
        </thead>
        <tbody>
          ${personRows.map(p => `
            <tr class="${p.kaza > 0 ? 'row-alert' : ''}">
              <td><button type="button" class="person-name-link" data-person-detail="${p.id}">${escapeHtml(p.ad)}</button></td>
              <td class="${p.kaza > 0 ? 'cell-alert' : ''}">${p.kaza}${p.kaza > 0 ? ' ⚠' : ''}</td>
              <td>${p.ramakKala}</td><td>${p.seeCard}</td><td>${p.asd}</td><td>${p.sapma}</td>
              <td>${p.fazlaMesaiSaat}</td><td>${p.izinliGun}</td>
              <td>${p.izinGunKatilim}</td><td>${p.raporGunKatilim}</td>
            </tr>
          `).join('')}
          <tr class="ozet-total-row">
            <td>TOPLAM</td>
            <td>${genelToplam.kaza}</td><td>${genelToplam.ramakKala}</td><td>${genelToplam.seeCard}</td>
            <td>${genelToplam.asd}</td><td>${genelToplam.sapma}</td>
            <td>${genelToplam.fazlaMesaiSaat}</td><td>${genelToplam.izinliGun}</td>
            <td>${genelToplam.izinGunKatilim}</td><td>${genelToplam.raporGunKatilim}</td>
          </tr>
        </tbody>
      </table>`;

    // ---- Bolum bazli YILLIK gruplama (secili state.year'a ait tum aylarin toplami) ----
    const bolumSummary = {};
    personRows.forEach(p => {
      if (!bolumSummary[p.departman]) {
        bolumSummary[p.departman] = { departman: p.departman, kisiSayisi: 0, kaza: 0, ramakKala: 0, seeCard: 0, asd: 0, sapma: 0, fazlaMesaiSaat: 0, izinliGun: 0, izinGunKatilim: 0, raporGunKatilim: 0 };
      }
      const b = bolumSummary[p.departman];
      const yillik = summarizePersonBreakdown(p.id, String(state.year)).totals;
      const yillikKatilim = summarizeKatilimBreakdown(p.id, String(state.year));
      b.kisiSayisi++; b.kaza += yillik.kaza; b.ramakKala += yillik.ramakKala; b.seeCard += yillik.seeCard;
      b.asd += yillik.asd; b.sapma += yillik.sapma; b.fazlaMesaiSaat += yillik.fazlaMesaiSaat; b.izinliGun += yillik.izinliGun;
      b.izinGunKatilim += yillikKatilim.izinGun; b.raporGunKatilim += yillikKatilim.raporGun;
    });
    const bolumRows = Object.values(bolumSummary);
    const yillikGenelToplam = bolumRows.reduce((acc, b) => {
      acc.kaza += b.kaza; acc.ramakKala += b.ramakKala; acc.seeCard += b.seeCard;
      acc.asd += b.asd; acc.sapma += b.sapma; acc.fazlaMesaiSaat += b.fazlaMesaiSaat; acc.izinliGun += b.izinliGun;
      acc.izinGunKatilim += b.izinGunKatilim; acc.raporGunKatilim += b.raporGunKatilim;
      return acc;
    }, { kaza: 0, ramakKala: 0, seeCard: 0, asd: 0, sapma: 0, fazlaMesaiSaat: 0, izinliGun: 0, izinGunKatilim: 0, raporGunKatilim: 0 });

    bolumTableHtml = `
      <div class="category-hedef" style="margin:0 0 10px 0;padding:0;border:none;">
        ${state.year} yılına ait, ay değiştikçe otomatik güncellenen kümülatif toplamlardır.
      </div>
      <table class="actions-table">
        <thead>
          <tr>
            <th>Bölüm / Görev Yeri</th><th>Kişi Sayısı</th><th>Kaza</th><th>Ramak Kala</th>
            <th>See Card</th><th>ASD</th><th>Sapma</th><th>Fazla Mesai (saat)</th>
            <th>Eksik/İzinli (Teslimat)</th><th>İzinli (gün)</th><th>Raporlu (gün)</th>
          </tr>
        </thead>
        <tbody>
          ${bolumRows.map(b => `
            <tr class="${b.kaza > 0 ? 'row-alert' : ''}">
              <td>${escapeHtml(b.departman)}</td><td>${b.kisiSayisi}</td>
              <td class="${b.kaza > 0 ? 'cell-alert' : ''}">${b.kaza}${b.kaza > 0 ? ' ⚠' : ''}</td>
              <td>${b.ramakKala}</td><td>${b.seeCard}</td><td>${b.asd}</td><td>${b.sapma}</td>
              <td>${b.fazlaMesaiSaat}</td><td>${b.izinliGun}</td>
              <td>${b.izinGunKatilim}</td><td>${b.raporGunKatilim}</td>
            </tr>
          `).join('')}
          <tr class="ozet-total-row">
            <td>TOPLAM</td><td>${personRows.length}</td>
            <td>${yillikGenelToplam.kaza}</td><td>${yillikGenelToplam.ramakKala}</td><td>${yillikGenelToplam.seeCard}</td>
            <td>${yillikGenelToplam.asd}</td><td>${yillikGenelToplam.sapma}</td>
            <td>${yillikGenelToplam.fazlaMesaiSaat}</td><td>${yillikGenelToplam.izinliGun}</td>
            <td>${yillikGenelToplam.izinGunKatilim}</td><td>${yillikGenelToplam.raporGunKatilim}</td>
          </tr>
        </tbody>
      </table>`;
  }

  // ---- canli uyari rozetleri: sadece ilgili sayi >0 ise gosterilir ----
  const uyariRozetleri = [];
  if (sapmaToplam > 0) uyariRozetleri.push({ label: 'Kalite Sapma', count: sapmaToplam, tone: 'red' });
  if (asdToplam > 0) uyariRozetleri.push({ label: 'Açılan ASD', count: asdToplam, tone: 'purple' });
  if (kazaToplam > 0) uyariRozetleri.push({ label: 'Minör/Majör Kaza', count: kazaToplam, tone: 'red' });
  if (seeCardToplam > 0) uyariRozetleri.push({ label: 'See Card', count: seeCardToplam, tone: 'blue' });
  const uyariRozetleriHtml = uyariRozetleri.map(r => `
    <span class="ozet-warn-badge tone-${r.tone}">${escapeHtml(r.label)}: <strong>${r.count}</strong></span>
  `).join('');

  let olayHtml = '';
  if (olayNotlari.length === 0) {
    olayHtml = `<p style="color:#6b7280;">Bu ay için kayıtlı kaza / ramak kala olayı bulunmuyor.</p>`;
  } else {
    olayHtml = `
      <table class="actions-table">
        <thead><tr><th>Gün</th><th>Tür</th><th>Personel</th><th>Not</th></tr></thead>
        <tbody>
          ${olayNotlari.sort((a, b) => a.gun - b.gun).map(o => `
            <tr class="${o.tur !== 'Ramak Kala' ? 'row-alert' : ''}">
              <td>${String(o.gun).padStart(2, '0')} ${MONTHS_TR[state.month - 1]}</td>
              <td><span class="badge ${o.tur === 'Ramak Kala' ? 'badge-devam' : 'badge-iptal'}">${o.tur}</span></td>
              <td>${escapeHtml(getPersonName(o.personelId))}</td>
              <td>${escapeHtml(o.not) || '<span style="color:#9ca3af;">-</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  const acikAksiyonlar = actionsRes.filter(a => a.durum === 'Devam ediyor');
  let actionsHtml = '';
  if (acikAksiyonlar.length === 0) {
    actionsHtml = `<p style="color:#6b7280;">Açık aksiyon bulunmuyor.</p>`;
  } else {
    actionsHtml = `
      <table class="actions-table">
        <thead><tr><th>Aksiyon</th><th>Sahibi</th><th>Başlangıç</th><th>Bitiş</th><th>Durum</th></tr></thead>
        <tbody>
          ${acikAksiyonlar.map(a => `
            <tr>
              <td>${escapeHtml(a.baslik)}</td>
              <td>${a.sahibiId ? escapeHtml(getPersonName(a.sahibiId)) : '-'}</td>
              <td>${a.baslangic || ''}</td>
              <td>${a.bitis || ''}</td>
              <td><span class="badge badge-devam">${a.durum}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  // ---- SKT / Sure Takibi ozeti ----
  const sktInfoList = (state.sktList || [])
    .map(item => ({ item, info: computeSktInfo(item) }))
    .sort((a, b) => a.info.kalanGun - b.info.kalanGun);
  const sktKritikSayisi = sktInfoList.filter(x => x.info.durum !== 'green').length;
  let sktOzetHtml = '';
  if (sktInfoList.length === 0) {
    sktOzetHtml = `<p style="color:#6b7280;">Henüz SKT/süre takibi eklenmedi. "Aksiyonlar" sekmesinden ekleyebilirsiniz.</p>`;
  } else {
    sktOzetHtml = `
      <table class="actions-table skt-table">
        <thead><tr><th>Malzeme / Çözelti</th><th>SKT Tarihi</th><th>Durum</th></tr></thead>
        <tbody>
          ${sktInfoList.map(({ item, info }) => {
            const badgeClass = info.durum === 'red' ? 'skt-badge-red' : info.durum === 'yellow' ? 'skt-badge-yellow' : 'skt-badge-green';
            const rowClass = info.durum === 'red' ? 'skt-row-red' : info.durum === 'yellow' ? 'skt-row-yellow' : '';
            const kalanText = info.kalanGun < 0 ? `${Math.abs(info.kalanGun)} gün gecikti` : info.kalanGun === 0 ? 'Bugün doluyor' : `${info.kalanGun} gün kaldı`;
            return `
              <tr class="${rowClass}">
                <td>${escapeHtml(item.ad)}</td>
                <td>${formatDateTR(info.sktDate)}</td>
                <td><span class="skt-badge ${badgeClass}">${kalanText}</span></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  // ---- notlar / gorevler (aktif gorevler + duyurular one plana cikar) ----
  const notlarSirali = (notlarRes || []).slice().sort((a, b) => {
    const aAktif = a.tip === 'gorev' && a.durum !== 'Tamamlandı';
    const bAktif = b.tip === 'gorev' && b.durum !== 'Tamamlandı';
    if (aAktif !== bAktif) return aAktif ? -1 : 1;
    return 0; // zaten en yeni en basta (unshift ile ekleniyor)
  });
  const gosterilecekNotlar = notlarSirali.slice(0, 8);
  let notlarHtml = '';
  if (!notlarRes || notlarRes.length === 0) {
    notlarHtml = `<p style="color:#6b7280;">Henüz not/görev eklenmedi. "Aksiyonlar" sekmesinden ekleyebilirsiniz.</p>`;
  } else {
    notlarHtml = `<div class="notes-grid">${gosterilecekNotlar.map(n => notCardHtml(n, false)).join('')}</div>`;
    if (notlarRes.length > gosterilecekNotlar.length) {
      notlarHtml += `<p style="color:#6b7280;font-size:12.5px;margin-top:10px;">+ ${notlarRes.length - gosterilecekNotlar.length} kayıt daha (tümü için "Aksiyonlar" sekmesine bakın)</p>`;
    }
  }

  // ---- duyurular (OPL / See Card-Oneri / Kalibrasyon Tablosu / Diger 1-2-3) ----
  const duy = state.duyurular || {};
  const duyuruItems = [
    { key: 'opl', label: 'One Point Lesson', src: duy.opl },
    { key: 'seeCardKarekod', label: 'See Card / Öneri Karekodu', src: duy.seeCardKarekod },
    { key: 'kalibrasyonTablosu', label: 'Kalibrasyon Tablosu', src: duy.kalibrasyonTablosu },
    { key: 'diger1', label: 'Diğer 1', src: duy.diger1 },
    { key: 'diger2', label: 'Diğer 2', src: duy.diger2 },
    { key: 'diger3', label: 'Diğer 3', src: duy.diger3 }
  ];
  const duyuruHtml = duyuruItems.map(d => `
    <div class="duyuru-thumb-box" ${d.src ? `data-duyuru-view="${d.key}"` : ''}>
      <div class="duyuru-thumb-label">${d.label}</div>
      ${d.src
        ? `<img src="${d.src}" class="duyuru-thumb-img">`
        : `<div class="duyuru-thumb-empty">Henüz yüklenmedi</div>`}
    </div>
  `).join('');

  // ---- ust bloklar (Notlar, Personel) ve kart bolumleri (Kaza, SKT, Aksiyonlar):
  //      kullanicinin Ayarlar sayfasindan belirledigi siraya gore diziliyor ----
  const ustBloklar = {
    notlar: `
      <details class="ozet-details ozet-details-full" open>
        <summary>Notlar / Görevler <span class="ozet-count-badge">${notlarRes ? notlarRes.length : 0}</span></summary>
        <div class="ozet-details-body">${notlarHtml}</div>
      </details>`,
    personel: `
      <details class="ozet-details ozet-details-full" open>
        <summary>Personel Bazlı Özet <span class="ozet-count-badge">${personRows.length}</span></summary>
        <div class="ozet-details-body">${personTableHtml}</div>
      </details>`
  };
  const kartBolumleri = {
    kaza: `
      <details class="ozet-details" ${olayNotlari.length > 0 ? 'open' : ''}>
        <summary>Kaza / Ramak Kala Olay Detayları <span class="ozet-count-badge ${olayNotlari.length > 0 ? 'badge-warn' : ''}">${olayNotlari.length}</span></summary>
        <div class="ozet-details-body">${olayHtml}</div>
      </details>`,
    skt: `
      <details class="ozet-details" ${sktKritikSayisi > 0 ? 'open' : ''}>
        <summary>SKT / Süre Takibi <span class="ozet-count-badge ${sktKritikSayisi > 0 ? 'badge-warn' : ''}">${sktInfoList.length}</span></summary>
        <div class="ozet-details-body">${sktOzetHtml}</div>
      </details>`,
    aksiyonlar: `
      <details class="ozet-details" ${acikAksiyonlar.length > 0 ? 'open' : ''}>
        <summary>Açık Aksiyonlar <span class="ozet-count-badge">${acikAksiyonlar.length}</span></summary>
        <div class="ozet-details-body">${actionsHtml}</div>
      </details>`
  };
  const ustSiralama = (state.ayarlar.ozetUstSiralama && state.ayarlar.ozetUstSiralama.length === 2) ? state.ayarlar.ozetUstSiralama : ['notlar', 'personel'];
  const kartSiralama = (state.ayarlar.ozetKartSiralama && state.ayarlar.ozetKartSiralama.length === 3) ? state.ayarlar.ozetKartSiralama : ['kaza', 'skt', 'aksiyonlar'];
  const ustBloklarHtml = ustSiralama.map(k => ustBloklar[k] || '').join('');
  const kartBolumleriHtml = kartSiralama.map(k => kartBolumleri[k] || '').join('');

  container.innerHTML = `
    <div class="ozet-top-row">
      <div class="category-card ozet-main-card">
        <h2 class="category-title">Özet — ${MONTHS_TR[state.month - 1]} ${state.year}</h2>
        <div class="category-hedef">Bu sayfa salt okunurdur. Detay görmek için aşağıdaki kartlara tıklayın.</div>
        <div class="ozet-stat-grid">${statCardsHtml}</div>
        <div class="ozet-yillik-panel" id="ozetYillikPanel" style="display:none;">${bolumTableHtml}</div>
        ${uyariRozetleriHtml ? `<div class="ozet-warn-row">${uyariRozetleriHtml}</div>` : ''}
      </div>
      <div class="category-card ozet-duyuru-card">
        <h2 class="category-title" style="font-size:14px;">Duyurular</h2>
        <div class="duyuru-thumb-row">${duyuruHtml}</div>
        <div class="category-hedef" style="margin:10px 0 0 0;padding:0;border:none;">Görseli büyütmek için üzerine tıklayın. Yükleme/değiştirme "Aksiyonlar" sekmesinden yapılır.</div>
      </div>
    </div>

    ${ustBloklarHtml}

    <div class="ozet-card-grid">${kartBolumleriHtml}</div>
  `;

  const yillikCard = container.querySelector('#ozetYillikToggleCard');
  const yillikPanel = container.querySelector('#ozetYillikPanel');
  const yillikArrow = container.querySelector('#ozetYillikArrow');
  if (yillikCard && yillikPanel) {
    yillikCard.addEventListener('click', () => {
      const isOpen = yillikPanel.style.display !== 'none';
      yillikPanel.style.display = isOpen ? 'none' : 'block';
      yillikCard.classList.toggle('ozet-stat-card-active', !isOpen);
      if (yillikArrow) yillikArrow.textContent = isOpen ? '▾' : '▴';
    });
  }

  container.querySelectorAll('[data-duyuru-view]').forEach(box => {
    box.addEventListener('click', () => {
      const item = duyuruItems.find(d => d.key === box.dataset.duyuruView);
      if (item && item.src) openImageLightbox(item.src, item.label);
    });
  });

  container.querySelectorAll('[data-person-detail]').forEach(btn => {
    btn.addEventListener('click', () => {
      openPersonDetailModal(btn.dataset.personDetail);
    });
  });
}

// ================== AKSIYONLAR ==================

function initActionForm() {
  const form = document.getElementById('actionForm');
  if (!form) { console.error('[initActionForm] #actionForm bulunamadi'); return; }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      baslik: document.getElementById('actBaslik').value.trim(),
      sahibiId: document.getElementById('actSahibi').value,
      durum: document.getElementById('actDurum').value,
      baslangic: document.getElementById('actBaslangic').value,
      bitis: document.getElementById('actBitis').value,
      aciklama: document.getElementById('actAciklama').value.trim()
    };
    if (!payload.baslik) return;

    if (state.editingActionId) {
      await fetch(`/api/actions/${state.editingActionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      state.editingActionId = null;
      form.querySelector('.btn-primary').textContent = 'Aksiyon Ekle';
    } else {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    form.reset();
    loadActions();
  });
}

async function loadActions() {
  const res = await fetch('/api/actions');
  state.actions = await res.json();
  renderActions();
}

function badgeClass(durum) {
  if (durum === 'Tamamlandı') return 'badge-tamam';
  if (durum === 'İptal') return 'badge-iptal';
  return 'badge-devam';
}

function renderActions() {
  const tbody = document.getElementById('actionsTableBody');
  if (state.actions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#6b7280;">Henüz aksiyon eklenmedi.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.actions.map(a => `
    <tr>
      <td>${escapeHtml(a.baslik)}</td>
      <td>${escapeHtml(a.aciklama || '')}</td>
      <td>${a.sahibiId ? escapeHtml(getPersonName(a.sahibiId)) : '-'}</td>
      <td>${a.baslangic || ''}</td>
      <td>${a.bitis || ''}</td>
      <td><span class="badge ${badgeClass(a.durum)}">${a.durum}</span></td>
      <td>
        <button class="icon-btn" data-edit="${a.id}">Düzenle</button>
        <button class="icon-btn danger" data-delete="${a.id}">Sil</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => startEditAction(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteAction(btn.dataset.delete));
  });
}

function startEditAction(id) {
  const action = state.actions.find(a => a.id === id);
  if (!action) return;
  document.getElementById('actBaslik').value = action.baslik || '';
  fillPersonelSelect(document.getElementById('actSahibi'), action.sahibiId);
  document.getElementById('actDurum').value = action.durum || 'Devam ediyor';
  document.getElementById('actBaslangic').value = action.baslangic || '';
  document.getElementById('actBitis').value = action.bitis || '';
  document.getElementById('actAciklama').value = action.aciklama || '';
  state.editingActionId = id;
  document.querySelector('#actionForm .btn-primary').textContent = 'Aksiyonu Güncelle';
  document.getElementById('actionForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteAction(id) {
  if (!confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) return;
  await fetch(`/api/actions/${id}`, { method: 'DELETE' });
  loadActions();
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = '✓ ' + message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('app-toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('app-toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ================== ORGANIZASYON SEMASI ==================

function renderOrganizasyon() {
  const container = document.getElementById('grid-organizasyon');
  const bolumSorumlusu = state.personelList.find(p => p.unvan === 'Bölüm Sorumlusu');

  // 2. kademe: Kalite Kontrol Uzmanı / Vardiya Sorumlusu (Bolum Sorumlusu'nun dogrudan altinda, tek basina)
  const ikinciKademeUnvan = UNVAN_LIST[1];
  // 3. kademe: kalan 5 unvan, ikinci kademenin altina yayilir
  const ucuncuKademeUnvanlar = UNVAN_LIST.slice(2);

  const headHtml = bolumSorumlusu
    ? `${personAvatarHtml(bolumSorumlusu, 56)}<div class="org-name">${escapeHtml(bolumSorumlusu.ad)}</div><div class="org-title">${escapeHtml(bolumSorumlusu.unvan)}</div>`
    : `<div class="org-name" style="opacity:.6;">Bölüm sorumlusu atanmadı</div><div class="org-title">Personel sekmesinden bir kişiye "Bölüm Sorumlusu" unvanı verin</div>`;

  const ikinciKademeKisiler = state.personelList.filter(p => p.unvan === ikinciKademeUnvan);
  const ikinciKademeHtml = `
    <div class="org-tier org-tier-mid">
      <div class="org-tier-title">${ikinciKademeUnvan}</div>
      <div class="org-tier-people">
        ${ikinciKademeKisiler.length
          ? ikinciKademeKisiler.map(p => `<div class="org-person">${personAvatarHtml(p, 28)}<span>${escapeHtml(p.ad)}</span></div>`).join('')
          : `<div class="org-person org-person-empty">—</div>`}
      </div>
    </div>`;

  const ucuncuKademeHtml = ucuncuKademeUnvanlar.map(unvan => {
    const kisiler = state.personelList.filter(p => p.unvan === unvan);
    return `
      <div class="org-tier">
        <div class="org-tier-title">${unvan}</div>
        <div class="org-tier-people">
          ${kisiler.length
            ? kisiler.map(p => `<div class="org-person">${personAvatarHtml(p, 28)}<span>${escapeHtml(p.ad)}</span></div>`).join('')
            : `<div class="org-person org-person-empty">—</div>`}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="category-card">
      <h2 class="category-title">${state.ayarlar.bolumAdi ? escapeHtml(state.ayarlar.bolumAdi) : 'Organizasyon Şeması'}</h2>
      <div class="category-hedef">Personellerin unvanı "Personel" sekmesinden atanır; şema otomatik güncellenir.</div>

      <div class="org-chart">
        <div class="org-head-box">${headHtml}</div>
        <div class="org-connector"></div>
        <div class="org-tier-row org-tier-row-mid">${ikinciKademeHtml}</div>
        <div class="org-connector"></div>
        <div class="org-tier-row">${ucuncuKademeHtml}</div>
      </div>
    </div>
  `;
}

// ================== AYARLAR (GORUNUM / KURUMSAL) ==================

async function loadAyarlar() {
  const res = await fetch('/api/ayarlar');
  state.ayarlar = await res.json();
  applyAyarlar();
  fillAyarlarForm();
}

function applyAyarlar() {
  const a = state.ayarlar || {};
  const root = document.documentElement;
  if (a.accentColor) root.style.setProperty('--navy', a.accentColor);
  if (a.bgColor) root.style.setProperty('--bg', a.bgColor);

  // sayfa genisligi
  const widthMap = { dar: '860px', normal: '1200px', genis: 'none' };
  root.style.setProperty('--page-max-width', widthMap[a.pageWidth] || 'none');

  // kose yuvarlakligi
  const radiusMap = { keskin: '4px', normal: '12px', oval: '22px' };
  root.style.setProperty('--radius', radiusMap[a.radius] || '12px');

  // golge acik/kapali
  document.body.classList.toggle('no-shadow', a.shadows === false);

  // kompakt gorunum
  document.body.classList.toggle('compact-mode', !!a.compact);

  if (a.bgImageBase64) {
    document.body.style.backgroundImage = `url(${a.bgImageBase64})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundAttachment = 'fixed';
  } else {
    document.body.style.backgroundImage = 'none';
  }

  const logoEl = document.getElementById('topbarLogo');
  if (a.logoBase64) {
    logoEl.src = a.logoBase64;
    logoEl.style.display = 'block';
  } else {
    logoEl.style.display = 'none';
  }

  const titleEl = document.getElementById('topbarTitle');
  titleEl.textContent = a.firmaAdi ? `${a.firmaAdi} — WCT Yönetim Panosu` : 'WCT Günlük Yönetim Panosu';

  const subtitleEl = document.getElementById('topbarSubtitle');
  if (a.bolumAdi) {
    subtitleEl.textContent = a.bolumAdi;
    subtitleEl.style.display = 'block';
  } else {
    subtitleEl.style.display = 'none';
  }
}

function fillAyarlarForm() {
  const a = state.ayarlar || {};
  document.getElementById('setFirmaAdi').value = a.firmaAdi || '';
  document.getElementById('setBolumAdi').value = a.bolumAdi || '';
  document.getElementById('setAccentColor').value = a.accentColor || '#1b2a4a';
  document.getElementById('setBgColor').value = a.bgColor || '#f2f4f7';
  document.getElementById('setPageWidth').value = a.pageWidth || 'genis';
  document.getElementById('setRadius').value = a.radius || 'normal';
  document.getElementById('setShadows').checked = a.shadows !== false;
  document.getElementById('setCompact').checked = !!a.compact;

  const cc = a.categoryColors || {};
  const ccMap = {
    setColorGuvenlik: cc.guvenlik || '#2563eb',
    setColorKalite: cc.kalite || '#7c3aed',
    setColorTeslimat: cc.teslimat || '#0d9488',
    setColorVerimlilik: cc.verimlilik || '#ea580c',
    setColorKalibrasyon: cc.kalibrasyon || '#475569'
  };
  Object.entries(ccMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  const logoPreview = document.getElementById('logoPreview');
  const clearLogoBtn = document.getElementById('clearLogoBtn');
  if (a.logoBase64) {
    logoPreview.src = a.logoBase64;
    logoPreview.style.display = 'inline-block';
    clearLogoBtn.style.display = 'inline-block';
  } else {
    logoPreview.style.display = 'none';
    clearLogoBtn.style.display = 'none';
  }

  const bgPreview = document.getElementById('bgPreview');
  const clearBgBtn = document.getElementById('clearBgBtn');
  if (a.bgImageBase64) {
    bgPreview.src = a.bgImageBase64;
    bgPreview.style.display = 'inline-block';
    clearBgBtn.style.display = 'inline-block';
  } else {
    bgPreview.style.display = 'none';
    clearBgBtn.style.display = 'none';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initAyarlarForm() {
  const form = document.getElementById('ayarlarForm');
  if (!form) {
    console.error('[initAyarlarForm] #ayarlarForm bulunamadi — Ayarlar formu HTML\'de eksik olabilir.');
    return;
  }
  let pendingLogo = undefined;   // undefined = degistirilmedi, null = kaldirildi, string = yeni
  let pendingBgImage = undefined;

  const logoFileEl = document.getElementById('setLogoFile');
  const bgFileEl = document.getElementById('setBgImageFile');
  const clearLogoBtn = document.getElementById('clearLogoBtn');
  const clearBgBtn = document.getElementById('clearBgBtn');

  if (logoFileEl) {
    logoFileEl.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingLogo = await fileToBase64(file);
      document.getElementById('logoPreview').src = pendingLogo;
      document.getElementById('logoPreview').style.display = 'inline-block';
      if (clearLogoBtn) clearLogoBtn.style.display = 'inline-block';
    });
  }

  if (bgFileEl) {
    bgFileEl.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pendingBgImage = await fileToBase64(file);
      document.getElementById('bgPreview').src = pendingBgImage;
      document.getElementById('bgPreview').style.display = 'inline-block';
      if (clearBgBtn) clearBgBtn.style.display = 'inline-block';
    });
  }

  if (clearLogoBtn) {
    clearLogoBtn.addEventListener('click', () => {
      pendingLogo = null;
      document.getElementById('logoPreview').style.display = 'none';
      clearLogoBtn.style.display = 'none';
      if (logoFileEl) logoFileEl.value = '';
    });
  }

  if (clearBgBtn) {
    clearBgBtn.addEventListener('click', () => {
      pendingBgImage = null;
      document.getElementById('bgPreview').style.display = 'none';
      clearBgBtn.style.display = 'none';
      if (bgFileEl) bgFileEl.value = '';
    });
  }

  const saveBtn = document.getElementById('ayarlarKaydetBtn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const getVal = (id, fallback) => {
      const el = document.getElementById(id);
      return el ? el.value : fallback;
    };
    const getChecked = (id, fallback) => {
      const el = document.getElementById(id);
      return el ? el.checked : fallback;
    };

    const payload = {
      firmaAdi: getVal('setFirmaAdi', '').trim(),
      bolumAdi: getVal('setBolumAdi', '').trim(),
      accentColor: getVal('setAccentColor', '#1b2a4a'),
      bgColor: getVal('setBgColor', '#f2f4f7'),
      pageWidth: getVal('setPageWidth', 'genis'),
      radius: getVal('setRadius', 'normal'),
      shadows: getChecked('setShadows', true),
      compact: getChecked('setCompact', false),
      categoryColors: {
        guvenlik: getVal('setColorGuvenlik', '#2563eb'),
        kalite: getVal('setColorKalite', '#7c3aed'),
        teslimat: getVal('setColorTeslimat', '#0d9488'),
        verimlilik: getVal('setColorVerimlilik', '#ea580c'),
        kalibrasyon: getVal('setColorKalibrasyon', '#475569')
      }
    };
    if (pendingLogo !== undefined) payload.logoBase64 = pendingLogo || '';
    if (pendingBgImage !== undefined) payload.bgImageBase64 = pendingBgImage || '';

    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Kaydediliyor…';
    saveBtn.disabled = true;

    try {
      const res = await fetch('/api/ayarlar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      state.ayarlar = await res.json();
      console.log('[Ayarlar] kaydedildi:', state.ayarlar);
      applyAyarlar();
      pendingLogo = undefined;
      pendingBgImage = undefined;
      showToast('Ayarlar başarıyla kaydedildi.');
    } catch (err) {
      console.error('[Ayarlar] kayıt hatası:', err);
      alert('Ayarlar kaydedilemedi. Sunucu bağlantısını kontrol edin.\n\nHata: ' + err.message);
    } finally {
      saveBtn.textContent = originalText || 'Ayarları Kaydet';
      saveBtn.disabled = false;
    }
  });
}

// ================== SAYFA SIRALAMASI (GUNLUK TAKIP / OZET) ==================

const SIRALAMA_ETIKETLERI = {
  guvenlik: 'Güvenlik (G)',
  kalite: 'Kalite (K)',
  teslimat: 'Teslimat (T)',
  verimlilik: 'Verimlilik (V)',
  kalibrasyon: 'Kalibrasyonlar',
  notlar: 'Notlar / Görevler',
  personel: 'Personel Bazlı Özet',
  kaza: 'Kaza / Ramak Kala Olay Detayları',
  skt: 'SKT / Süre Takibi',
  aksiyonlar: 'Açık Aksiyonlar'
};

function renderSiralamaList(containerId, field) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const list = (state.ayarlar && state.ayarlar[field]) || [];
  container.innerHTML = list.map((key, idx) => `
    <div class="siralama-item">
      <span class="siralama-item-label">${idx + 1}. ${SIRALAMA_ETIKETLERI[key] || key}</span>
      <div class="siralama-item-buttons">
        <button type="button" class="btn-small" data-siralama-up="${field}:${idx}" ${idx === 0 ? 'disabled' : ''}>▲ Yukarı</button>
        <button type="button" class="btn-small" data-siralama-down="${field}:${idx}" ${idx === list.length - 1 ? 'disabled' : ''}>▼ Aşağı</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-siralama-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [f, idxStr] = btn.dataset.siralamaUp.split(':');
      moveSiralamaItem(f, Number(idxStr), -1);
    });
  });
  container.querySelectorAll('[data-siralama-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [f, idxStr] = btn.dataset.siralamaDown.split(':');
      moveSiralamaItem(f, Number(idxStr), 1);
    });
  });
}

async function moveSiralamaItem(field, index, direction) {
  const list = (state.ayarlar[field] || []).slice();
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= list.length) return;
  [list[index], list[newIndex]] = [list[newIndex], list[index]];

  try {
    const res = await fetch('/api/ayarlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: list })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.ayarlar = await res.json();
  } catch (err) {
    console.error('[Sıralama] kayıt hatası:', err);
    alert('Sıralama kaydedilemedi. Sunucu bağlantısını kontrol edin.');
    return;
  }

  renderSiralamaListleri();

  // ilgili sayfa acikken degisikligi aninda yansit
  if (state.category === 'gunluk' && field === 'gunlukSiralama') {
    applyGunlukSiralama();
  } else if (state.category === 'ozet' && (field === 'ozetUstSiralama' || field === 'ozetKartSiralama')) {
    renderOzet();
  }
}

function renderSiralamaListleri() {
  renderSiralamaList('siralamaGunlukList', 'gunlukSiralama');
  renderSiralamaList('siralamaOzetUstList', 'ozetUstSiralama');
  renderSiralamaList('siralamaOzetKartList', 'ozetKartSiralama');
}

// Gunluk Takip sayfasindaki 5 kart-panelin gorsel sirasini state.ayarlar.gunlukSiralama'ya gore ayarlar
function applyGunlukSiralama() {
  const siralama = (state.ayarlar && state.ayarlar.gunlukSiralama) || ['guvenlik', 'kalite', 'teslimat', 'verimlilik', 'kalibrasyon'];
  siralama.forEach((cat, idx) => {
    const el = document.getElementById('subgrid-' + cat);
    if (el) el.style.order = idx;
  });
}

// ================== TOPLANTI NOTLARI ==================

function formatDateSimpleTR(isoOrDateStr) {
  if (!isoOrDateStr) return '';
  const d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return isoOrDateStr;
  return formatDateTR(d);
}

function initNotForm() {
  const form = document.getElementById('notForm');
  if (!form) { console.error('[initNotForm] #notForm bulunamadi'); return; }

  const tipSelect = document.getElementById('notTip');
  const personelWrap = document.getElementById('notPersonelWrap');
  const durumWrap = document.getElementById('notDurumWrap');
  const bitisWrap = document.getElementById('notBitisWrap');
  const personelSelect = document.getElementById('notPersonel');

  function updateFormVisibility() {
    const isGorev = tipSelect.value === 'gorev';
    personelWrap.style.display = isGorev ? '' : 'none';
    durumWrap.style.display = isGorev ? '' : 'none';
    bitisWrap.style.display = isGorev ? '' : 'none';
    if (isGorev) fillPersonelSelect(personelSelect);
  }
  if (tipSelect) {
    tipSelect.addEventListener('change', updateFormVisibility);
    updateFormVisibility();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tip = tipSelect ? tipSelect.value : 'duyuru';
    const baslik = document.getElementById('notBaslik').value.trim();
    const not = document.getElementById('notMetin').value.trim();
    if (!baslik && !not) return;

    const payload = { tip, baslik, not };
    if (tip === 'gorev') {
      payload.personelId = personelSelect ? personelSelect.value : '';
      payload.bitisTarihi = document.getElementById('notBitis').value;
      payload.durum = document.getElementById('notDurum').value;
    }

    const res = await fetch('/api/notlar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { alert('Kayıt eklenemedi.'); return; }
    form.reset();
    updateFormVisibility();
    await loadNotlar();
    renderOzet();
  });
}

async function loadNotlar() {
  const res = await fetch('/api/notlar');
  state.notlar = await res.json();
  renderNotlar();
}

function notCardHtml(n, showActions) {
  const isGorev = n.tip === 'gorev';
  const tipBadge = isGorev
    ? `<span class="badge badge-gorev">Kişiye Görev</span>`
    : `<span class="badge badge-duyuru">Lab Geneli Duyuru</span>`;
  const sorumlu = isGorev ? escapeHtml(getPersonName(n.personelId)) : 'Tüm Laboratuvar';
  const durumBadge = isGorev
    ? `<span class="badge ${n.durum === 'Tamamlandı' ? 'badge-tamam' : 'badge-devam'}">${escapeHtml(n.durum || 'Devam ediyor')}</span>`
    : '';
  const olusturma = formatDateSimpleTR(n.olusturmaTarihi) || n.tarih || '';
  const bitis = isGorev && n.bitisTarihi ? formatDateSimpleTR(n.bitisTarihi) : '';

  return `
    <div class="note-card ${isGorev && n.durum !== 'Tamamlandı' && n.bitisTarihi && new Date(n.bitisTarihi) < new Date(new Date().toDateString()) ? 'note-card-overdue' : ''}">
      <div class="note-card-header">
        <div class="note-card-tags">${tipBadge} ${durumBadge}</div>
        ${showActions ? `<div class="note-card-actions">
          ${isGorev && n.durum !== 'Tamamlandı' ? `<button class="icon-btn" data-complete-note="${n.id}">Tamamlandı İşaretle</button>` : ''}
          <button class="icon-btn danger" data-del-note="${n.id}">Sil</button>
        </div>` : ''}
      </div>
      ${n.baslik ? `<div class="note-title">${escapeHtml(n.baslik)}</div>` : ''}
      ${n.not ? `<div class="note-text">${escapeHtml(n.not)}</div>` : ''}
      <div class="note-meta">
        <span>Sorumlu: <strong>${sorumlu}</strong></span>
        ${olusturma ? `<span>Oluşturma: <strong>${olusturma}</strong></span>` : ''}
        ${bitis ? `<span>Bitiş: <strong>${bitis}</strong></span>` : ''}
      </div>
    </div>`;
}

function renderNotlar() {
  const container = document.getElementById('notlarListe');
  if (!state.notlar || state.notlar.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;">Henüz not/görev eklenmedi.</p>`;
    return;
  }
  container.innerHTML = state.notlar.map(n => notCardHtml(n, true)).join('');

  container.querySelectorAll('[data-del-note]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
      await fetch(`/api/notlar/${btn.dataset.delNote}`, { method: 'DELETE' });
      await loadNotlar();
      renderOzet();
    });
  });

  container.querySelectorAll('[data-complete-note]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/notlar/${btn.dataset.completeNote}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durum: 'Tamamlandı' })
      });
      await loadNotlar();
      renderOzet();
    });
  });
}

// ================== DUYURULAR (OPL / SEE CARD-ONERI / KALIBRASYON TABLOSU GORSELLERI) ==================

const DUYURU_TANIMLARI = [
  { key: 'opl', label: 'One Point Lesson (OPL)', fileId: 'duyuruOplFile', previewId: 'duyuruOplPreview', clearId: 'duyuruOplClear' },
  { key: 'seeCardKarekod', label: 'See Card / Öneri Karekodu', fileId: 'duyuruKarekodFile', previewId: 'duyuruKarekodPreview', clearId: 'duyuruKarekodClear' },
  { key: 'kalibrasyonTablosu', label: 'Kalibrasyon Tablosu', fileId: 'duyuruKalibrasyonFile', previewId: 'duyuruKalibrasyonPreview', clearId: 'duyuruKalibrasyonClear' },
  { key: 'diger1', label: 'Diğer 1', fileId: 'duyuruDiger1File', previewId: 'duyuruDiger1Preview', clearId: 'duyuruDiger1Clear' },
  { key: 'diger2', label: 'Diğer 2', fileId: 'duyuruDiger2File', previewId: 'duyuruDiger2Preview', clearId: 'duyuruDiger2Clear' },
  { key: 'diger3', label: 'Diğer 3', fileId: 'duyuruDiger3File', previewId: 'duyuruDiger3Preview', clearId: 'duyuruDiger3Clear' }
];

async function loadDuyurular() {
  const res = await fetch('/api/duyurular');
  state.duyurular = await res.json();
  fillDuyuruPreviews();
}

function fillDuyuruPreviews() {
  const d = state.duyurular || {};
  DUYURU_TANIMLARI.forEach(t => {
    const img = document.getElementById(t.previewId);
    const clearBtn = document.getElementById(t.clearId);
    if (!img || !clearBtn) return;
    if (d[t.key]) {
      img.src = d[t.key];
      img.style.display = 'block';
      clearBtn.style.display = 'inline-block';
    } else {
      img.style.display = 'none';
      clearBtn.style.display = 'none';
    }
  });
}

function initDuyuruUploads() {
  DUYURU_TANIMLARI.forEach(t => {
    const fileInput = document.getElementById(t.fileId);
    const clearBtn = document.getElementById(t.clearId);
    if (!fileInput || !clearBtn) return;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const base64 = await fileToBase64(file);
      const res = await fetch('/api/duyurular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [t.key]: base64 })
      });
      state.duyurular = await res.json();
      fillDuyuruPreviews();
      fileInput.value = '';
    });

    clearBtn.addEventListener('click', async () => {
      if (!confirm(`${t.label} görselini kaldırmak istediğinize emin misiniz?`)) return;
      const res = await fetch('/api/duyurular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [t.key]: '' })
      });
      state.duyurular = await res.json();
      fillDuyuruPreviews();
    });
  });
}

function openImageLightbox(src, title) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay lightbox-overlay';
  overlay.innerHTML = `
    <div class="lightbox-box">
      <div class="lightbox-header">
        <span>${escapeHtml(title)}</span>
        <button type="button" class="modal-close" id="lightboxClose">✕</button>
      </div>
      <img src="${src}" class="lightbox-img">
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#lightboxClose').addEventListener('click', close);
}

// ================== PERSONEL DETAY KARTI (OZET SAYFASINDAN ACILIR) ==================

const AY_KISALTMA = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

function formatYearMonthTR(ym) {
  const [y, m] = ym.split('-');
  const idx = Number(m) - 1;
  return `${AY_KISALTMA[idx] || m} ${y}`;
}

function openPersonDetailModal(personId) {
  const p = state.personelList.find(x => x.id === personId);
  if (!p) return;

  const { totals: tumZamanlar, monthlyRows } = summarizePersonBreakdown(personId, null);
  const { totals: buYil } = summarizePersonBreakdown(personId, String(state.year));
  const katilimTumZamanlar = summarizeKatilimBreakdown(personId, null);
  const katilimBuYil = summarizeKatilimBreakdown(personId, String(state.year));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const monthlyTableHtml = monthlyRows.length === 0
    ? `<p style="color:#6b7280;font-size:13px;">Bu personele ait henüz kayıtlı bir ay bulunmuyor.</p>`
    : `
      <table class="actions-table" style="margin-top:10px;">
        <thead>
          <tr><th>Ay</th><th>Kaza</th><th>Ramak Kala</th><th>See Card</th><th>ASD</th><th>Sapma</th><th>Fazla Mesai</th><th>İzinli Gün</th></tr>
        </thead>
        <tbody>
          ${monthlyRows.map(r => `
            <tr class="${r.kaza > 0 ? 'row-alert' : ''}">
              <td>${formatYearMonthTR(r.ym)}</td>
              <td>${r.kaza}</td><td>${r.ramakKala}</td><td>${r.seeCard}</td>
              <td>${r.asd}</td><td>${r.sapma}</td><td>${r.fazlaMesaiSaat}</td><td>${r.izinliGun}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  overlay.innerHTML = `
    <div class="modal-box person-detail-box">
      <div class="modal-header">
        <h3>Personel Detay Kartı</h3>
        <button class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-body">
        <div class="person-detail-head">
          ${personAvatarHtml(p, 64)}
          <div>
            <div class="person-detail-name">${escapeHtml(p.ad)}</div>
            <div class="person-detail-sub">${escapeHtml(p.departman || 'Departman belirtilmemiş')}${p.unvan ? ' · ' + escapeHtml(p.unvan) : ''}</div>
            ${p.sorumluluklar && p.sorumluluklar.length > 0 ? `<div class="person-detail-sorumluluklar">${sorumlulukBadgesHtml(p.sorumluluklar)}</div>` : ''}
          </div>
        </div>

        <div class="person-detail-totals-grid">
          <div class="person-total-card">
            <div class="person-total-title">Bu Yıl (${state.year})</div>
            <div class="person-total-row">Kaza: <strong>${buYil.kaza}</strong></div>
            <div class="person-total-row">Ramak Kala: <strong>${buYil.ramakKala}</strong></div>
            <div class="person-total-row">See Card: <strong>${buYil.seeCard}</strong></div>
            <div class="person-total-row">ASD: <strong>${buYil.asd}</strong></div>
            <div class="person-total-row">Sapma: <strong>${buYil.sapma}</strong></div>
            <div class="person-total-row">Fazla Mesai: <strong>${buYil.fazlaMesaiSaat} saat</strong></div>
            <div class="person-total-row">İzinli/Eksik Gün: <strong>${buYil.izinliGun}</strong></div>
            <div class="person-total-row">İzinli (Katılım): <strong>${katilimBuYil.izinGun}</strong></div>
            <div class="person-total-row">Raporlu (Katılım): <strong>${katilimBuYil.raporGun}</strong></div>
          </div>
          <div class="person-total-card person-total-card-alt">
            <div class="person-total-title">Tüm Zamanlar Toplamı</div>
            <div class="person-total-row">Kaza: <strong>${tumZamanlar.kaza}</strong></div>
            <div class="person-total-row">Ramak Kala: <strong>${tumZamanlar.ramakKala}</strong></div>
            <div class="person-total-row">See Card: <strong>${tumZamanlar.seeCard}</strong></div>
            <div class="person-total-row">ASD: <strong>${tumZamanlar.asd}</strong></div>
            <div class="person-total-row">Sapma: <strong>${tumZamanlar.sapma}</strong></div>
            <div class="person-total-row">Fazla Mesai: <strong>${tumZamanlar.fazlaMesaiSaat} saat</strong></div>
            <div class="person-total-row">İzinli/Eksik Gün: <strong>${tumZamanlar.izinliGun}</strong></div>
            <div class="person-total-row">İzinli (Katılım): <strong>${katilimTumZamanlar.izinGun}</strong></div>
            <div class="person-total-row">Raporlu (Katılım): <strong>${katilimTumZamanlar.raporGun}</strong></div>
          </div>
        </div>

        <div class="modal-field-group-label" style="margin-top:6px;">Ay Bazlı Kırılım</div>
        ${monthlyTableHtml}
      </div>
      <div class="modal-footer">
        <span></span>
        <button type="button" class="btn-primary" id="personDetailCloseBtn">Kapat</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('#personDetailCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// ================== SKT / SURE TAKIBI ==================

function computeSktInfo(item) {
  const hazirlanma = new Date(item.hazirlanmaTarihi + 'T00:00:00');
  const sktDate = new Date(hazirlanma.getTime() + Number(item.sureGun || 0) * 86400000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const kalanGun = Math.round((sktDate.getTime() - today.getTime()) / 86400000);
  let durum;
  if (kalanGun < 0) durum = 'red';
  else if (kalanGun <= 3) durum = 'yellow';
  else durum = 'green';
  return { sktDate, kalanGun, durum };
}

function formatDateTR(d) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function initSktForm() {
  const form = document.getElementById('sktForm');
  if (!form) { console.error('[initSktForm] #sktForm bulunamadi'); return; }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ad = document.getElementById('sktAd').value.trim();
    const hazirlanmaTarihi = document.getElementById('sktHazirlanma').value;
    const sureGun = Number(document.getElementById('sktSure').value);
    if (!ad || !hazirlanmaTarihi || !sureGun) return;

    const res = await fetch('/api/skt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad, hazirlanmaTarihi, sureGun })
    });
    if (!res.ok) { alert('SKT kaydı eklenemedi.'); return; }
    form.reset();
    document.getElementById('sktSure').value = 21;
    await loadSktList();
    checkSktWarningsAndPopup();
  });
}

async function loadSktList() {
  const res = await fetch('/api/skt');
  state.sktList = await res.json();
  renderSktTable();
}

function renderSktTable() {
  const wrap = document.getElementById('sktTableWrap');
  if (!wrap) return;
  if (!state.sktList || state.sktList.length === 0) {
    wrap.innerHTML = `<p style="color:#6b7280;margin-top:14px;">Henüz takip edilen bir malzeme/çözelti eklenmedi.</p>`;
    return;
  }

  const rows = state.sktList.map(item => {
    const info = computeSktInfo(item);
    const badgeClass = info.durum === 'red' ? 'skt-badge-red' : info.durum === 'yellow' ? 'skt-badge-yellow' : 'skt-badge-green';
    const rowClass = info.durum === 'red' ? 'skt-row-red' : info.durum === 'yellow' ? 'skt-row-yellow' : '';
    const kalanText = info.kalanGun < 0
      ? `${Math.abs(info.kalanGun)} gün gecikti`
      : info.kalanGun === 0
        ? 'Bugün doluyor'
        : `${info.kalanGun} gün kaldı`;
    return `
      <tr class="${rowClass}">
        <td>${escapeHtml(item.ad)}</td>
        <td>${formatDateTR(new Date(item.hazirlanmaTarihi + 'T00:00:00'))}</td>
        <td>${item.sureGun} gün</td>
        <td>${formatDateTR(info.sktDate)}</td>
        <td><span class="skt-badge ${badgeClass}">${kalanText}</span></td>
        <td><button class="icon-btn danger" data-del-skt="${item.id}">Sil</button></td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="actions-table skt-table" style="margin-top:14px;">
      <thead>
        <tr><th>Malzeme / Çözelti</th><th>Hazırlanma Tarihi</th><th>Süre</th><th>SKT Tarihi</th><th>Durum</th><th>İşlem</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-del-skt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Bu takip kaydını silmek istediğinize emin misiniz?')) return;
      await fetch(`/api/skt/${btn.dataset.delSkt}`, { method: 'DELETE' });
      loadSktList();
    });
  });
}

// Sayfa acilisinda bir kez calisir: sarı/kırmızı durumda SKT varsa uyari penceresi gosterir
function checkSktWarningsAndPopup() {
  const list = state.sktList || [];
  const critical = list
    .map(item => ({ item, info: computeSktInfo(item) }))
    .filter(x => x.info.durum === 'red' || x.info.durum === 'yellow')
    .sort((a, b) => a.info.kalanGun - b.info.kalanGun);

  if (critical.length === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box skt-warning-box">
      <div class="modal-header" style="background:#b91c1c;">
        <h3>⚠ SKT / Süre Uyarısı</h3>
        <button class="modal-close" type="button">✕</button>
      </div>
      <div class="modal-body">
        <p style="margin:0 0 10px 0;font-size:13.5px;color:var(--text);">Aşağıdaki malzeme/çözeltilerin süresi doldu veya dolmak üzere:</p>
        ${critical.map(({ item, info }) => `
          <div class="skt-warning-item ${info.durum === 'red' ? 'skt-warning-red' : 'skt-warning-yellow'}">
            <strong>${escapeHtml(item.ad)}</strong> —
            ${info.kalanGun < 0 ? `${Math.abs(info.kalanGun)} gün önce süresi doldu!` : info.kalanGun === 0 ? 'bugün doluyor!' : `${info.kalanGun} gün kaldı`}
            <span class="skt-warning-date">(SKT: ${formatDateTR(info.sktDate)})</span>
          </div>
        `).join('')}
      </div>
      <div class="modal-footer">
        <span></span>
        <button type="button" class="btn-primary" id="sktWarningOkBtn">Anladım</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.querySelector('#sktWarningOkBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// ================== MASAUSTU BILDIRIMLERI (TARAYICI Notification API) ==================
// Bu sistem sertifika/HTTPS/service worker/push altyapisi GEREKTIRMEZ.
// Sadece tarayicinin yerlesik Notification API'sini kullanir; WCT Panosu
// sekmesi bilgisayarda acik oldugu surece (arka planda da olabilir) calisir.
// Telefon push bildirimleri (sertifika/HTTPS gerektiren, sorunlu) kaldirildi.

const MY_PERSONEL_ID_KEY = 'wct_dashboard_my_personel_id';
const BILDIRIM_ENABLED_KEY = 'wct_dashboard_bildirim_enabled';
let bildirimKontrolIntervalId = null;

function initBildirimUI() {
  const selectEl = document.getElementById('bildirimPersonelSelect');
  const enableBtn = document.getElementById('bildirimEtkinlestirBtn');
  const testBtn = document.getElementById('bildirimTestBtn');
  const disableBtn = document.getElementById('bildirimKapatBtn');
  const statusBox = document.getElementById('bildirimDurumBox');
  if (!enableBtn) return; // bu bolum HTML'de yoksa sessizce cik

  function setStatus(msg, cls) {
    if (!statusBox) return;
    statusBox.textContent = msg;
    statusBox.className = 'modal-save-status' + (cls ? ' ' + cls : '');
  }

  function refreshUIState() {
    if (selectEl) fillPersonelSelect(selectEl, localStorage.getItem(MY_PERSONEL_ID_KEY) || '');

    if (!('Notification' in window)) {
      setStatus('Bu tarayıcı masaüstü bildirimlerini desteklemiyor.', 'error');
      enableBtn.disabled = true;
      return;
    }

    const enabled = localStorage.getItem(BILDIRIM_ENABLED_KEY) === '1' && Notification.permission === 'granted';
    if (enabled) {
      enableBtn.textContent = '🔔 Bildirimler Açık (kişiyi değiştirmek için tekrar basın)';
      testBtn.style.display = 'inline-block';
      disableBtn.style.display = 'inline-block';
      setStatus('✓ Bu bilgisayarda bildirimler etkin.', 'saved');
    } else {
      enableBtn.textContent = '🔔 Bu Bilgisayarda Bildirimleri Etkinleştir';
      testBtn.style.display = 'none';
      disableBtn.style.display = 'none';
      setStatus('');
    }
  }

  enableBtn.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alert('Bu tarayıcı masaüstü bildirimlerini desteklemiyor.');
      return;
    }
    const personelId = selectEl ? selectEl.value : '';
    if (!personelId) {
      alert('Lütfen önce hangi personel adına bildirim alacağınızı seçin.');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('⚠ Bildirimler tarayıcı tarafından engellenmiş. Adres çubuğundaki kilit/site ayarları simgesinden "Bildirimler" iznini manuel olarak "İzin Ver" yapıp tekrar deneyin.', 'error');
      return;
    }

    setStatus('İzin isteniyor…', 'saving');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus('Bildirim izni verilmedi. Tarayıcı ayarlarından izin vermeniz gerekir.', 'error');
        return;
      }

      localStorage.setItem(MY_PERSONEL_ID_KEY, personelId);
      localStorage.setItem(BILDIRIM_ENABLED_KEY, '1');
      showToast('Bu bilgisayarda bildirimler etkinleştirildi.');
      refreshUIState();
      startBildirimKontrolDongusu();

      // hemen bir kere kontrol et (beklemeden)
      checkGorevBildirimleriVeGoster();
    } catch (err) {
      console.error('[bildirim] etkinleştirme hatası:', err);
      setStatus('⚠ Etkinleştirilemedi: ' + err.message, 'error');
    }
  });

  if (testBtn) {
    testBtn.addEventListener('click', () => {
      if (Notification.permission !== 'granted') {
        setStatus('⚠ Önce bildirimleri etkinleştirmeniz gerekir.', 'error');
        return;
      }
      try {
        new Notification('✅ Test Bildirimi', {
          body: 'WCT Panosu bildirimleri bu bilgisayarda çalışıyor.',
          icon: undefined
        });
        setStatus('✓ Test bildirimi gönderildi.', 'saved');
      } catch (err) {
        setStatus('⚠ Test bildirimi gönderilemedi: ' + err.message, 'error');
      }
    });
  }

  if (disableBtn) {
    disableBtn.addEventListener('click', () => {
      localStorage.setItem(BILDIRIM_ENABLED_KEY, '0');
      stopBildirimKontrolDongusu();
      setStatus('Bu bilgisayarda bildirimler kapatıldı.', '');
      refreshUIState();
    });
  }

  refreshUIState();

  // Sayfa acilirken bildirimler zaten etkinse periyodik kontrolu baslat
  if (localStorage.getItem(BILDIRIM_ENABLED_KEY) === '1' && Notification.permission === 'granted') {
    startBildirimKontrolDongusu();
  }
}

function startBildirimKontrolDongusu() {
  if (bildirimKontrolIntervalId) return; // zaten calisiyor
  // her 10 dakikada bir kontrol et
  bildirimKontrolIntervalId = setInterval(checkGorevBildirimleriVeGoster, 10 * 60 * 1000);
}

function stopBildirimKontrolDongusu() {
  if (bildirimKontrolIntervalId) {
    clearInterval(bildirimKontrolIntervalId);
    bildirimKontrolIntervalId = null;
  }
}

function bugunTarihStrClient() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Size atanan gorevlerden son tarihi yaklasan/gecmis olanlar icin gercek
// tarayici (masaustu) bildirimi gosterir. Ayni gorev icin ayni gun tekrar
// bildirim gostermemek adina, sunucudaki gorev kaydina 'sonBildirimTarihi'
// yazilir (mevcut PUT /api/notlar/:id ucu yeniden kullanilir).
async function checkGorevBildirimleriVeGoster() {
  if (localStorage.getItem(BILDIRIM_ENABLED_KEY) !== '1') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const myId = localStorage.getItem(MY_PERSONEL_ID_KEY);
  if (!myId) return;

  try {
    const res = await fetch('/api/notlar');
    const notlar = await res.json();
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
    const bugunStr = bugunTarihStrClient();

    for (const gorev of notlar) {
      if (gorev.tip !== 'gorev' || gorev.durum === 'Tamamlandı' || gorev.personelId !== myId || !gorev.bitisTarihi) continue;

      const bitis = new Date(gorev.bitisTarihi + 'T00:00:00');
      if (isNaN(bitis.getTime())) continue;
      const kalanGun = Math.round((bitis.getTime() - bugun.getTime()) / 86400000);

      let asama = null;
      if (kalanGun < 0) asama = 'gecti';
      else if (kalanGun <= 1) asama = 'yaklasti';
      if (!asama) continue;

      // ayni gorev icin bugun zaten bildirim gosterildiyse atla
      if (gorev.sonBildirimTarihi === bugunStr) continue;

      const title = asama === 'gecti' ? '⚠ Görev Süresi Doldu' : '⏰ Görev Yaklaşıyor';
      const tarihMetni = kalanGun === 0 ? 'bugün' : (kalanGun < 0 ? `${Math.abs(kalanGun)} gün önce (${gorev.bitisTarihi})` : `yarın (${gorev.bitisTarihi})`);
      const body = `${gorev.baslik || 'Görev'} — son tarih: ${tarihMetni}`;

      try {
        const notif = new Notification(title, { body, tag: 'gorev-' + gorev.id, requireInteraction: true });
        notif.onclick = () => { window.focus(); notif.close(); };
      } catch (err) {
        console.error('[bildirim] gösterilemedi:', err);
      }

      // tekrar gostermemek icin sunucuya isaretle
      try {
        await fetch(`/api/notlar/${gorev.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sonBildirimTarihi: bugunStr, sonBildirimAsama: asama })
        });
      } catch (err) {
        console.error('[bildirim] sunucuya işaretlenemedi:', err);
      }
    }
  } catch (err) {
    console.error('[bildirim] kontrol hatası:', err);
  }
}

// Bildirim izni olmasa bile (izin vermediler) ek bir guvenlik agi: sayfa her
// acildiginda, "Ben kimim" olarak secilmis kisinin yaklasan/gecmis gorevleri
// varsa uygulama icinde bir uyari penceresi gosterir.
async function checkGorevlerimVeUyar() {
  const myId = localStorage.getItem(MY_PERSONEL_ID_KEY);
  if (!myId) return; // henuz kimlik secilmemis, sessizce cik

  try {
    const res = await fetch('/api/notlar');
    const notlar = await res.json();
    const bugun = new Date(); bugun.setHours(0, 0, 0, 0);

    const kritikGorevler = notlar
      .filter(n => n.tip === 'gorev' && n.durum !== 'Tamamlandı' && n.personelId === myId && n.bitisTarihi)
      .map(n => {
        const bitis = new Date(n.bitisTarihi + 'T00:00:00');
        const kalanGun = Math.round((bitis.getTime() - bugun.getTime()) / 86400000);
        return { gorev: n, kalanGun };
      })
      .filter(x => x.kalanGun <= 1)
      .sort((a, b) => a.kalanGun - b.kalanGun);

    if (kritikGorevler.length === 0) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box skt-warning-box">
        <div class="modal-header" style="background:#b91c1c;">
          <h3>⏰ Size Atanan Görevler</h3>
          <button class="modal-close" type="button">✕</button>
        </div>
        <div class="modal-body">
          <p style="margin:0 0 10px 0;font-size:13.5px;color:var(--text);">Yaklaşan veya süresi geçmiş göreviniz var:</p>
          ${kritikGorevler.map(({ gorev, kalanGun }) => `
            <div class="skt-warning-item ${kalanGun < 0 ? 'skt-warning-red' : 'skt-warning-yellow'}">
              <strong>${escapeHtml(gorev.baslik || 'Görev')}</strong> —
              ${kalanGun < 0 ? `${Math.abs(kalanGun)} gün önce süresi doldu!` : kalanGun === 0 ? 'bugün doluyor!' : 'yarın doluyor'}
              <span class="skt-warning-date">(Son tarih: ${formatDateSimpleTR(gorev.bitisTarihi)})</span>
            </div>
          `).join('')}
        </div>
        <div class="modal-footer">
          <span></span>
          <button type="button" class="btn-primary" id="gorevUyariOkBtn">Anladım</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#gorevUyariOkBtn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  } catch (err) {
    console.error('[gorev-uyari] kontrol hatası:', err);
  }
}
