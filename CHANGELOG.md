# Changelog / Sürüm notları

## 1.2.0 — 2026-11-12

### English

- `acad_setup_drawing_standard`: one-step ISO drawing profile (ISO 3098
  lettering, ISO 128-2 line types and line groups, prefixed layers, ISO
  dimension style). Numeric basis is reported; full-text verification pending.
- `acad_create_leader`: native MLEADER with arrow/dot/none terminators,
  reference line and text or block content, fully read back.
- Internal symbol block engine for upcoming GD&T, surface texture and
  welding symbols.
- Angular, arc length and ordinate dimensions; chain/baseline series;
  ISO notation around the live measurement (Ø/R/S, square, count, framed
  TED, reference, not-to-scale, ISO 286 fit, limits, min/max, ISO 14405
  modifiers, half dimensions) and ISO 15786-style hole callouts with an
  optional check against the real circle.
- Written decimal places and trailing zeros are kept exactly. Display
  precision alone does not define tolerance; use the dimension, drawing
  notes or referenced standard. Decimal-place tolerance mappings apply
  only when explicitly specified on the drawing.
- `acad_create_feature_control_frame`: ISO rows with all 14 characteristic
  symbols, written tolerance values, ISO 5458/2692/10579 modifiers, common
  datums and ISO 5459 datum modifiers, stacked frames, adjacent indications
  and an associated LEADER whose feature point is checked (surface, or in
  line with the dimension line for an axis). The single-line form stays.
- `acad_create_datum_feature`: datum triangle and letter frame (ISO 5459).
- `acad_create_general_specification`: user-selected ISO 8015, ISO 2768,
  ISO 14405 Ⓔ, ISO 22081 and ISO 10579 notes. Layouts pending full-text
  verification; Ⓣ and plane indicators are not implemented.
- `acad_create_drawing_sheet`: ISO 5457 A0–A4 frame (20/10 mm margins) and
  centring marks; returns the title block corner.
- `acad_create_title_block`: the education_122x31 title block layout as a
  signed attributed block with a first/third angle projection symbol.
  Values come only from the request and omitted fields stay empty; a value
  wider than its cell is rejected.
- `acad_create_layout` takes `plotStyle` (monochrome.ctb, Grayscale.ctb,
  acad.ctb), so technical PDFs print black instead of layer colours.
- `acad_create_text` takes `justification` and applies the style width
  factor, which TEXT entities previously ignored.
- `acad_create_dimension` takes `textPosition` for non-diameter kinds; the
  description now states that diameter/radius `linePoint` is the text
  location.
- `acad_extrude` takes `profilePlane` XZ/YZ for front and side profiles
  (inclined arms, holes along Y).
- A bare `acad_create_leader` (no reference line, no content) no longer
  needs `landingDirection`; `acad_query_entities` no longer needs `filter`.
- `acad_create_layer` description states that existing linetypes are
  accepted.

### Türkçe

- `acad_setup_drawing_standard`: tek adımda ISO çizim profili (ISO 3098
  yazı, ISO 128-2 çizgi tipleri ve grupları, önekli katmanlar, ISO ölçü
  stili). Sayısal dayanak bildirilir; tam metin doğrulaması bekliyor.
- `acad_create_leader`: ok/nokta/uçsuz, referans çizgili, metin veya blok
  içerikli native MLEADER; tamamı geri okunur.
- Gelecek GD&T, yüzey ve kaynak sembolleri için iç sembol blok motoru.
- Açısal, yay uzunluğu ve koordinat ölçüleri; zincir/taban çizgili seri;
  canlı ölçü değerinin çevresinde ISO gösterimi (Ø/R/S, kare, adet, TED
  çerçevesi, referans, ölçek dışı, ISO 286 geçme, limit, min/max, ISO 14405
  değiştiricileri, yarım ölçü) ve gerçek daireyle kontrol edilebilen ISO
  15786 tarzı delik notları.
- Yazılan ondalık basamaklar ve sondaki sıfırlar aynen korunur. Gösterim
  hassasiyeti tek başına tolerans belirlemez; ölçü, çizim notları veya
  atıf yapılan standart esas alınır. Ondalık basamağa göre tolerans
  eşlemesi yalnız çizimde açıkça tanımlanmışsa uygulanır.
- `acad_create_feature_control_frame`: 14 karakteristik sembolü, yazılı
  tolerans değeri, ISO 5458/2692/10579 değiştiricileri, ortak datum ve
  ISO 5459 datum değiştiricileri, üst üste çerçeveler, çerçeve üstü
  göstergeler ve unsur noktası denetlenen bağlı LEADER (yüzey ya da eksen
  için ölçü çizgisi hizası). Tek satırlı eski biçim korunur.
- `acad_create_datum_feature`: datum üçgeni ve harf çerçevesi (ISO 5459).
- `acad_create_general_specification`: kullanıcının seçtiği ISO 8015,
  ISO 2768, ISO 14405 Ⓔ, ISO 22081 ve ISO 10579 notları. Düzen tam metin
  doğrulaması bekliyor; Ⓣ ve düzlem göstergeleri uygulanmadı.
- `acad_create_drawing_sheet`: ISO 5457 A0–A4 çerçeve (20/10 mm kenar
  payı) ve merkezleme işaretleri; antet köşesini döndürür.
- `acad_create_title_block`: education_122x31 antet düzeni, birinci/üçüncü
  açı sembollü imzalı nitelikli blok. Değerler yalnız istekten gelir,
  verilmeyen alanlar boş kalır; hücresine sığmayan değer reddedilir.
- `acad_create_layout` `plotStyle` alır (monochrome.ctb, Grayscale.ctb,
  acad.ctb); teknik PDF katman renkleri yerine siyah basılır.
- `acad_create_text` `justification` alır ve stilin genişlik oranını
  uygular (TEXT önceden bunu yok sayıyordu).
- `acad_create_dimension` çap dışı türlerde `textPosition` alır; açıklama
  çap/yarıçapta `linePoint`in yazı konumu olduğunu belirtir.
- `acad_extrude` önden/yandan profiller için `profilePlane` XZ/YZ alır
  (eğik kol, Y yönlü delik).
- Referans çizgisiz ve içeriksiz `acad_create_leader` artık
  `landingDirection` istemez; `acad_query_entities` `filter` istemez.
- `acad_create_layer` açıklaması mevcut çizgi tiplerinin kabul edildiğini
  belirtir.

## 1.0.0 — 2026-10-20

### English

- 52 typed CAD tools covering 2D geometry, annotations, blocks, solids,
  mechanical helpers, layouts/PDF, staged xrefs and atomic batches.
- A local Windows tray application with explicit AutoCAD selection,
  reconnect, separate CAD/MCP status and optional startup in the tray.
- Step-by-step AutoCAD and MCP setup, client-specific instructions,
  command/argument copy buttons and an original red application logo.
- Bundled Node24, per-user installation, upgrade, rollback and recovery;
  Codex/Claude Code/OpenCode1.x configurations and existing skills.
- Apache-2.0 project license and English/Turkish READMEs.

Unsigned public Windows preview. Pending: trusted ARX/EXE signatures and separate clean Windows
acceptance. macOS and live Claude model testing have not been completed.

### Türkçe

- 2B geometri, teknik resim, bloklar, katılar, mekanik yardımcılar,
  pafta/PDF, kontrollü xref ve atomik batch için 52 tipli CAD aracı.
- Açık AutoCAD seçimi, yeniden bağlantı, ayrı CAD/MCP durumu ve isteğe
  bağlı tepside başlangıç içeren yerel Windows uygulaması.
- Adım adım AutoCAD/MCP kurulumu, istemciye özel talimatlar,
  komut/argüman kopyalama ve özgün kırmızı uygulama logosu.
- Paket içi Node24, kullanıcıya özel kurulum, yükseltme, geri alma,
  kurtarma; Codex/Claude Code/OpenCode1.x ayarları ve mevcut skill'ler.
- Apache-2.0 proje lisansı ve İngilizce/Türkçe README'ler.

İmzasız public Windows önizlemesi. Güvenilir ARX/EXE imzası ve ayrı temiz Windows kabulü açık.
macOS ve canlı Claude model testi tamamlanmadı.
