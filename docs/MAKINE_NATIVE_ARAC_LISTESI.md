# Makine mühendisliği gösterimleri — önerilen native araç listesi

2026-10-21. **Ö1 listesi kullanıcı tarafından onaylandı; A1–A3 uygulandı (durum: §6).** Kullanıcı kararı: makine skill'i **ISO / TS EN ISO** tabanlı olacak (ASME sonra eklenecek); kaynak, yüzey ve leader dışında GD&T dahil makine resminde kullanılan bütün gösterimler araştırılacak ve **her biri için native araç** eklenecek. Bu belge yalnız listedir; **kodlama kullanıcı listeyi onaylamadan başlamaz.**

Mevcut kapsamın kaynağı: [TOOL_CATALOG.json](TOOL_CATALOG.json) (52 araç), [MAKINE_MUHENDISLIGI.md](MAKINE_MUHENDISLIGI.md), [skill referansı](../skills/autocad-mcp/references/mechanical.md).

## 1. Standart dayanakları ve sürüm durumu

Sürümler 2026-10-21'de ISO kataloğu ve ulusal kuruluş kayıtlarından kontrol edildi. Tam metinler satın alınmadı; sayısal oranlar ve tablolar uygulama öncesi tam metinden doğrulanmalıdır (bkz. §5).

| Konu | Standart | Durum (2026-10-21) |
|---|---|---|
| Çizgi tipleri ve kalınlıkları | ISO 128-2:2022 | Güncel (2020 sürümü geri çekildi) |
| Görünüş, kesit, kesim | ISO 128-3:2022 | Güncel |
| Genel ilkeler | ISO 128-1:2020 | Revizyon projesi var; durum doğrulanmadı |
| Projeksiyon yöntemi ve sembolü | ISO 5456-2 | Sürüm doğrulanmadı |
| Ölçülendirme | ISO 129-1:2018 + Amd 1:2020 | Güncel |
| Boyut toleransı/geçme kodu | ISO 286-1:2010, ISO 286-2:2010 | Güncel |
| Boyut belirtim değiştiricileri | ISO 14405-1:2016 (+ -2, -3) | Güncel; değiştirici kodları tam metinden doğrulanacak |
| GPS temel ilkeleri | ISO 8015:2011 | Durum doğrulanmadı |
| Geometrik tolerans | ISO 1101:2017 | Güncel; yeni sürüm bulunmadı |
| Datum ve datum sistemi | **ISO 5459:2024** (3. baskı) | Güncel; 2011 sürümünün yerini aldı |
| MMR / LMR / RPR | ISO 2692:2021 | Güncel; sistematik incelemede |
| Profil toleransı | ISO 1660:2017 | Güncel |
| Desen / birleşik belirtim (CZ, SZ, SIM) | ISO 5458:2018 | Güncel (2023'te teyit) |
| Genel geometrik/boyut belirtimi | ISO 22081:2021 | Güncel; ISO 2768-2'nin yerini aldı |
| Genel boyut toleransı | ISO 2768-1:1989 | Durum doğrulanmadı |
| Esnek parçalar (serbest durum) | ISO 10579:2010 | Güncel; ISO/DIS 25935 ile değişecek |
| Koniler | ISO 3040:2016 | Büyük olasılıkla güncel; doğrulanmadı |
| Tanımsız kenarlar | ISO 13715:2017 | Güncel |
| Deliklerin basit gösterimi | ISO 15786:2008 | Güncel (2024'te teyit) |
| Yüzey dokusu gösterimi | **ISO 21920-1:2021** | Güncel; ISO 1302:2002'nin yerini aldı |
| Kaynak sembolleri | ISO 2553:2019 | Güncel; **ISO/DIS 2553:2026 taslağı** askıda |
| Kaynak yöntem numaraları | ISO 4063:2023 | Güncel |
| Kaynaklı yapı genel toleransı | ISO 13920:2023 | Güncel |
| Diş gösterimi | ISO 6410-1:1993 (+ -2, -3) | Güncel (2024'te teyit) |
| Punta deliği | ISO 6411:1982 | Güncel (2024'te teyit) |
| Kama mili / tırtıl | ISO 6413:2018 | Güncel |
| Dişliler | ISO 2203:1973 | Güncel (2024'te teyit) |
| Yaylar | ISO 2162-1:1993 | Güncel |
| Rulmanlar, contalar, bağlantı elemanları | ISO 8826-1, ISO 9222-1, ISO 5845-1 | Sürüm doğrulanmadı |
| Pafta boyutu ve düzeni | ISO 5457:1999 + Amd 1:2010 | Güncel; incelemede |
| Antet veri alanları | ISO 7200:2004 | Güncel (2025'te teyit) |
| Parça listesi | ISO 7573:2008 | Güncel (2023'te teyit) |
| Parça referansı (balon) | ISO 6433:2012 | Büyük olasılıkla güncel |
| Yazı | ISO 3098-1:2015, -2:2000, -5:1997 | Güncel |
| Ölçekler | ISO 5455:1979 | Doğrulanmadı |
| 3B açıklama (MBD) | ISO 16792:2021 | Güncel; 4. baskı taslakta |

## 2. Mevcut 52 araçta olan ve olmayan

| Alan | Var | Eksik |
|---|---|---|
| Ölçü | Doğrusal, hizalı, çap, yarıçap; +/- sapma; hassasiyet | Açısal, yay uzunluğu, koordinat, zincir/taban çizgisi; Ø/R/SR/SØ/□/t ön-ekleri; teorik tam ölçü (çerçeveli); referans ölçü; ölçek dışı ölçü; geçme kodu (H7/g6); limit ölçü; ISO 14405 değiştiricileri; pah, eğim, koniklik |
| GD&T | 12 karakteristik, Ø bölge, M/L, en çok 3 datum, tek satır | Eş eksenlilik/eş merkezlilik ve simetri; ISO değiştiricileri (Ⓟ Ⓕ Ⓡ CZ SZ SIM UZ ACS vb.); ortak datum (A-B); datum değiştiricileri; çok satırlı/bileşik çerçeve; ek göstergeler (kesişim/yön düzlemi); çerçeve leader'ı; datum üçgeni; datum hedefleri |
| Yüzey, kaynak, leader | — | Hepsi |
| Çizgi ve tarama | Katman, kalınlık, basit kesikli çizgi tipi; SOLID/ANSI31 tarama | ISO 128-2 çizgi tipi takımı ve kalınlık grupları; malzeme/montaj tarama desenleri |
| Görünüş | Katı kesit REGION, kamera | Kesit düzlemi işareti (A–A), detay dairesi, görünüş oku, kırık çizgi, merkez işareti/eksenler, simetri sembolü; 3B'den 2B görünüş üretimi |
| Pafta | Ölçekli layout, viewport, PDF; kullanıcının verdiği bloktan antet; BOM + TABLE | ISO 5457 pafta çerçevesi; ISO 7200 antet; revizyon tablosu; ISO 7573 parça listesi düzeni; balon; ISO yazı tipi (yalnız arial.ttf/txt.shx izinli) |
| Makine elemanları | Delik/kademeli delik/havşa katısı, kademeli mil | Diş, punta deliği, kama mili, dişli, yay, rulman, conta, bağlantı elemanı gösterimleri |

## 3. Önerilen native araçlar

Her araç: tipli girdi, WCS ve birim, tek UNDO grubu, AutoCAD'den geri okuma, sorgu/taşıma/silme desteği, kaydet-yeniden aç testi. Sembol geometrisi kodda **yazı yüksekliği h'ye bağlı oranlarla** üretilir; model sembolü çizgi çizgi kurmaz. Mühendislik değeri (tolerans, Ra, kaynak kalınlığı) her zaman kullanıcıdan gelir.

Öncelik: **Ö1** makine skill'inin ilk sürümü için gerekli; **Ö2** ilk sürümde olması iyi; **Ö3** sonraki paket.

### A. Altyapı

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| A1 | `acad_create_leader` | Native MLEADER: çok kırılımlı ok çizgisi, ok ucu (dolu ok, açık ok, nokta, yok — ISO 128-2/129-1), yatay referans çizgisi, metin ya da blok içerik, nesneye/kenara/ölçü çizgisine bağlama | Ö1 |
| A2 | `acad_setup_drawing_standard` | ISO profili: ISO 128-2 çizgi tipleri (sürekli, kesikli, ince/kalın noktalı, iki noktalı, zigzag) doğru tire oranlarıyla; kalınlık grubu (ör. 0,25/0,5 veya 0,35/0,7); standart katman takımı; ISO 3098 yazı stili (isocp.shx izin listesine eklenir); ISO ölçü stili; tarama ve ok boyutları. Değerler tam metinden doğrulanarak sabitlenir | Ö1 |
| A3 | Sembol motoru (iç bileşen) | Kaynak/yüzey/datum/punta gibi sembolleri h'ye göre ölçekli adlı blok olarak üretir; tekrar kullanır, sürüm etiketi taşır. Ayrı MCP aracı değil | Ö1 |

### B. Ölçülendirme (ISO 129-1, 286, 14405, 3040, 13715, 15786)

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| B1 | `acad_create_dimension` genişletmesi | Açısal (2 çizgi/3 nokta), yay uzunluğu, koordinat (ordinate), zincir ve taban çizgili seri ölçü | Ö1 |
| B2 | Ölçü belirtimi alanları | Ön-ek/son-ek: Ø, R, SØ, SR, □, t=, adet ×; teorik tam ölçü (çerçeveli TED); referans ölçü (parantez); ölçek dışı ölçü (altı çizili); simetrik yarım ölçü | Ö1 |
| B3 | Tolerans biçimleri | Kullanıcının verdiği geçme kodu (H7, g6, H7/g6) + istenirse sapma değeri; limit ölçü (üst/alt boyut); tek yönlü sınır (min/max); ISO 14405 değiştiricileri (Ⓔ, LP, LS, GG, GX, GN, CC, CA, CV, SX, SN, SA… ve ACS/SCS, /uzunluk). ISO 286 sapma tabloları kopyalanmaz; değer kullanıcıdan ya da kullanıcının onayladığı hesaptan gelir | Ö1 |
| B4 | `acad_create_hole_callout` | ISO 15786 basit delik gösterimi: çap, derinlik ↧, kademe ⌴, havşa ⌵, iç diş (M10-6H), adet, leader ile | Ö1 |
| B5 | `acad_create_chamfer_dimension` | Pah: C2 / 2×45° / iki uzunluk; ISO 129-1 | Ö2 |
| B6 | `acad_create_taper_slope` | Koniklik (ISO 3040) ve eğim sembolü, oran yazımı | Ö2 |
| B7 | `acad_create_edge_symbol` | ISO 13715 tanımsız kenar sembolü (çapak izni/keskin kenar/köşe, +/- değerler) | Ö2 |

### C. Geometrik tolerans (ISO 1101, 5459, 2692, 1660, 5458, 22081, 10579)

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| C1 | `acad_create_feature_control_frame` genişletmesi | 14 karakteristiğin tamamı (eş eksenlilik/eş merkezlilik, simetri eklenir); tolerans bölgesi ve ISO değiştiricileri: Ⓜ Ⓛ Ⓡ, Ⓟ (uzatılmış bölge + uzunluk), Ⓕ (serbest durum), CZ/SZ/CZR/SIM, UZ (kaydırılmış bölge), ACS, LD/MD/PD, filtre; datum değiştiricileri; ortak datum (A-B); çok satırlı ve bileşik çerçeve; "arasında" ↔, tüm çevre/tüm yüzey; ek göstergeler (kesişim düzlemi, yön düzlemi, yön elemanı, toplama düzlemi) | Ö1 |
| C2 | Çerçeve bağlama | FCF'yi leader (A1) ile yüzeye, uzantı çizgisine veya ölçü çizgisine bağlama; eksen/yüzey ayrımı | Ö1 |
| C3 | `acad_create_datum_feature` | Datum harfi kare çerçevede + dolu/boş üçgen; yüzeye, uzantı çizgisine ya da ölçü çizgisi hizasına (eksen datumu) yerleşim | Ö1 |
| C4 | `acad_create_datum_target` | ISO 5459 datum hedefleri: nokta (×), çizgi, alan (kesikli sınır + tarama), hedef etiketi dairesi (A1, alan boyutu) | Ö2 |
| C5 | Genel belirtim notu | Antet yanında ISO 22081 / ISO 2768 genel tolerans ifadesi, ISO 8015 atfı, ISO 10579 serbest durum notu — yalnız kullanıcı seçerse | Ö1 (H2 ile birlikte) |

### D. Yüzey dokusu (ISO 21920-1)

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| D1 | `acad_create_surface_texture` | Temel sembol, talaş kaldırmalı/kaldırmasız, tüm çevre dairesi; ISO 21920 parametre yazımı (ör. Ra, Rz; üst/alt sınır, filtre), imalat yöntemi, işleme payı, yön sembolleri (=, ⊥, X, M, C, R, P); yüzeye, uzantı çizgisine veya leader'a; okuma yönü kuralı | Ö1 |
| D2 | Toplu yüzey gösterimi | Antet yanında genel sembol + parantez içinde istisna sembolleri; basitleştirilmiş harfli referans (ör. "x" = Ra …) | Ö1 |

### E. Kaynak (ISO 2553, 4063, 13920)

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| E1 | `acad_create_weld_symbol` | Ok çizgisi + referans çizgisi (ISO 2553 sistem A: sürekli + kesikli tanımlama çizgisi; sistem B ileride); ok tarafı / diğer taraf; temel semboller (köşe, I, V, tek taraflı V, Y, tek taraflı Y, U, J, çift taraflı birleşimler, flanşlı, tapa/oluk, nokta, dikiş, saplama, yüzey dolgu, kök pasosu, altlık); tamamlayıcı semboller (düz, dışbükey, içbükey, düzgün geçiş, kalıcı/sökülebilir altlık); tüm çevre dairesi; şantiye bayrağı; kuyruk (ISO 4063 yöntem no, kalite seviyesi, pozisyon, dolgu); ölçüler (a/z, n × l (e), kesintili/zigzag/kademeli) | Ö1 |
| E2 | `acad_create_weld_representation` | Kesitte ve görünüşte kaynak dikişi gösterimi (dolu kesit, dikiş çizgisi) — sembolden ayrı, isteğe bağlı | Ö3 |
| E3 | Kaynaklı yapı notu | ISO 13920 genel tolerans sınıfı notu (kullanıcı seçerse) | Ö2 |

### F. Görünüş ve kesit (ISO 128-3, 5456-2)

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| F1 | `acad_create_section_marker` | Kesit düzlemi işareti (uçlarda kalın kısa çizgiler, bakış okları, harfler), kademeli kesit; kesit başlığı "A–A" | Ö1 |
| F2 | `acad_create_detail_marker` | Detay dairesi/sınırı + harf ve başlık "B (5:1)" | Ö1 |
| F3 | `acad_create_view_arrow` | Yardımcı/kısmi görünüş oku ve başlığı | Ö2 |
| F4 | `acad_create_centerlines` | Delik merkez işareti, simetri ekseni, delik dairesi taksimat dairesi ve eksenleri, simetri sembolü (iki kısa paralel çizgi) | Ö1 |
| F5 | `acad_create_break_line` | Kırık görünüş (zigzag/serbest el), kısaltılmış uzun parça | Ö2 |
| F6 | `acad_create_hatch` genişletmesi | Malzeme/montaj desenleri; bitişik parçada farklı açı/aralık; ince kesitte dolu | Ö1 |
| F7 | 3B katıdan 2B görünüş | Ön/üst/yan/izometrik görünüş üretimi (gizli çizgi dahil). ObjectARX API uygunluğu araştırma gerektirir | Ö3 (araştırma) |

### G. Makine elemanları gösterimi

| No | Araç | Standart | Öncelik |
|---|---|---|---|
| G1 | `acad_create_thread` | ISO 6410-1/-2/-3: dış/iç diş görünüş ve kesit (tepe kalın, dip ince, görünüşte 3/4 daire), diş sonu, tarama sınırı, gösterim (M10×1,5-6g, LH); basitleştirilmiş gösterim | Ö1 |
| G2 | `acad_create_centre_hole` | ISO 6411: üç simge (gerekli/izinli/yasak) + gösterim (ör. ISO 6411-A2,5/5,3) | Ö2 |
| G3 | `acad_create_spline_shaft` | ISO 6413: kama mili/tırtıl tam ve basit gösterim + gösterim simgesi | Ö3 |
| G4 | `acad_create_gear` | ISO 2203: dış daire, taksimat dairesi (ince noktalı), diş dibi; dişli veri tablosu (modül, z, α — kullanıcıdan) | Ö3 |
| G5 | `acad_create_spring` | ISO 2162-1 basitleştirilmiş yay | Ö3 |
| G6 | `acad_create_bearing` / `acad_create_seal` / `acad_create_fastener` | ISO 8826-1, ISO 9222-1, ISO 5845-1 basitleştirilmiş gösterimler | Ö3 |

### H. Pafta, antet ve listeler (ISO 5457, 7200, 7573, 6433, 3098, 5455)

| No | Araç | Kapsam | Öncelik |
|---|---|---|---|
| H1 | `acad_create_drawing_sheet` | ISO 5457 A0–A4 (dikey/yatay): çerçeve ve kenar boşlukları, merkezleme işaretleri, ızgara referansı (harf/rakam), kesme işaretleri | Ö1 |
| H2 | `acad_create_title_block` | ISO 7200 alanları: yasal sahip, belge türü, başlık, ek başlık, belge no, revizyon, yayın tarihi, sayfa/toplam, dil, hazırlayan, onaylayan, teknik referans, belge durumu, sınıflandırma. Makine alanları: ölçek, projeksiyon sembolü (ISO 5456-2), birim, malzeme, kütle, genel tolerans, toplu yüzey sembolü. Nitelikli blok; bilinmeyen alan boş kalır, uydurulmaz | Ö1 |
| H3 | `acad_create_revision_table` | Revizyon indeksi, açıklama, tarih, onay | Ö2 |
| H4 | `acad_create_parts_list` | ISO 7573 parça listesi: poz no, adet, ad, malzeme, standart/referans, kütle; antet üstünde aşağıdan yukarı; mevcut BOM verisinden | Ö1 |
| H5 | `acad_create_item_reference` | ISO 6433 balon: dairede poz no, leader + nokta/ok, yatay/dikey hizalama | Ö1 |

### I. Sonraki paketler (bu listenin dışı)

- ASME Y14.5 / Y14.100 / AWS A2.4 profili (kullanıcı kararı: ileride).
- ISO 16792 3B açıklama (MBD).
- İnşaat ve mimarlık skill'lerinin kendi gösterimleri (ayrı liste).

## 4. Sayım ve önerilen sıra

- **Ö1:** 23 iş kalemi (yeni araç, mevcut aracın genişletmesi ya da iç bileşen) — makine skill'inin ilk sürümü.
- **Ö2:** 9 kalem. **Ö3:** 6 kalem (F7 araştırma dahil).

Önerilen geliştirme sırası: A1–A3 (uygulandı) → B1–B4 → C1–C3, C5 → D1–D2 → E1 → F1, F2, F4, F6 → G1 → H1–H5. Her grup bitince canlı AutoCAD kabulü ve PDF çıktısı denetlenir; sonra skill'in ilgili bölümü yazılır.

## 5. Riskler ve kullanıcı kararı gereken noktalar

1. **Tam metin erişimi:** ISO tam metinleri satın alınmadı. Sembol oranları (ör. yüzey sembolü kol uzunlukları, kaynak sembolü boyutları), ISO 128-2 tire uzunlukları ve kalınlık grupları ikincil kaynaktan alınırsa hata riski vardır. Öneri: Ö1 kapsamındaki standartların TS EN ISO tam metinlerinin kullanıcı tarafından temin edilmesi (TSE). Metinler depoya girmez; yalnız uygulanan sayısal değerler kodda kaynak numarasıyla yer alır.
2. **ISO 2553 taslağı:** 2026 taslağı yayımlanırsa kaynak sembolü aracının güncellenmesi gerekebilir; ilk uygulama 2019 sürümüne göre yapılır.
3. **AutoCAD yerel nesne sınırı:** AutoCAD (Mechanical araç seti olmadan) yerel kaynak/yüzey sembolü nesnesi sunmaz; bu semboller MLEADER + blok olarak üretilir. Kullanıcı DWG'yi AutoCAD Mechanical'da açtığında bunlar Mechanical sembol nesnesi olarak görünmez.
4. **GD&T yazı tipi:** AutoCAD FCF'si `gdt.shx` karakterlerine dayanır; ISO'ya özgü değiştiriciler (CZ, UZ, ACS) metin bölmesi olarak eklenir. Görsel sonuç PDF'te ayrıca denetlenir.
5. **Kapsam büyüklüğü:** Ö1 tek başına mevcut 52 aracın yaklaşık yarısı kadar native iş demektir. Ö2/Ö3 sonraki sürümlere bölünmelidir.

## 6. Uygulama durumu

| Kalem | Durum (2026-10-21) | Kanıt / sınır |
|---|---|---|
| A1 `acad_create_leader` | Uygulandı. Native MLEADER; ok/nokta/yok uç, isteğe bağlı yatay referans çizgisi, düz metin veya yerel blok içerik, blok nitelikleri | Köşeler, uç, referans çizgisi, içerik ve içeriğin referans çizgisi sonuna bağlandığı nokta (`contentConnection`) commit öncesi ve sonrası okunur. Bilinmeyen nitelik/blok reddi revizyonu değiştirmez. Taşıma, kaydet–yeniden aç ve A4 PDF çıktısı denetlendi |
| A2 `acad_setup_drawing_standard` | Uygulandı. ISO 3098 yazı stili (isocp.shx), ISO 128-2 ince kesikli/uzun çizgi-noktalı/iki noktalı çizgi tipleri, 10 katman, ISO ölçü stili, PSLTSCALE=1 | Çizgi elemanları (12d/3d/24d/nokta) AutoCAD `acadiso.lin` ile çapraz doğrulandı; ölçü oranları AutoCAD ISO-25 stilinden. Sonuç `verification: pending_full_text` bildirir. Var olan ad varsa hiçbir şey yazılmaz |
| A3 sembol motoru | Uygulandı (iç bileşen, ayrı MCP aracı yok) | Kod üretimli adlı blok + imza Xrecord'u; aynı içerik yeniden kullanılır, aynı adda yabancı blok reddedilir. Yalnız test derlemesindeki sabit sentetik sembolle sınandı; gerçek katalog sembolleri C3/D1/E1 ile gelecek |

Canlı kabul: `test/standards-windows.ts` (izole Core Console, sentetik stok şablon). Bilinen sınırlar: ISO tam metinleri satın alınmadan sayısal oranlar "doğrulama bekliyor" kalır; MLEADER'ın kendi metin konumu AutoCAD tarafından hesaplanır, yalnız bağlantı noktası doğrulanır; yerleşik `_DOT`/`_NONE` ok blokları ilk kullanımda çizime eklenir.
