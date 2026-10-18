# Mevcut AutoCAD MCP projeleri ve ürünleri karşılaştırma raporu

Ajan: DeepSeek V4.1 Flash. Yönetici: Codex.
Tarih: 2026-10-18. Kapsam: yalnız kamuya açık birincil kaynaklar.
**Canlı AutoCAD testi yapılmadı; hiçbir test paketi çalıştırılmadı; hiçbir proje kurulmadı.**

## Yöntem ve sınırlar

- Her proje için GitHub deposu, README, lisans dosyası, `pyproject.toml`/`package.json`, test dizini ve mümkünse bir kaynak dosyası okundu.
- README'deki iddialar canlı test sayılmadı; "iddia" olarak işaretlendi.
- Yıldız/çatal/commit sayıları yalnız depo metasıdır; başarı kanıtı olarak kullanılmadı.
- Autodesk resmî belgesi JavaScript ile render edildiği için doğrudan HTML yalnızca kabuk döndürdü. Belge metni, Autodesk URL'si üzerinden bir okuma proxy'si (`r.jina.ai`) ile alındı; kaynak yine Autodesk'in kendi help sayfasıdır. Bu, uygulamanın kendisinin test edildiği anlamına gelmez.
- Mac desteği ile ezdxf'in Mac'te çalışması ayrı şeylerdir; aşağıda ayrıca belirtildi.
- Bu rapor mimari seçim önermez; yalnızca kanıtlı karşılaştırma ve açık boşlukları sunar.

## Yönetici doğrulaması ve kapsam düzeltmesi

Codex, 2026-10-18: Aşağıdaki altı projelik araştırma bütün ekosistemi temsil etmez. Yönetici araştırması ayrıca Mac için ObjectARX tabanlı açık kaynak bir proje ve Windows/Mac desteği bildiren bir ürün buldu. Bu nedenle aşağıdaki "hiçbiri" ifadeleri yalnız görevdeki altı projeye aittir; piyasada Mac AutoCAD MCP yok sonucu çıkarılamaz. Kullanıcının netleştirdiği hedef iki sistemde de tam AutoCAD 2027 ve kurulabilir açık kaynak üründür. Mac işlemci mimarisi henüz belirtilmedi.

| Ek kaynak | Doğrulanan belge/kaynak kapsamı | Açık sınır |
|---|---|---|
| [chronista-club/autocad-mcp](https://github.com/chronista-club/autocad-mcp) | ObjectARX C++ eklentisi + Rust MCP + Unix socket; Mac Apple Silicon ve Intel destek beyanı; Windows planned. [LICENSE](https://raw.githubusercontent.com/chronista-club/autocad-mcp/main/LICENSE) MIT; [project.yml](https://github.com/chronista-club/autocad-mcp/blob/main/arx-plugin/project.yml) Mac bundle hedefliyor. | Canlı test çalıştırılmadı. README'deki tüm özellikler iddiası tam kapsam kanıtı değildir. [socket_bridge.cpp](https://github.com/chronista-club/autocad-mcp/blob/main/arx-plugin/socket_bridge.cpp) elle JSON ayrıştırıyor; ürün temeli olarak kullanmadan protokol, hata ve yaşam döngüsü denetimi gerekir. |
| [bimwright/dwg-mcp](https://github.com/bimwright/dwg-mcp) | Apache-2.0; sürüme özel AutoCAD .NET eklentileri + dış MCP sunucusu; yerel token doğrulaması ve pipe/TCP bağlantısı. | Windows odaklı; Mac .NET API desteği yok. Metin okuma, kümelendirme ve yeniden yazma ağırlıklı. Geliştiricinin kullanım istatistikleri bağımsız test sayılmadı. |
| [Control MCP paketi](https://www.npmjs.com/package/@dmytro-prototypes/cad-control-mcp-server) | Paket belgesinde AutoCAD 2025/2026/2027, Windows x64 ve Mac Apple Silicon, Claude/Codex/Cursor, komut/LISP/nesne düzenleme ve görünüm yakalama listeleniyor. Control eklentisi ve hesabı gerekiyor. | Paket lisansı SEE LICENSE IN LICENSE.txt; açık kaynak yeniden kullanım izni doğrulanmadı. Bu araştırmada kurulmadı. |
| [haianhdskt-boop/autocad-ai-mcp](https://github.com/haianhdskt-boop/autocad-ai-mcp) | Windows COM ve Mac AutoLISP/AppleScript destek beyanı; mimari çizim odaklı sekiz iş akışı. | README beyanı canlı uyumluluk testi değildir. Açık kaynak lisans izni doğrulanmadı; genel ObjectARX ürününün eşdeğeri sayılmadı. |

[Autodesk 2027 API tablosu](https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm) ObjectARX ve AutoLISP'i Windows/Mac için, .NET ve ActiveX'i Windows için listeler. [SDK sayfası](https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk) bütün API'lerin Mac'te bulunmadığını açıkça belirtir. API ve platform bazında özellik matrisi bu nedenle gereklidir.

Yönetici resmi MCP belgesini kendi web aracıyla ayrıca okudu: AutoCAD okuma/analiz, Civil 3D ek yazma araçları; desteklenen istemci Autodesk Assistant olarak belgelenmiş. Harici istemciler için belgelenmiş bağlantı burada doğrulanmadı; "teknik olarak yalnız bu istemci çalışabilir" sonucu çıkarılmadı.

## İlk altı kaynak için özet sonuç

1. **Görevdeki altı projenin hiçbirinde Windows ve macOS'ta canlı tam AutoCAD desteği belgelenmemiş.** Bu altı kaynakta canlı bağlantılar COM/ActiveX veya Win32 File IPC kullanıyor. ezdxf'in Mac'te çalışması canlı AutoCAD desteği değildir. Yukarıdaki ek kaynaklarda Mac için başka yollar vardır.
2. **Bu altı projenin araç kataloglarında tipli 3B katı modelleme kapsamı doğrulanmadı.** İncelenen kataloglar 2B çizim/inceleme ağırlıklı. Bu, keyfi LISP/komut yollarından 3B iş yapılamayacağı anlamına gelmez.
3. **Tam AutoCAD (Windows) için en geniş kapsam:** thewisekape (22 araç, ~130+ işlem iddiası) ve nguyenthanguth (109 araç iddiası). İkisinin de kapsamı bağımsız testle doğrulanmadı. Araç sayıları doğrudan kıyaslanamaz: puran/thewisekape konsolide araçlar, nguyenthanguth tekil araçlar sayıyor.
4. **Açık kaynak lisansı belgelenenler:** puran-water (MIT), thewisekape ve Slacker-LLC (Apache-2.0), nguyenthanguth (MIT; Autodesk interop DLL dağıtım koşulları ayrıca incelenmeli). **PabloDeCortes'te lisans dosyası doğrulanmadı**; yeniden kullanım izni netleştirilmeli.
5. **Olgunluk kanıtı zayıf:** Yalnız nguyenthanguth'un bir GitHub release'i var (v1.0.0). Diğerlerinde release/tag yok. En çok yıldız/commit puran-water'da (573 yıldız, 25 commit) ama bu başarı kanıtı değil.
6. **Rastgele LISP/C# erişimi tam kapsam değildir.** puran `execute_lisp`, Pablo `evaluate_lisp`, nguyenthanguth `execute_csharp_script`/`send_command` sunuyor; bunlar kaçış kapılarıdır, tipli ve güvenilir tam API değildir; ayrıca güvenlik riskidir.

## Karşılaştırma tablosu

| Proje | Bağlantı | Platform | 2B/3B | Lisans | Test/release kanıtı | Fork için özet |
|---|---|---|---|---|---|---|
| **puran-water/autocad-mcp** | File IPC (AutoLISP + Win32 `PostMessage`) + ezdxf headless; stdio | Windows 10/11 + AutoCAD LT 2024+ (belgelenen hedef); ezdxf her platformda ama AutoCAD yok | 2B; README'de LT için 3B işlemler desteklenmiyor | MIT (LICENSE + pyproject) | `tests/` var (ezdxf, IPC, screenshot); pytest yapılandırması var; release/tag yok; README v3.1 / pyproject 3.0.0 | MIT, temiz ve küçük; belgelenen hedef Windows LT, tam AutoCAD/Mac belgelenmemiş, 3B yok, tuş gönderme IPC'si kırılgan, P&ID için CTO kütüphanesi bağımlılığı |
| **thewisekape/autocad-mcp** | File IPC + COM + ezdxf; stdio | File IPC: Windows + LT 2024+; COM: Windows + AutoCAD 2018+/ZWCAD/GstarCAD/BricsCAD; ezdxf her platformda | 2B ağırlıklı; 3B araç yok | Apache-2.0 (LICENSE + pyproject) | `tests/` (8 test dosyası + yardımcılar), `pytest_output.txt`, kendi doğrulama raporu (COM, AutoCAD 2026, 2026-04-03); release yok; README v5.0 / pyproject 5.1.0 | En geniş araç seti ve çoklu CAD COM'u; genç/4 commit, miras kod, doğrulama kendi raporu, Windows'a bağlı, 3B yok |
| **PabloDeCortes/autocad-2026-mcp** | COM tetikleyici + AutoLISP köprüsü (PowerShell); stdio | Windows + AutoCAD 2026 | 2B (line/circle/arc/polyline/text/dimension) | **Lisans dosyası yok; `private: true`** | `test/` + `bun test`; release yok; 8 commit | Lisans yok → yeniden kullanım engeli; Windows 2026'ya kilitli; küçük araç seti; eşzamanlılık/timeout/undo desenleri iyi |
| **Slacker-LLC/autocad-mcp** | COM/ActiveX; stdio; sıralı COM çağrıları | Windows + tam AutoCAD 2026 (LT değil) | 2B; 3B solids "sonraki iş" olarak belirtilmiş | Apache-2.0 (LICENSE + pyproject) | `tests/test_acad_core.py` (COM sahtelenmiş); README'de canlı doğrulama 2026-08-15; release yok; 8 commit | Güvenlik/ölçü/test disiplini iyi; 2026'ya ve Windows'a kilitli; araç sayısı dar; 3B yok |
| **nguyenthanguth/MCP-AutoCAD-Csharp** | C# .NET 8 COM Interop; STA dispatcher; stdio | Windows + tam AutoCAD (LT desteklenmiyor) | Çoğunlukla 2B; `draw_3d_polyline` var, 3B katı modelleme yok | MIT LICENSE var; README "lisans yok" diyor (çelişki) | v1.0.0 release + zip (2026-07-17); `tests/` yok; 3 commit | 109 araç fikri zengin; keyfi C# ve `send_command` güvenlik riski; test yok; Autodesk interop DLL'leri yeniden dağıtılıyor |
| **Autodesk resmî (AutoCAD/Civil 3D MCP)** | Autodesk Assistant içinde yerel MCP; 7 araç | Windows + AutoCAD/Civil 3D; desteklenen tek istemci Autodesk Assistant | AutoCAD: salt okunur; Civil 3D: yazma; 2B/nesne ağırlıklı, 3B modelleme yok | Açık kaynak değil; Autodesk Tech Preview (Public Beta); belgeler CC BY-NC-SA 3.0 | Belgeler var; kamuya açık kaynak/test/release yok | Fork edilemez; istemciden bağımsız değil; Windows'a kilitli; şema-önce keşif/query deseni değerli |

## Proje ayrıntıları

### 1) puran-water/autocad-mcp

**Kaynaklar:** [README](https://github.com/puran-water/autocad-mcp), [pyproject.toml](https://raw.githubusercontent.com/puran-water/autocad-mcp/main/pyproject.toml), [LICENSE](https://raw.githubusercontent.com/puran-water/autocad-mcp/main/LICENSE), [file_ipc.py](https://raw.githubusercontent.com/puran-water/autocad-mcp/main/src/autocad_mcp/backends/file_ipc.py), [tests](https://github.com/puran-water/autocad-mcp/tree/main/tests), [releases](https://api.github.com/repos/puran-water/autocad-mcp/releases), [tags](https://api.github.com/repos/puran-water/autocad-mcp/tags).

- **Bağlantı:** İki backend ve 8 konsolide araç (`drawing`, `entity`, `layer`, `block`, `annotation`, `pid`, `view`, `system`). File IPC: Python JSON komut dosyası yazar, AutoCAD penceresine `(c:mcp-dispatch)` tuşlarını `PostMessageW(WM_CHAR)` ile gönderir, LISP sonucu dosyaya yazar, Python 100 ms aralıkla okur. ezdxf: AutoCAD'siz, bellekte DXF.
- **Platform:** File IPC `find_autocad_window()` içinde `sys.platform != "win32"` ise `None` döner; `pywin32` bağımlılığı Windows'a koşullu. README açıkça "Windows 10/11 + AutoCAD LT 2024+" diyor; **tam AutoCAD ve Mac için otomasyon belgelenmemiş.** **ezdxf backend'i macOS/Linux/WSL'de çalışır ama AutoCAD'i sürmez.** README ayrıca "AutoCAD LT for Mac ... does not support AutoLISP" diyor.
- **2B/3B:** Araç listesi 2B (line, circle, polyline, arc, ellipse, mtext, hatch, dimension, leader). README'nin LT uyumluluk tablosunda "3D operations" desteklenmiyor olarak işaretli. 3B modelleme yok.
- **Lisans:** MIT; `LICENSE` ve `pyproject.toml` (`license = "MIT"`) uyumlu.
- **Test/release:** `tests/` altında `test_ezdxf_backend.py`, `test_ipc_protocol.py`, `test_screenshot.py`, `conftest.py`, golden veriler var; pytest yapılandırması var. **Ancak release ve tag yok** (GitHub API boş). README "v3.1" derken `pyproject.toml` sürümü `3.0.0`; sürüm tutarsızlığı. Canlı AutoCAD testi kanıtı okunmadı; testler çalıştırılmadı.
- **Fork için yararlı:** MIT; küçük ve okunabilir Python; File IPC + headless ezdxf ayrımı net; undo/redo, screenshot, `execute_lisp` var; odak çalmayan gönderim ve tek uçuş kilidi (`asyncio.Lock`) düşünülmüş.
- **Fork için engel:** Belgelenen hedef Windows LT; tam AutoCAD ve Mac desteği belgelenmemiş; 3B yok; tuş gönderme tabanlı IPC komut istemi/odak durumuna duyarlı ve kırılgan; P&ID sembolleri için CAD Tools Online (CTO) kütüphanesi `C:\PIDv4-CTO\` bağımlılığı; `execute_lisp` keyfi kod çalıştırır (güvenlik); sürüm/release disiplini zayıf.

### 2) thewisekape/autocad-mcp

**Kaynaklar:** [README](https://github.com/thewisekape/autocad-mcp), [pyproject.toml](https://raw.githubusercontent.com/thewisekape/autocad-mcp/main/pyproject.toml), [LICENSE](https://raw.githubusercontent.com/thewisekape/autocad-mcp/main/LICENSE), [doğrulama raporu](https://raw.githubusercontent.com/thewisekape/autocad-mcp/main/MCP_VALIDATION_REPORT.md), [backend dizini](https://github.com/thewisekape/autocad-mcp/tree/main/src/autocad_mcp/backends), [tests](https://github.com/thewisekape/autocad-mcp/tree/main/tests), [releases](https://api.github.com/repos/thewisekape/autocad-mcp/releases).

- **Bağlantı:** Üç backend: File IPC (AutoLISP + Win32 `PostMessage`), COM (`win32com.client`), ezdxf. COM ile AutoCAD / ZWCAD / GstarCAD / BricsCAD hedefleniyor (`AUTOCAD_MCP_CAD_TYPE`).
- **Platform:** README tablosu: File IPC Windows + LT 2024+; COM Windows + AutoCAD 2018+ ve alternatif CAD'ler; ezdxf her platformda (AutoCAD'siz). **Mac AutoCAD yok.**
- **2B/3B:** 22 araç/~130+ işlem iddiası; araç kataloğu 2B çizim, düzenleme, katman, blok, ölçü, P&ID, xref, layout, elektrik, NLP, Excel. 3B katı/modelleme aracı yok.
- **Lisans:** Apache-2.0; `LICENSE` ve `pyproject.toml` uyumlu; `NOTICE` dosyası var. README'de puran-water, ngk0 ve AnCode666'ya atıf var. Test dosyalarından bazılarının SHA'ları puran-water ile aynı (ör. `tests/conftest.py`, `tests/test_ezdxf_backend.py`, `tests/test_ipc_protocol.py`); bu, kod/test mirasını destekliyor.
- **Test/release:** `tests/` altında 8 test dosyası ve yardımcılar; `pytest_output.txt`; `MCP_VALIDATION_REPORT.md` kendi beyanına göre 2026-04-03'te AutoCAD 2026 (25.1s) COM backend'iyle canlı doğrulama yapmış. **Bu bağımsız test değildir; biz doğrulamadık.** Release yok; README v5.0 / `pyproject.toml` 5.1.0 sürüm tutarsızlığı; yalnız 4 commit. Ayrıca README "~130+ operations" derken doğrulama raporu "~182 operations" stub'ından söz ediyor; sayım farkı doğrulanmadı.
- **Fork için yararlı:** En geniş 2B araç kataloğu; COM ile tam AutoCAD ve çoklu CAD; Apache-2.0; puran'ın File IPC'sini ve ezdxf'ini genişletiyor; `switch_backend` ve çoklu backend soyutlaması.
- **Fork için engel:** Genç ve küçük bir depo; doğrulama kendi raporu; COM'da birçok işlem "not supported" (rapora göre); Windows'a bağlı; 3B yok; Mac yok; release yok; kod tabanı büyük ölçüde miras.

### 3) PabloDeCortes/autocad-2026-mcp

**Kaynaklar:** [README](https://github.com/PabloDeCortes/autocad-2026-mcp), [package.json](https://raw.githubusercontent.com/PabloDeCortes/autocad-2026-mcp/main/package.json), [kök içerik](https://api.github.com/repos/PabloDeCortes/autocad-2026-mcp/contents/), [src](https://github.com/PabloDeCortes/autocad-2026-mcp/tree/main/src).

- **Bağlantı:** Effect + Bun/TypeScript. Her araç çağrısında istek dosyası yazılır; AutoCAD'e Windows PowerShell üzerinden COM (`AutoCAD.Application`) ile tek `SendCommand` gönderilir; AutoLISP eklentisi ifadeyi değerlendirip JSON yanıt yazar; sunucu yanıtı yoklar. Eklenti eksik/eskiyse otomatik yüklenir.
- **Platform:** README "Windows with AutoCAD 2026 running" diyor. PowerShell 5.1 zorunlu (`Marshal.GetActiveObject` PowerShell 7+'da yok). **Mac yok.**
- **2B/3B:** 2B araçlar: line, circle, arc, polyline, text, aligned dimension, `create_entities` (500'e kadar), entity list/get/erase/copy/move/rotate/scale, layer, block. 3B araç yok.
- **Lisans:** **Kök dizinde LICENSE görülmedi; `package.json` içinde `"private": true`, lisans alanı yok.** Açık kaynak ürünümüzde kodu yeniden kullanma/dağıtma izni doğrulanmadı; izin netleşmeden kod alınmamalı. GitHub üzerinde fork oluşturabilmek, açık kaynak dağıtım lisansı bulunduğu anlamına gelmez.
- **Test/release:** `test/` dizini ve `bun test` scripti var; release/tag yok; 8 commit; 0 yıldız.
- **Fork için yararlı:** COM tetikleyici + LISP köprüsünde eşzamanlı tetikleme/yanıt yoklaması, yanıt timeout'u, meşgul AutoCAD'de otomatik yeniden deneme, semafor ile sıralama ve her araç çağrısını tek undo grubuna alma desenleri iyi düşünülmüş; `create_entities` toplu çağrısı verimli.
- **Fork için engel:** Yeniden kullanım ve dağıtım lisansı doğrulanmadı; belgelenen hedef Windows 2026; tipli araçlar 2B ağırlıklı; `evaluate_lisp` keyfi kod çalıştırır; release kanıtı görülmedi.

### 4) Slacker-LLC/autocad-mcp

**Kaynaklar:** [README](https://github.com/Slacker-LLC/autocad-mcp), [pyproject.toml](https://raw.githubusercontent.com/Slacker-LLC/autocad-mcp/main/pyproject.toml), [server.json](https://raw.githubusercontent.com/Slacker-LLC/autocad-mcp/main/server.json), [tests](https://github.com/Slacker-LLC/autocad-mcp/tree/main/tests), [releases](https://api.github.com/repos/Slacker-LLC/autocad-mcp/releases).

- **Bağlantı:** Yalnız stdio MCP; çalışan AutoCAD 2026'ya Autodesk'in belgelenmiş ActiveX/COM API'siyle bağlanır. Uygulamayı başlatmaz; var olan oturuma bağlanır. COM çağrıları sıralıdır (AutoCAD tek iş parçacıklı).
- **Platform:** Windows + **tam AutoCAD 2026** (LT değil). **Mac yok.**
- **2B/3B:** README açıkça "This version targets 2D entities, dimensions, block insertion, layer/block/layout inspection, document lifecycle, and screenshot feedback" diyor; hatch, plotting, layout switching, xref, 3B solids "eklenebilir" olarak listelenmiş. 3B yok.
- **Lisans:** Apache-2.0; `pyproject.toml` ve README/LICENSE uyumlu; `NOTICE` var.
- **Test/release:** `tests/test_acad_core.py` (57 KB); README'ye göre COM yüzeyi sahtelenmiş, AutoCAD kurulu olmadan çalışır. README'de 2026-08-15'te canlı AutoCAD 2026 (25.1s, Çince UI) ile yapılan doğrulama anlatılıyor; **bu proje beyanıdır, bağımsız değildir.** GitHub release/tag yok; 8 commit; 3 yıldız. `server.json` PyPI `autocad-mcp` 0.1.0'a ve `limuzi013/autocad-mcp` kimliğine işaret ediyor; depo sahibi Slacker-LLC. Bu kimlik farkı doğrulanamadı.
- **Fork için yararlı:** Güvenlik modeli net: keyfi `run_command`/`SendCommand` yok; yazma yolları `ACAD_MCP_OUTPUT_ROOT` ile sınırlı; `.dxf` yazımı açıkça DXF türüyle yapılıyor; mm/derece sözleşmesi; `INSUNITS` dönüşümü; tip kütüphanesi yansımasıyla imza doğrulama; COM sahtelenmiş çevrimdışı testler; canlı doğrulamada bağımsız geri okuma.
- **Fork için engel:** Yalnız AutoCAD 2026 + Windows; 2B; araç sayısı dar; 3B/hatch/plot/xref yok; release yok; depo kimliği ile registry kimliği uyuşmuyor; Mac yok.

### 5) nguyenthanguth/MCP-AutoCAD-Csharp

**Kaynaklar:** [README](https://github.com/nguyenthanguth/MCP-AutoCAD-Csharp), [LICENSE](https://raw.githubusercontent.com/nguyenthanguth/MCP-AutoCAD-Csharp/main/LICENSE), [AutoCADScriptTools.cs](https://raw.githubusercontent.com/nguyenthanguth/MCP-AutoCAD-Csharp/main/MCPServerConsole/AutoCADScriptTools.cs), [MCPServerConsole](https://github.com/nguyenthanguth/MCP-AutoCAD-Csharp/tree/main/MCPServerConsole), [release v1.0.0](https://api.github.com/repos/nguyenthanguth/MCP-AutoCAD-Csharp/releases).

- **Bağlantı:** C# .NET 8 konsol MCP sunucusu; çalışan AutoCAD'e COM Interop ile bağlanır. Tüm COM çağrıları tek bir STA dispatcher iş parçacığından geçer; otomatik yeniden bağlanma var.
- **Platform:** Windows 10/11 + **tam AutoCAD**; README "AutoCAD LT is not supported (no COM automation)" diyor. **Mac yok.**
- **2B/3B:** 109 araç iddiası; çizgi, şekil, mimari semboller, düzenleme, blok, metin/ölçü, katman, sorgu, export, layout. `draw_3d_polyline` var; 3B katı modelleme/BOOLEAN yok; kapsam ağırlıklı 2B.
- **Lisans:** `LICENSE` MIT. Ancak README'nin sonunda "No license has been specified yet" yazıyor; **README ile LICENSE çelişiyor.** Autodesk interop DLL'leri için proje kodunun MIT lisansından ayrı dağıtım koşulları incelenmeli; yalnız dosyaların bulunmasından lisans ihlali sonucu çıkarılmadı.
- **Test/release:** GitHub'da v1.0.0 release'i ve `MCPServerConsole-v1.0.0.zip` (yaklaşık 9 MB) var (2026-07-17). **`tests/` dizini yok**; otomatik test kanıtı yok. 3 commit; 0 yıldız.
- **Fork için yararlı:** Araç kataloğu fikir vermesi açısından zengin (mimari semboller, batch, export, layout); STA dispatcher ve otomatik yeniden bağlanma deseni; handle tabanlı nesne takibi.
- **Fork için engel:** `execute_csharp_script` keyfi C# ve `send_command` keyfi AutoCAD komutu çalıştırır; güvenlik açısından yüksek risk. Test yok; Autodesk DLL yeniden dağıtımı hukuki risk; README/LICENSE çelişkisi; Windows + 2B; Mac/3B yok.

### 6) Autodesk resmî AutoCAD ve Civil 3D MCP sunucusu

**Kaynaklar:** [Ana belge](https://help.autodesk.com/view/ADSKMCP/ENU/?guid=ADSKMCP_AutoCADCivil3DMcp_autodesk_autocad_civil_3d_mcp_html), [araç belgesi](https://help.autodesk.com/view/ADSKMCP/ENU/?guid=autocadcivil3dmcp_tools), [MCP sunucu dizini](https://help.autodesk.com/view/ADSKMCP/ENU/) (7 araç, "Tech Preview (Public Beta)").

- **Bağlantı:** Autodesk Assistant içinde, uygulamanın içinde çalışan yerel MCP sunucusu. 7 araç: `discoverAutoCADTypes`, `queryAutoCADObjects`, `aggregateAutoCADObjects`, `manipulateDrawingCanvas`, `checkAutoCADObjects`, `updateAutoCADObjects` (Civil 3D), `civil3dQueryModifyStyles` (Civil 3D).
- **Platform:** Belgeler "AutoCAD and Civil 3D on Windows" diyor; Autodesk Assistant açık olmalı. **Mac yok.**
- **2B/3B:** AutoCAD tarafı **salt okunur**; yazma araçları Civil 3D'de. Nesne türleri line, circle, arc, text, mtext, polyline, dimension, layer, block ve Civil 3D alignment/surface/corridor/pipe. 3B katı modelleme aracı yok; Civil 3D surface slope güncellemesi var.
- **Lisans:** Açık kaynak değil; Autodesk Tech Preview (Public Beta). Belgeler CC BY-NC-SA 3.0. Kamuya açık kaynak deposu yok.
- **Test/release:** Resmî belge var; kamuya açık test paketi/release yok. Uygulama canlı test edilmedi.
- **Fork için yararlı:** Şema-önce keşif (`discoverAutoCADTypes` → `queryAutoCADObjects` → `aggregateAutoCADObjects` → eylem) deseni; nesne türü/alan şeması ve filtre sözdizimi; resmî ürünün yetenek sınırını göstermesi.
- **Yeniden kullanım sınırı:** Kamuya açık açık kaynak kod deposu doğrulanmadı; belgede desteklenen istemci Autodesk Assistant. Claude/Codex bağlantı yöntemi doğrulanmadı. Belgelenen AutoCAD araçları okuma/analiz odaklı; Windows ve Tech Preview kapsamı var.

## Kesit bulgular

### Mac durumu

- puran-water ve thewisekape'de ezdxf backend'i macOS'ta çalışır; **bu yalnızca DXF dosyası üretmek/okumak demektir, AutoCAD oturumunu sürmek değildir.**
- puran-water README'si "AutoCAD LT for Mac ... does not support AutoLISP" diyor; File IPC de Win32 `PostMessage` kullanıyor (`sys.platform != "win32"` → `None`). Yani bu yol Mac'te çalışmaz.
- Diğer projeler COM/ActiveX veya Windows PowerShell tabanlıdır; hiçbiri macOS AutoCAD otomasyonu belgelemiyor.
- **Sonuç:** Bu bölümdeki ilk altı kaynakta canlı Mac AutoCAD otomasyonu belgelenmemiş. Yönetici doğrulamasında bulunan Mac ObjectARX ve AppleScript projeleri yukarıda ayrıca listelenmiştir.

### 3B durumu

- puran-water: LT uyumluluk tablosunda 3B işlemler desteklenmiyor.
- thewisekape: araç kataloğunda 3B modelleme yok.
- PabloDeCortes: yalnız 2B entities.
- Slacker-LLC: README açıkça 2B; 3B solids "eklenebilir" diyor.
- nguyenthanguth: `draw_3d_polyline` var ama 3B katı modelleme/BOOLEAN yok.
- Autodesk resmî: 3B modelleme aracı belgelenmemiş; Civil 3D nesne sorgusu var.
- **Sonuç:** İlk altı kaynağın tipli araç kataloglarında kapsamlı 3B katı oluşturma/düzenleme doğrulanmadı; serbest komut/LISP erişimi ayrı değerlendirilmelidir.

### Bağlantı yöntemleri

| Yöntem | Kullananlar | Artı | Eksi |
|---|---|---|---|
| File IPC + AutoLISP | puran, thewisekape, Pablo (COM tetikleyicili) | LT'de çalışır; AutoCAD içinde geniş erişim; odak çalmayan gönderme mümkün | Windows'a bağlı; tuş/dosya zamanlaması kırılgan; LISP güvenliği; Mac yok |
| COM/ActiveX | thewisekape, Slacker, nguyenthanguth, Pablo (tetikleyici) | Tam AutoCAD'de zengin nesne modeli; tipli API | Windows'a bağlı; tek iş parçacıklı; sürüm/type-library bağımlılığı; Mac yok |
| ezdxf (headless) | puran, thewisekape | Platformdan bağımsız; AutoCAD gerekmez | AutoCAD değil; canlı oturum/3B modelleme yok; sınırlı DXF |

### Güvenlik ve güvenilirlik

- **Keyfi kod yüzeyleri:** puran `execute_lisp`, Pablo `evaluate_lisp`, nguyenthanguth `execute_csharp_script` + `send_command`. Bunlar "her şeyi yapar" gibi görünse de tipli, test edilmiş, sürümler arası kararlı bir API değildir; hata ayıklama, undo, doğrulama ve güvenlik açısından risklidir.
- **Slacker-LLC** bilinçli olarak keyfi komut aracı sunmuyor ve yazma yollarını çıktı köküne sınırlıyor; bu, güvenilir ürün için iyi bir referans.
- **PabloDeCortes** meşgul AutoCAD, timeout, eşzamanlılık ve undo grubu konularını düşünmüş; ancak lisansı yok.
- **thewisekape** ve **nguyenthanguth** geniş yüzey sunuyor; ikisinde de bağımsız test kanıtı zayıf.

### Lisans özeti

| Proje | Lisans | Fork/dağıtım notu |
|---|---|---|
| puran-water | MIT | En rahat; atıf korunmalı |
| thewisekape | Apache-2.0 | Uygun; NOTICE ve değişiklik bildirimi korunmalı |
| Slacker-LLC | Apache-2.0 | Uygun; NOTICE ve değişiklik bildirimi korunmalı |
| nguyenthanguth | MIT (README çelişkili) | MIT uygun görünüyor; ancak Autodesk interop DLL'leri ayrıca Autodesk lisansına tabi |
| PabloDeCortes | Lisans yok | **Yeniden kullanım/dağıtım için izin yok** |
| Autodesk resmî | Tescilli / Tech Preview | Fork edilemez; belgeler CC BY-NC-SA 3.0 |

## Açık belirsizlikler / doğrulanmayanlar

- **Canlı AutoCAD testi yok.** Hiçbir proje kurulmadı, hiçbir MCP istemcisi bağlanmadı, hiçbir çizim açılmadı.
- **Test paketleri çalıştırılmadı.** "Test var" yalnızca dosya/readme kanıtıdır; "test geçti" değildir.
- **thewisekape doğrulama raporu** ve **Slacker canlı doğrulama** proje beyanıdır; bağımsız tekrar yok.
- **Autodesk belgeleri** JS render nedeniyle okuma proxy'siyle alındı; doğrudan HTML yalnızca "Help" kabuğu döndü. Belge içeriği Autodesk sayfasına aittir; proxy yalnızca metni görünür kıldı.
- **Sürüm tutarsızlıkları:** puran README v3.1 / pyproject 3.0.0; thewisekape README v5.0 / pyproject 5.1.0; nguyenthanguth README "lisans yok" / LICENSE MIT. thewisekape'de README "~130+ operations" / doğrulama raporu "~182 operations" farkı da doğrulanmadı.
- **Slacker kimlik farkı:** Depo `Slacker-LLC/autocad-mcp`; `server.json`, `pyproject.toml` ve README `limuzi013/autocad-mcp`'ye işaret ediyor. Bu farkın nedeni (fork/transfer) doğrulanmadı.
- **Pablo lisansı:** Kökte LICENSE yok; alt dizinlerde de lisans dosyası görülmedi. Bu, "lisans yok" tespitidir; gizli bir izin olduğu iddia edilmiyor.
- **Mac AutoCAD:** İlk altı kaynakta macOS canlı otomasyonu belgelenmemiş; ek kaynaklarda Mac desteği beyanı ve ObjectARX kaynak kodu vardır. Bu araştırmada Mac testi çalıştırılmadı.
- **3B:** Hiçbir projede 3B katı modelleme aracı görülmedi; `draw_3d_polyline` gibi tek araçlar 3B modelleme sayılmadı.
- **Yıldız/çatal/commit sayıları** 2026-10-18 anlık görüntüsüdür; başarı kanıtı değildir.

## Kaynak listesi

- https://github.com/puran-water/autocad-mcp
- https://raw.githubusercontent.com/puran-water/autocad-mcp/main/pyproject.toml
- https://raw.githubusercontent.com/puran-water/autocad-mcp/main/LICENSE
- https://raw.githubusercontent.com/puran-water/autocad-mcp/main/src/autocad_mcp/backends/file_ipc.py
- https://github.com/puran-water/autocad-mcp/tree/main/tests
- https://api.github.com/repos/puran-water/autocad-mcp/releases
- https://api.github.com/repos/puran-water/autocad-mcp/tags
- https://github.com/thewisekape/autocad-mcp
- https://raw.githubusercontent.com/thewisekape/autocad-mcp/main/pyproject.toml
- https://raw.githubusercontent.com/thewisekape/autocad-mcp/main/LICENSE
- https://raw.githubusercontent.com/thewisekape/autocad-mcp/main/MCP_VALIDATION_REPORT.md
- https://github.com/thewisekape/autocad-mcp/tree/main/src/autocad_mcp/backends
- https://github.com/thewisekape/autocad-mcp/tree/main/tests
- https://api.github.com/repos/thewisekape/autocad-mcp/releases
- https://github.com/PabloDeCortes/autocad-2026-mcp
- https://raw.githubusercontent.com/PabloDeCortes/autocad-2026-mcp/main/package.json
- https://api.github.com/repos/PabloDeCortes/autocad-2026-mcp/contents/
- https://github.com/PabloDeCortes/autocad-2026-mcp/tree/main/src
- https://github.com/Slacker-LLC/autocad-mcp
- https://raw.githubusercontent.com/Slacker-LLC/autocad-mcp/main/pyproject.toml
- https://raw.githubusercontent.com/Slacker-LLC/autocad-mcp/main/server.json
- https://github.com/Slacker-LLC/autocad-mcp/tree/main/tests
- https://api.github.com/repos/Slacker-LLC/autocad-mcp/releases
- https://github.com/nguyenthanguth/MCP-AutoCAD-Csharp
- https://raw.githubusercontent.com/nguyenthanguth/MCP-AutoCAD-Csharp/main/LICENSE
- https://raw.githubusercontent.com/nguyenthanguth/MCP-AutoCAD-Csharp/main/MCPServerConsole/AutoCADScriptTools.cs
- https://github.com/nguyenthanguth/MCP-AutoCAD-Csharp/tree/main/MCPServerConsole
- https://api.github.com/repos/nguyenthanguth/MCP-AutoCAD-Csharp/releases
- https://help.autodesk.com/view/ADSKMCP/ENU/?guid=ADSKMCP_AutoCADCivil3DMcp_autodesk_autocad_civil_3d_mcp_html
- https://help.autodesk.com/view/ADSKMCP/ENU/?guid=autocadcivil3dmcp_tools
- https://help.autodesk.com/view/ADSKMCP/ENU/
