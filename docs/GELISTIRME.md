# Geliştirme ve prototipi çalıştırma

Bu sürüm özel önizlemedir. Windows Codex ve OpenCode pilot kabulü geçti; Claude dosyaları/skill hazır, canlı Claude çağrısı çalıştırılmadı. Faz6'da yerel Windows ZIP adayı vardır; imzalı genel dağıtım ve temiz cihaz kabulü yoktur. Kaynak istemci kurulumu [pilot rehberinde](PILOT_KURULUM.md), paket kurulumu [Windows rehberinde](WINDOWS_KURULUM.md), gerçek sonuçlar [kabul belgesindedir](TEKNIK_DENEME_KABUL.md). Mac native taşıması/eklenti derlemesi ayrı Faz M kapsamındadır ve şu an kapalıdır; Windows kabulünü engellemez.

## 1. Ortak MCP çekirdeği

Node 24+ gerekir. Proje klasöründe:

```powershell
npm ci --ignore-scripts
npm run check
npm test
```

`npm test` gerçek AutoCAD başlatmaz. Yerel mock backend, şemalar, HMAC, timeout/iptal ve resmî SDK istemcisiyle gerçek stdio süreci sınanır. Mock sonuçları `simulation:true` taşır. MCP katmanı için LLM/API anahtarı gerekmez.

Eşleştirme olmadan sunucu araçları listeler; instance listesi boştur, çizim işlemi yapamaz:

```powershell
npm run build
node dist/src/main.js
```

Bu bir stdio sunucusudur; terminalde beklemesi normaldir. Model sohbetini veya günlükleri stdin'e yazmayın. MCP istemcisi süreci başlatıp protokol mesajlarını iletir; port açılmaz.

## 2. Windows ObjectARX derlemesi

Tam AutoCAD 2027, Windows x64, Visual Studio C++ araçları, CMake ve lisanslı ObjectARX 2027 SDK gerekir. [SDK indirme/lisans sayfası](https://aps.autodesk.com/developer/overview/autocad-objectarx-sdk-licensing) kullanıcı tarafından tamamlanır. SDK repoya veya dağıtım paketine eklenmez.

Bu bilgisayarda SDK `tmp/sdk/CDROM1` içinde. SDK farklı konumdaysa `OBJECTARX_ROOT` değiştirilir:

```powershell
cmake -S . -B build/native -G "Visual Studio 18 2026" -A x64 -DOBJECTARX_ROOT="C:/Dev/Other Projects/Autocad MCP/tmp/sdk/CDROM1"
cmake --build build/native --config Release
ctest --test-dir build/native -C Release --output-on-failure
```

CMake nlohmann JSON 3.12.0 tek başlığını resmî kaynaktan sabit SHA256 ile indirir. Çevrimdışı kullanımda aynı dosyanın dizini `-DJSON_INCLUDE_DIR=<dizin>` ile verilebilir. Çıktı `build/native/Release/AutocadMcp.arx`. Test ortamı MSVC 14.51 ile başarılıdır; SDK'nın önerdiği 14.44 ile ayrıca denenmedi.

## 3. İzole gerçek Windows testi

Harness yalnız açık opt-in ile, stok şablon kopyasında ve ayrı Core Console profilinde çalışır. Başka bir AutoCAD sürecini veya çizimini kullanmaz. SECURELOAD kapatılmaz; yalnız bu izole profil derleme klasörünü trusted path olarak kullanır. Kendi test sürecini kapatır; dosyalar `tmp/live-runs/<kimlik>/` altında kanıt olarak kalır.

Core Console için aynı modülün CRX uzantılı kopyası kullanılır:

```powershell
Copy-Item -LiteralPath build/native/Release/AutocadMcp.arx -Destination build/native/Release/AutocadMcp-test.crx
$env:AUTOCAD_MCP_LIVE_TEST='1'
$env:AUTOCAD_MCP_TEST_INSUNITS='4'
$env:AUTOCAD_MCP_TEST_UNDO='1'
npm run test:live:windows -- 'C:\Program Files\Autodesk\AutoCAD 2027' "$env:LOCALAPPDATA\Autodesk\AutoCAD 2027\R26.0\enu\Template\acadiso.dwt" 'C:\Dev\Other Projects\Autocad MCP\build\native\Release\AutocadMcp-test.crx'
```

Şablon ve kurulum yolları bu bilgisayardaki örneklerdir; başka kurulumda değiştirilir. `AUTOCAD_MCP_TEST_INSUNITS='6'` metre, `'0'` birimsiz çizimi sınar. Bu hazırlık aşamasında INSUNITS test harness'i tarafından ayarlanır; MCP işlemleri değeri değiştirmez. Testler aynı profile bağlı olduğundan sırayla çalıştırılır.

`results.json` gerçek kontrol sonuçlarını ve ölçüleri, `autocad.log` native günlüğü içerir. Günlükte eşleştirme dosyasının yalnız yolu bulunur. Eşleştirme sırrı yazılmaz. DWG ve günlükler Git'e girmez.

## 3B. Görünür Windows masaüstü kabulü

Test denetimleri normal derlemeye girmez. Masaüstü harness ayrıca PowerShell 7 (`pwsh.exe`) kullanır. Ayrı klasöre açıkça derleyin:

```powershell
cmake -S . -B build/desktop-tests -G "Visual Studio 18 2026" -A x64 -DOBJECTARX_ROOT="C:/Dev/Other Projects/Autocad MCP/tmp/sdk/CDROM1" -DAUTOCAD_MCP_TESTING=ON
cmake --build build/desktop-tests --config Release
npm run build
$env:AUTOCAD_MCP_DESKTOP_TEST='1'
node dist/test/desktop-windows.js --new
```

`start-desktop.ps1` bu test bilgisayarındaki AutoCAD 2027 profil düzenini kullanır. Mevcut acad süreci varsa testi başlatmaz. Yeni isimli test profilini kaynak profilden kopyalar; yalnız yeni profilde kendi modül klasörünü trusted path yapar, SECURELOAD=2 kalır. Kullanıcının mevcut profili değiştirilmez. Profil ve kanıtlar yerelde tutulur; genel kurulum/kaldırma betiği değildir.

Yeni UUID dizininde primary/secondary stok şablon kopyaları açılır. Gövdeyi modelden almayan sabit test aksiyonları yalnız test derlemesi+ortamında etkinleşir. Normal `build/native` için `AUTOCAD_MCP_TESTING=OFF` kullanın; test derlemesini dağıtmayın.

Harness sonuçları `tmp/desktop-runs/<UUID>/desktop-results.json` içindedir. Varsayılan olarak sentetik AutoCAD penceresini açık bırakır; test sonunda kendi oturumunu kapatmak için `AUTOCAD_MCP_DESKTOP_CLOSE=1` verilebilir. Oluşan `tmp/desktop-current.json`, yalnız o test oturumuna tekrar bağlanma bilgisidir; pairing sırrını içermez. Mevcut konfigürasyonla tekrar test ancak boş/fresh başlangıç koşulları sağlanıyorsa çalıştırılır.

## 4. Eklenti–MCP yaşam döngüsü

Geliştirici akışı: AutoCAD sürecinin ortamında `MCP_RUNTIME_DIR` mutlak bir yerel dizine ayarlanır; eklenti yüklenir ve AutoCAD'de `MCPSTART` çalıştırılır. Eklenti özel DACL'li yeni oturum dizini ve `pairing.json` üretir. Modelin bu dosyayı okuması gerekmez; yerel MCP sürecine yolu verilir:

```text
command: node
args: ["<projenin mutlak yolu>/dist/src/main.js", "--grant-file", "<MCPSTART tarafından bildirilen pairing.json yolu>"]
```

Bu, istemciye verilecek süreç/argüman bilgisidir. Faz 4'te `pilot configure` aynı bağlantı için ayrı Codex/Claude/OpenCode proje ayarları ve skill'leri üretir; kişisel ayarlar değiştirilmez. `pilot pair` yeni oturuma açıkça bağlar; istemci MCP yeniden başlatılır. [Pilot rehberi](PILOT_KURULUM.md).

`MCPSTOP` pipe'ı kapatır, sırrı bellekten siler ve kendi eşleştirme dosyasını kaldırır. AutoCAD yeniden başladığında yeni instance/epoch ve eşleştirme gerekir. Oturum süresi 24 saattir. Sırlar için paylaşım/git yok; eşleştirme dosyası modeli talimatla sınırlandıran bir sandbox değildir.

`MCPPUMP` ve `bridge.test_done` yalnız `MCP_TEST_MODE` ile test kontrolü içindir; 14 MCP aracına eklenmez. Core Console'da Win32 mesajlarını ana thread'de işler. Görünür masaüstü event loop/context geçişi 26 sentetik kontrolde test pompası olmadan geçti; bu belge kullanıcı çizimlerinde üretim kullanım önerisi değildir.

## 5. Mevcut sınırlar

- Modelspace; çizgi, WCS XY çember, eksenlere paralel kutu. Taşıma/silme çizgi, çember ve bu oturumda üretilen kutularla sınırlı.
- Birimler `mm`, `m`, `inch`, `drawing_unit`; fiziksel dönüşüm INSUNITS 1/4/6 için. Bilinmeyen birimde fiziksel yazma reddedilir; açık drawing_unit kabul edilir. Inch canlı testi çalıştırılmadı.
- Tek eşleştirilmiş instance; MCP süreci başına bir normal IPC çağrısı/64 iş admission sınırı. Bağımsız kontrol pipe'ı status/iptali CAD işinden ayırır. Native iki ana bağlantı, tek CAD thread'i; iki istemciden eşzamanlı dedup sınandı. Codex/OpenCode model pilotları aynı sentetik çizimde sırayla geçti; Claude birlikte kullanım testi çalıştırılmadı.
- HMAC sırrı + işlem izin listesi; kullanıcı arayüzünden profil verme/iptal yönetimi yok. Windows dosya ACL'si eklenti tarafından oluşturulur; Node ayrıca Windows ACL denetimi yapmaz.
- Mutasyon başına en fazla 100 hedef; sorgu limit 1000, tarama 10000, çerçeve 1 MiB, iç gövde 512 KiB. Büyük çizim performansı sınanmadı.
- Ayrı kayıt yalnız oturumun `output` dizinine, `outputRootId=test-output`, düz yeni `.dwg` adı, `overwrite:false`. Alt dizin ve genel kullanıcı kökü seçimi yok.
- Kopya doğrulaması modelspace nesne sayısı/INSUNITS ve desteklenen LINE/CIRCLE/3DSOLID geometrisini karşılaştırır. Bütün layout, xref, metadata ve özel nesne verisini doğruladığını iddia etmez.
- Native cooperative iptal commit öncesi kontrol noktalarında uygulanır; uzun AutoCAD API çağrısı zorla kesilmez. Kalıcı işlem günlüğü, genel LISP/komut, HTTP, kurulum paketi ve Mac native eklenti yok.

Proje lisansı seçilmedi; bağımlılık lisansları [üçüncü taraf notlarında](../THIRD_PARTY_NOTICES.md). Yayın ve paketleme ayrı onay gerektirir.

## 6. Faz 3 hata enjeksiyonu (56 kontrol)

Bu paket yalnız sentetik çizimler ve yeni test profili kullanır; mevcut acad süreci varsa başlamaz. Son senaryo kendi test sürecini çalışan mutasyon sırasında sonlandırır. **Kişisel çizim açmayın.** Kullanıcı dosyası açılmışsa sabit assert_owned/restart/quit kontrolleri cleanup'ı reddeder. Yeni profile verilen izinler normal profili değiştirmez.

```powershell
cmake -S . -B build/test-controls-check -G "Visual Studio 18 2026" -A x64 -DOBJECTARX_ROOT="C:/Dev/Other Projects/Autocad MCP/tmp/sdk/CDROM1" -DJSON_INCLUDE_DIR="C:/Dev/Other Projects/Autocad MCP/tmp/deps" -DAUTOCAD_MCP_TESTING=ON
cmake --build build/test-controls-check --config Release
npm run build
$env:AUTOCAD_MCP_PHASE3_TEST='1'
node dist/test/phase3-windows.js
```

Sonuç `tmp/desktop-runs/<UUID>/phase3-results.json`. Süreç öldüğünde eski pairing dosyası kalabilir; endpoint IPC_UNAVAILABLE verir, otomatik tekrar yapılmaz. Normal dağıtım hedefi build/native ve AUTOCAD_MCP_TESTING=OFF'tur. Normal derlemede test_action/test_probe/fault/seal_records kodu etkin değildir.

Enjeksiyon ayrımı: abort_before_commit gerçek transaction abort'unu ve nesnenin kaybolmasını ölçer. abort_unconfirmed gerçek abort sonrasında kanıt eksikliğini taklit eder; gerçek SDK abort başarısızlığı iddiası değildir. source_side_effect yalnız testte snapshot'a write lock verir ve sentetik kaynak INSUNITS'ını değiştirir; gerçek değişim partial bildirimini sınar, test-only restore_units ile 4'e geri alınır. Normal save_copy read lock kullanır. Modal kontrolü süre tahminiyle değil, ayrı test probe'u ile gerçekten aktif/owner disabled olduğu görülerek yapılır.

## Faz 5 Windows modülü ve native paket kabulü

Faz4'te açık bırakılan AutoCAD modülü değiştirilmez. Yeni normal derleme ayrı klasördedir:

```powershell
cmake -S . -B build/phase5-native -G "Visual Studio 18 2026" -A x64 -DOBJECTARX_ROOT="C:/Dev/Other Projects/Autocad MCP/tmp/sdk/CDROM1" -DJSON_INCLUDE_DIR="C:/Dev/Other Projects/Autocad MCP/tmp/deps" -DAUTOCAD_MCP_TESTING=OFF
cmake --build build/phase5-native --config Release
$env:AUTOCAD_MCP_PHASE5_TEST='1'
npm run test:phase5:windows
```

11 paket sırayla yeni sentetik stok-template kopyaları ve özel Core Console profilleri kullanır; yalnız kendi açtığı süreçleri kapatır. Sonuç `tmp/phase5-regressions/<UUID>/results.json`, paket kanıtları `tmp/phase5-runs/<UUID>/results.json`. Gerçek geometri her zaman resmi MCP SDK stdio istemcisi→yerel IPC→ObjectARX yolundan geçer; test bootstrap/stop kontrolü CAD geometry aracı değildir. Model çağrısı/API harcaması yoktur. Eski masaüstü fault suite ayrıca test edilir; bu runner onun yerine geçmez.

Normal Python'da PyYAML yoksa skill validator için proje içindeki `tmp/skill-validation-deps` PYTHONPATH olarak kullanılabilir; global Python ayarını değiştirme. Geçici derlemeler/SDK/binary/DWG/PDF/kanıt günlükleri gitignored kalır. Faz6 yerel kurulum adayı aşağıdadır; ayrı temiz cihaz kabulü açıktır, Mac FazM'dedir.

## Faz 6 — Windows özel paket

Paket üretimini geliştirici yapar; kullanıcının SDK, Node veya npm kurması gerekmez. Üretimde Node24 x64 kullanılır; onun tam LICENSE dosyası (bağımlılık bildirimleri dahil) aynı sürümün resmî Node deposundan alınır. Native nlohmann/json3.12.0 lisansı `third-party/` altındadır; paketleyici sabit header hash'ini ve telif bildirimlerini ayrıca taşır. Proje lisansı Apache-2.0 olarak seçildi; LICENSE/NOTICE pakete eklenir.

```powershell
cmake -S . -B build/phase6-native -G 'Visual Studio 18 2026' -A x64 -DOBJECTARX_ROOT='C:/Dev/Other Projects/Autocad MCP/tmp/sdk/CDROM1' -DJSON_INCLUDE_DIR='C:/Dev/Other Projects/Autocad MCP/tmp/deps' -DAUTOCAD_MCP_TESTING=OFF
cmake --build build/phase6-native --config Release
npm run package:windows -- --native-build build/phase6-native --output runtime/packages/windows-0.1.0-preview --node-license tmp/deps/node-v24.19.0-LICENSE
$env:AUTOCAD_MCP_INSTALL_TEST='1'
$env:AUTOCAD_MCP_PACKAGE_ROOT=(Resolve-Path 'runtime/packages/windows-0.1.0-preview/AutocadMcp.bundle').Path
npm run test:installation:windows
```

Paketleyici mevcut çıktı dizinini/ZIP'i değiştirmez. Derlemenin CMake post-build JSON'u, OFF bayrağı ve ARX SHA256 doğrulanır. Üretim bağımlılıkları kilit dosyasından alınır; geliştirici SDK istemcisi/TypeScript, pairing, çizim, test kaynakları ve kişisel ayarlar taşınmaz. Oluşan ZIP ve SHA256 yan dosyası `runtime/` altında gitignored kalır. Paket içi Node ile üretim import smoke testi yapılır.

Kurulum testi yalnız `tmp/installation-runs/<UUID>` içinde gerçek CLI ile kurulum/tekrar kurulum/sentetik ikinci paket/geri alma/kaldırma yapar. Node PATH'ten çıkarılır; paket içi Node ve kurulu dosyalar resmi MCP SDK ile gerçek sentetik AutoCAD'e bağlanır, daire oluşturur, ayrı DWG kaydeder ve taze AutoCAD'de ölçüyü geri okur. Varsayılan `LOCALAPPDATA` fallback'i test sürecine özel dizinde denenir. Yeni kişisel AutoCAD/istemci ayarı veya global kurulum oluşturulmaz. Kaynak paket ve örnek çizim hash'leri korunur. Bu test yeni bir VM veya otomatik bundle yükleme kabulü değildir; kaynak ARX testte özel profil altında açıkça yüklenir.

Yeni native derleme ile önceki paketleri sınamak için `AUTOCAD_MCP_TEST_MODULE` değerini mutlak yeni ARX yoluna ayarlayıp `AUTOCAD_MCP_PHASE5_TEST=1 npm run test:phase5:windows` çalıştır. Native kontroller başka yerdeki eski `build/phase5-native` dosyasına dayanmaz. Varsayılan değer eski geliştirme modülüdür.

Kurulum testleri atomic rename/junction kullandığı için Windows korumalı alanında EPERM alırsa aynı sentetik test normal kullanıcı izniyle çalıştırılır; ACL veya ürün doğrulamaları gevşetilmez. Sonuçlar `tmp/installation-runs/<UUID>/results.json`; ortak testler gerçek AutoCAD başlatmaz.

İmza/lisans/temiz cihaz kapısı: `node scripts/check-windows-release.mjs --bundle <bundle>`. ARX, Node ve varsa masaüstü EXE imzaları ayrı denetlenir. Özel adayda başarısız olması beklenir. Açık public önizleme profili ve tek yayın betiği için [yayın kuralları](RELEASING.md) geçerlidir.

### Durum uygulaması ve yeniden bağlantı

`desktop/` Win32 tepsi uygulaması CMake ile derlenir; Node denetleyicisi paket içi runtime ile özel stdin/stdout üzerinden çalışır. HTTP portu/merkezi hizmet yoktur. Tek kullanıcı/tek durum kökünde ikinci uygulama açılmaz. Controller çocuk süreci Windows Job Object ömrüne bağlıdır; yönetilen workspace yolu saklanır. `desktop_platform_test` gerçek Run anahtarına dokunmadan yeni sentetik HKCU anahtarında başlangıç kaydını, kapatma ve sahiplik kontrollerini sınar.

`AUTOCAD_MCP_DESKTOP_TEST=1 npm run test:desktop:windows` üç yeni sentetik Core Console oturumunda komutsuz native başlatma, aynı MCP transportuyla AutoCAD yeniden başlatma, iki host arasında açık seçim, eski kimlik reddi ve native kayıt kabulünü yapar. Bu test temiz cihaz autoload, gerçek Explorer tepsisi veya bilgisayarı yeniden başlatma testi değildir. Pencere/kapatma/küçültme/tek instance/çıkış ayrıca görünür uygulamada denetlenir. Gerçek kullanıcı Run kaydı geliştirme testinde etkinleştirilmez.

Eklenti ilk yüklemede yalnız iki izinli yerel yönetim işlemini ilan eder (`desktop_get_status`, `desktop_start`); bunlar AI'ya sunulan52 CAD aracına eklenmez. CAD API çağrısı UI thread'ine post edilir. Yönetim bilgisi auth/özelACL ile okunur; pairing sırrı GUI veya istemci ayarına kopyalanmaz. Bind generation değişirse kuyruktaki eski mutasyon gönderilmez; gönderilmiş/sonucu belirsiz işlem otomatik yinelenmez. `MCPSTART` CLI yolu korunur. Ayrı test kökleri `--state-root`, `--hosts-root`, `--cad-root` ile seçilebilir; özel state kökünde başlangıç kutusu devre dışıdır.

PDF kenar payı regresyonu: plotting paketi kenarsız, normal yatay ve90° döndürülmüş A4 üretir; dört köşe işareti gerçek PDF'den ayrıca ölçülür. `pypdfium2` içeren Python ile `python test/pdf-paper-positions.py runtime/exports/phase5-<paket-UUID>` çalıştırılır. Sonuç `pdf-paper-positions.json`; medya dönüşümü sonrası glif konumları0.75pt altında ve190/142mm aralıkları1:1 olmalıdır. Bu salt okunur PDF denetimi yerel SDK alanlarına güvenmekle yetinmez. Örnek kabul: `phase5-3f3157c5-0800-4dbe-a66d-0bb339ea2b43`. Normal A4 kenarları fiziksel baskı alanı dışında kalabilir;10mm çerçeve için gerçekten kurulu kenarsız medya seçilir.
