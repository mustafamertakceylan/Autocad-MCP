<div align="center">

<img src="desktop/assets/autocad-mcp-logo.png" alt="Autocad MCP logosu" width="144" />

# Autocad MCP

**AI asistanını AutoCAD'e bağla. Kendi bilgisayarında çiz, incele ve düzenle.**

[![Windows indir](https://img.shields.io/badge/İndir-Windows_x64-D92532?style=for-the-badge)](https://github.com/mustafamertakceylan/Autocad-MCP/releases/download/v1.0.0/Autocad-MCP-1.0.0-Windows-x64.zip)
[![v1.0.0](https://img.shields.io/badge/v1.0.0-Windows_önizlemesi-25262B?style=for-the-badge)](https://github.com/mustafamertakceylan/Autocad-MCP/releases)
[![Apache 2.0](https://img.shields.io/badge/Lisans-Apache_2.0-D92532?style=for-the-badge)](LICENSE)

[English](README.md) · **Türkçe**

[Kurulum rehberi](docs/WINDOWS_KURULUM.md) · [52 araç](docs/TOOL_CATALOG.json) · [Derleme](docs/GELISTIRME.md)

</div>

Autocad MCP; Codex, Claude Code, OpenCode ve diğer yerel STDIO MCP istemcilerini tam AutoCAD 2027'ye bağlayan açık kaynak bir köprüdür. Köprü bilgisayarında çalışır; merkezi sunucu, port açma veya köprüye özel API anahtarı gerekmez. AI istemcisinin model erişimi ve buluta gönderdiği veriler kendi ayarlarına bağlıdır.

![AutoCAD hazırlığını adım adım anlatan uygulama ekranı](docs/media/setup-guide.jpg)

**Desteklenen hedef: Windows x64 ve tam AutoCAD 2027.** AutoCAD LT desteklenmez. Mac Apple Silicon ayrı geliştirme fazındadır; henüz Mac paketi yoktur. Uygulama arayüzü şu an Türkçedir; README Türkçe ve İngilizcedir.

**v1.0.0 imzasız Windows önizlemesidir.** Windows/AutoCAD yayıncı veya güven uyarısı gösterebilir. Ayrı temiz bilgisayar kabulü, gerçek reboot/başlangıç ve güvenilir ARX/EXE imzası kontrolleri tamamlanmadı. Kullanmadan önce [sürüm notlarını](docs/releases/v1.0.0.md) ve SHA256 yan dosyasını incele.

### Başlangıç

1. Yayımlanan Windows ZIP paketini aç; AutoCAD kapalıyken **install.cmd** çalıştır.
2. AutoCAD 2027'de bir çizim aç. **Autocad MCP** uygulamasında oturumu seçip **AutoCAD'e bağlan** düğmesine bas.
3. **Kurulum rehberi → MCP'yi bağla** bölümünden AI istemcini seç. Codex masaüstü/IDE için komut ve argümanları kopyala; CLI istemcilerinde **İstemciler** sekmesinden boş bir çalışma klasörü hazırla.
4. AI sohbetinde **“AutoCAD durumunu kontrol et”** yaz. Uygulamada AutoCAD bağlantısı ile MCP istemci bağlantısını ayrı ayrı görebilirsin.

Eklenti listede görünmüyorsa rehberdeki **Eklenti klasörünü aç** düğmesini kullan; AutoCAD'de `APPLOAD` ile `AutocadMcp.arx` dosyasını seç. Güven uyarısını kullanıcı değerlendirir; uygulama AutoCAD güvenlik ayarlarını değiştirmez.

Sonraki kullanımda aynı istemci ayarı geçerlidir. AutoCAD'i açıp oturumu bağlaman yeterlidir. Pencereyi kapatınca uygulama sistem tepsisinde kalır. **Windows ile başlat** seçeneği isteğe bağlıdır ve varsayılan kapalıdır; etkinleştirilirse oturum açılışında pencere göstermeden tepside başlar.

### Neler yapabilirsin?

- Çizimleri ve nesneleri sorgula; 2B geometri oluştur, taşı, dönüştür ve düzenle.
- Gerçek ölçü nesneleri, yazı, katman, çizgi tipi, tarama ve blok/niteliklerle teknik resim hazırla.
- Katı oluşturma, ekstrüzyon, döndürme, boolean, delik ve açık yoğunlukla kütle hesabını kullan.
- Kesit, BOM/tablo, kamera, ölçekli pafta/PDF ve kontrollü xref işlemleri yap.
- Açık belge hedefi, birim ve revision denetimiyle çalış; ayrı DWG kopyası kaydet, desteklenen adımları atomik batch içinde yürüt.

52 araç bütün AutoCAD özelliklerinin desteği anlamına gelmez. Yüzey/mesh, serbest AutoLISP/komut ve uzak HTTP erişimi mevcut kapsamda yoktur. AI'nın ölçü ve görünüş kararlarını ayrıca kontrol et; başarılı MCP işlemi mühendislik doğruluğu veya üretim onayı değildir. [Destek ve sınırlar](docs/YETENEK_MATRISI.md).

### AI istemcileri ve skill'ler

| İstemci | Bağlantı |
|---|---|
| Codex masaüstü / IDE | Rehberdeki yerel STDIO komutu ve dört ayrı argüman |
| Codex CLI | Üretilen `codex` çalışma klasörü ve proje MCP ayarı |
| Claude Code | Üretilen `claude` klasöründeki `.mcp.json` ve mevcut skill |
| OpenCode 1.x | Üretilen `opencode` klasörü ve yerel MCP ayarı |
| Diğer STDIO istemcileri | Komut ve argümanlarla elle bağlantı; istemci bazında doğrulama gerekir |

Mevcut `autocad-mcp` skill'i ve üç sabit MCP resource dahildir. Genel teknik resim doğruluğu için yeni skill çalışması ertelendi. Claude Code dosyaları hazırlanır; canlı Claude model testi çalıştırılmadı. OpenCode2.x ve Claude Desktop kurulumu bu yollarla doğrulanmış sayılmaz.

### Doğrulama ve geliştirme

Windows geliştirme ortamında 47 ortak test, 338 native CAD kontrolü, 23 yeniden bağlantı kontrolü ve 28 kurulum kontrolü için tarihli kanıtlar vardır. Son arayüzde rehber, komut kopyalama ve istemci seçimi denendi; CTest 2/2 geçti. Son sürümün kabul kapsamı ve çalıştırılmayan kontroller [kabul belgesindedir](docs/TEKNIK_DENEME_KABUL.md); bunlar temiz Windows kabulü yerine geçmez.

Kaynak geliştirme için Node 24+, CMake, uygun Visual Studio C++ araçları ve ayrı lisanslanan ObjectARX 2027 SDK gerekir:

```powershell
npm ci --ignore-scripts
npm run check
npm test
```

Native derleme, izole AutoCAD testleri ve paketleme: [geliştirme rehberi](docs/GELISTIRME.md). Son kullanıcı paketi Node çalışma zamanını içerir; kullanıcıya SDK veya derleyici kurdurulmaz.

### Lisans ve katkılar

[Apache 2.0](LICENSE) · [Bildirim](NOTICE) · [Üçüncü taraf lisansları](THIRD_PARTY_NOTICES.md) · [Sürüm notları](CHANGELOG.md)

AutoCAD ve ObjectARX Autodesk'in ayrı ürünleridir; bu bağımsız proje Autodesk tarafından desteklenmez veya onaylanmaz. AutoCAD/SDK pakete dahil değildir. Logo özgün olarak imagegen ile üretildi; [üretim tarifi](desktop/assets/README.md).
