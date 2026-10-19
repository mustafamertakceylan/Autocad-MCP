# Makine mühendisliği kapsamı — Faz 5

2026-10-18 başlatıldı, 2026-10-19 güncellendi. Kullanıcı önceki Faz 5 sırasının tamamını koruyup makine mühendisliği ihtiyaçlarını ekledi ve yöneticinin kendisinin başlamasını istedi. Windows AutoCAD 2027 hedeflenir; Mechanical toolset gerektiren komutlar temel AutoCAD desteği sayılmaz. Güncel Windows modülü 52 araçtır; tablo uygulanmış kısımla açık alt paketleri ayırır. Kabul kanıtı olmayan bölüm uygulanmış sayılmaz.

## Sıra ve kabul

| Paket | Mekanik iş | İlk durum / kabul |
|---|---|---|
| 5A-1 | Native doğrusal/hizalı, çap/yarıçap ölçüleri; metin; katman, çizgi kalınlığı ve stiller | Uygulandı; native ölçü/yazı/katman/stil/çizgi tipi, değer/birim/UNDO/kayıt-reopen kabulü geçti |
| 5A-1b | Kullanıcının açık verdiği alt/üst sapmalar, limit ölçü, hassasiyet; geçme etiketi | Açık alt/üst sapma ve hassasiyet uygulandı. Limit modu ve otomatik H7/g6 seçimi yok; geçme yalnız kullanıcının verdiği etiket olabilir |
| 5A-1c | Merkez/eksen ve gizli çizgiler, tarama, kesit ve detay gösterimleri | Basit center/hidden dash stili, native HATCH ve katı kesit REGION uygulandı; otomatik kesit/detay paftası üretimi yok |
| 5A-2 | Yay/polyline, fillet/chamfer, offset, trim/extend, kopya/döndür/ayna; doğrusal/dairesel diziler | Uygulandı. WCS XY; extend LINE, köşe işlemi ortak uçlu iki LINE; açık sınır ve hata kabulleri geçti |
| 5A-3 | Blok/nitelik, standart parça yerleştirme, parça numarası, balon, antet ve parça listesi | Blok/nitelik/BOM/native TABLE uygulandı; açık verilen tanımdan antet/parça yerleştirilebilir. Dahil standart parça kütüphanesi ve balon aracı yok |
| 5A-4 | Delik, kademeli delik/havşa, diş tanımı, delik dairesi; mil, kanal/kama, segman oluğu gibi parametrik yardımcılar | Gerçek çoklu delik/kademeli delik/havşa ve kademeli mil uygulandı; açık merkez/çap/derinlik/segmentler. Kanal/kama/oluk açık kesici+boolean ile kurulabilir; diş geometri/özel yardımcı ve kalıcı parametrik kısıt yok |
| 5A-5 | GD&T çerçevesi/datum, yüzey işleme-pürüzlülük ve kaynak sembolleri | Native FCF, açık sembol/tolerans/datum etiketi uygulandı; görsel extents unavailable. Yüzey pürüzlülüğü ve kaynak sembol aracı açık alt pakettir; not MTEXT olabilir, standart sembol sayılmaz |
| 5B | Kapalı profilden extrude/revolve, delik çıkarma, boolean, kesit; hacim/alan/merkez ve kullanıcı yoğunluğuyla kütle | Uygulandı; gerçek hacim/alan/merkez/explicit yoğunluk kütlesi ve kayıt-reopen kabulü geçti. Yüzey/mesh, sweep/loft ayrı alt paket |
| 5B ileri | Sac kalınlığı/büküm ve açınım ihtiyacı, dişli/yay gibi hesap gerektiren parçalar | Ayrı alt kabul gerekir. Üretim parametreleri olmadan otomatik tasarım yapılmaz; temel AutoCAD kapsamı/API uygunluğu araştırılır |
| 5C | Ölçekli pafta, görünüş/kesit, antet, PDF, xref ve veri çıkarımı | Kamera, ölçekli layout/viewport/PDF, staged xref lifecycle ve BOM uygulandı. A4 PDF render ve native DWG kabulü geçti; otomatik antet/detay düzenleme ve genel veri çıkarımı yok |
| 5D | Açık izinli toplu görevler | 24 adımlı typed create batch, ayrı alt araç izinleri, tek revision/ID ve atomik rollback uygulandı. Ham LISP/komut yok |

İlk uçtan uca örnek mevcut 80×40 mm, merkez Ø10 parçadır: gerçek ölçü nesneleri, yazı ve ayrı katmanlarla yeni DWG; ölçüm sorgusu ve yeniden açma. Sonraki mekanik örnek açık toleranslı plaka, delik dairesi/flanş ve mil kesiti olur. Eski test çizimleri değiştirilmez.

Her yeni nesne türü oluşturma yanında sorgu/projeksiyon, taşıma/silme izinleri, işlem durumu, geri alma ve kayıt doğrulaması kapsamına girer. Görsel sonuç tek başına boyutsal doğruluk değildir. Skill'ler ve capability kataloğu yalnız gerçek destekle güncellenir. Sonuçlar [kabul belgesinde](TEKNIK_DENEME_KABUL.md), kilometre taşları tek [durum dosyasında](TEKNIK_DENEME_KABUL.md) tutulur.

## Doğrulama sınırı

Faz5 paketleri gerçek AutoCAD2027 Core Console + resmi MCP SDK istemcisiyle sentetik çizimlerde sınandı. Faz4 canlı Codex/OpenCode pilotu tarihî14 araç alt kümesidir.19Ekim yeni braket için52 araçlık kataloğun2B/ölçü/antet/pafta alt kümesi GPT-6.1-Sol ve DeepSeek Pro ile denendi; MiMo ilk bağımsız turu çıktı üretmedi, koordinat destekli tur ayrıca değerlendirilir. [Karşılaştırma](UC_GORUNUS_KARSILASTIRMASI.md) model hataları/girdi farklarını ayırır.52 aracın tamamı her modelde sınanmış değildir; Claude canlı modeli, Mac ve yeni modülün tam masaüstü hata-enjeksiyon regresyonu çalıştırılmadı.

## Kaynak yönü

Resmî katalog kapsamları incelendi; tam metinler satın alınmadı ve sayısal standart tabloları kopyalanmadı. Bir katalog başlığına dayanarak ISO uyumluluk sertifikası veya üretime uygunluk iddiası kurulmaz. Mühendislik standardı/sürümü ve tasarım parametreleri açıkça belirlenir.

- [ISO 129-1:2018](https://www.iso.org/standard/64007.html): boyut ve ilişkili tolerans gösterimi.
- [ISO 286-1:2010](https://www.iso.org/standard/45975.html): lineer boyut toleransları, sapmalar ve geçmelerin temeli.
- [ISO 1101:2017](https://www.iso.org/standard/66777.html): geometrik tolerans gösterimi.
- [ISO 21920-1:2021](https://www.iso.org/standard/72196.html): yüzey dokusu gösterimi.
- [ISO 6410-1:1993](https://www.iso.org/standard/12750.html): vida dişi gösterimleri.
- [ISO 2553:2019](https://www.iso.org/standard/72740.html): kaynak bağlantısı sembolleri; katalogda yeni sürüm çalışması ayrıca listeleniyor, uygulama öncesi seçilen sürüm yeniden kontrol edilir.

Bu iş CAD çizim/modelleme köprüsüdür; FEA, dayanım/yorulma hesabı, tolerans yığılması veya CAM takım yolu hesapları uygulanmış özellikler değildir.
