# Windows pilotu: Codex, Claude ve OpenCode

Bu akış kaynak geliştirme derlemesi olan **tam AutoCAD 2027 / Windows x64** içindir. Faz6'daki paket içi Node/bundle ile özel önizleme kurulumu [Windows kurulum rehberindedir](WINDOWS_KURULUM.md). Temiz cihaz kabulü ve genel yayın henüz yapılmadı. Mac ayrı Faz M'dir. İstemcilerin destek durumu ve gerçek sonuçlar [kabul belgesindedir](TEKNIK_DENEME_KABUL.md).

## Nasıl çalışır?

AutoCAD içinde ObjectARX eklentisi çalışır. AI istemcisi yerel Node MCP sürecini başlatır; bu süreç eşleştirildiği AutoCAD'e Windows named pipe üzerinden bağlanır. Port açılmaz; bu köprü için LLM anahtarı gerekmez. İstemcinin kullandığı modelin hesabı ve veri akışı ayrıdır.

```text
Codex / Claude / OpenCode
  → stdio MCP (yerel Node)
  → imzalı named pipe (yerel)
  → ObjectARX → açık çizim
```

AI istemcisi kapandığında AutoCAD kapanmaz. AutoCAD kapanırsa köprü işlem yapamaz. Yeni AutoCAD oturumu için açıkça yeniden eşleştirme gerekir; eski hedef otomatik değiştirilmez.

## 1. Derle ve AutoCAD'i hazırla

Node 24+, tam AutoCAD 2027 ve [geliştirme rehberindeki](GELISTIRME.md) ObjectARX derlemesi gerekir:

```powershell
npm ci --ignore-scripts
npm run build
cmake --build build/native --config Release
```

Native hedef `AUTOCAD_MCP_TESTING=OFF` olmalıdır. SDK, derleme çıktısı ve eşleştirme sırrı repoya eklenmez.

Yeni AutoCAD sürecini başlatmadan ortamında `MCP_RUNTIME_DIR` için yerel mutlak bir dizin seç. AutoCAD'de yalnız derlenmiş modül klasörünü güvenilir konuma ekle; SECURELOAD'ı kapatma. `APPLOAD` ile `AutocadMcp.arx` yükle ve `MCPSTART` çalıştır. Komutun bildirdiği **pairing.json yolunu** aşağıdaki komuta ver; dosyanın içeriğini sohbete yapıştırma.

İlk kullanımda kişisel çizim yerine stok şablondan yeni bir test çizimi aç. Pilot, kullanıcı profiline otomatik eklenti kurmaz veya açık AutoCAD'i kendiliğinden seçmez.

## 2. İstemci klasörlerini ve skill'leri oluştur

Proje kökünde, yeni ya da boş bir çalışma klasörü seç:

```powershell
node dist/src/pilot.js configure --workspace "C:\CAD-Pilot" --grant-file "<MCPSTART'ın bildirdiği mutlak pairing.json yolu>"
node dist/src/pilot.js doctor --session-file "C:\CAD-Pilot\autocad-session.json"
```

`doctor` çıktısında gerçek bağlantı için `connected:true`, `backend:"objectarx"`, `simulation:false` beklenir. Bu sorgu model çağırmaz. `toolCount` sunucunun güncel katalog sayısıdır (Faz5:52); bağlanan eski eklenti14 araçta kalabilir, gerçek izin/yetenek listesi ayrıca okunur; AutoCAD'in bütün komutları anlamına gelmez.

Oluşan yapı:

| İstemci | Çalışma klasörü | MCP yapılandırması | Skill |
|---|---|---|---|
| Codex | `C:\CAD-Pilot\codex` | `.codex/config.toml` | `.agents/skills/autocad-mcp/` |
| Claude Code | `C:\CAD-Pilot\claude` | `.mcp.json` | `.claude/skills/autocad-mcp/` |
| OpenCode | `C:\CAD-Pilot\opencode` | `opencode.json` | `.opencode/skills/autocad-mcp/` |

Her istemciyi kendi çalışma klasöründe aç. Proje güvenini ve istemcinin gösterdiği MCP/skill izinlerini o istemcide değerlendir. Mevcut kişisel ayarlar değiştirilmez. Dolu klasörde `configure` reddedilir; üzerine yazılmaz. Başka yerdeki projeye bağlantı gerekiyorsa üretilen **command/args** alanlarını o istemcinin yerel MCP ayarına taşı; pairing içeriğini taşıma. Claude Desktop yapılandırması bu pilotta üretilmez veya denenmez.

Skill'in tek kaynak kopyası [SKILL.md](../skills/autocad-mcp/SKILL.md) dosyasıdır. Hedef/birim belirleme, ölçülü çizim, eski revision, belirsiz sonuç, geri okuma ve güvenli kayıt akışını tarif eder. Modelin bu talimatları izlemesi teknik yetki sınırı yerine geçmez.

Kabuk/dosya skill okumasını engelleyen istemciler için aynı talimatlar üç sabit MCP resource ile okunabilir:

```text
skill://autocad-mcp/autocad-mcp/SKILL.md
skill://autocad-mcp/autocad-mcp/references/tools.md
skill://autocad-mcp/autocad-mcp/references/mechanical.md
```

Bunlar standart MCP resource'lardır; yeni CAD aracı, keyfi dosya okuma veya ayrı bir skills protokolü değildir. İstemcinin resource okuyabilmesi gerekir. Paket taşınırsa yeniden derleme/yapılandırma gerekir; üretilen yollar mutlaktır.

## 3. Kullan

Örnek istek:

> autocad-mcp skill'ini kullan. Gerçek bağlantıyı, yetenekleri ve açık belgeleri listele. Seçtiğim test çiziminde mm ve WCS ile 80×40 mm simetrik kontur ve merkezde Ø10 çember oluştur. Belirsiz ölçüleri önce sor. Sonucu geri okuyup ölç; yeni bir DWG kopyası kaydet.

Model önce `instanceId`, `documentId`, `documentEpoch` belirler. Her yazmada yeni revision ve benzersiz operationId kullanır. Birden fazla hedef varsa seçim gerekir. İki istemcinin aynı çizime yazmasını sırayla yap; eşzamanlı değişim eski revision reddi doğurabilir.

Kayıt yalnız eşleştirilmiş oturumun `output` köküne, yeni düz `.dwg` adıyla ve `overwrite:false` ile yapılır. Orijinal dosyanın üzerine kaydetme aracı yoktur. Sonuçtaki `outputRootId`/`relativePath` alanlarını kullan; modelin tahmin ettiği dosya yoluna güvenme. DWG'yi kullanıcıya sunmak için yerel operatör çıktı dizininden ayrıca kopyalayabilir.

Mevcut araçlar: keşif/durum/yetenek, belge listesi/bilgisi, sorgu/tek nesne, çizgi/çember/kutu oluşturma, taşıma/silme, işlem durumu, ayrı DWG kaydı. Makinece okunur gerçek input/output şemaları ve annotations: [TOOL_CATALOG.json](TOOL_CATALOG.json), yeniden üretme: `npm run catalog`. Girdi şemaları katıdır; çıktı şeması halen genel JSON object'tir. Ayrıntılı alan/durum sözleşmesi [skill referansında](../skills/autocad-mcp/references/tools.md) ve [iletişim sözleşmesinde](ILETISIM_SOZLESMESI.md) bulunur; her sonuç için dar, statik çıktı tipi garantisi verilmez.

Önceki 14 araçlı Faz4 pilot fotoğraf deneyinde yalnız profil ve çember üretildi; ölçü okları/yazıları yoktu. Faz5'in52 araçlı modülü native ölçü, yazı, katman/stil, polyline, katı modelleme ve PDF de sunar; güncel instance capability listesi esas alınır. Serbest LISP/komut aracı yoktur. 20 ayrı LINE kapalı polyline değildir; 2B çember fiziksel3B delik değildir.

## 4. AutoCAD yeniden açılınca

Yeni oturumda eklentiyi yükleyip `MCPSTART` çalıştır. İstemcide devam eden işlemi bitir; bilinmeyen mutasyon sonucunu yeni kimlikle tekrar etme. Operatör olarak:

```powershell
node dist/src/pilot.js pair --session-file "C:\CAD-Pilot\autocad-session.json" --grant-file "<yeni pairing.json yolu>"
node dist/src/pilot.js doctor --session-file "C:\CAD-Pilot\autocad-session.json"
```

Ardından istemcinin MCP bağlantısını yeniden başlat ve belge kimliklerini yeniden listele. Çalışan sunucu pointer değişince sessizce başka hedefe geçmez. Skill/config dosyaları korunur. Eşleştirme süresi mevcut profilde 24 saattir; `MCPSTOP` grant'i iptal eder. İşlem günlüğü kalıcı değildir; yeniden başlama sonrası eksik kayıt `unknown/null` demektir, etkisizlik kanıtı değildir.

## Kaynaklar ve doğrulama sınırı

- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Claude Code skills](https://code.claude.com/docs/en/skills)
- [OpenCode MCP](https://opencode.ai/docs/mcp-servers/), [skills](https://opencode.ai/docs/skills/), [yapılandırma](https://opencode.ai/docs/config/), [izinler](https://opencode.ai/docs/permissions/)

2026-10-18: Codex ve OpenCode ile gerçek AutoCAD pilotu yürütüldü. Claude için dosya/skill hazırlığı ve statik kontroller vardır; limit olmadığı için canlı model çağrısı **çalıştırılmadı**. Başka istemci/sürüm, temiz cihaz ve kullanıcı çizimlerinde genel ürün kabulü iddia edilmez.

## Faz 5 geliştirme modülüne geçiş

Güncel52 araç `build/phase5-native/Release/AutocadMcp.arx` normal OFF derlemesindedir. Çalışan eski eklenti binary dosya değişince kendiliğinden güncellenmez. Kişisel çizim/oturum kapatılmaz; uygun yeni AutoCAD oturumunda yeni modül yüklenip `MCPSTART` yapılır ve yeni pairing ile yeni/boş pilot çalışma klasörü üretilir. Eski skill kopyaları da kendi kendine güncellenmez; `configure` güncel canonical bundle'ı yeni klasöre kopyalar. Kişisel istemci ayarları üzerine yazılmaz.

Xref kaynağını operatör özel pairing klasörünün `input/` altına kopyalar; MCP yalnız `inputRootId=session-input` ve düz DWG adı alır. Eklentinin verdiği kökün dışı kabul edilmez. Bu ilk akış genel dosya tarayıcısı/istemci upload API'si değildir. Xref'i bind etmeden alınan kopyanın dış DWG bağımlılığı sürer.
