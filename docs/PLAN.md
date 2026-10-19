# Plan

> Durum: 2026-10-18. Faz 2 Windows/ortak prototipi uygulandı; gerçek Core Console kanıtları [kabul belgesinde](TEKNIK_DENEME_KABUL.md). Mac kullanıcı isteğiyle ayrı Faz M'ye taşındı; güncel fazlar Windows üzerinden ilerler. Bu plan gelecekteki fazlara, commit veya yayına izin vermez. Aşağıdaki genel ürün yönü ile sınanmış prototip alt kümesi ayrıdır.

İlgili belgeler: [Kararlar](KARARLAR.md), [Yetenek matrisi](YETENEK_MATRISI.md), [Araştırma](arastirma/MEVCUT_COZUMLER_2026-10-18.md), [Geliştirme rehberi](GELISTIRME.md).

## 1. Amaç

Her kullanıcının kendi bilgisayarında yerel çalışan bir köprüyle tam AutoCAD 2027 ile MCP istemcileri arasında bağlantı kurmak. Windows ve macOS'ta yeni 2B/3B çizim ile mevcut çizimi inceleme/düzenleme birlikte hedeflenir. Zorunlu merkezi hesap veya sunucu planlanmıyor.

Başarı ölçütü, istenen işlemi doğru hedefte ve belirlenmiş birimlerle uygulayıp sonucunu AutoCAD'den doğrulamaktır. Geniş özellik erişimi platform/API matrisiyle izlenecek; serbest komut/LISP erişimi tam test kapsamı sayılmayacak.

## 2. Kullanıcı kararları (sabit)

| Karar | Ayrıntı |
|---|---|
| Ad ve konum | Proje adı **Autocad MCP**; çalışma klasörü bu depo. GitHub adı `Autocad-MCP`, görünürlük **private**. Public yalnız açık kullanıcı talebiyle. |
| Platform | Tam AutoCAD 2027; hem Windows hem macOS. İlk Mac test hedefi kullanıcı tarafından Apple Silicon (M serisi, arm64) olarak belirtildi. |
| Kapsam | Yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme birlikte hedeflenir. |
| Yerel köprü | Her kullanıcının bilgisayarında yerel köprü; zorunlu merkezi hesap/sunucu yok. |
| Veri akışı | Yerel köprü, bulut AI sağlayıcısının veri akışını otomatik yerelleştirmez. AI istemcisinin buluta veri göndermesi ayrı veri akışıdır. |
| Ürün yönü | İleride kurulabilir açık kaynak ürün. Lisans kesinleşmedi; Apache-2.0 yalnız öneridir ve `LICENSE` yazılmaz. |
| Güncel izin | Faz 2 Windows/ortak kod, yerel bağımlılık/SDK, derleme ve izole AutoCAD testi onaylı; kullanıcı “kendin yap” dedi. Mac, commit/push/yayın yok. |
| Dil | Kullanıcı iletişimi ve proje belgeleri Türkçe. Prototip MCP açıklamaları İngilizce; ürün yerelleştirmesi açık. |
| Test ortamı | İzole Core Console profili ve sentetik stok şablon kopyaları; gerçek müşteri/üretim dosyası yok. |
| Mac | Mac derlemesi ve canlı testi ileride gerekir; kullanıcı o iş için onay vermeden Mac'e bağlanılmaz. |
| Hesap/imza | SDK koşullarını kabul etmek, hesap açmak, ödeme ve imzalama hesabı işlemleri kullanıcıya aittir. |

## 3. Teknik yön ve ürün önerileri

Aşağıdakiler ürünün tasarım yönleridir. Faz 2 Windows alt kümesi §12 ve kabul belgesinde kanıtlıdır; Mac ve ileri modüller henüz uygulanmadı.

| No | Öneri | Gerekçe / sınır |
|---|---|---|
| Ö-1 | Dış katmanda TypeScript ve resmî MCP SDK kullanan sunucu | MCP ekosistemi ve stdio için doğal seçim; sürüm farkları test gerektirir. |
| Ö-2 | İçeride C++/ObjectARX ortak kaynaklarından Windows ve macOS için ayrı derlenen eklenti | Autodesk 2027 tablosunda ObjectARX iki platformda belgeli; .NET/ActiveX yalnız Windows. Mac SDK tüm API'leri içermiyor. |
| Ö-3 | Windows'ta named pipe, macOS'ta Unix domain socket | Yerel süreçler arası, ağ dinleyicisi gerektirmeyen taşıma önerisi. |
| Ö-4 | MCP taşımasında önce stdio | İlk hedef yerel istemci; ağ yüzeyi açmaz. |
| Ö-5 | Streamable HTTP ve bulut istemci erişimini ayrı kapsamda ele almak | Yetkilendirme, TLS, origin, maruz kalma ve veri akışı ayrı karar gerektirir. |
| Ö-6 | İşlem hattı: hedef çözümleme → inceleme/hazırlık → uygulama → geri okuma → bildirim | Başarıyı yalnız istek kabulüne değil, AutoCAD'den gerçek geri okumaya bağlar. |
| Ö-7 | AutoCAD API erişimini ana iş parçacığında uygun bağlamda sıralamak | API iş parçacığı/bağlam kısıtları ve eşzamanlı değişiklik riski. |
| Ö-8 | Belge başına transaction/undo grubu; dosya/komut/LISP yan etkilerinin sınırını ayırmak | Her işlemin geri alınabilirliğini artırır; transaction dışına taşan etkiler ayrıca raporlanmalı. |
| Ö-9 | İşlem kimliği, tekrar istek ve zaman aşımı için "bilinmiyor" durumu | Zaman aşımında başarı veya başarısızlık uydurmamak; uzlaştırma sorgusu gerekir. |
| Ö-10 | Yetki profilleri (salt okuma, çizim, düzenleme, otomasyon) | Öneri; her işlemi kullanıcıya onaylatma varsayımı yok. |
| Ö-11 | Gelişmiş LISP/komut erişimini varsayılan kapalı ve ayrı yetkiyle ele almak | Gelişmiş LISP bir güvenlik sandbox'ı değildir. |
| Ö-12 | Platform/API/gerçek test durumunu yetenek matrisinde tutmak | Genel API belgeli olması, özelliğin o platformda çalıştığı anlamına gelmez. |
| Ö-13 | Test katmanlarını ve dağıtımı ayrı aşamalara bölmek | Canlı AutoCAD testi olmadan ürün iddiası kurmamak. |

## 4. Ürün akışı

Tipik akış:

1. Kullanıcı MCP istemcisinde bir işlem ister.
2. AI istemcisindeki model isteği uygun MCP araç çağrılarına dönüştürür. Yerel MCP sunucusu gelen yapılandırılmış çağrıları doğrular; hedef belirsizse yazma yapmadan açık hedef ister. Köprünün kendi AI modeli veya sağlayıcı API anahtarı gerekmez.
3. İstek yerel IPC üzerinden AutoCAD eklentisine gider.
4. Eklenti hedef instance/belge/nesne kimliğini, birimleri ve koordinat sistemini belirler.
5. İnceleme/hazırlık yapılır: tür, geometri, katman/stil, birim ve platform desteği doğrulanır.
6. Uygulama ana iş parçacığında, belge bağlamında ve mümkünse tek undo grubunda yapılır.
7. Sonuç AutoCAD'den geri okunur; beklenen ile gerçek karşılaştırılır.
8. İstemciye sonuç, kimlikler, gerçek değerler ve varsa kısmi/başarısız adımlar bildirilir.

İşlem hattı önerisi:

```text
hedef instance/belge/nesne + birim/koordinat
        ↓
inceleme ve hazırlık
        ↓
uygulama (ana iş parçacığı, belge bağlamı, undo grubu)
        ↓
AutoCAD'den geri okuma
        ↓
sonuç / kısmi sonuç / bilinmiyor
```

Kurallar:

- Hedef belirsizse işlem yapılmaz; önce instance/belge/nesne seçimi netleştirilir.
- Birim ve koordinat sistemi bilinmiyorsa yazma işlemi varsayımla yapılmaz.
- "Gönderildi" başarı değildir; geri okuma yoksa sonuç doğrulanmamıştır.
- Zaman aşımı "başarısız" değil, önce "bilinmiyor"dur; uzlaştırma sorgusu gerekir.
- Kısmi uygulama ayrı durumdur; tam başarı gibi raporlanmaz.

### Son kullanıcı kurulumu ve başlatma hedefi

Kullanıcı bir kez platformuna uygun paketi kurar, AutoCAD'i açar ve MCP istemcisine köprüyü ekler. Ayrı bir uygulama penceresini veya sunucu komutunu elle başlatması hedeflenmez. stdio yolunda MCP istemcisinin sunucu sürecini otomatik başlatması, AutoCAD'in de eklentiyi yüklemesi önerilir. Eklentinin etkinleştirme ayarı ve süreçlerin kapanma/yeniden bağlanma ayrıntıları teknik denemede netleşecek.

stdio için port açılmaz. Bir port/adres üzerinden HTTP bağlantısı istenirse bu ayrı taşıma seçeneği olur; varsayılan kurulum bilgisayarı internete açmaz. Her kullanıcının çizim işlemleri kendi AutoCAD'inde yürütülür. Merkezi hesap/sunucu gerekmemesi, bulut AI istemcisinin veri işlemeyi yerelde yaptığı anlamına gelmez.

## 5. Önerilen mimari

### 5.1 Bileşenler

| Bileşen | Görev | Durum |
|---|---|---|
| MCP sunucusu | MCP istemcisine tipli araçlar sunmak; doğrulama, hata eşleme, işlem kimliği, zaman aşımı | Ürün yönü; prototip durumu §12 ve kabul belgesinde |
| Yerel köprü | Sunucu ile eklenti arasında yerel IPC; el sıkışma, sürüm denetimi, istek/yanıt/olay | Ürün yönü; prototip durumu §12 ve kabul belgesinde |
| AutoCAD eklentisi | C++/ObjectARX; ana iş parçacığı sevkıyatı, belge işlemleri, transaction/undo, geri okuma | Ürün yönü; prototip durumu §12 ve kabul belgesinde |
| Kurulum/paketleme | Platforma özel eklenti ve sunucu kurulumu, sürüm uyumu, kaldırma | Ürün yönü; prototip durumu §12 ve kabul belgesinde |
| Tanılama | Sürüm/platform/özellik bilgisi, güvenli günlük, bağlantı durumu | Ürün yönü; prototip durumu §12 ve kabul belgesinde |

### 5.2 Neden bu yön

Autodesk'in 2027 API tablosu ObjectARX ve AutoLISP'i Windows/macOS için, .NET ve ActiveX'i yalnız Windows için listeler. ObjectARX SDK sayfası tüm API'lerin Mac'te bulunmadığını belirtir. Bu nedenle:

- Windows'a özgü .NET/ActiveX'e ürünün tamamını bağlamak Mac hedefiyle çelişir.
- ObjectARX ortak kaynak + platforma özel derleme, iki platform için en tutarlı yön gibi görünür; ancak Mac API alt kümesi özellik bazında doğrulanmalıdır.
- TypeScript MCP sunucusu, MCP SDK ve stdio ile dış katmanı platformdan bağımsız tutar; platform bağımlılığı eklentide kalır.

Windows Core Console prototipi sınırlı uygulanabilirlik kanıtıdır; Windows ürünü için masaüstü, istemci ve kurulum kabulü gerekir. Mac desteği ayrı Faz M'de kanıtlanır ve Windows kabulünü bekletmez.

### 5.3 Bağlantı ve el sıkışma

Öneri:

- Eklenti açılışta protokol sürümü, eklenti sürümü, AutoCAD sürümü, platform/mimari ve yetenek listesini bildirir.
- Sunucu istemci sürümüyle uyumsuzluğu erken reddeder.
- Birden fazla AutoCAD instance varsa hedef açıkça seçilir; belirsizlik hata döner.
- Bağlantı koptuğunda yeniden bağlanma ve durum uzlaştırma yapılır; eski işlem kimlikleri körlemesine yeniden uygulanmaz.
- Belge kimliği, handle'lar ve birimler oturum boyunca izlenir; eskimiş handle ayrı hata olarak raporlanır.

### 5.4 Yerel IPC

Öneri:

- Windows named pipe, macOS Unix domain socket.
- Varsayılan olarak yalnız yerel kullanıcı; dosya/soket izinleri kullanıcıya daraltılır.
- Çerçeveleme, en büyük mesaj boyu, geri baskı ve sürüm alanı tanımlanır.
- Varsayılan TCP dinleyicisi yok; uzak erişim ayrı karar.
- Kimlik doğrulama yerel kullanıcı bağlamına dayanır; yine de yetki profilleri ve komut sınırları ayrıca uygulanır.

### 5.5 Eşzamanlılık, işlem kimliği ve zaman aşımı

Öneri:

- AutoCAD API çağrıları ana iş parçacığında sıralanır; aynı belge üzerinde eşzamanlı yazma yapılmaz.
- Sunucu her işleme kimlik ve isteğe bağlı idempotency anahtarı verir.
- Aynı anahtarla tekrar istek, tamamlanmış sonucu döndürür; yarım kalmış işlem yeniden uygulanmaz.
- Anahtarın kapsamı AutoCAD örneği, belge ve işlem gövdesiyle bağlanır. Saklama süresi, yeniden başlatma sonrası kayıt ve uzlaştırma davranışı sözleşmede belirlenecek; çökme sonrası kanıt yoksa tam-bir-kez uygulama garantisi verilmez, durum bilinmiyor kalır.
- Zaman aşımı "bilinmiyor" durumuna yol açar; istemci uzlaştırma sorgusuyla gerçek durumu öğrenir.
- İptal isteği en iyi çaba ile iletilir; işlem çoktan uygulanmış olabilir. İptal, geri alma garantisi değildir.
- AutoCAD meşgulse kuyruklama/geri çekilme önerilir; kullanıcı arayüzünü kilitleyen uzun bloklar yapılmaz.

### 5.6 Transaction/undo ve yan etki sınırları

Öneri:

- Mümkünse bir işlem = bir belge transaction/undo grubu.
- Uygulama sonrası geri okuma aynı işlem bağlamında veya hemen sonrasında yapılır.
- Kaydetme, kapatma, plot/PDF, dış dosya yazımı, komut ve LISP çağrıları transaction dışına taşabilir; bunlar ayrı yetki ve ayrı sonuç olarak raporlanır.
- Kısmi uygulama ve undo başarısızlığı ayrı hata durumlarıdır; "başarılı" sayılmaz.
- Otomatik geri alma, kullanıcı verisini beklenmedik şekilde değiştirmemek için dikkatle tasarlanmalıdır; öneri düzeyindedir.

### 5.7 Güvenlik modeli (öneri)

- Varsayılan yüzey yalnız yerel; ağ dinleyicisi yok.
- Yerel IPC izinleri kullanıcıya daraltılır; başka kullanıcı/oturum erişimi reddedilir.
- Keyfi komut/LISP varsayılan kapalı; açılırsa ayrı yetki profili, açık uyarı ve denetim gerekir.
- Gelişmiş LISP bir sandbox değildir; dosya sistemi, ağ ve AutoCAD oturumu üzerinde geniş etki bırakabilir.
- Her işlemi kullanıcıya onaylatma varsayımı yok; yetki profilleri öneridir.
- Günlüklerde sır, kişisel veri ve müşteri çizim içeriği tutulmaz.
- Eklenti ve kurulum imzalama/notarization ileride; SDK/hesap işlemleri kullanıcıya aittir.
- Uzak HTTP/cloud erişimi ayrı tehdit modeli ve açık kullanıcı kararı gerektirir.

## 6. Modüller

Aşağıdaki kapsamlar öneridir; kesin destek iddiası değildir. Ayrıntı ve durum için [YETENEK_MATRISI.md](YETENEK_MATRISI.md).

| Modül | Örnek işlemler | Not |
|---|---|---|
| Bağlantı | Instance keşfi, el sıkışma, sürüm/yetenek doğrulama, yeniden bağlanma | İlk teknik denemenin önkoşulu. |
| Belge | Belge listesi, aktif belge, açma/kaydetme/kapatma, salt okunur ve birim bilgisi | Kaydetme/kapatma yan etkileri ayrı ele alınır. |
| Sorgu | Handle ile nesne, filtreli seçim, özellikler, sınır kutusu, katman/blok/xref envanteri | Salt okuma; birim/koordinat bağlamı gerekir. |
| 2B | Çizgi, daire, yay, polyline, elips, spline oluşturma/okuma/güncelleme | Geometri ve birim dönüşümü test edilmeli. |
| Düzenleme | Taşıma, kopyalama, döndürme, ölçekleme, ayna, offset, trim/extend, silme, özellik değiştirme | Undo grubu ve geri okuma zorunlu. |
| Katman-stil | Katman oluşturma/yeniden adlandırma, renk, çizgi tipi, kalınlık, açma/kapama, kilit; yazı/ölçü stilleri | Stil bağımlılıkları ve ölçek davranışı doğrulanmalı. |
| Blok | Blok tanımı, ekleme, nitelikler, iç içe bloklar | Dinamik bloklar ayrı kapsam önerisi. |
| Açıklama | Metin/mtext, ölçülendirme, leader/multileader, tablo (ileri) | Ölçü stili ve ölçek platform farkı gösterebilir. |
| 3B | Katı ilkel nesneler, extrude/revolve, boolean, 3B polyline; yüzey/mesh ileri | Ürün kapsamı açık; API alt kümesi doğrulanmalı. |
| Görünüm-layout-PDF | Zoom/görünüm, viewport, layout, page setup, plot/PDF, görsel stil | Plot/PDF aygıt ve kâğıt ayarları platforma göre değişebilir. |
| Xref-veri | Xref ekleme/çıkarma/yenileme, veri çıkarımı, alanlar, dış tablolar | Yol çözümleme ve eksik xref davranışı test edilmeli. |
| Otomasyon | Toplu işlem, komut dizisi, LISP değerlendirme (öneri) | Yüksek risk; varsayılan kapalı önerisi; sandbox değil. |

## 7. Hata durumları

Aşağıdaki katalog ürün tasarımıdır; yalnız bir alt küme prototipte uygulanmıştır. Gerçek hata testleri kabul belgesindedir. Amaç, "sessiz başarı" yerine açık ve uzlaştırılabilir hata üretmektir.

| Kod (öneri) | Anlam | Beklenen davranış |
|---|---|---|
| `ACAD_NOT_RUNNING` | AutoCAD süreci yok | İşlem yapılmaz; kullanıcıya başlatma/bağlanma yönlendirmesi. |
| `PLUGIN_NOT_LOADED` | Eklenti yüklü değil | Kurulum/yükleme yönlendirmesi; otomatik yükleme varsa sonucu doğrula. |
| `PLUGIN_VERSION_MISMATCH` | Sunucu/eklenti protokolü uyumsuz | Erken reddet; hangi sürümün uyumlu olduğunu bildir. |
| `IPC_UNAVAILABLE` | Pipe/soket açılamıyor | Yerel izin/oturum kontrolü; ağ çözümü önerme. |
| `IPC_AUTH_FAILED` | Yerel kimlik/izin reddi | Erişim reddi; ayrıntı sızdırma. |
| `INSTANCE_AMBIGUOUS` | Birden fazla AutoCAD instance | Hedef seçimi iste; varsayılanla yazma yapma. |
| `DOC_NOT_FOUND` | Belge yok/kapalı | İşlem yapılmaz; belge listesi öner. |
| `DOC_READ_ONLY` | Belge salt okunur | Yazma reddedilir; neden ve seçenek bildirilir. |
| `DOC_BUSY` | Belge/komut meşgul | Kuyruk/geri çekilme; uzun süre kilitleme yok. |
| `TARGET_NOT_FOUND` | Nesne/hedef yok | İşlem yapılmaz; arama ölçütü öner. |
| `STALE_HANDLE` | Handle eskimiş/silinmiş | Yeniden sorgu; körlemesine yazma yok. |
| `UNITS_UNKNOWN` | Birim/koordinat belirsiz | Yazma öncesi netleştir; varsayımla devam etme. |
| `UNSUPPORTED_ON_PLATFORM` | Özellik bu platformda yok | Açıkça "desteklenmiyor"; genel API varlığına dayanarak vaat verme. |
| `VALIDATION_FAILED` | Girdi/geometri geçersiz | Ayrıntılı alan hatası; AutoCAD'e gönderme. |
| `EXECUTION_FAILED` | AutoCAD işlemi reddetti/başarısız | Ayıklanmış hata kodu ve gerekli bağlam; sır/kişisel veri/çizim içeriği sızdırmadan bildir, başarı sayma. |
| `PARTIAL_APPLY` | Bir kısmı uygulandı | Kısmi sonuç, hangi nesneler, geri alma seçeneği. |
| `UNDO_FAILED` | Geri alma başarısız | Kritik uyarı; belge durumu ve uzlaştırma. |
| `TIMEOUT_UNKNOWN` | Yanıt yok, durum bilinmiyor | Başarı/başarısızlık deme; uzlaştırma sorgusu. |
| `CANCELLED` | İptal edildi | İşlem uygulanmış olabilir; gerçek durumu oku. |
| `SECURITY_DENIED` | Yetki profili/izin reddi | Neden ve gerekli yetki; sessiz geçme yok. |

## 8. Özellik matrisi stratejisi

- Tek kaynak: [YETENEK_MATRISI.md](YETENEK_MATRISI.md). Her satır modül, örnek işlemler, Windows 2027, Mac 2027, gerçek test ve aşama içerir.
- Durumlar ayrılır: **belgeli API** (Autodesk dokümanı), **uygulanmadı**, **canlı test edildi** (tarih, platform, AutoCAD sürümü, test çizimi, kanıt), **desteklenmiyor**.
- Genel API'nin belgeli olması özellik desteği sayılmaz. Özellikle Mac'te ObjectARX/AutoLISP genel olarak belgeli olsa da SDK tüm API'leri içermez; modül bazında test gerekir.
- Windows ve macOS ayrı satır/değerlendirme alır; bir platformdaki sonuç diğerine genellenmez.
- Bilinmeyen hücre "doğrulanmadı" kalır; tahminle doldurulmaz.
- Matris her canlı testten sonra kanıtla güncellenir; ürün iddiası yalnız matristeki kanıtlı satırlara dayanır.
- "Çalışıyor", "destekleniyor" ve "tamamlandı" ifadeleri canlı test kanıtı olmadan kullanılmaz.

## 9. stdio, Streamable HTTP ve uzak erişim ayrımı

| Katman | Karar durumu | Not |
|---|---|---|
| stdio | İlk hedef (öneri) | Yerel istemci, ağ yüzeyi yok; ilk teknik deneme için en dar kapsam. |
| Streamable HTTP | Ayrı kapsam | Yerel/uzak istemci, kimlik doğrulama, origin, TLS/ters vekil, oturum ve kötüye kullanım modeli gerekir. İlk sürümde varsayılan değil. |
| Bulut istemci erişimi | Ayrı kapsam ve veri akışı | Yerel köprü bulut sağlayıcısının veri akışını otomatik yerelleştirmez; gizlilik/güvenlik incelemesi ve açık kullanıcı kararı gerekir. |

MCP TypeScript SDK ve spesifikasyon sürümleri arasında farklar olabilir; sürüm sabitlenmeli ve uyumluluk test edilmelidir. Spesifikasyon değişiklik günlüğü kaynağı: <https://modelcontextprotocol.io/specification/2026-07-28/changelog>. Bu planda sürüm uyumluluğu iddia edilmez.

## 10. Test katmanları

| Katman | Ne | Durum |
|---|---|---|
| Belge/statik | Bağlantı, kapsam, tutarlılık, dosya listesi | Bu görevde yalnız belge kontrolü yapıldı; uygulama testi değil. |
| Birim | Protokol çerçeveleme, doğrulama, hata eşleme, durum makinesi | Windows/ortak prototip testleri mevcut; ayrıntı kabul belgesinde. |
| Sözleşme | MCP araç şemaları, sunucu-eklenti protokolü, sürüm uyumu | Windows/ortak prototip testleri mevcut; ayrıntı kabul belgesinde. |
| Entegrasyon | Sahte eklenti/AutoCAD test double ile akış | Windows/ortak prototip testleri mevcut; ayrıntı kabul belgesinde. |
| Canlı Windows | Gerçek AutoCAD 2027 üzerinde işlem ve geri okuma | Core Console 30+30+9; görünür masaüstü 26 kontrol geçti. Faz 3 kuyruğuyla 8 eşzamanlı masaüstü okuması da geçti. |
| Canlı macOS | Apple Silicon üzerinde gerçek AutoCAD 2027 ile işlem ve geri okuma | Çalıştırılmadı; Mac'e bağlantı için ayrıca uygunluk/onay gerekir. |
| Hata enjeksiyonu | Bağlantı kopması, meşgul belge, zaman aşımı, izin reddi, undo hatası | W-phase3: 56 gerçek masaüstü kontrolü; abort, partial, timeout/iptal, kilit/modal, yetki iptali, dosya yarışı, restart/süreç kaybı geçti. Tam fuzz/stres değildir. |
| Regresyon çizimleri | Yalnız sahte/açık örnek çizim kopyaları | Stok şablondan mm/metre/birimsiz sentetik kopyalarla geçildi; büyük/karmaşık çizim yok. |
| Paketleme/temiz cihaz | Kurulum, kaldırma, sürüm yükseltme | Paket yok; çalıştırılmadı. |
| Güvenlik | Yerel IPC izni, yol/komut enjeksiyonu, keyfi LISP kapalılığı, profil sınırları | Native HMAC/revocation/yanlış-instance/kontrol yetkisi ve dosya yarışı negatifleri geçti. Ayrı kapsamlı güvenlik denetimi değildir. |
| Performans/büyük çizim | Büyük belge, çok nesne, bellek/süre | Çalıştırılmadı. |

`npm test`, CTest ve açık opt-in canlı Windows harness mevcut. CI henüz yok. Bir test katmanı "geçti" denmeden önce gerçek çıktı ve ortam kaydı gerekir. Canlı AutoCAD testi olmayan otomatik test, "tam destek" kanıtı sayılmaz.

## 11. Paketleme ve dağıtım (öneri)

- **Windows:** ObjectARX eklentisi ve bağımlılıkları, kurulum paketi, AutoCAD 2027 bundle/autoload, sürüm denetimi, imzalama, kaldırma.
- **macOS:** Eklenti bundle'ı, kurulum paketi, notarization, imzalama, kaldırma. İlk test hedefi Apple Silicon/arm64; Intel ve universal paketler ayrıca değerlendirilecek.
- **MCP sunucusu:** Windows özel ZIP adayı Node24 ikilisi, sabitlenmiş üretim bağımlılıkları ve mevcut skill bundle'ını birlikte taşır; kullanıcıda npm/derleyici/SDK gerekmez. npm/genel paket yayını yapılmaz.
- **Uyumluluk:** Sunucu-eklenti protokol sürümü, AutoCAD 2027 sürüm aralığı ve işletim sistemi sürümleri matriste tutulur.
- **Yükseltme/geri alma:** Eski eklentiyle yeni sunucu karışımı reddedilmeli; yükseltme ve kaldırma test edilmeli.
- Otomatik güncelleme ilk sürümde varsayılan değil; ayrı karar.
- Faz6'da özel yerel paketleme uygulanır; sertifikalı imzalama, temiz cihaz kabulü ve genel dağıtım ayrı kapılardır. Mevcut özel aday genel yayın değildir.

## 12. Fazlar, çıktılar ve tamamlanma ölçütleri

**Güncel konum:** 2A MCP/IPC çekirdeği ve 2B Windows ObjectARX prototipi yazıldı. 2D'de mm/metre/birimsiz, tek işlem UNDO, revision, dedup, ayrı DWG geometri geri okuma ve hash/dirty koruması Core Console'da geçti. Görünür masaüstünde test pompası olmadan 26 kontrol geçti: çoklu belge/context, UNDO, komut meşguliyeti, kilitli katman ve dosya/junction yarışları. Windows Faz 2 ve Faz 3 tamamlandı. Faz 3: ayrı status/iptal kanalı, kayıt bütçesi, eşzamanlı dedup, rollback/partial doğruluğu ve 56/56 gerçek masaüstü hata enjeksiyonu. Normal eklentiyle 30/30 regresyon geçti. Faz 4 Windows geliştirici pilotu Codex + OpenCode/EVREN MiMo ile tamamlandı: 80×40 mm, Ø10 kontur; oluşturma/taşıma/silme/sorgu/kayıt ve iki DWG reopen kabulü geçti. Claude config/skill hazır; kullanıcı limiti olmadığı için canlı Claude testi çalıştırılmadı. Ortak testler güncel 21/21. Eski 2C Mac paketi ayrı Faz M'dedir ve Windows'u bekletmez. Kullanıcı onayıyla tek kısa [durum kaydı](TEKNIK_DENEME_KABUL.md) tutulur.

1–6 numaralı fazlar güncel Windows hattıdır; mevcut numaralar korunur. Mac ayrı Faz M hattıdır; Windows fazlarının bitişine bağımlılık eklemez. Süre tahmini verilmez. Bir faz, yalnız belge yazıldığı için geliştirme/test açısından tamamlanmış sayılmaz.

| Faz | Hedef | Somut teslim | Fazın bitiş ölçütü | Şu an |
|---|---|---|---|---|
| **1 — Araştırma ve tasarım** | Ne geliştireceğimizi ve sınırlarını belirlemek | Mevcut çözüm araştırması, 42 işlem envanteri, 14 araç sözleşmesi taslağı, platform matrisi ve kabul senaryoları | Kaynaklı adaylar ve açık teknik riskler ayrılmış; ilk geliştirilecek dilim tanımlı | Belgeler hazır; Windows sınırlı dikey dilim doğrulandı |
| **2 — Çalışan ilk köprü** | AI → MCP → yerel eklenti → AutoCAD akışını kanıtlamak | TypeScript MCP çekirdeği; Windows eklentisi; belge okuma, çizgi/çember/kutu, taşıma ve geri okuma | Windows'ta sentetik çizim üzerinde gerçek ölçüler, doğru belge hedefi ve ayrı kayıt/UNDO senaryoları kanıtlı; Windows kabul kapıları çözülmüş | Windows temel kabulü tamamlandı: 69 Core Console + 26 masaüstü kontrolü |
| **3 — Güvenilir çekirdek** | Mevcut çizimde güvenilir sorgu ve düzenleme | Yetki, revision/epoch, tekilleştirme, transaction/undo, iptal/zaman aşımı ve güvenli dosya çıktısı | Tekrar istek ikinci nesne üretmiyor; yanlış/eski hedefe yazmıyor; hata/kısmi etkiyi doğru bildiriyor; negatif senaryolar geçiyor | Tamamlandı: 56/56 gerçek masaüstü hata enjeksiyonu, 17/17 ortak, 1/1 C++, normal eklenti 30/30 regresyon |
| **4 — İlk kullanılabilir sürüm (MVP)** | Kullanıcının AI istemcisinden temel işleri yapabilmesi | İlk 14 araç için doğrulanmış destek durumu, Windows pilot kurulumu, Claude/Codex bağlantı örnekleri ve kullanım belgesi | Yeni ve mevcut sentetik çizimde sorgu → oluşturma → düzenleme → ayrı kayıt akışı iki istemciyle Windows üzerinde kanıtlı; kurulum tekrarlanabilir | Tamamlandı: Codex + OpenCode gerçek pilotu, iki DWG reopen, üç istemci için config/skill ve rehber. Claude canlı testi çalıştırılmadı |
| **5 — Özellikleri genişletme** | Geniş AutoCAD kapsamını modül modül geliştirmek | Gelişmiş 2B, katman/stil, blok/nitelik, açıklama, ileri 3B, layout/PDF, xref/veri ve isteğe bağlı otomasyon | Her modül kendi API/platform/geri okuma ve hata testlerini geçince açılıyor; desteklenmeyenler açık | Windows ana paketleri uygulandı; ileri alt paketler açık |
| **6 — Kurulabilir ürün ve dağıtım** | Başkalarının kendi bilgisayarında kurabilmesi | Paketler, imzalama/notarization, istemci ayar rehberi, tanılama, yükseltme/kaldırma ve sürüm belgeleri | Geliştirici araçları olmayan temiz Windows'ta kurulum, kullanım, yükseltme ve kaldırma doğrulanmış; lisans ve yayın kararları kesinleşmiş | Windows public önizleme: ZIP/tepsi/rehber/kurulum kabulü hazır; Apache-2.0 seçildi. Güvenilir imza, temiz cihaz ve gerçek reboot açık |
| **M — macOS Apple Silicon** | Windows çekirdeğini Mac'e taşımak | ObjectARX arm64 eklentisi, Unix socket, Mac kabulü/pilot/paketleme | SDK/API farkları, gerçek AutoCAD işlemleri, doğru belge/UNDO/kopya ve Mac kurulum testleri bağımsız kanıtlı | Ayrı faz; kullanıcı ayrıca başlatacak, Windows'u engellemez |

### Faz 2'nin iş sırası ve kabul sınırı

1. **2A / Çekirdek ve test altyapısı:** sürümleri sabitle; proje/derleme yapısını ve MCP stdio sunucusunu kur; sahte eklentiyle mesaj/şema ve hata akışını dene. IPC çağıran doğrulamasının somut mekanizmasını seç; yetki kapısı çözülmeden mutasyon açma. Çıktı: native AutoCAD bağlantısı iddiası taşımayan sınanabilir MCP çekirdeği.
2. **2B / Windows dikey dilimi:** ObjectARX eklentisini derle; ana thread/context, instance/belge keşfi ve salt okuma; ardından yetkili çizgi/çember/kutu/taşıma ve ölçü geri okuma. Çıktı: Windows AutoCAD 2027 üzerinde ilk gerçek MCP işlemi.
3. **2C / eski Mac paketi:** Faz M'ye taşındı; güncel Faz 2 kapsamında çalıştırılmaz ve Windows kabulünü bekletmez. Numaralar mevcut referansları korumak için değiştirilmedi.
4. **2D / Windows kabul kapısı:** mm/metre/birimsiz örnekler, belge/sekme ayrımı, UNDO, orijinal hash/dirty koruması ve ayrı kopyayı yeniden açmayı dene. Kayıt güvenliği kanıtlanamazsa araç kapalı kalır ve bu kapı tamamlandı sayılmaz. Çıktı: [teknik deneme kabul ölçütlerinin](TEKNIK_DENEME_KABUL.md) Windows için doldurulmuş sonuçları; Mac satırları Faz M'ye aittir.

### Faz 3–6'nın iş paketleri

- **3A:** sorgu/projeksiyon/sayfalama ve nesne referansları. **3B:** yetki, revision ve eşzamanlı tekilleştirme. **3C:** transaction/undo, iptal/timeout/unknown ve dosya yarışı testleri. Faz 2'deki temel önlemler burada kapsamlı hata enjeksiyonuyla sağlamlaştırılır.
- **4A:** 14 aracın gerçek şemalarının [kataloğu](TOOL_CATALOG.json) ve destek listesi; katı girdiler, halen genel object çıktı şeması, alan/durum sözleşmesi ayrıca belgeli. **4B:** Kullanıcının Claude limitinin olmadığını belirtip OpenCode istemesi üzerine Codex + OpenCode/EVREN MiMo ile uçtan uca senaryolar geçti; Claude config/skill statik doğrulandı, canlı testi çalıştırılmadı. **4C:** Windows `pilot configure/doctor/pair`, Codex/Claude/OpenCode skill ve [kullanıcı rehberi](PILOT_KURULUM.md) hazır; Mac pilotu Faz M'de. Bu paketler son imzalı genel dağıtım yerine doğrulanmış geliştirici pilotudur.
- **5A:** 2B + katman/stil + blok/nitelik + açıklama. **5B:** ileri katı/yüzey/mesh. **5C:** görünüm/layout/PDF + xref/veri. **5D:** ayrı yetkiyle otomasyon. Her paket bağımsız kapsam ve kabul ölçütüyle ele alınır; ham LISP erişimi "bütün özellikler tamam" sayılmaz.
- **6A:** kurulum, istemci yapılandırması ve Windows durum/tepsi uygulaması. AutoCAD ve MCP istemcisi ayrı durum göstergeleri; açık hedef seçimiyle yeniden bağlantı; kapatma/küçültmede tepside çalışma; varsayılan kapalı, isteğe bağlı oturum açılışında `--tray` başlangıcı. İstemci ayarı AutoCAD yeniden başladığında değişmez; eski belge kimliği yeni hedefe taşınmaz. **6B:** Windows imzalama ve temiz cihaz testleri; Mac notarization Faz M'de. **6C:** yükseltme/kaldırma, lisans, destek matrisi ve yayın hazırlığı. Public depo, Release veya paket yayını yalnız kullanıcının açık talebiyle yapılır.

2026-10-19 kullanıcı kararıyla Faz6 başladı; yeni teknik resim doğruluğu skill'i ertelendi. Üç modelin geometri/ölçü/çizgi tipi kararları MCP'nin işlemleri uygulama kabulünden ayrı değerlendirilir; modelin yanlış çizimi kurulum paketini bekletmez. Windows dağıtımı [kurulum rehberi](WINDOWS_KURULUM.md), derleme/test komutları [geliştirme rehberi](GELISTIRME.md), yayın kapıları [yayın kuralları](RELEASING.md) içindedir. Faz5 ileri alt paketleri ve çizim skill'i tamamlandı sayılmaz. Bu 19Ekim kaydı tarihçedir;20Ekim public v1.0.0 talebi ve güncel yayın profili RELEASING.md içindedir.

**Bağımlılık:** Windows çekirdek yolu 1 → 2 → 3 → 4'tür. Faz M bu hattın ön koşulu değildir; kullanıcı ayrıca başlattığında ortak çekirdeğin uygun sürümü üzerinden yürür. Faz 4 sonrası çekirdek ürün için Faz 6 yürütülebilir; Faz 5'in bütün ileri modüllerinin bitmesi ilk kurulabilir dağıtımı engellemez. Her yeni Faz 5 modülü aynı Faz 6 dağıtım kontrollerinden geçer.

### Faz 5 için önerilen uygulama sırası

Kullanıcı daha sonra bu sıranın tamamını ve makine mühendisliği ihtiyaçlarının eklenmesini onaylayıp yöneticinin kendisinin uygulamaya başlamasını istedi. **Faz 5 Windows ana paketleri 52 araca ulaştı; ileri mekanik/yüzey/mesh alt paketleri açık.** Her satır kendi kabulü geçmeden tamamlandı sayılmaz. Makine mühendisliği alt paketleri [mekanik kapsamda](MAKINE_MUHENDISLIGI.md) ayrılır. Windows 2027 hattı sürer; Mac Faz M'de, temiz cihaz/paketleme Faz 6'dadır. Bu planlama anındaki yetki tarihçedir; güncel public v1.0.0 talebi RELEASING.md içindedir.

| Sıra | Paket | Kullanıcıya kazandıracağı iş |
|---|---|---|
| 1 | 5A-1 Teknik resim: temel katman/çizgi tipi ve yazı/ölçü stili; TEXT/MTEXT ve native doğrusal, çap/yarıçap ölçüleri | Verilen parçayı geometrisinin yanında okunabilir gerçek ölçü nesneleriyle çizebilmek |
| 2 | 5A-2 Gelişmiş 2B: polyline/yay; kopyala, döndür, ayna; ardından offset, trim/extend, fillet/chamfer | Birleşik konturlar ve elle çizime daha yakın düzenleme; işlemler ayrı küçük kabullerle açılır |
| 3 | 5A-3 Blok ve nitelik | Tekrarlanan parçaları blok olarak tanımlayıp yerleştirmek, parametre/nitelikleri okumak ve düzenlemek |
| 4 | 5B Katı modelleme: extrude/revolve ve boolean işlemler | 2B profilden gerçek hacim ve delik üretmek; yüzey/mesh daha sonraki alt paket |
| 5 | 5C Görünüm/layout/PDF ve ardından xref/veri | Çizimi ekrana sığdırma, pafta/ölçek, PDF çıktısı; dış dosyaları ayrı güvenli yol kurallarıyla yönetmek |
| 6 | 5D İsteğe bağlı otomasyon | Gereksinim doğrulanırsa ayrı izinlerle toplu iş; keyfi LISP/komut varsayılan açılmaz |

İlk öneri **5A-1**: aynı 80×40, Ø10 örneğini yeniden üretip 80, 40, 50, 20, 30 ve çap ölçülerini native DIMENSION olarak yerleştirmek. Kabul yalnız görünüşe dayanmaz: ölçülen değer, metin/stil/katman, yerleşim, UNDO, eski revision ve yetki retleri, ayrı DWG kaydı/yeniden açma doğrulanır. Yeni nesne türleri sorgu ve kayıt doğrulamasına da eklenir; yalnız oluşturma aracı eklenip mevcut geri okuma sınırı gizlenmez. Her pakette capability/şema kataloğu ve skill'ler gerçek destekle birlikte güncellenir; önceki çekirdek testleri korunur.

**Kullanıcı açısından eşikler:** ilk gerçek AutoCAD işlemi Faz 2'de; temel günlük kullanım hedefi Faz 4'te; başkalarının temiz cihazda kurabileceği ürün Faz 6'dadır. Hiçbiri şu an tamamlanmış ürün desteği değildir.

Ayrıntılı dayanaklar: [işlem/API envanteri](OZELLIK_ENVANTERI.md), [iletişim sözleşmesi taslağı](ILETISIM_SOZLESMESI.md), [kabul senaryoları](TEKNIK_DENEME_KABUL.md). Teknik test sonuçları bu mevcut belgelere işlenir; kişisel görev/ajan/durum kayıtları public Git ağacında tutulmaz.

## 13. Açık kararlar

| Açık karar | Neden önemli | Öneri (varsa) |
|---|---|---|
| Intel/universal Mac dağıtımı | İlk Apple Silicon hedefinin ötesinde paketleme ve test kapsamı | Apple Silicon/arm64 ilk test hedefidir; Intel/universal desteği ayrıca kararlaştırılacak. |
| AutoCAD LT desteği | Tam AutoCAD kararı verildi; LT kapsamı belirsiz | İlk kapsam tam AutoCAD 2027; LT ayrı karar. |
| Lisans | Açık kaynak dağıtım ve katkı koşulları | Apache-2.0 yalnız öneri; karar değil. |
| Depo görünürlüğü | Public/private ve topluluk katkısı | Şu an private; açık kullanıcı talebi gerekir. |
| Streamable HTTP/uzak erişim | Ağ yüzeyi, kimlik doğrulama, gizlilik | İlk sürümde yok; ayrı kapsam. |
| Bulut istemci erişimi | AI sağlayıcısına veri akışı | Ayrı veri akışı ve açık karar; yerel köprü otomatik yerelleştirmez. |
| MCP araç metinlerinin dili | Kullanıcı deneyimi ve çok dillilik | Uygulama öncesi netleştirilecek. |
| Keyfi komut/LISP | Güvenlik ve test edilebilirlik | Varsayılan kapalı; ayrı yetki; sandbox değil. |
| Yetki profilleri | Kim neyi değiştirebilir | Salt okuma/çizim/düzenleme/otomasyon önerisi; ayrıntı açık. |
| Çoklu instance davranışı | Hedef belirsizliği ve veri güvenliği | Açık seçim; belirsizlikte yazma yok. |
| Birim/koordinat politikası | Ölçek ve konum hataları | Taslak: WCS ve açık birim; fiziksel birimde INSUNITS bilinmiyorsa ret, açık drawing_unit seçimi ayrı. |
| 3B kapsamı | Ürün vaadi ve API alt kümesi | İlk deneme ilkel nesneler; ileri modelleme ayrı aşama. |
| Layout/PDF kapsamı | Plot aygıtı ve platform farkları | İleri modül; canlı test gerekir. |
| Xref okuma/yazma sınırı | Dış dosya ve yol güvenliği | Önce envanter/okuma; yazma ayrı karar. |
| AutoCAD sürüm desteği | 2027 dışı sürümler | Önce 2027; genişletme ayrı karar. |
| MCP SDK/spesifikasyon sürümü | Uyumluluk ve test yükü | Sürüm sabitle; farkları test et. |
| Dağıtım kanalı | npm/paketli çalıştırılabilir | Açık; ilk sürüm için en dar yol seçilecek. |
| İmzalama/notarization kimliği | Kurulum güveni | Kullanıcı sağlayacak; ayrı iş. |
| Telemetri/günlük saklama | Gizlilik ve destek | Varsayılan en az veri; ayrı karar. |
| Desteklenen işletim sistemi sürümleri | Kurulum/test matrisi | Açık; temiz cihaz testleriyle netleşecek. |
| Performans hedefleri | Büyük çizimlerde kullanılabilirlik | Açık; ölçüm olmadan sayı verilmez. |
| Yerelleştirme | Arayüz/araç metinleri | Açık; ilk hedef Türkçe belgeler, araç dili ayrı. |

## 14. Kaynaklar

- Autodesk, AutoCAD 2027 API tablosu: <https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm> — ObjectARX ve AutoLISP Windows/macOS; .NET ve ActiveX Windows.
- Autodesk, ObjectARX/AutoCAD SDK genel bakış: <https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk> — tüm API'lerin Mac'te bulunmadığı belirtilir.
- Model Context Protocol TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>.
- MCP spesifikasyon değişiklik günlüğü (2026-07-28): <https://modelcontextprotocol.io/specification/2026-07-28/changelog> — sürüm farklılıkları test gerektirir.
- [Mevcut çözümler araştırması](arastirma/MEVCUT_COZUMLER_2026-10-18.md) — altı proje ve ek kaynaklar; canlı test yok.
- [Geliştirme rehberi](GELISTIRME.md) ve [katkı rehberi](GELISTIRME.md).

İlk plan araştırma kaynaklarına dayanır. Faz 2 güncellemesi yerel kaynak kodu, sabitlenmiş bağımlılıklar, SDK başlıkları ve kabul belgesindeki gerçek komut sonuçlarına dayanır; bu sonuçlar Mac veya tam AutoCAD kapsamına genellenmez.
