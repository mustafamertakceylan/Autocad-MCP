# Geliştirme ve prototipi çalıştırma

Bu sürüm geliştirici prototipidir. Kurulum paketi, imzalı genel dağıtım ve Claude/Codex pilot kabulü henüz yoktur. Gerçek test kapsamı [kabul belgesindedir](TEKNIK_DENEME_KABUL.md). Mac native taşıması/eklenti derlemesi ayrı Faz M kapsamındadır ve şu an kapalıdır; Windows kabulünü engellemez.

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

Bu, istemciye verilecek süreç/argüman bilgisidir; belirli bir istemcinin ayar dosyası biçimi değildir. Claude/Codex kişisel ayarları değiştirilmedi; ayrı pilot test Faz 4'tedir.

`MCPSTOP` pipe'ı kapatır, sırrı bellekten siler ve kendi eşleştirme dosyasını kaldırır. AutoCAD yeniden başladığında yeni instance/epoch ve eşleştirme gerekir. Oturum süresi 24 saattir. Sırlar için paylaşım/git yok; eşleştirme dosyası modeli talimatla sınırlandıran bir sandbox değildir.

`MCPPUMP` ve `bridge.test_done` yalnız `MCP_TEST_MODE` ile test kontrolü içindir; 14 MCP aracına eklenmez. Core Console'da Win32 mesajlarını ana thread'de işler. Görünür masaüstü event loop/context geçişi 26 sentetik kontrolde test pompası olmadan geçti; bu belge kullanıcı çizimlerinde üretim kullanım önerisi değildir.

## 5. Mevcut sınırlar

- Modelspace; çizgi, WCS XY çember, eksenlere paralel kutu. Taşıma/silme çizgi, çember ve bu oturumda üretilen kutularla sınırlı.
- Birimler `mm`, `m`, `inch`, `drawing_unit`; fiziksel dönüşüm INSUNITS 1/4/6 için. Bilinmeyen birimde fiziksel yazma reddedilir; açık drawing_unit kabul edilir. Inch canlı testi çalıştırılmadı.
- Tek eşleştirilmiş instance; MCP süreci başına bir normal IPC çağrısı/64 iş admission sınırı. Bağımsız kontrol pipe'ı status/iptali CAD işinden ayırır. Native iki ana bağlantı, tek CAD thread'i; iki istemciden eşzamanlı dedup sınandı. Claude/Codex birlikte kullanım pilotu Faz 4'tedir.
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
