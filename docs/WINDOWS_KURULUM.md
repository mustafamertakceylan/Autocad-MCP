# Windows 2027 önizleme kurulumu

Bu paket Windows x64 ve **tam AutoCAD 2027** içindir. AutoCAD LT, diğer yıllar ve Mac desteklenmez. Node 24 ve çalışma zamanı bağımlılıkları paket içindedir; kullanıcının npm, CMake, Visual Studio veya ObjectARX SDK kurması gerekmez. AutoCAD'in kendi kurulumundaki çalışma zamanı bileşenleri gereklidir.

v1.0.0 kaynak kodu Apache-2.0 lisanslıdır. Windows paketi **imzasız public önizleme** olarak hazırlanır; ayrı temiz Windows kabulü tamamlanmadı. Windows/AutoCAD bilinmeyen yayıncı uyarısı gösterebilir; kullanıcı değerlendirir. SHA256 listesi dosya bozulmasını denetler; yayıncı kimliğini dijital imza gibi doğrulamaz.

Uygulamadaki **Kurulum rehberi** iki kısa bölüm içerir: **1. AutoCAD'i hazırla** ve **2. MCP'yi bağla**. Ana ekrandaki **MCP rehberi** düğmesi doğrudan ikinci bölümü açar. Her bölümde numaralı adımlar ve ilgili ekrana götüren düğmeler vardır.

## Kurulum

1. Paketi yeni bir yerel klasöre çıkart. AutoCAD ve Core Console süreçlerini kapat.
2. `install.cmd` çalıştır. Yönetici hakkı istemeden `%APPDATA%\Autodesk\ApplicationPlugins\AutocadMcp.bundle` içine kurulur. Dolu ve bu kurulumun yönetmediği bir bundle üzerine yazılmaz.
3. AutoCAD'i aç. İmzasız önizlemenin yüklenmesi için AutoCAD'in gösterdiği yayıncı/güven uyarısını kullanıcı değerlendirir. Gerekirse yalnız bundle'ın `Contents\Win64` klasörünü güvenilir konum olarak elle seç. Kurucu `SECURELOAD`, `TRUSTEDPATHS` veya kişisel AutoCAD profilini değiştirmez.
4. Başlat menüsünden **Autocad MCP**'yi aç; alternatif olarak çıkardığın pakette `Autocad MCP.cmd` çalıştır. Kısayol kurulamadıysa bu ikinci yol kullanılabilir.
5. Durum ekranında AutoCAD oturumunu seçip **Bağlan**'a bas. Tek oturum listede seçili gelir; bağlantı için yine düğmeye basılır. Birden çok AutoCAD varsa hedefi açıkça sen seçersin. `MCPSTART` yazman gerekmez. Eklenti otomatik yüklenmediyse `APPLOAD` ile kurulu `AutocadMcp.arx` dosyasını seç.

Bundle AutoCAD açılışında yalnız yerel keşif kanalını hazırlar. Çizim köprüsü **Bağlan** seçilince başlar; kendiliğinden çizim işlemi yapılmaz. Köprü durumu ile AI istemcisinin MCP bağlantısı ekranda ayrı gösterilir. **AutoCAD bağlı / 52 araç** ve **MCP istemcisi bağlı** birlikte bağlantının iki tarafını gösterir. İstemcinin model erişimi/aboneliği bu yerel göstergeden bağımsızdır.

## Codex, Claude Code ve OpenCode bağlantısı

**İstemciler** sekmesinde yeni/boş bir çalışma klasörü seç ve **Bağlantı dosyalarını hazırla**'ya bas. Codex, Claude veya OpenCode kartındaki klasör düğmesiyle kendi alt klasörünü aç; istemciyi orada başlat. İlk kullanımda istemcinin proje MCP güven/onay adımını kendisi tamamlar.

**Codex masaüstü / IDE ve diğer STDIO istemcileri:** Kurulum rehberi → MCP'yi bağla bölümünde istemciyi seç. Codex'te Ayarlar → MCP sunucuları → Sunucu ekle yolunu kullan; ad `autocad`, tür **STDIO**. Uygulamadaki **Komutu kopyala** düğmesinin değerini komut alanına gir. **Argümanları kopyala** dört ayrı satır verir; bunları aynı sırayla dört ayrı argüman olarak ekle. Bu satırlar kabuk komutu değildir; başlarına/sonlarına fazladan tırnak ekleme. Kaydet, istemcide MCP'yi yeniden başlat ve “AutoCAD durumunu kontrol et” yaz. URL, port veya API anahtarı gerekmez. Bu elle ekleme yolu istemcinin mevcut ayarlarını uygulama tarafından değiştirmez; skill kurulumu ayrı İstemciler ekranındadır.

**CLI yolu:** Rehberin istemci listesinden Codex CLI, Claude Code veya OpenCode1.x seç. Hazırlanan ilgili alt klasörde terminal açıp sırasıyla `codex`, `claude` veya `opencode` çalıştır; proje güveni/MCP onayını kullanıcı verir. Claude Code proje `.mcp.json` ayarını kullanır; Claude Desktop sohbet bağlantısıyla aynı kurulum değildir. OpenCode2.x biçimi bu pakette desteklendiği iddia edilmez. Kurulum adımları [OpenAI MCP belgesi](https://learn.chatgpt.com/docs/extend/mcp?surface=app), [Claude Code proje MCP belgesi](https://code.claude.com/docs/en/mcp#project-scope) ve [OpenCode yerel MCP belgesi](https://opencode.ai/docs/mcp-servers/#local) ile karşılaştırıldı; canlı model kabulü yerine geçmez.

Üç istemci için ayrı klasörlerde MCP ayarı ve mevcut `autocad-mcp` skill'i üretilir. Global/kişisel istemci ayarları değişmez. Yapılandırma pairing sırrını içermez; yerel masaüstü yöneticisine bağlanır. Üretilmiş ayarlar değiştirilmez; farklı kurulum konumuna geçerken veya eksik klasörde yeni/boş bir çalışma klasörü seç. Genel teknik resim doğruluğu için yeni skill çalışması ertelenmiştir. Claude canlı model testi çalıştırılmadı.

## Sonraki kullanım ve sistem tepsisi

- Pencereyi kapatmak veya küçültmek uygulamayı tepsiye gizler; bağlantı sürer. Tepsi simgesinden **Durumu göster**, **Seçili AutoCAD'e bağlan** veya **Çıkış ve bağlantıyı kes** seçilebilir. Tam çıkış AutoCAD'i veya çizimleri kapatmaz.
- **Ayarlar → Windows ile başlat** varsayılan kapalıdır. İşaretlersen mevcut Windows kullanıcısının oturum açılışında `--tray` ile başlar; pencere zorla açılmaz. Aynı kutuyu kaldırınca uygulamanın kendi başlangıç kaydı kaldırılır. Yönetici hakkı veya Windows servisi gerekmez. Aynı sekmedeki **Tepsiye gizle** pencereyi saklar; **Tamamen kapat** uygulamadan çıkar.
- Bilgisayarı/AutoCAD'i yeniden açınca AutoCAD oturumunu seçip **Bağlan**'a bas. İstemci ayarlarını tekrar üretmen gerekmez. Açık MCP istemcisi yeni bağlantıyı aynı transport üzerinden kullanabilir; istemciyi yeniden başlatmak gerekmez. Eski çizim kimliğiyle istek kabul edilmez; AI yeni instance/belge kimliklerini yeniden keşfetmelidir.
- Tepsi griyse AutoCAD eklentisi bekleniyor; sarıysa AutoCAD bulundu ve bağlantı seçimi gerekiyor; yeşilse yerel AutoCAD bağlantısı doğrulandı. MCP istemci sayısı ayrıca ekranda görünür. AutoCAD kapalıyken MCP araç kataloğu açılabilir; çizime erişilemez.

Yerel stdio/named pipe kullanılır; ağ portu ve merkezi hesap gerekmez. Uygulama durumu `%LOCALAPPDATA%\AutocadMCP\desktop`, keşif `%LOCALAPPDATA%\AutocadMCP\desktop-hosts`, CAD oturumları `%LOCALAPPDATA%\AutocadMCP\runtime` altındadır. Pairing dosyası içeriğini paylaşma. İleri kullanımda mutlak `MCP_RUNTIME_DIR` geçerlidir; özel root kullanan geliştirme ortamında yöneticiye aynı hosts/cad kökleri verilmelidir.

## İleri kullanım: eski komut satırı bağlantısı

Tepsi yöneticisini kullanmadan `MCPSTART` + açık pairing yolu ile önceki CLI yolu korunur. Bu modda AutoCAD yeniden başladığında `pilot.js pair` ile yeni pairing yolunu seçmek ve MCP bağlantısını yeniden başlatmak gerekir:

```powershell
$cadServer = Join-Path $env:APPDATA 'Autodesk\ApplicationPlugins\AutocadMcp.bundle\Contents\server'
& "$cadServer\runtime\node.exe" "$cadServer\dist\src\pilot.js" configure --workspace 'C:\CAD-Pilot' --grant-file '<MCPSTART pairing.json yolu>'
& "$cadServer\runtime\node.exe" "$cadServer\dist\src\pilot.js" doctor --session-file 'C:\CAD-Pilot\autocad-session.json'
```

## Tanılama, yükseltme ve kaldırma

Paket klasöründe `setup.cmd doctor` kurulu dosyaları manifest SHA256 değerleriyle kontrol eder; arşiv kimliklerini, bozulma ve kesintili kurulum durumunu gösterir. Canlı bağlantı için durum ekranını, eski CLI modunda `pilot.js doctor` kullan. Model çağrısı veya ücretli API isteği yapılmaz.

Yeni paketin `install.cmd` dosyasıyla yükselt. Önce tepsi menüsünden **Çıkış** seç; AutoCAD ve AI istemcilerindeki MCP bağlantılarını kapat. Kurucu tamamı doğrulanmış yeni bundle'ı hazırlar, eski sürümü `.AutocadMcp/archive-<kimlik>` içinde saklar. Aktif dosyalar değiştirilmişse üzerine yazmak yerine durur. İstemci MCP bağlantısını yeniden başlat; çalışma klasöründeki skill kopyaları sürüm yükseltmesiyle otomatik yenilenmez, güncel skill için yeni bir boş istemci klasörü üret.

```powershell
.\setup.cmd doctor
.\setup.cmd rollback --archive 'archive-<doctor çıktısındaki kimlik>'
.\setup.cmd recover
.\setup.cmd uninstall
```

Kaldırma uygulamanın kendi başlangıç kaydını ve Başlat kısayolunu kaldırır; yönetilen aktif bundle'ı arşivler. Çizimleri, oturum çıktısını, istemci çalışma klasörlerini ve önceki sürümleri silmez. Kaldırma sonrası bu istemcideki MCP bağlantısını kullanıcı devre dışı bırakır. Kurucu başka uygulama dosyalarını veya istemci ayarlarını temizlemez.

Kesintide `recoveryRequired` görülürse `setup.cmd recover` kullan. Günlük, aktif paket, önceki sürüm ve kurulum kaydı doğrulanır; tamamı yerleştirilmiş yeni sürüm tamamlanır, yarım kalmış değiştirmede önceki sürüm geri gelir. Tanınmayan/değiştirilmiş dosyada kurtarma durur. Eski kurucudan kalan tanınmış kilit, yalnız kaydettiği süreç kimliği artık çalışmıyorsa arşivlenir; çalışan veya tanınmayan kilit aşılmaz. Bu koruma aynı anda iki kurucunun çalışmasını engeller.

## Doğrulama sınırı

Geliştirme bilgisayarında izole paket/yerel AutoCAD testleri temiz cihaz kabulü değildir. İmzalama sertifikası, seçilmiş proje lisansı, SDK dağıtım koşulları incelemesi ve geliştirici araçları bulunmayan ayrı Windows makine/VM'deki kurulum–kullanım–yükseltme–kaldırma kabulü genel yayın öncesinde gerekir. Mac ayrı Faz M'dir.

Autodesk'in [bundle kurulum ve güven açıklaması](https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-5E50A846-C80B-4FFD-8DD3-C20B22098008.htm) kullanıcıya özel ApplicationPlugins yolunu ve güvenli yükleme şartlarını açıklar.
