# Yetenek matrisi (ilk plan)

> Durum: 2026-10-18 ilk plan. Windows prototipinin kanıtlı alt kümesi aşağıdaki tabloda ayrıldı. Mac ve diğer özellikler uygulanmadı; Windows kanıtı Core Console ile sınırlıdır. Tablo ürün vaadi değil; planlama ve kanıt takibi aracıdır.

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

## Matris

| Modül | Örnek işlemler | Windows 2027 | Mac 2027 | Gerçek test | Aşama | Not |
|---|---|---|---|---|---|---|
| Bağlantı | Instance keşfi, el sıkışma, sürüm/yetenek doğrulama, yeniden bağlanma | Named pipe/stdio; 14 araç, HMAC eşleştirme; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 → 4 | Keşif/durum/yetenek; yeniden bağlanma yaşam döngüsü kapsamlı sınanmadı. |
| Belge | Belge listesi, aktif belge, açma/kaydetme/kapatma, salt okunur ve birim bilgisi | Belge listesi/bilgisi, epoch/revision/INSUNITS, ayrı kopya; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 → 3 | Açma/kapatma ve çoklu sekme testi yok. |
| Sorgu | Handle ile nesne, filtreli seçim, özellikler, sınır kutusu, katman/blok/xref envanteri | Modelspace LINE/CIRCLE/3DSOLID, handle/projeksiyon/cursor; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 3 | Sayfalama ve eski cursor reddi geçti; blok/xref envanteri yok. |
| 2B | Çizgi, daire, yay, polyline, elips, spline oluşturma/okuma/güncelleme | Çizgi ve WCS XY çember oluşturma/okuma; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 → 4 | Yay, polyline, elips, spline yok. |
| Düzenleme | Taşıma, kopyalama, döndürme, ölçekleme, ayna, offset, trim/extend, silme, özellik değiştirme | Taşıma ve silme; ayrı işlem UNDO; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 3 → 4 | Diğer düzenleme komutları yok; kutu yazması yalnız bridge-created nesne. |
| Katman-stil | Katman oluşturma/yeniden adlandırma, renk, çizgi tipi, kalınlık, açma/kapama, kilit; yazı/ölçü stilleri | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 4 | Stil bağımlılıkları ve ölçek davranışı doğrulanmalı. |
| Blok | Blok tanımı, ekleme, nitelikler, iç içe bloklar | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 4 → 5 | Dinamik bloklar ayrı kapsam önerisi. |
| Açıklama | Metin/mtext, ölçülendirme, leader/multileader, tablo (ileri) | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 4 | Ölçü stili ve ölçek platform farkı gösterebilir. |
| 3B | Katı ilkel nesneler, extrude/revolve, boolean, 3B polyline; yüzey/mesh ileri | Eksenlere paralel kutu; hacim/merkez/extents okuma; prototip | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Windows Core Console, mm/m/birimsiz; kabul kanıtı | 2 (deneme) → 5 (ileri) | Extrude/revolve/boolean/yüzey/mesh yok. |
| Görünüm-layout-PDF | Zoom/görünüm, viewport, layout, page setup, plot/PDF, görsel stil | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Plot/PDF aygıt ve kâğıt ayarları platforma göre değişebilir. |
| Xref-veri | Xref ekleme/çıkarma/yenileme, veri çıkarımı, alanlar, dış tablolar | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Yol çözümleme ve eksik xref davranışı test edilmeli. |
| Otomasyon | Toplu işlem, komut dizisi, LISP değerlendirme (öneri) | Uygulanmadı; modül API'si doğrulanmadı `[W]` | Uygulanmadı; modül API'si doğrulanmadı `[M]` | Çalıştırılmadı `[T]` | 5 | Yüksek risk; varsayılan kapalı önerisi; LISP sandbox değil. |

## Platform API notları

- **Windows 2027:** Autodesk 2027 API tablosu ObjectARX, AutoLISP, .NET ve ActiveX'i Windows için listeler. Bu, modül bazında özellik desteği kanıtı değildir.
- **macOS 2027:** Aynı tablo ObjectARX ve AutoLISP'i macOS için listeler; .NET ve ActiveX'i listelemez. ObjectARX SDK sayfası tüm API'lerin Mac'te bulunmadığını açıkça belirtir. Modül bazında alt küme doğrulanmalıdır.
- **Mimari:** Kullanıcı Mac'in Apple Silicon (M serisi) olduğunu belirtti; ilk Mac test hedefi arm64. Intel/universal paketler ayrıca kararlaştırılacak.
- **Canlı test:** Windows AutoCAD 2027 Core Console X.60.0.0, stok şablon kopyaları, 2026-10-18. Mm/metre için 30+30, birimsiz için 9 kontrol geçti; kanıt ve açık kapılar [kabul belgesinde](TEKNIK_DENEME_KABUL.md). Mac ve masaüstü UI çalıştırılmadı.

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
