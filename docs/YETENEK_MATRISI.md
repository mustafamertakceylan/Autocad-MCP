# Yetenek matrisi (ilk plan)

> Durum: 2026-10-18 ilk plan. Bu tabloda **hiçbir modül uygulanmadı** ve **hiçbir gerçek AutoCAD testi çalıştırılmadı.** Tablo ürün vaadi değil; planlama ve kanıt takibi aracıdır.

İlgili belgeler: [Plan](PLAN.md), [Kararlar](KARARLAR.md), [Araştırma](arastirma/MEVCUT_COZUMLER_2026-10-18.md).

## Okuma anahtarı

| Kısaltma | Anlam |
|---|---|
| `[W]` | Windows 2027: ObjectARX/AutoLISP ve .NET/ActiveX genel API'leri Autodesk tablosunda belgeli. Bu tablodaki modülün özellik düzeyi **uygulanmadı ve doğrulanmadı.** |
| `[M]` | macOS 2027: ObjectARX/AutoLISP genel API'leri belgeli; Autodesk SDK sayfası tüm API'lerin Mac'te bulunmadığını belirtir. Bu tablodaki modülün özellik düzeyi **uygulanmadı ve doğrulanmadı.** |
| `[T]` | Gerçek test: **çalıştırılmadı.** |
| Aşama | [PLAN.md](PLAN.md) aşamaları: 1 Envanter, 2 İki platformda 2B+3B teknik deneme, 3 Güvenilir inceleme/düzenleme, 4 İlk kullanılabilir sürüm, 5 İleri modüller, 6 Temiz cihazda dağıtım. |

Genel API'nin belgeli olması, o modülün ilgili platformda çalıştığı anlamına gelmez. Platform API ayrıntılarında kesin uyumluluk iddia edilmez; her hücre canlı testle doğrulanana kadar "doğrulanmadı" kalır.

## Matris

| Modül | Örnek işlemler | Windows 2027 | Mac 2027 | Gerçek test | Aşama | Not |
|---|---|---|---|---|---|---|
| Bağlantı | Instance keşfi, el sıkışma, sürüm/yetenek doğrulama, yeniden bağlanma | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 2 → 4 | Named pipe/Unix socket önerisi; protokol ve sürüm denetimi tasarım gereği. |
| Belge | Belge listesi, aktif belge, açma/kaydetme/kapatma, salt okunur ve birim bilgisi | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 2 → 3 | Kaydetme/kapatma yan etkileri transaction dışına taşabilir. |
| Sorgu | Handle ile nesne, filtreli seçim, özellikler, sınır kutusu, katman/blok/xref envanteri | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 3 | Handle kimliği, birim ve koordinat bağlamı doğrulanmalı. |
| 2B | Çizgi, daire, yay, polyline, elips, spline oluşturma/okuma/güncelleme | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 2 → 4 | Geometri, birim ve koordinat dönüşümü test edilmeli. |
| Düzenleme | Taşıma, kopyalama, döndürme, ölçekleme, ayna, offset, trim/extend, silme, özellik değiştirme | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 3 → 4 | Undo grubu ve geri okuma zorunlu; kısmi uygulama ayrı durum. |
| Katman-stil | Katman oluşturma/yeniden adlandırma, renk, çizgi tipi, kalınlık, açma/kapama, kilit; yazı/ölçü stilleri | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 4 | Stil bağımlılıkları ve ölçek davranışı doğrulanmalı. |
| Blok | Blok tanımı, ekleme, nitelikler, iç içe bloklar | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 4 → 5 | Dinamik bloklar ayrı kapsam önerisi. |
| Açıklama | Metin/mtext, ölçülendirme, leader/multileader, tablo (ileri) | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 4 | Ölçü stili ve ölçek platform farkı gösterebilir. |
| 3B | Katı ilkel nesneler, extrude/revolve, boolean, 3B polyline; yüzey/mesh ileri | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 2 (deneme) → 5 (ileri) | Ürün kapsamı açık; 3B polyline tek başına katı modelleme sayılmaz. |
| Görünüm-layout-PDF | Zoom/görünüm, viewport, layout, page setup, plot/PDF, görsel stil | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Plot/PDF aygıt ve kâğıt ayarları platforma göre değişebilir. |
| Xref-veri | Xref ekleme/çıkarma/yenileme, veri çıkarımı, alanlar, dış tablolar | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Yol çözümleme ve eksik xref davranışı test edilmeli. |
| Otomasyon | Toplu işlem, komut dizisi, LISP değerlendirme (öneri) | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Yüksek risk; varsayılan kapalı önerisi; LISP sandbox değil. |

## Platform API notları

- **Windows 2027:** Autodesk 2027 API tablosu ObjectARX, AutoLISP, .NET ve ActiveX'i Windows için listeler. Bu, modül bazında özellik desteği kanıtı değildir.
- **macOS 2027:** Aynı tablo ObjectARX ve AutoLISP'i macOS için listeler; .NET ve ActiveX'i listelemez. ObjectARX SDK sayfası tüm API'lerin Mac'te bulunmadığını açıkça belirtir. Modül bazında alt küme doğrulanmalıdır.
- **Mimari:** Mac işlemci mimarisi belirtilmedi; derleme/paketleme/test kapsamı bu karara bağlıdır.
- **Canlı test:** Hiçbir platformda AutoCAD 2027 bağlantısı kurulmadı; hiçbir modül denenmedi.

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
