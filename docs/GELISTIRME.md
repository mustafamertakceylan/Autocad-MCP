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

## 4. Eklenti–MCP yaşam döngüsü

Geliştirici akışı: AutoCAD sürecinin ortamında `MCP_RUNTIME_DIR` mutlak bir yerel dizine ayarlanır; eklenti yüklenir ve AutoCAD'de `MCPSTART` çalıştırılır. Eklenti özel DACL'li yeni oturum dizini ve `pairing.json` üretir. Modelin bu dosyayı okuması gerekmez; yerel MCP sürecine yolu verilir:

```text
command: node
args: ["<projenin mutlak yolu>/dist/src/main.js", "--grant-file", "<MCPSTART tarafından bildirilen pairing.json yolu>"]
```

Bu, istemciye verilecek süreç/argüman bilgisidir; belirli bir istemcinin ayar dosyası biçimi değildir. Claude/Codex kişisel ayarları değiştirilmedi; ayrı pilot test Faz 4'tedir.

`MCPSTOP` pipe'ı kapatır, sırrı bellekten siler ve kendi eşleştirme dosyasını kaldırır. AutoCAD yeniden başladığında yeni instance/epoch ve eşleştirme gerekir. Oturum süresi 24 saattir. Sırlar için paylaşım/git yok; eşleştirme dosyası modeli talimatla sınırlandıran bir sandbox değildir.

`MCPPUMP` ve `bridge.test_done` yalnız `MCP_TEST_MODE` ile test kontrolü içindir; 14 MCP aracına eklenmez. Core Console'da Win32 mesajlarını ana thread'de işler. Masaüstü AutoCAD'in event loop/context geçişi ayrıca sınanmalıdır; bu belge kullanıcı çizimlerinde kullanım önerisi değildir.

## 5. Mevcut sınırlar

- Modelspace; çizgi, WCS XY çember, eksenlere paralel kutu. Taşıma/silme çizgi, çember ve bu oturumda üretilen kutularla sınırlı.
- Birimler `mm`, `m`, `inch`, `drawing_unit`; fiziksel dönüşüm INSUNITS 1/4/6 için. Bilinmeyen birimde fiziksel yazma reddedilir; açık drawing_unit kabul edilir. Inch canlı testi çalıştırılmadı.
- Tek eşleştirilmiş instance ve MCP süreci başına bir IPC çağrısı. Çoklu istemci paylaşımı ürün kabulü değildir.
- HMAC sırrı + işlem izin listesi; kullanıcı arayüzünden profil verme/iptal yönetimi yok. Windows dosya ACL'si eklenti tarafından oluşturulur; Node ayrıca Windows ACL denetimi yapmaz.
- Mutasyon başına en fazla 100 hedef; sorgu limit 1000, tarama 10000, çerçeve 1 MiB, iç gövde 512 KiB. Büyük çizim performansı sınanmadı.
- Ayrı kayıt yalnız oturumun `output` dizinine, `outputRootId=test-output`, düz yeni `.dwg` adı, `overwrite:false`. Alt dizin ve genel kullanıcı kökü seçimi yok.
- Kopya doğrulaması modelspace nesne sayısı/INSUNITS ve desteklenen LINE/CIRCLE/3DSOLID geometrisini karşılaştırır. Bütün layout, xref, metadata ve özel nesne verisini doğruladığını iddia etmez.
- Kalıcı işlem günlüğü, native çalışan işi iptal etme, genel LISP/komut, HTTP, kurulum paketi ve Mac native eklenti yok.

Proje lisansı seçilmedi; bağımlılık lisansları [üçüncü taraf notlarında](../THIRD_PARTY_NOTICES.md). Yayın ve paketleme ayrı onay gerektirir.
