# WCT Günlük Yönetim Panosu

Güvenlik, Kalite, Teslimat, Verimlilik, Kalibrasyon ve Aksiyon takibini dijital ortama taşıyan panodur.

## Klasör Yapısı

```
wct-dashboard/
├── package.json
├── server.js          -> Express sunucu ve API
├── data/
│   └── db.json        -> Tüm veriler burada saklanır (otomatik oluşur/güncellenir)
└── public/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Visual Studio Code'da Kurulum

1. Bu `wct-dashboard` klasörünü bilgisayarınıza indirin ve VS Code ile açın
   (File > Open Folder... > wct-dashboard).

2. VS Code içinde Terminal açın (Terminal > New Terminal) ve şu komutu çalıştırın:

   ```
   npm install
   ```

   Bu komut `express` ve `cors` paketlerini indirir (internet bağlantısı gerekir).

3. Sunucuyu başlatın:

   ```
   npm start
   ```

4. Tarayıcıda şu adresi açın:

   ```
   http://localhost:3000
   ```

Artık pano kullanıma hazır. Üstteki ay/yıl seçiciden ilgili dönemi seçip,
sekmeler arasında geçiş yaparak (Güvenlik / Kalite / Teslimat / Verimlilik /
Kalibrasyonlar / Aksiyonlar) her gün için veri girebilirsiniz. Her hücre
değiştiğinde otomatik olarak `data/db.json` dosyasına kaydedilir.

## Bu Sürümde Eklenenler (18) — Telefon Bildirimleri Kaldırıldı, Masaüstü Bildirimleri Eklendi

Telefon üzerinden push bildirimleri (sertifika/HTTPS/Service Worker
gerektiren sistem) **tamamen kaldırıldı** — bazı Android cihazlarda (özellikle
Samsung) güvenilir şekilde çalıştırılamadığı için bu yol terk edildi. Aşağıdaki
"Bu Sürümde Eklenenler (13-17)" başlıkları artık **geçmiş/kullanılmayan**
özellikleri anlatıyor, referans için saklandı.

**Yeni sistem: Masaüstü (Bilgisayar) Bildirimleri**

- Hiçbir sertifika, HTTPS, telefon eşleştirmesi, service worker
  **gerekmez**. Sadece tarayıcının kendi bildirim özelliğini kullanır.
- Ayarlar → 🔔 Bildirimler (Bu Bilgisayar) bölümünden: kendinizi seçip
  **"Bu Bilgisayarda Bildirimleri Etkinleştir"** butonuna basın, tarayıcının
  izin isteğini onaylayın. Bu kadar.
- WCT Panosu sekmesi bilgisayarda **açık** kaldığı sürece (simge durumuna
  küçültülebilir, başka sekmelerde çalışabilirsiniz — sadece sekmeyi
  tamamen kapatmayın), size atanan bir görevin son tarihine **1 gün** kala
  veya **süresi geçtiğinde** gerçek bir Windows/Mac bildirimi görürsünüz.
- Kontrol, sayfa her açıldığında ve ardından **her 10 dakikada bir**
  otomatik olarak yapılır. Aynı görev için aynı gün tekrar bildirim
  gösterilmez (spam yapılmaz), ama görev tamamlanana kadar her gün bir kez
  hatırlatmaya devam eder.
- **"Test Bildirimi Gönder"** ile anında bir deneme bildirimi
  gönderebilirsiniz — sunucuya gitmeden, doğrudan tarayıcıdan çalışır.
- Bildirim izni vermeseniz bile: uygulamayı her açtığınızda (kendinizi
  seçtiyseniz) yaklaşan/geçmiş görevleriniz varsa **uygulama içi bir uyarı
  penceresi** otomatik açılır (ek güvenlik ağı).

**Ayarları Kaydet butonu artık sayfanın en altında:** Kurumsal Kimlik,
Görünüm ve Sayfa Düzeni, Sayfa Bazlı Renkler, Sayfa Sıralaması ve
Bildirimler bölümlerinin **hepsinden sonra**, sayfanın en altında tek bir
"Ayarları Kaydet" butonu var (yalnızca form alanlarını — kurumsal kimlik,
görünüm, renkler — kaydeder; Sıralama ve Bildirimler bölümleri zaten kendi
işlemlerini anında kaydeder).

**Kaldırılanlar:** `web-push` ve `selfsigned` npm paketleri artık gerekli
değil (package.json'dan çıkarıldı), PWA manifest/service worker dosyaları
silindi, `/api/push/*` ve sertifika indirme uç noktaları kaldırıldı.
Kurulum artık daha basit: sadece `npm install` + `npm start`, HTTPS/IP/
sertifika ile uğraşmanıza gerek yok.

## Bu Sürümde Eklenenler (13-15) — Bildirim Sistemi Düzeltmeleri

**13) Bildirim personel dropdown'ı boş geliyordu:** `initBildirimUI()`
fonksiyonu, personel listesi sunucudan yüklenmeden ÖNCE çalışıyordu; bu
yüzden Ayarlar → Bildirimler bölümündeki "kimin adına" seçim kutusu boş
görünüyordu (personel eklemiş olsanız bile). Artık bu fonksiyon personel
listesi tamamen yüklendikten SONRA çalışıyor; ayrıca Ayarlar sekmesine her
girişte dropdown otomatik tazeleniyor.

**14) "İzin isteniyor…" yazısı takılı kalıyordu:** Önceden durum metni
sadece en başta bir kez güncelleniyordu; izin verildikten SONRA sonraki bir
adımda (örn. service worker hazırlanırken) takılırsa ekran yanıltıcı şekilde
hâlâ "İzin isteniyor" gösteriyordu. Artık her adımda ayrı durum mesajı
("1/4 İzin isteniyor" → "2/4 Sunucu anahtarı alınıyor" → "3/4 Cihaz
hazırlanıyor" → "4/4 Sunucuya kaydediliyor") gösteriliyor, her adıma 8-10
saniyelik zaman aşımı koruması eklendi (sonsuza kadar beklemek yerine açık
hata veriyor), ve F12 Console'da adım adım loglar görünüyor.

**15) Telefonda "Service worker hazırlama" zaman aşımı — kök neden:**
Yukarıdaki 14. maddedeki zaman aşımı koruması, gerçek sorunu ortaya çıkardı:
**sertifika, bilgisayarın güncel IP adresini kapsamıyordu** (IP, sertifika
ilk oluşturulduğundan sonra değişmişti — router yeniden başlamış, farklı
ağa bağlanılmış vb. olabilir). Bu yüzden telefon bağlantıyı geçerli bir
"secure context" saymıyor ve Service Worker hiçbir zaman hazır duruma
gelmiyordu. **Düzeltme:** Sunucu artık her açılışta mevcut sertifikanın
güncel IP'yi kapsayıp kapsamadığını otomatik kontrol ediyor, kapsamıyorsa
sertifikayı **otomatik olarak yeniden oluşturuyor** (manuel dosya silmeye
gerek yok).

⚠️ **Sertifika yenilendiğinde** telefonunuzdaki eski "güvenlik istisnası"
geçersiz olur; tekrar "Bağlantınız güvenli değil" uyarısı görüp **"Gelişmiş"
→ "Yine de devam et"** ile geçmeniz gerekir — bu tek seferlik ve normaldir.

## Bu Sürümde Eklenenler (17) — Samsung/Android Chrome için KESİN çözüm

Bazı Android cihazlarda (özellikle Samsung Chrome'da), güvenlik uyarısında
"Yine de devam et" demek yeterli olmuyor — tarayıcı bağlantıyı yine de tam
güvenli saymıyor ve Service Worker hiçbir zaman aktif olamıyor, "Service
worker hazırlama" adımında sonsuza kadar takılı kalıyor. Bu, PC'de Chrome'da
çalışıp telefonda çalışmamasının en olası sebebidir.

**Kesin çözüm:** Sertifikayı telefona **"güvenilir kök sertifika" (CA)**
olarak yükletmek. Bunu yaptığınızda tarayıcı artık hiçbir uyarı göstermeden
bağlantıya tam güvenir.

- Sunucudaki sertifika artık gerçek bir **CA sertifikası** olarak
  oluşturuluyor (önceki sürümlerde sadece "sunucu sertifikası"ydı, telefona
  kök sertifika olarak yüklenemiyordu). Sunucu ilk açılışta eski formattaki
  sertifikayı otomatik tespit edip yeniden oluşturur.
- Ayarlar → 📱 Bildirimler bölümüne yeni bir alt bölüm eklendi: **"Telefonda
  'Service worker hazırlama' hatası alıyorsanız"** — buradan sertifikayı
  indirebilir (📄 Sertifikayı İndir butonu) ve adım adım Android kurulum
  talimatlarını görebilirsiniz.

### Samsung M12 (ve benzeri Android cihazlar) için adımlar

1. Telefonda `https://<bilgisayar-IP>:3443` adresini açın (güvenlik
   uyarısını "Gelişmiş > Yine de devam et" ile geçin — bu SADECE
   sertifikayı indirebilmek için, kalıcı çözüm değil).
2. Ayarlar → 📱 Bildirimler → en alttaki **"📄 Sertifikayı İndir"**
   butonuna basıp `wct-panosu-sertifikasi.crt` dosyasını indirin.
3. Telefonda **Ayarlar** uygulaması → **Biyometrik veriler ve güvenlik**
   → **Diğer güvenlik ayarları** → **Sertifika yükle** → **CA sertifikası**
   → indirdiğiniz dosyayı seçin → onaylayın. (Samsung cihazlarda menü adı
   modele/Android sürümüne göre "Güvenlik ve gizlilik" gibi hafif farklı
   adlandırılabilir; "sertifika yükle" ifadesini arama kutusuna yazarak da
   bulabilirsiniz.)
4. Tarayıcıyı tamamen kapatıp yeniden açın, adresi tekrar ziyaret edin —
   artık **hiçbir güvenlik uyarısı görmemelisiniz**.
5. Ayarlar → Bildirimler'den "Etkinleştir" butonunu tekrar deneyin —
   artık sorunsuz çalışmalı.

*Not: Bu sertifika sadece SİZİN bilgisayarınızın ürettiği, tamamen yerel bir
sertifikadır; internete veya başka hiçbir sunucuya bağlı değildir. Sadece bu
WCT Panosu'na (bu bilgisayara) yapılan bağlantıları "güvenli" olarak
işaretler, başka hiçbir siteyi etkilemez.*

## Bu Sürümde Eklenenler (16) — "Service worker hazırlama" takılması

Bazı kullanıcılarda telefonda "Bu Cihazda Bildirimleri Etkinleştir" butonuna
basınca **"Service worker hazırlama" adımı 10 saniyede tamamlanamadı**
hatası alınıyordu. Bunun en olası nedeni: telefonun tarayıcısının, o adres
(`https://<IP>:3443`) için verdiğiniz güvenlik istisnasının tarayıcı
tarafından **tam olarak "güvenli bağlam" sayılmaması** — bu durumda Service
Worker hiçbir zaman aktif olmuyor ve buton sonsuza kadar bekliyordu.

Bu sürümde:
- Sunucu artık başlarken **hangi IP adreslerini** kapsayan bir sertifika
  oluşturduğunu terminalde açıkça yazdırıyor (`[https] Yeni sertifika şu IP
  adreslerini kapsıyor: ...`) — telefonunuzda kullandığınız adresin bu
  listede olduğunu buradan kontrol edebilirsiniz.
- Bilgisayarın IP adresi değiştiğinde sertifika **otomatik olarak yeniden
  oluşturuluyor** (önceki sürümden beri).
- "Bildirimleri Etkinleştir" butonuna basar basmaz artık önce
  `window.isSecureContext` kontrolü yapılıyor; sayfa güvenli bağlam olarak
  algılanmıyorsa **hemen, anlamlı bir hata mesajıyla** durduruluyor (10
  saniye beklemeden) ve size ne yapmanız gerektiğini (tarayıcı geçmişini/
  site verilerini temizleyip yeniden deneme) söylüyor.

### Sorun Devam Ederse Yapmanız Gerekenler

1. Terminaldeki (`npm start` çalıştırdığınız pencere) çıktıya bakın —
   `[https] Yeni sertifika şu IP adreslerini kapsıyor: ...` satırında
   telefonda kullandığınız IP'nin (örn. `192.168.1.7`) listelendiğinden
   emin olun. Listelenmiyorsa `data/cert.pem` ve `data/key.pem` dosyalarını
   silip sunucuyu yeniden başlatın.
2. Telefonda Chrome'da: adres çubuğundaki kilit/uyarı simgesine dokunun →
   **Site ayarları** → bu site için **"Sıfırla" / "Verileri temizle"**
   yapın. Ardından sekmeyi tamamen kapatıp yeniden açın.
3. `https://<IP>:3443` adresini tekrar açın, güvenlik uyarısını **yeniden**
   onaylayın ("Gelişmiş" → "Yine de devam et").
4. Ayarlar → Bildirimler'den tekrar deneyin. Artık ya çalışacak ya da (SW
   gerçekten kurulamıyorsa) size anlamlı bir hata mesajı verecek — F12/
   uzaktan hata ayıklama ile konsolu kontrol edip bana iletebilirsiniz.

## Bu Sürümde Eklenenler (15) — Sertifika IP Otomatik Yenileme

Bilgisayarın yerel ağ IP adresi değiştiğinde (router yeniden başlatıldığında,
farklı bir Wi-Fi ağına bağlanıldığında vb.), eskiden kaydedilmiş sertifika
yeni IP'yi tanımadığı için telefonda sürekli "güvenli değil" hatası ve
"Service worker hazırlama" adımında sonsuz takılma yaşanıyordu. Artık sunucu
her başlatıldığında mevcut sertifikanın güncel IP adres(ler)ini kapsayıp
kapsamadığını kontrol ediyor; kapsamıyorsa otomatik olarak yeni bir
sertifika oluşturuyor. *(Not: Sertifika yenilendiğinde telefonunuzda daha
önce verdiğiniz güvenlik istisnasını bir kez daha vermeniz gerekir.)*

## Bu Sürümde Eklenenler (14) — Bildirim Etkinleştirme Akışı İyileştirmeleri

"Bu Cihazda Bildirimleri Etkinleştir" butonuna basıldığında ekranda uzun
süre yalnızca "İzin isteniyor…" yazısının kalması sorunu giderildi:
- Artık her adımda (1/4 İzin, 2/4 Sunucu anahtarı, 3/4 Cihaz hazırlama, 4/4
  Sunucuya kayıt) durum metni güncelleniyor, böylece sürecin tam olarak
  hangi aşamada olduğunu görebilirsiniz.
- Her adıma 8-10 saniyelik zaman aşımı eklendi; bir adım takılırsa sonsuza
  kadar beklemek yerine açık bir hata mesajı gösteriliyor.
- Bildirimler tarayıcı tarafından zaten engellenmişse bu baştan tespit
  edilip size nasıl düzelteceğiniz söyleniyor.
- F12 Console'da `[push] ...` etiketiyle detaylı adım adım loglar tutuluyor.

## Bu Sürümde Eklenenler (13) — Bildirim Sayfasındaki Personel Listesi Boş Kalıyordu

Ayarlar → Bildirimler bölümündeki personel seçim kutusu, personel listesi
sunucudan yüklenmeden önce doldurulduğu için boş görünüyordu (personel
eklemiş olsanız bile). Artık bu kutu, personel listesi tamamen
yüklendikten sonra dolduruluyor; ayrıca Ayarlar sekmesine her girişte de
otomatik olarak tazeleniyor.

## Bu Sürümde Eklenenler (12) — Mobil / Masaüstü Push Bildirimleri

Artık uygulama gerçek bir **PWA (Progressive Web App)** ve size özel atanan
görevlerin (Aksiyonlar → Notlar/Görevler → "Kişiye Görev") son tarihi
yaklaştığında veya geçtiğinde **telefonunuza/bilgisayarınıza bildirim**
gönderebiliyor — WCT tablosuna bakmayı unutsanız bile.

### Nasıl Çalışır?

- Sunucu artık **iki adresten** yayın yapıyor:
  - `http://localhost:3000` — bilgisayarınızda normal kullanım için.
  - `https://<bilgisayarınızın-yerel-IP-adresi>:3443` — **telefon ve diğer
    cihazlar için**. Sunucuyu başlattığınızda (`npm start`) terminalde bu
    adres otomatik olarak yazdırılır (örn. `https://192.168.1.23:3443`).
- **Neden iki adres var?** Tarayıcılar, push bildirimlerini yalnızca
  "güvenli bağlam" (HTTPS veya `localhost`) üzerinde çalıştırır. Telefonunuz
  ayrı bir cihaz olduğu için bilgisayarınızın `localhost` adresine
  erişemez; bu yüzden telefon için ayrı, kendinden imzalı bir HTTPS adresi
  oluşturduk. Bu sertifika tamamen yerel olarak üretilir, internete veya
  üçüncü bir servise ihtiyaç duymaz.

### Kurulum Adımları

1. Zip'i açıp `npm install` çalıştırın (bu sürümde 2 yeni paket eklendi:
   `web-push` ve `selfsigned`).
2. `npm start` ile sunucuyu başlatın. Terminalde şöyle bir çıktı göreceksiniz:
   ```
   WCT Dashboard (bilgisayarinizda):  http://localhost:3000
   Telefon/diger cihazlar icin (AYNI Wi-Fi agi gereklidir):
     https://192.168.1.23:3443
   ```
3. **Telefonunuzu bilgisayarınızla aynı Wi-Fi ağına bağlayın.**
4. Telefonunuzun tarayıcısında (Chrome/Safari) terminaldeki `https://...:3443`
   adresini açın.
5. "Bağlantınız güvenli değil" gibi bir uyarı çıkacaktır — bu normaldir
   (kendinden imzalı sertifika kullanıyoruz). **"Gelişmiş" / "Advanced" >
   "Yine de devam et / Proceed"** ile geçin.
6. Telefonda tarayıcı menüsünden **"Ana Ekrana Ekle"** yaparak uygulamayı
   telefon ana ekranınıza yükleyebilirsiniz (isteğe bağlı ama önerilir).
7. Uygulamada **Ayarlar → 📱 Bildirimler** bölümüne gidin, "Bu cihazda
   bildirimleri kimin adına almak istiyorsunuz?" kısmından kendinizi seçin,
   **"🔔 Bu Cihazda Bildirimleri Etkinleştir"** butonuna basın ve tarayıcının
   bildirim izni isteğini onaylayın.
8. **"Test Bildirimi Gönder"** ile çalıştığını doğrulayabilirsiniz.

### Bildirim Ne Zaman Gelir?

- Bir görevin **son tarihine 1 gün veya daha az** kaldığında ("yaklaşıyor").
- Bir görevin **son tarihi geçtiğinde** ("süresi doldu").
- Sunucu bu kontrolü sunucu açıldıktan 8 saniye sonra bir kez, sonrasında
  **her 30 dakikada bir** otomatik olarak yapar. Aynı görev için aynı gün
  içinde tekrar bildirim gönderilmez (spam önlenir), ama görev tamamlanana
  kadar her gün bir kez hatırlatılmaya devam eder.
- Bildirim yalnızca **o görevin sahibi olarak atanan kişiye** gider (Ayarlar
  sayfasında hangi personel adına bildirim aldığınızı seçtiğiniz cihaza).

### Ek Güvenlik Ağı (Push izni olmasa bile)

Push bildirimlerine izin vermeseniz veya masaüstünde çalışıyor olsanız
bile, uygulamayı her açtığınızda (Ayarlar'da kendinizi seçtiyseniz),
yaklaşan/geçmiş görevleriniz varsa **uygulama içi bir uyarı penceresi**
otomatik olarak açılır — SKT uyarı popup'ına benzer şekilde.

### Bilinmesi Gerekenler / Sınırlamalar

- Bilgisayarınızın yerel IP adresi değişirse (örn. router yeniden başlarsa)
  terminaldeki yeni adresi kullanmanız gerekir; sertifika birden fazla olası
  IP için önceden oluşturulur ama IP tamamen değişirse yeni sertifika
  gerekebilir (bu durumda `data/cert.pem` ve `data/key.pem` dosyalarını
  silip sunucuyu yeniden başlatmanız yeterlidir, otomatik yeniden oluşur).
- Bilgisayarınız kapalıyken veya sunucu çalışmıyorken bildirim gönderilemez
  (bu bir yerel sunucu, bulut servisi değildir).
  telefonun ve bilgisayarın aynı ağda olması gerekir.
- iPhone'da push bildirimleri yalnızca iOS 16.4 ve üzeri sürümlerde, site
  "Ana Ekrana Eklendiyse" çalışır (Safari'de doğrudan sekmede değil).

## Bu Sürümde Eklenenler (11)

**İzin/Rapor Süresince Satır Kilitleme:** WCT Katılım Listesi'nde bir
personel için "İzinli/Raporlu" seçilip **kaç gün izinli / kaç gün raporlu**
girildiğinde, o gün de dahil toplam gün sayısı kadar (örn. 3 gün izin + 2 gün
rapor = 5 gün) ilerleyen günlerde o personelin satırı **otomatik olarak
kilitlenir** — üç seçenek de (Katıldı/Katılmadı/İzinli-Raporlu) tıklanamaz
hale gelir, "İzinli/Raporlu" olarak sabit görünür ve sarı bir "🔒 kilitli,
X gün daha" ipucu gösterilir. Süre dolunca (girişin yapıldığı günden itibaren
belirtilen gün sayısı kadar sonra) satır otomatik olarak tekrar serbest kalır.

Kilitli günlerde her zaman görünen bir **"Düzenle"** bağlantısı, tıklandığında
otomatik olarak girişin yapıldığı asıl güne (anchor gün) atlar ve o gün için
izin/rapor sayılarını değiştirebileceğiniz popup'ı açar — böylece yanlış
girilen bir süre istenildiği zaman düzeltilebilir ve kilit süresi buna göre
otomatik olarak yeniden hesaplanır.

*Not: Kilit hesaplaması ay bazında yapılır (ayın 1'inden itibaren); bir izin/
rapor süresinin ay sonunu aşıp bir sonraki aya taşması şu an desteklenmiyor.*

## Bu Sürümde Eklenenler (10)

**1) Yıllık Özet artık 6. tıklanabilir kart:** Özet sayfasındaki 5 kategori
kartının yanına "Yıllık Özet (Bölüm Bazlı)" adında 6. bir kart eklendi.
Tıklandığında hemen altında yıllık bölüm bazlı tablo açılıp kapanıyor
(ayrı bir sayfa aşağısına gitmeye gerek yok).

**2) Teslimat varsayılan değerleri:** Günlük Takip sayfasındaki Teslimat
kartında İstenen/Onaylanan Parti alanları artık boş değil, **"0"** ile
geliyor.

**3) Kalibrasyon "Belirtilmedi" kaldırıldı:** Artık sadece **Yapıldı** /
**Yapılmadı** seçenekleri var; liste her zaman **Yapıldı** ile açılıyor,
"Yapılmadı" sadece siz seçerseniz işaretleniyor.

**4) Ayarlar → Sayfa Sıralaması:** Yeni bir bölüm eklendi — Günlük Takip
(G-K-T-V-K) kartlarının sırasını ve Özet sayfasındaki blokların (Notlar/
Personel üst bloklar; Kaza/SKT/Aksiyonlar kart bölümleri) sırasını ▲/▼
butonlarıyla değiştirebilirsiniz. Değişiklikler anında kaydedilir.
*(Not: "sağa/sola" yerine tek bir sıralı liste üzerinden yukarı/aşağı
kullanıldı, çünkü kartlar otomatik sarılan bir ızgarada olduğu için sabit
bir "sağ/sol" pozisyonu yok — yukarı/aşağı ile aynı esneklik sağlanıyor.)*

**5) İzinli/Raporlu gün takibi:** WCT Katılım Listesi'nde bir personel için
**"İzinli/Raporlu"** seçildiğinde artık bir popup açılıp **"Kaç gün izinli,
kaç gün raporlu"** soruluyor. Girilen sayılar:
  - **Personel Bazlı Özet** tablosuna iki yeni sütun olarak ("İzinli (gün)",
    "Raporlu (gün)") ekleniyor (seçili aya göre),
  - **Yıllık Özet — Bölüm Bazlı** tablosuna yıllık toplam olarak yansıyor,
  - **Personel Detay Kartı**na (isme tıklayınca açılan popup) hem "Bu Yıl"
    hem "Tüm Zamanlar Toplamı" olarak ekleniyor.

## Bu Sürümde Eklenenler (9)

**Personel Sorumluluğu:** "Personel" sekmesindeki forma yeni bir alan
eklendi — **Sorumluluk(lar)** (örn. "Arşiv Sorumlusu", "Reaktif Sorumlusu").
Bir kişiye birden fazla sorumluluk eklenebilir (metin yazıp "+ Ekle" veya
Enter'a basarak, chip listesi olarak eklenir/çıkarılır). Sorumluluklar:
- Personel tablosunda yeni bir sütunda küçük sarı rozetler olarak görünür.
- Özet sayfasındaki **Personel Detay Kartı** (isme tıklayınca açılan popup)
  içinde, personelin adı/departmanının hemen altında rozetler olarak
  gösterilir.
- Personel düzenlenirken ("Düzenle" butonu) mevcut sorumluluklar forma
  otomatik yüklenir, ekleme/çıkarma yapılıp güncellenebilir.

## Bu Sürümde Eklenenler (8)

**1) Toplantı Notları → Notlar / Görevler sistemine dönüştürüldü:** Artık iki
tip kayıt eklenebiliyor:
  - **Kişiye Görev**: Sorumlu personel seçilir, başlık, açıklama, **bitiş/son
    tarih** girilir, durum (Devam ediyor/Tamamlandı) takip edilir. Süresi
    geçmiş ve hâlâ tamamlanmamış görevler kırmızı arka planla vurgulanır.
  - **Lab Geneli Duyuru**: Belirli bir kişiye değil, tüm laboratuvara yönelik
    genel not/duyuru (kişi seçimi yok).
  Her kayıtta **oluşturma tarihi** otomatik olarak sunucu tarafında
  kaydedilir. Aksiyonlar sekmesindeki form buna göre yeniden düzenlendi (Tip
  seçildikçe ilgili alanlar — personel, bitiş tarihi, durum — otomatik
  görünür/gizlenir). Kayıt listesinden görevler tek tıkla "Tamamlandı"
  işaretlenebilir.
  Bu bölüm artık **Özet sayfasında**, üstteki "Özet — Ay Yıl" kartı ile
  "Personel Bazlı Özet" tablosu **arasında**, **sayfa genişliğince** ve
  **açılır/kapanır** olarak gösteriliyor; tamamlanmamış görevler listenin
  başında öne çıkarılıyor.

**2) G-K-T-V-K takviminde gün adları:** Her tarih hücresinin gün numarasının
üstüne küçük harflerle haftanın günü kısaltması (Pzt, Sal, Çar...) eklendi.

## Bu Sürümde Eklenenler (7)

**1) Personel Detay Kartı:** Özet sayfasındaki "Personel Bazlı Özet"
tablosunda artık her personelin **adı tıklanabilir** (altı çizili link).
Tıklandığında bir popup açılır ve gösterir: personel fotoğrafı/rozeti,
departman/unvan, **"Bu Yıl"** toplamları (kaza, ramak kala, See Card, ASD,
sapma, fazla mesai, izinli gün) ve **"Tüm Zamanlar Toplamı"**, ayrıca ay ay
kırılım tablosu (hangi ayda ne kadar veri girilmiş).

**2) Bölüm Bazlı Özet → Yıllık Özet:** Bu tablo artık sadece seçili ayın
verisini değil, **seçili yılın (state.year) tüm aylarının toplamını**
gösteriyor. Yıl değiştirildikçe (üstteki yıl seçiciden) tablo otomatik olarak
o yıla ait kümülatif toplamlarla güncelleniyor.

**3) Personel düzenleme:** "Personel" sekmesinde her kayda artık bir
**"Düzenle"** butonu var. Tıklandığında form o personelin bilgileriyle
(ad, departman, unvan, fotoğraf) dolar, buton "Personeli Güncelle" olur,
yanında bir "Vazgeç" butonu belirir. Kaydedince bilgiler güncellenir
(fotoğraf değiştirilmezse mevcut fotoğraf korunur).

## Bu Sürümde Eklenenler (6)

**1) Personel/Bölüm bazlı toplamlar:** Personel Bazlı Özet tablosunun altına
**TOPLAM** satırı eklendi. Ayrıca yeni bir **"Bölüm Bazlı Özet"** tablosu
(Personel sekmesindeki "Departman / Görev Yeri" alanına göre gruplanmış)
eklendi — her bölümün kişi sayısı ve tüm metrik toplamları görünür.

**2) SKT bilgisi Özet sayfasında:** Özet sayfasına yeni bir **"SKT / Süre
Takibi"** kartı eklendi; tüm kayıtlı malzemelerin kalan gün durumunu (yeşil/
sarı/kırmızı rozet ile) gösterir, kritik durumdaysa kart otomatik açık gelir.
Ayrıca uyarı popup'ı artık şu durumlarda da tetiklenir: yeni bir SKT kaydı
eklendiğinde ve "Aksiyonlar" sekmesine her girildiğinde (öncesinde sadece
sayfa ilk açıldığında kontrol ediliyordu).

**3) Ayarlar sayfası gruplandırıldı + sayfa bazlı renkler:** Ayarlar artık
3 açılır/kapanır başlık altında: **Kurumsal Kimlik**, **Görünüm ve Sayfa
Düzeni**, **Sayfa Bazlı Renkler**. Son bölümde Güvenlik/Kalite/Teslimat/
Verimlilik/Kalibrasyon sayfalarının her birinin rengini ayrı ayrı
özelleştirebilirsiniz.

**4) Aksiyonlar sayfası tamamen açılır/kapanır:** Aksiyon Takibi, Toplantı
Notları, Duyurular, SKT Takibi — hepsi artık kendi başlığına tıklanınca
açılıp kapanan ayrı bölümler, sayfa çok daha derli toplu.

## Bu Sürümde Eklenenler (5)

**1) Duyurular 3'ten 6'ya çıkarıldı:** "Aksiyonlar" sekmesinde artık OPL,
See Card/Öneri Karekodu, Kalibrasyon Tablosu'na ek olarak **Diğer 1, Diğer 2,
Diğer 3** adında 3 yükleme kutusu daha var. Özet sayfasında bu 6 görsel
düzenli bir 2 sütunlu ızgarada yan yana gösteriliyor.

**2) WCT Katılım Listesi artık açılır/kapanır:** Günlük Takip sayfasının en
üstünde yer kaplamaması için "▸ WCT Katılım Listesi" başlığına tıklanınca
açılıp kapanan bir bölüme dönüştürüldü.

**3) G-K-T-V harf şekli kaldırıldı:** Güvenlik, Kalite, Teslimat ve
Verimlilik artık Kalibrasyon tablosuyla aynı şekilde, sade 7 sütunlu düz
takvim görünümünde. Harf şekli tasarımı tamamen kaldırıldı.

**4) Verimlilik (ve diğer) popup genişliği:** "+ Ekle" satırındaki
seçim kutusu, saat/not alanları ve buton artık dar ekranlarda otomatik alt
satıra geçiyor (flex-wrap), böylece "+ Ekle" butonu hiçbir zaman görünmez
şekilde kesilmiyor.

**5) SKT / Süre Takibi (yeni):** "Aksiyonlar" sekmesinin altında yeni bir
bölüm — malzeme/çözelti adı, hazırlanma tarihi ve geçerlilik süresi (gün)
girilir, sistem SKT tarihini otomatik hesaplar. Süre dolmasına **3 gün kala
sarı**, **süre dolunca kırmızı** (yanıp sönen) uyarı verir. Birden fazla
kayıt eklenebilir, her biri ayrı satırda takip edilir. Sayfa her açıldığında,
sarı/kırmızı durumda kayıt varsa otomatik bir **uyarı penceresi (popup)**
açılır.

## Bu Sürümde Eklenenler (4) — kesin kök neden bulundu

**1) Ayarlar sayfası kaydetmiyordu — GERÇEK NEDEN BULUNDU VE DÜZELTİLDİ:**
Sayfa açılışında (`DOMContentLoaded`) tüm init fonksiyonları (`initActionForm`,
`initNotForm`, `initPersonelForm`, `initAyarlarForm` ...) art arda,
**korumasız** çağrılıyordu. Eğer bunlardan biri hata fırlatırsa, JavaScript o
noktada durur ve **kendisinden sonraki hiçbir init fonksiyonu çalışmaz**. Bu
yüzden `initAyarlarForm()` bazı durumlarda hiç çalışmıyor, "Kaydet" butonuna
tıklama olayı hiç bağlanmıyordu — buton görünüyordu ama tıklandığında hiçbir
şey olmuyordu. Artık her init adımı ayrı `try/catch` ile izole edildi; biri
başarısız olsa bile diğerleri (özellikle Ayarlar) çalışmaya devam ediyor.
Sunucu hata dönerse artık görünür bir uyarı çıkıyor, başarılı kayıtta yeşil
bir "✓ kaydedildi" bildirimi beliriyor.

**2) Özet sayfası düzeni:** Personel Bazlı Özet tablosu artık **tam sayfa
genişliğinde** tek başına üstte; Kaza/Ramak Kala Detayları, Açık Aksiyonlar
ve Toplantı Notları ise altlarında **yan yana** (dar ekranda alt alta),
her biri hâlâ açılır/kapanır.

**3) GKVTK popup genişliği:** Gün düzenleme penceresi 420px'ten 560px'e
genişletildi, pencere artık ekran yüksekliğine göre kendi içinde kaydırılıyor
(üst başlık ve alt "Kaydet" butonu her zaman sabit ve görünür kalıyor), dar
ekranlarda butonlar alt alta tam genişlikte diziliyor.

**4) Özet sayfası uyarı satırı:** Eski "⚠ Bu ay toplam N gün sapma var"
mesajı (tüm 5 kategorinin kırmızı günlerini topluyordu) kaldırıldı. Yerine,
yalnızca ilgili sayı 0'dan büyükse görünen ayrı rozetler eklendi: **Kalite
Sapma**, **Açılan ASD**, **Minör/Majör Kaza**, **See Card** — her biri veri
girildikçe canlı güncelleniyor ve sadece kendi kategorisindeki veriye göre
tetikleniyor.

## Bu Sürümde Eklenenler (kayıt sorunu — kesin çözüm denemesi)

Sunucu tarafındaki kayıt mantığı gerçek HTTP istekleriyle defalarca test edildi
ve doğru çalıştığı doğrulandı (bir kaza kaydı eklenip "Kaydet"e basıldığında
sunucu veriyi doğru saklıyor ve durum hesaplaması "kırmızı" çıkıyor). Buna
rağmen sorun yaşanmasının en olası nedeni şuydu: **modalda "+ Ekle" ile
personel eklemek/çıkarmak henüz kaydetmiyor** — bu sadece pencere içindeki
taslağı değiştiriyor, gerçek kayıt için hâlâ ayrı olarak en alttaki
**"Kaydet"** butonuna basmak gerekiyor. Kullanıcı "+ Ekle"ye bastıktan sonra
pencereyi kapatırsa (Kaydet'e basmadan) hiçbir şey kaydedilmiyordu ve bu fark
edilmiyordu. Bunu imkansız hale getirmek için:

- Modalın üstüne **sarı bir uyarı şeridi** eklendi: "+ Ekle personel
  eklemek/çıkarmak henüz KAYDETMEZ..."
- Modalın altına, Kaydet'e basmadan önce **tam olarak neyin kaydedileceğini**
  ve **sonuç renginin ne olacağını** (YEŞİL/KIRMIZI) canlı gösteren bir
  **doğrulama kutusu** eklendi.
- Kaydedilmemiş bir değişiklik varken pencereyi kapatmaya çalışırsanız artık
  bir **onay penceresi** çıkıyor ("Kaydet'e basmadınız, kapatmak istediğinize
  emin misiniz?").
- Başarılı kayıttan sonra ekranın altında yeşil bir **"✓ kaydedildi"**
  bildirimi (toast) beliriyor.
- Sunucu artık her kayıt isteğini **terminal konsoluna** logluyor
  (`[POST /api/data] ...`) — sorun devam ederse `npm start` çalıştırdığınız
  terminal penceresinde bu logları görüp bana iletebilirsiniz.
- Sürüm numarası `v2026-07-18-3-savefix` olarak güncellendi; sayfanın en
  altında bu numarayı görmelisiniz. Farklı bir numara görüyorsanız hâlâ eski
  dosyaları çalıştırıyorsunuz demektir.

## Bu Sürümde Eklenenler (2)

- **Özet sayfası artık kart-grid düzeninde**: Üstte ana özet kartı + Duyurular
  mini galerisi yan yana; altta Personel Özeti / Kaza Detayları / Açık
  Aksiyonlar / Toplantı Notları kartları yan yana ve alt alta, her biri
  başlığına tıklandığında açılıp kapanıyor.
- **Duyurular (görsel yükleme)**: "Aksiyonlar" sekmesinde 3 ayrı yükleme
  alanı — One Point Lesson (OPL), See Card/Öneri Karekodu, Kalibrasyon
  Tablosu. Yüklenen görseller Özet sayfasında küçük önizleme olarak görünür;
  üzerine tıklayınca büyütülmüş halde açılır.
- Kayıt işleminde sunucu bir hata döndürürse (önceden sessizce yutulan
  durum) artık görünür bir uyarı çıkıyor; ayrıca önbellek tamamen kapatıldı
  ve sayfa altına sürüm numarası eklendi.

## Bu Sürümde Değişenler

- **Kaydet butonu geri geldi**: Gün penceresinde artık yine açık bir "Kaydet"
  butonuna basmanız gerekiyor; otomatik kaydetme kaldırıldı.
- **Varsayılan durum artık YEŞİL**: Bir güne hiç veri girmediyseniz o gün
  otomatik olarak yeşil (hedefe uygun) görünür. Kırmızı sadece açıkça kötü
  bir veri girildiğinde (kaza, ramak kala, ASD, sapma, teslimat sapması,
  yapılmayan kalibrasyon vb.) görünür. Gri "veri girilmedi" durumu kaldırıldı.
- **Personel fotoğrafı**: "Personel" sekmesinde her kişiye opsiyonel bir
  fotoğraf yükleyebilirsiniz (yoksa isim baş harfleriyle otomatik bir rozet
  gösterilir). Fotoğraf, Organizasyon Şemasında da görünür.
- **Ayarlar → Sayfa Düzeni ve Boyutlandırma**: Sayfa genişliği (dar/normal/
  geniş), köşe yuvarlaklığı (keskin/yumuşak/oval), kart gölgesi açık/kapalı,
  kompakt görünüm (daha az boşluk) seçenekleri eklendi.

## Önceki Sürümlerde Eklenenler

*(Not: Bu bölümdeki "otomatik kayıt" ile ilgili madde artık geçerli değildir —
kullanıcı isteği üzerine tekrar açık "Kaydet" butonuna dönülmüştür, bkz. yukarı.)*

- Personel seçmeden "+ Ekle" butonuna basarsanız artık sessizce hiçbir şey
  olmaz demeden, kırmızı bir uyarı ("Lütfen önce bir personel seçin.") gösterilir.
- **Toplantı Notları** artık Özet sayfasında da (son 5 not) görünüyor.
- **Özet sayfası** artık daha kompakt: üstte her zaman görünen küçük durum
  kartları, altında ise başlığa tıklayınca açılıp kapanan bölümler (Personel
  Bazlı Özet, Kaza/Ramak Kala Detayları, Açık Aksiyonlar, Toplantı Notları).
- **Organizasyon Şeması** artık 3 kademeli: Bölüm Sorumlusu → doğrudan altında
  tek başına Kalite Kontrol Uzmanı/Vardiya Sorumlusu → onun altında dağılan
  diğer 5 unvan.

⚠️ **Önemli**: Tarayıcınız eski `app.js`/`style.css` dosyalarını önbelleğe
almış olabilir. Dosyaları değiştirdikten ve sunucuyu yeniden başlattıktan
sonra tarayıcıda mutlaka **sert yenileme** yapın: **Ctrl+Shift+R** (Windows)
veya sayfayı gizli sekmede açın. Aksi halde eski davranışı görmeye devam
edebilirsiniz.

## Yeni Eklenen Özellikler (önceki sürüm)

- **Olay Notu**: Güvenlik/Kalite/Verimlilik sayfalarında bir güne personel
  eklerken (örn. Minör Kaza, See Card) opsiyonel bir "Not" alanına kısa
  açıklama yazabilirsiniz; bu not kayıtlı kalır ve Özet sayfasındaki
  "Kaza / Ramak Kala Olay Detayları" tablosunda görünür.
- **Özet sayfasında dikkat çekme**: Personel bazlı özet tablosunda bir
  personelin Kaza (Minör+Majör) sayısı 0'dan büyükse o satır ve hücre
  kırmızı vurgulanır (See Card bu kurala dahil değildir).
- **Organizasyon Şeması**: "Personel" sekmesinde her kişiye bir **Unvan**
  atayın (Bölüm Sorumlusu + 6 kademe). "Organizasyon" sekmesi bu unvanlara
  göre şemayı otomatik oluşturur.
- **Ayarlar**: Firma adı, bölüm adı, ana renk (aksan rengi), arka plan rengi,
  logo yükleme ve arka plan görseli yükleme. Kaydettiğinizde tüm sayfalara
  anında uygulanır.
- **Toplantı Notları**: "Aksiyonlar" sekmesinin altında, tarih + serbest
  metin ile toplantı notu ekleme/silme.

## Kategoriler ve Kurallar

- **Özet**: Uygulama açılınca gelen ana sayfa. Salt okunurdur, düzenleme/silme
  yoktur. Seçili ay için her kategorinin yeşil/kırmızı/veri yok gün sayılarını,
  personel bazlı olay özetini (kaza, ramak kala, See Card, ASD, sapma, fazla
  mesai, izinli gün) ve açık aksiyonları gösterir.
- **Güvenlik**: Minör Kaza, Majör Kaza, Ramak Kala, See Card — her olay bir
  **personele bağlı** olarak eklenir. O gün kaydedildiğinde (Kaydet'e
  basıldığında) kaza/ramak kala varsa **kırmızı**, yoksa **yeşil** olur.
- **Kalite**: Açılan ASD ve Açılan Sapma — her biri personele bağlı olay
  olarak eklenir. Herhangi biri varsa **kırmızı**.
- **Teslimat**: İstenen Parti / Onaylanan Parti sayısal olarak girilir,
  Teslimat % otomatik hesaplanır.
- **Verimlilik**: Fazla Mesai (personel + saat), Eksik/İzinli Personel
  (personel bazlı), Arızalı/Eksik Ekipman (adet).
- **Kalibrasyonlar**: Terazi 1/2/3, Karl Fischer, pH Metre, FT-IR,
  Türbidimetre için Yapıldı / Yapılmadı / Belirtilmedi seçimi.
- **Aksiyonlar**: Başlık, açıklama, başlangıç/bitiş tarihi, **aksiyon sahibi
  (personel)** ve durum (Devam ediyor / Tamamlandı / İptal).
- **Personel**: Ad soyad + departman ile personel ekleme/silme. Diğer tüm
  sekmelerdeki personel seçim kutuları buradan beslenir.

## Gün Rengi Nasıl Çalışır (Gri / Yeşil / Kırmızı)

Her gün hücresine tıklayınca açılan pencerede veri girip **Kaydet**'e
bastığınızda o gün "değerlendirildi" olarak işaretlenir ve kurala göre yeşil
veya kırmızı olur. Eğer o güne hiç girmediyseniz veya yanlışlıkla girip
**"Bu Günü Temizle"** butonuna bastıysanız, gün tamamen silinir ve tekrar
**gri (veri girilmedi)** durumuna döner. Böylece yanlışlıkla girilip
silinen veriler pano üzerinde kırmızı/yeşil olarak takılı kalmaz.

## Notlar

- Personel silindiğinde geçmiş kayıtlardaki adı "(silinmiş personel)" olarak
  görünür; kayıtlar kaybolmaz.
- Kalibrasyonlar için harfli şablon paylaşılmadığından bu sekme klasik 7
  sütunlu takvim görünümünde kalmıştır.
- Önceki bir sürümden güncelliyorsanız `data/db.json` dosyanızdaki eski
  sayısal alanlar (örn. `minor: 2`) yeni personel-listesi formatıyla uyumlu
  değildir; en temizi mevcut `db.json`'ı bu paketteki boş haliyle
  değiştirip verileri yeniden girmektir.

