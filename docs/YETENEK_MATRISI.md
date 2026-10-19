# Yetenek matrisi

> Durum: 2026-10-18 ilk plan. Windows prototipinin kanıtlı alt kümesi aşağıdaki tabloda ayrıldı. Mac uygulanmadı; Faz5 güncellemesi ayrı tabloda; Windows kanıtı Core Console ve görünür masaüstü Faz 2–4 kabulünü (Faz 3: 56 kontrol; Faz 4: Codex/OpenCode model pilotu) kapsar; bütün ürün özellikleri değildir. Tablo ürün vaadi değil; planlama ve kanıt takibi aracıdır.

İlgili belgeler: [Plan](PLAN.md), [Kararlar](KARARLAR.md), [Araştırma](arastirma/MEVCUT_COZUMLER_2026-10-18.md). Aşama sütunu güncel Windows hattıdır; Mac sütunu ayrı Faz M kabulüne aittir ve Windows ilerlemesini engellemez.

## Okuma anahtarı

| Kısaltma | Anlam |
|---|---|
| `[W]` | Windows 2027: ObjectARX/AutoLISP ve .NET/ActiveX genel API'leri Autodesk tablosunda belgeli. Genel API desteği tek başına özellik kanıtı değildir; Windows alt kümesi ayrı kanıtlıdır. |
| `[M]` | macOS 2027: ObjectARX/AutoLISP genel API'leri belgeli; Autodesk SDK sayfası tüm API'lerin Mac'te bulunmadığını belirtir. Bu tablodaki modülün özellik düzeyi **uygulanmadı ve doğrulanmadı.** |
| `[T]` | Genel ürün modülü için **çalıştırılmadı**; özel kanıtlı alt küme ayrı belirtilir. |
| Aşama | [PLAN.md](PLAN.md) aşamaları: 1 Envanter, 2 İki platformda 2B+3B teknik deneme, 3 Güvenilir inceleme/düzenleme, 4 İlk kullanılabilir sürüm, 5 İleri modüller, 6 Temiz cihazda dağıtım. |

Genel API'nin belgeli olması, o modülün ilgili platformda çalıştığı anlamına gelmez. Platform API ayrıntılarında kesin uyumluluk iddia edilmez; her hücre canlı testle doğrulanana kadar "doğrulanmadı" kalır.

İşlem düzeyindeki belge kanıtı [özellik envanterinde](OZELLIK_ENVANTERI.md) tutulur. İlk araştırma kapsamındaki geniş modüller ile aşağıdaki prototip alt kümesi ayrıdır; API adayı bulunması canlı doğrulama değildir. İlk araç ve test taslakları: [iletişim sözleşmesi](ILETISIM_SOZLESMESI.md), [teknik deneme kabulü](TEKNIK_DENEME_KABUL.md).

## Güncel Windows Faz 5 alt kümesi — 2026-10-19

Yeni normal OFF modül `build/phase5-native` altında 52 araç içerir. [Faz 5 kabul tablosu](TEKNIK_DENEME_KABUL.md#9-faz-5-windows-paket-kabulleri) güncel kanıttır; aşağıdaki ilk plan tablosu Faz 2–4 tarihçesidir, Faz 5 kapsamını geçersiz kılmaz.

| Paket | Uygulanan Windows 2027 alt küme | Sınır |
|---|---|---|
| Teknik resim | Katman/ACI/kalınlık, text/dimension/linetype stilleri; TEXT/MTEXT, ölçü/sapma | Non-associative ölçü, açık sapma; otomatik geçme seçimi yok |
| İleri2B | ARC/LWPOLYLINE, transform/dizi, offset/trim/LINE extend/fillet/chamfer | WCS XY ve açık seçim; eğri türü sınırları şemalarda |
| Blok/veri | Define/insert/get/attributes, BOM ve native TABLE | Yerel planar tanım; nested BOM yok |
| Katı/mekanik | Extrude/revolve/boolean, gerçek delik/havşa/kademeli delik, mil, section REGION, HATCH, FCF, kütle | Açık geometri/yoğunluk; FCF görsel bounds unavailable; ISO/FEA/CAM iddiası yok |
| Pafta | Modelspace kamera, ölçekli layout/viewport, iki izinli PDF aygıtı | Kâğıt mm; fiziksel yazıcı ve overwrite yok |
| Xref | Staged DWG attach/overlay, list/reload/unload/bind/detach | Özel input kökü, nested/dependency preflight, tüm direct model refs açık; dosya yazılmaz |
| Otomasyon | En fazla24 typed create adımı, atomik rollback, tek revision/ID | Her alt araç ayrıca izinli; keyfi komut/LISP yok |

Mac bu satırların hiçbirinde derlenmedi/test edilmedi. Güncel52 araç doğrudan MCP SDK istemcisiyle native Core Console testindedir; Faz4 model pilotları tarihî14 araç alt kümesidir.

## İlk plan / Faz 2–4 tarihçesi

| Modül | Örnek işlemler | Windows 2027 | Mac 2027 | Gerçek test | Aşama | Not |
|---|---|---|---|---|---|---|
| Bağlantı | Instance keşfi, el sıkışma, sürüm/yetenek doğrulama, yeniden bağlanma | Named pipe/stdio; 14 araç, HMAC eşleştirme; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 → 4 | Keşif/durum/yetenek; yeniden bağlanma yaşam döngüsü kapsamlı sınanmadı. |
| Belge | Belge listesi, aktif belge, açma/kaydetme/kapatma, salt okunur ve birim bilgisi | Belge listesi/bilgisi, epoch/revision/INSUNITS, ayrı kopya; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 → 3 | Test yardımcılarıyla sentetik belge kapat/aç ve çoklu sekme/context geçti; genel belge açma/kapatma MCP aracı yok. |
| Sorgu | Handle ile nesne, filtreli seçim, özellikler, sınır kutusu, katman/blok/xref envanteri | Modelspace LINE/CIRCLE/3DSOLID, handle/projeksiyon/cursor; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 3 | Sayfalama ve eski cursor reddi geçti; blok/xref envanteri yok. |
| 2B | Çizgi, daire, yay, polyline, elips, spline oluşturma/okuma/güncelleme | Çizgi ve WCS XY çember oluşturma/okuma; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 → 4 | Yay, polyline, elips, spline yok. |
| Düzenleme | Taşıma, kopyalama, döndürme, ölçekleme, ayna, offset, trim/extend, silme, özellik değiştirme | Taşıma ve silme; ayrı işlem UNDO; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 3 → 4 | Diğer düzenleme komutları yok; kutu yazması yalnız bridge-created nesne. |
| Katman-stil | Katman oluşturma/yeniden adlandırma, renk, çizgi tipi, kalınlık, açma/kapama, kilit; yazı/ölçü stilleri | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Stil bağımlılıkları ve ölçek davranışı doğrulanmalı. |
| Blok | Blok tanımı, ekleme, nitelikler, iç içe bloklar | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Dinamik bloklar ayrı kapsam önerisi. |
| Açıklama | Metin/mtext, ölçülendirme, leader/multileader, tablo (ileri) | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Ölçü stili ve ölçek platform farkı gösterebilir. |
| 3B | Katı ilkel nesneler, extrude/revolve, boolean, 3B polyline; yüzey/mesh ileri | Eksenlere paralel kutu; hacim/merkez/extents okuma; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 (deneme) → 5 (ileri) | Extrude/revolve/boolean/yüzey/mesh yok. |
| Görünüm-layout-PDF | Zoom/görünüm, viewport, layout, page setup, plot/PDF, görsel stil | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Plot/PDF aygıt ve kâğıt ayarları platforma göre değişebilir. |
| Xref-veri | Xref ekleme/çıkarma/yenileme, veri çıkarımı, alanlar, dış tablolar | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Yol çözümleme ve eksik xref davranışı test edilmeli. |
| Otomasyon | Toplu işlem, komut dizisi, LISP değerlendirme (öneri) | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Yüksek risk; varsayılan kapalı önerisi; LISP sandbox değil. |

## İstemci pilotu — Faz 4

Windows AutoCAD 2027 normal modülüyle Codex CLI 0.160.0 ve OpenCode 1.18.34 / EVREN MiMo V2.6 Pro gerçek model akışı geçti. 20 LINE + 1 CIRCLE profil (80×40 mm, Ø10), sorgu, taşıma/geri taşıma, geçici nesne oluştur/sil ve iki ayrı DWG kaydı/reopen doğrulandı. Pilot configure/doctor/pair ve Codex/Claude/OpenCode skill dosyaları hazır. Claude canlı modeli limit yokluğu nedeniyle **çalıştırılmadı**; statik config/skill kontrolü uygulandı. Başka istemciler için genel uyumluluk veya temiz cihaz iddiası yok. Kanıt: [W-phase4 kabulü](TEKNIK_DENEME_KABUL.md); kurulum: [pilot rehberi](PILOT_KURULUM.md).

## Faz 6 Windows özel paket — 2026-10-19

| Alan | Kanıtlı durum | Sınır |
|---|---|---|
| Windows x64 / tam AutoCAD2027 | Güncel preview6: paket içi Node24, normal ARX ve tepsi EXE'si; ZIP kurulum/gerçek MCP çizim/kayıt/reopen28/28; native338/338 | Geliştirme bilgisayarı; ayrı temiz VM değildir |
| Durum / sistem tepsisi | Preview10: kırmızı tema/özgün EXE-tepsi logosu; AutoCAD ve MCP için numaralı Kurulum rehberi, istemci seçimi ve komut kopyalama/yapıştırma görüldü. Preview7'de gerçek AutoCAD Bağlan,52 araç/1 MCP, istemci üretimi, Tab/Space ve tepsiye gizle/aynı pencere kabulü | Preview10'da önceki canlı CAD/kurulum testleri tekrarlanmadı; ARX/server/Node/installer aynı. Tepsi sağ tık/Explorer restart/temiz cihaz açık |
| Yeniden bağlantı | Aynı açık MCP transportuyla AutoCAD restart ve iki hostta açık seçim23/23; kuyruktaki eski hedef retleri ortak testte | Sessiz otomatik hedef seçimi yok; model yeni instance/belgeyi keşfeder |
| Windows açılışında başlatma | Varsayılan kapalı seçenek, `--tray`, kendi kayıt sahipliği8 sentetik registry kontrolünde | Gerçek Run kaydı/reboot/Start menüsü kurulumu denenmedi |
| Kurulum yaşam döngüsü | Yükseltme, önceki sürümü koruma, geri alma, veri silmeden kaldırma, kesinti kurtarma, hash/junction/kilit ve native kimlik retleri | Gerçek yeni ürün sürümü değil, ikinci sentetik paket aynı ikililerle denenmiştir |
| Codex/Claude Code/OpenCode config ve mevcut skill | Kurulu runtime yoluna üretim ve üç sabit resource kabulü | Yeni teknik resim doğruluğu skill'i ertelendi; Claude canlı modeli çalıştırılmadı |
| AutoCAD bundle autoload | Win64/AutoCAD/R26.0 manifesti üretildi | Otomatik yükleme/güven ekranı temiz cihazda çalıştırılmadı |
| İmzalama/genel yayın | Node imzası Valid, ARX/tepsi EXE NotSigned; yayın kapısı kapalı | Proje lisansı ve dağıtım onayı yok; Mac ayrı Faz M |

Kanıtlar [Faz6 kabulünde](TEKNIK_DENEME_KABUL.md#11-faz-6--windows-özel-zip-ve-kurulum-yaşam-döngüsü); kullanım [Windows kurulumunda](WINDOWS_KURULUM.md).

## Platform API notları

- **Windows 2027:** Autodesk 2027 API tablosu ObjectARX, AutoLISP, .NET ve ActiveX'i Windows için listeler. Bu, modül bazında özellik desteği kanıtı değildir.
- **macOS 2027:** Aynı tablo ObjectARX ve AutoLISP'i macOS için listeler; .NET ve ActiveX'i listelemez. ObjectARX SDK sayfası tüm API'lerin Mac'te bulunmadığını açıkça belirtir. Modül bazında alt küme doğrulanmalıdır.
- **Mimari:** Kullanıcı Mac'in Apple Silicon (M serisi) olduğunu belirtti; ilk Mac test hedefi arm64. Intel/universal paketler ayrıca kararlaştırılacak.
- **Canlı test:** Windows AutoCAD 2027 Core Console X.60.0.0, stok şablon kopyaları, 2026-10-18. Mm/metre için 30+30, birimsiz için 9 kontrol geçti; kanıt ve açık kapılar [kabul belgesinde](TEKNIK_DENEME_KABUL.md). Ek olarak görünür Windows masaüstünde 26 kontrol geçti; Mac çalıştırılmadı.

## Güncelleme kuralı

- Bir hücre ancak şu kanıtla güncellenir: tarih, platform, AutoCAD sürümü, test çizimi, çalıştırılan işlem ve gerçek çıktı.
- Bir platformdaki sonuç diğerine genellenmez.
- Genel API belgesi "uygulandı" veya "canlı test edildi" sayılmaz.
- Desteklenmeyen özellik açıkça `desteklenmiyor` olarak yazılır; boş veya tahmini hücre bırakılmaz.
- Matris her canlı testten sonra güncellenir; ürün iddiası yalnız kanıtlı satırlara dayanır.

## Kaynaklar

- Autodesk 2027 API tablosu: <https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm>
- ObjectARX/AutoCAD SDK genel bakış: <https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk>
- [Mevcut çözümler araştırması](arastirma/MEVCUT_COZUMLER_2026-10-18.md)
- [Plan](PLAN.md) ve [Kararlar](KARARLAR.md)
