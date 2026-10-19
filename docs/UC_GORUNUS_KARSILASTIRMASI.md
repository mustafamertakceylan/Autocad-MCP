<!-- Ham DWG/PDF/model günlükleri yerel kanıttır; public repo bu dosyaları içermez. -->
# Üç görünüş karşılaştırması — 19 Ekim2026

**Üç ayrı DWG hazır. Hiçbiri kusursuz doğruluk kabulünü geçmedi; commit/push yapılmadı.** Codex max görünüş geometrisinde daha tutarlı, fakat yöntem sembolü ters. Pro'da toplam yükseklik ve simetri hatası var. MiMo ilk bağımsız turda çizim üretmedi; yönetici koordinatlarıyla ikinci turu tamamladı, gizli/eksen çizgi tiplerini kuramadı.

| Dosya | Model/yöntem | Süre | Yeniden açılan DWG | Sonuç |
|---|---|---:|---|---|
| codex.dwg (yerel kanıt; Git paketinde yok) | GPT-6.1-Sol max; fotoğraf+tarif, bağımsız |4dk1sn|73 nesne,11 gerçek ölçü|Görünüşler tutarlı; üçüncü açı etiketiyle uyuşmayan sembol|
| evren-mimo.dwg (yerel kanıt; Git paketinde yok) | EVREN MiMo V2.6 Pro; koordinat destekli |18dk15sn|59 nesne,8 gerçek ölçü|Verilen koordinatları uyguladı; HIDDEN/CENTER Continuous kaldı|
| deepseek-pro.dwg (yerel kanıt; Git paketinde yok) | DeepSeek V4 Pro high; ortak tarif, bağımsız |8dk5sn|53 nesne,10 gerçek ölçü,1 TABLE|Toplam36mm; ön görünüşte5mm kayma; arka kontur ve sembol hatalı|

PDF ve model raporları: Codex PDF (yerel kanıt; Git paketinde yok), raporu (yerel kanıt; Git paketinde yok); MiMo PDF (yerel kanıt; Git paketinde yok), raporu (yerel kanıt; Git paketinde yok); Pro inceleme PDF (yerel kanıt; Git paketinde yok), raporu (yerel kanıt; Git paketinde yok). Antet alanları dolu; kontrol alanı INCELEME BEKLIYOR. Kaynak görsel (yerel kanıt; Git paketinde yok), sayısal denetim (yerel kanıt; Git paketinde yok), teslim hash'leri (yerel kanıt; Git paketinde yok).

## Girdi farkları ve bağımsızlık

İlk üç görev aynı anda başlatıldı. Pro ortak OpenCode SQLite kilidinde başlayamadı; ayrı veri diziniyle diğerleri sürerken tekrar açıldı. MiMo'nun bağımsız ilk turu14dk3sn sonunda16382 düşünme tokenını doldurdu, length ile bitti:0 geometri/0 DWG. CLI exit0 başarı sayılmadı. Kısa bağlantı kontrolü geçti; ikinci tur için açık koordinat planı verildi, araç listesi daraltıldı ve çıktı sınırı32k yapıldı. Bu dosya **bağımsız fotoğraf yorumlama başarısı sayılmaz**; destek antet/notta da yazıyor.

Codex ayrıca fotoğrafı gördü. MiMo/Pro mevcut OpenCode tanımlarında görsel girişsizdi; bunlara fotoğraf gönderilmedi. MiMo'nun başka sağlayıcı/ayarlarla görsel yeteneği hakkında hüküm verilmez. Bu eşit girdili kör model sıralaması değildir. Hiçbir ajan diğerinin sonucunu okumadı.

İlk Codex turunda yönetici high seçmişti. En yüksek efor kuralı için aynı model max ile yeni bağımsız oturumda tekrar çalıştırıldı; ultra yerel katalogda otomatik delegasyonlu tanımlandığından kullanılmadı. İlk high örneği67 nesne/11 ölçü ve3dk41sn ile ayrıca korundu (yerel kanıt; Git paketinde yok). Ana codex.dwg **max turudur**.

Ortak testte30mm toplam yükseklik,6mm taban,Ø30 başlık,Ø15 delik,7mm nervür kullanıldı. Fotoğraftaki60/18/pah ölçülerinin yüzey referansları kullanıcı tarafından kesinleştirilmedi. Codex max60'ı arka teğetten öne aldı; dış boy75mm oldu. İlk Codex high ve yönetici koordinatlarını kullanan MiMo60'ı toplam boy aldı. **Fotoğrafa birebir üretim ölçüsü doğrulandı denmiyor.** Malzeme/tolerans uydurulmadı.

## Gerçek ölçüm sonuçları

Her nihai DWG yeni gerçek AutoCAD2027/Core Console sürecinde açılıp MCP üzerinden sorgulandı; kaynak/kopya SHA256 değişmedi. Ham sorgular kanit/*-native-review.json dosyalarında. Bunlar modelspace'te2B ortografik nesnelerdir;3B katıdan otomatik/ilişkisel görünüş üretildiği iddia edilmez. Nesne sayısı kalite puanı değildir.

**Codex max:** ön[70,65]..[100,95] →30mm; taban65→71 →6mm. Ön/üst ekseniX85, nervür7 ve delik15 bu eksende. Sağ150→225 ve üst115→190 →75mm;60 ölçüsü150→210 teğet referansıdır. Başlık ön yüz192 ile teğet210 arası18; nervür boyu42mm. Ön/sağ tabanY65 hizalı; kesikli ve merkez çizgi tipleri gerçekten kurulu. **Sembol hatası:** daire solda[171,133]; sağdaki koninin yakın/sol ucu12, uzak/sağ ucu6mm yüksek. Daire büyük uca komşu: üçüncü açı örneğinin tersidir. Görünüş yerleşimi üst-yukarı/sağ-sağdadır; sembol hatası tüm görünüşler birinci açı demek değildir.

**Pro:** ön[80,62]..[110,98] →**36mm**.30 ölçüsünü taban üstü68'den98'e vermiş, taban6 ayrıca eklenmiş. Dış simetri merkezi95 iken ön nervür96.5/103.5 → merkez100; gizli delik92.5/107.5 → merkez100. Üst delik/nervür merkezi95: **5mm uyumsuzluk**. Üst dış polyline arkaY182 boyunca düz kapak çiziyor; R15 yayla beraber fazladan iki köşe/üst düz kenar oluşmuş. Sembol tek daire ve ters koniyle eksik/uyumsuz; notlarY202 ve kâğıt sağına taşıyor.10 gerçek DIMENSION'ın doğru sayı göstermesi bütün geometrinin doğru olduğunu göstermedi.

**MiMo destekli:** ön[75,70]..[105,100] →30mm; taban70→76 →6mm; nervür86.5/93.5 →7mm ve merkez90. Üst delik[90,175],R7.5; gizli kenarlar82.5/97.5 aynı merkezde. Sağ150→210 ve üst130→190 →60mm.8 gerçek ölçü30/6/60/18/7/12/Ø30/Ø15. Antet ve geometrik üçüncü açı sembolü var. Ancak HIDDEN/CENTER native linetype değeri **Continuous**; gizli çizgiler ve eksenler sürekli çizgi görünüyor. Tür hatalarından sonra stiller kurulamadan devam edilmiş. Teslim dosyası modelin son evren-mimo-pafta.dwg kaydının yeniden adlandırılmış kopyasıdır; pafta içerir. İlk kayıt saklandı (yerel kanıt; Git paketinde yok).

Yerleşim dayanağı: [Autodesk üçüncü açı açıklaması](https://help.autodesk.com/cloudhelp/ENU/Fusion-Drawing/files/GUID-0DB05CD9-BE99-4E45-9FBD-8B8AF1F297BF.htm). Sembol dayanağı: [SOLIDWORKS üçüncü açı geometrik örneği](https://help.solidworks.com/2022/english/SolidWorks/sldworks/c_creating_custom_symbols_overview.htm). Üretim/standart sertifikası verilmedi.

## MCP düzeltmeleri ve dosyaların kökeni

İlk high/Pro PDF'leri normal A4'ün5/17mm kenar payı nedeniyle kayıp kırpılmıştı. Fiziksel kâğıt başlangıcı telafisi, baskısız viewport katmanı ve çoklu layout sideDB viewport kimliği ayrımı düzeltildi. Ana Codex max/MiMo PDF'leri modellerin özgün yeni-motor çıktısıdır. Pro'nun inceleme PDF'si yalnız baskı düzeltmesiyle yönetici tarafından tekrar alındı; **hatalı geometri değiştirilmedi**. İlk PDF'ler orijinaller/ içinde duruyor. Rapor tek başına kabul kanıtı sayılmadı.

İstemci uyumluluğu için root/nested oneOf ve numeric prefixItems sunumu sadeleştirildi. Orijinal strict Zod/native çalışma zamanı doğrulaması korunuyor; sayı/dizi metinden çevrilmiyor. Yeni şema, çizimden ayrı4 çağrılık61.9sn gerçek MiMo kontrolünde sınandı: dashes[3,-1.5] dizi ve epoch/revision sayı gönderildi; native patternLength4.5 geri okundu. Ana MiMo çizimi eski metadata ile başlamıştı; bu ayrı kontrol çizimin hatalarını gidermiş gibi sunulmadı.

Son sunucu: **338/338 native**, **35/35 ortak test**, tip denetimi ve CTest1/1. Üç A4 medyada4 köşe glifi ve190/142mm1:1 aralıkları gerçek PDFium ölçümünden geçti;90° sayfa dönüşü normalize edildi, konum farkı0.75pt altında. Teknik kanıt docs/TEKNIK_DENEME_KABUL.md §10. Normal ARX a48ea6686a8f54bbe7c88a3d54db16fd2088218914b594b106b900862f64e6d5. İlk high/Pro/MiMo bağımsız turları1521835... modülüyle; max/MiMo destekli/yönetici incelemeleri yeni modülle yapıldı.

**Commit/push yapılmadı:** Kaynak ölçü referansları hâlâ yorum; bağımsız max çıktısında yöntem sembolü hatası da var. Kullanıcının çizim doğruluğu koşulu geçmiş sayılmadı. DWG/PDF/SDK/binary/günlük/sırlar repoya eklenmedi. Mac veya Claude canlı testi çalıştırılmadı.

## Önizlemeler

Codex max — tutarlı görünüşler, hatalı yöntem sembolü:

Codex max (yerel kanıt; Git paketinde yok)

EVREN MiMo — koordinat destekli, gizli/eksen tipleri eksik:

EVREN MiMo (yerel kanıt; Git paketinde yok)

Pro — hatalı geometri korunarak baskı aktarımı düzeltilmiş:

DeepSeek Pro (yerel kanıt; Git paketinde yok)


CAD dosyaları gitignored: bağlantılar yalnız yerel çalışma kopyasında açılır.
