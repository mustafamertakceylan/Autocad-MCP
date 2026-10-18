# AutoCAD 2027 işlem ve API envanteri

> 2026-10-18. **42 planlanan işlemin araştırma envanteri.** Bu tablodaki belge kanıtı canlı destek değildir. Faz 2'de Windows SDK başlıkları incelendi, eklenti derlendi ve sınırlı 14 araç Core Console ile sınandı; güncel uygulama/kanıt [matriste](YETENEK_MATRISI.md) ve [kabul belgesinde](TEKNIK_DENEME_KABUL.md). Mac çalıştırılmadı. MiMo teslim edemediği için ilk envanteri yönetici tamamladı.

İlgili belgeler: [Plan](PLAN.md), [Özet matris](YETENEK_MATRISI.md), [İlk 14 araç](ILETISIM_SOZLESMESI.md), [Kabul ölçütleri](TEKNIK_DENEME_KABUL.md), [Kaynak notları](arastirma/ASAMA1_KAYNAK_NOTLARI.md).

## Kanıt anahtarı

- **M:** 2027 Windows referansında ilgili metot listelendi/açıklaması okundu. Doğru overload, SDK derlemesi ve ürün davranışı ayrıca doğrulanacak.
- **K:** 2027 sınıf/üst sınıf belgeli; işlem ayrıntısı/metot imzası henüz doğrulanmadı. Metot adayı API garantisi değildir.
- **P:** Projeye ait IPC/protokol tasarımı; Autodesk'in hazır MCP veya instance keşif API'si olduğu iddia edilmez. Kaynak yalnız native katmanın bağlamını gösterir.
- **E:** Eski sürüm API adayı; **2027 kanıtı yok**. Eski belge açıkça sürümüyle listelenir.
- **U:** **Mac 2027 sembolü doğrulanmadı; SDK başlıkları ve canlı test gerekiyor.** Genel Mac ObjectARX/AutoLISP desteği [R20] ve eksik API uyarısı [R21] tek tek sembolün varlığını kanıtlamaz. U, desteklenmiyor demek değildir.
- **T:** Canlı test **çalıştırılmadı**; uygulama yok. T bütün satırlar için geçerlidir.

Kaynak sütunundaki R bağlantıları aşağıda doğrudan resmî URL'lere çözülür. Sürüm sütunu kaynak URL'sindeki dokümantasyon ailesidir; kurulu ürün/SDK sürümünün doğrulandığı anlamına gelmez. Aşama numaraları PLAN §12'ye aittir. 42 satır tüm AutoCAD komutlarının eksiksiz sayımı değildir; ilk modül envanteridir.

## İşlem listesi

| ID | Modül | İşlem | C++ ObjectARX / köprü adayı | Kaynak | Belge sürümü | Windows kanıtı | Mac kanıtı | Canlı | Aşama |
|---|---|---|---|---|---|---|---|---|---|
| F01 | Bağlantı | Yerel AutoCAD instance keşfi | Eklenti endpoint kaydı + OS IPC; AcApDocManager instance keşfi değildir | [R01] | 2027 / proje taslağı | P | U | T | 2 |
| F02 | Bağlantı | Hello, sürüm, durum ve capabilities | bridge.hello; eklentinin kendi sürüm/yetenek kaydı | [R20] | 2027 / proje taslağı | P | U | T | 2 |
| F03 | Belge | Açık belgeleri listeleme | AcApDocManager::getDocumentIterator | [R01] | 2027 | M | U | T | 2 |
| F04 | Belge | Çizim açma | AcApDocManager::appContextOpenDocument | [R01] | 2027 | M; bağlam/yol izni ayrı | U | T | 3 |
| F05 | Belge | Doğru belge bağlamını seçme | curDocument, mdiActiveDocument, setCurDocument | [R01] | 2027 | M; aktif/current farklı olabilir | U | T | 2 |
| F06 | Belge | Çizimin birimini okuma | AcDbDatabase::insunits | [R02] | 2027 | M | U | T | 2 |
| F07 | Belge | Ayrı DWG kopyası kaydetme | AcDbDatabase::saveAs(...,bBakAndRename=false,...) | [R03] | 2027 | M; no-replace/dirty koruması kanıtı değil | U | T | 2 |
| F08 | Sorgu | Modelspace nesnelerini filtreleyerek tarama | AcDbBlockTableRecord::newIterator; filtre/cursor köprüye ait | [R04] | 2027 | M; hazır MCP sorgu motoru yok | U | T | 2→3 |
| F09 | Sorgu | Handle ile bulma ve EntityRef üretme | AcDbDatabase::getAcDbObjectId; AcDbObject::getAcDbHandle | [R02], [R05] | 2027 | M; createIfNotFound=false | U | T | 2 |
| F10 | Sorgu | Geometrik sınır kutusu okuma | AcDbEntity::getGeomExtents adayı; solid getMassProp extents | [R06], [R08] | 2027 | Solid extents M; genel entity overload adayı | U | T | 2→3 |
| F11 | 2B | Çizgi üretme ve uçlarını okuma | AcDbLine::setStartPoint/setEndPoint/startPoint/endPoint; appendAcDbEntity | [R07], [R04] | 2027 | M | U | T | 2 |
| F12 | 2B | Çember üretme, radius/center geri okuma | AcDbCircle; constructor/center/radius imzaları SDK'da doğrulanacak | [R09] | 2027 | K; üst sınıf hiyerarşisi kanıtı | U | T | 2 |
| F13 | 2B | Yay üretme | AcDbArc constructor; normal/merkez WCS | [R10] | 2027 | M; açı dönüşümü ayrıca | U | T | 4 |
| F14 | 2B | Elips üretme | AcDbEllipse(center,normal,majorAxis,radiusRatio,...) | [R11] | 2027 | M; parametre geçerliliği kontrolü gerekir | U | T | 4 |
| F15 | 2B | Polyline üretme/düzenleme | AcDbPolyline; vertex/bulge metotları sonraki doğrulama | [R09] | 2027 | K | U | T | 4 |
| F16 | Düzenleme | Taşıma | AcDbEntity::transformBy + translation matrisi | [R06] | 2027 | M; nesne türü kısıtları geçerli | U | T | 2→3 |
| F17 | Düzenleme | Döndürme | AcDbEntity::transformBy + rotation matrisi | [R06] | 2027 | M; derece/radyan adaptörü ayrı | U | T | 3→4 |
| F18 | Düzenleme | Ölçekleme | AcDbEntity::transformBy + scaling matrisi | [R06] | 2027 | M; nonuniform tüm türlerde geçerli değil | U | T | 3→4 |
| F19 | Düzenleme | Aynı belge içinde kopyalama | AcDbDatabase::deepCloneObjects | [R02] | 2027 | M; sahiplik/idMapping gerekir | U | T | 3→4 |
| F20 | Düzenleme | Nesne silme | AcDbObject::erase; transaction/undo ve geri okuma | [R05] | 2027 | M | U | T | 2→3 |
| F21 | Katman-stil | Katman kilidini okuma/değiştirme | AcDbLayerTableRecord::isLocked/setIsLocked | [R12] | 2027 | M | U | T | 2 okuma / 4 yazma |
| F22 | Katman-stil | Katman rengini okuma/değiştirme | AcDbLayerTableRecord::color/setColor | [R12] | 2027 | M; renk modeli ayrıca | U | T | 4 |
| F23 | Katman-stil | Katmanı açma/dondurma | isOff/setIsOff; isFrozen/setIsFrozen | [R12] | 2027 | M | U | T | 4 |
| F24 | Katman-stil | Çizgi tipi/kalınlık atama | setLinetypeObjectId/setLineWeight | [R12] | 2027 | M; bağlı kayıtlar ayrıca çözümlenir | U | T | 4 |
| F25 | Blok | Blok tanımını inceleme/kurma | AcDbBlockTableRecord::newIterator/appendAcDbEntity; table'a yeni kayıt ekleme ayrıntısı ayrıca | [R04] | 2027 | M; tam blok kurma akışı henüz yok | U | T | 4 |
| F26 | Blok | Blok referansı ekleme/dönüştürme | AcDbBlockReference::setBlockTableRecord/setPosition/setBlockTransform | [R13] | 2027 | M; tanım ve birim politikası ayrı | U | T | 4 |
| F27 | Blok | Nitelik tarama/ekleme | AcDbBlockReference::attributeIterator/appendAttribute | [R13] | 2027 | M; attribute içeriği ayrı | U | T | 4→5 |
| F28 | Açıklama | MText okuma/yazma | AcDbMText::contents/setContents; DB'ye ekleme | [R14] | 2027 | M; biçim/font/kaçış ayrı | U | T | 4 |
| F29 | Açıklama | Ölçülendirme | AcDbDimension ve türetilmiş ölçü sınıfları | [R15] | 2027 | K; stil/alt tür oluşturma API'si henüz seçilmedi | U | T | 4 |
| F30 | 3B | Kutu katı üretme | AcDb3dSolid::createBox + merkez dönüşümü | [R08] | 2027 | M | U | T | 2 |
| F31 | 3B | Hacim/centroid/extents geri okuma | AcDb3dSolid::getMassProp | [R08] | 2027 | M; WCS kütle özellikleri | U | T | 2 |
| F32 | 3B | Küre üretme | AcDb3dSolid::createSphere | [R08] | 2027 | M; merkez dönüşümü ayrıca | U | T | 5 |
| F33 | 3B | Extrude | AcDb3dSolid::createExtrudedSolid / extrude | [R08] | 2027 | M; profil/topoloji/overload ayrı | U | T | 5 |
| F34 | 3B | Revolve | AcDb3dSolid::createRevolvedSolid | [R08] | 2027 | M; eksen/profil denemesi gerekir | U | T | 5 |
| F35 | 3B | Boolean birleştirme/çıkarma/kesişim | AcDb3dSolid::booleanOper | [R08] | 2027 | M; hata girdi ShapeManager gövdelerini silebilir | U | T | 5 |
| F36 | Görünüm-layout-PDF | Layout ve viewport envanteri | AcDbLayout::getLayoutName/getViewportArray | [R16] | 2027 | M; viewport listesi aktivasyonla ilişkili | U | T | 5 |
| F37 | Görünüm-layout-PDF | Layout üretme/çoğaltma | AcDbLayoutManager::createLayout/copyLayout | [R17] | 2027 | M; varsayılan viewport ilk aktivasyona bağlı | U | T | 5 |
| F38 | Görünüm-layout-PDF | Dosyaya plot/PDF | AcPlPlotFactory::createPublishEngine adayı | [R18] | **2018** | E; 2027/PDF aygıtı doğrulanmadı | U | T | 5 |
| F39 | Xref-veri | Xref türü/yol/yükleme durumu envanteri | AcDbBlockTableRecord::isFromExternalReference/isFromOverlayReference/isUnloaded/pathName | [R04] | 2027 | M; attach/reload yazması bu satır değil | U | T | 3 okuma / 5 ileri |
| F40 | Xref-veri | Nesneye bağlı veri envanteri | AcDbObject::extensionDictionary; xData erişimi adayı | [R05] | 2027 | Dictionary M; XData overload ayrıca | U | T | 5 |
| F41 | Otomasyon | Komut kuyruğu | AcApDocManager::sendStringToExecute | [R01] | 2027 | M; DB transaction garantisi değildir | U | T | 5; varsayılan kapalı |
| F42 | Otomasyon | AutoLISP erişimi | AutoLISP/eklenti köprüsü; değerlendirme API'si henüz seçilmedi | [R20] | 2027 | Genel arayüz belgeli; evaluator adayı seçilmedi | U | T | 5; varsayılan kapalı |

## İlk teknik denemenin dikey dilimi

F01–F03/F05–F12/F16/F20–F21/F30–F31 içinden [ilk 14 araç kataloğu](ILETISIM_SOZLESMESI.md) sınırında kalan işlemler seçilir. Satırda API adayı olması aracın açık olduğu anlamına gelmez; yetki, platform ve nesne alt türü capability ile ayrıca bildirilir.

- **2B/mevcut çizim:** sentetik çizimin kopyasında katman/nesne sorgusu; WCS çizgi `[0,0,0]→[100,0,0]` mm ve radius25 mm çember; çizgiyi `[10,0,0]` mm taşıma. Beklenen uzunluk100 mm, çap50 mm, yeni uçlar `[10,0,0]→[110,0,0]`; sadece doğru belge değişmeli.
- **3B/yeni çizim:** merkez `[200,0,0]` mm, boyut `[100,50,20]` mm kutu. Hacim100000 mm³; min `[150,-25,-10]`, max `[250,25,10]` mm. Native sonuçlar ve birim dönüşümü AutoCAD'den geri okunmalı.
- **Kopya ve geri alma:** kullanıcı UNDO denemesi, orijinal hash/dirty durumunu koruma, ayrı kopyayı yeniden açma. Testlerin ayrıntısı ve negatifleri [kabul belgesinde](TEKNIK_DENEME_KABUL.md); hepsi çalıştırılmadı.

## Sonraki modüller ve henüz çözülmeyenler

İlk katalog bütün AutoCAD yüzeyini kapsamaz. Arc/ellipse/polyline, gelişmiş seçim, katman/stil oluşturma, blok/nitelik, açıklama, ileri katı/yüzey/mesh, görünüm/layout/PDF, xref yazmaları ve otomasyon aşama aşama açılacak. Civil 3D/Architecture/Plant gibi dikey ürünlerin özel nesneleri bu 42 satırla desteklenmiş sayılmaz. Her yeni işlem için şema, yetki/undo/yan etki, iki platform API kanıtı ve canlı geri okuma eklenecek.

Mac 2027 ana belge sayfası açılmış olsa da ayrıntı linklerinin bir kısmı erişim hatası verdi. Bu, yokluk kanıtı değildir. Circle ve genel entity ayrıntılarının bazı sayfaları da yönetici okuma aracında açılamadı; ilgili Windows hücreleri dar kanıtla yazıldı. SDK başlığına bakmadan metot imzası veya arm64 uyumluluğu kesinleştirilmedi. Plot için bulunan eski referans 2027 diye yeniden etiketlenmedi.

## Doğrudan resmî kaynaklar

[R01]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcApDocManager.html
[R02]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbDatabase.html
[R03]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbDatabase__saveAs_ACHAR__bool_AcDb__AcDbDwgVersion_SecurityParams_.html
[R04]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbBlockTableRecord.html
[R05]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbObject.html
[R06]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbEntity__transformBy_AcGeMatrix3d_.html
[R07]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbLine.html
[R08]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDb3dSolid.html
[R09]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbCurve.html
[R10]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbArc__AcDbArc.html
[R11]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbEllipse__AcDbEllipse_AcGePoint3d__AcGeVector3d__AcGeVector3d__double_double_double.html
[R12]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbLayerTableRecord.html
[R13]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbBlockReference.html
[R14]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbMText.html
[R15]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbDimension.html
[R16]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbLayout.html
[R17]: https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDbLayoutManager.html
[R18]: https://help.autodesk.com/cloudhelp/2018/ENU/OARX-RefGuide/files/OREF-AcPlPlotFactory__createPublishEngine_AcPlPlotEngine___.html
[R20]: https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm
[R21]: https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk

- [R20] genel platform tablosu ve [R21] SDK sınırlamalarıdır; işlem düzeyinde Mac kanıtının yerine geçmez.
- [Mac 2027 geliştirici ana sayfası](https://help.autodesk.com/view/OARXMAC/2027/ENU/) erişim sınırının kaydı içindir; alt semboller doğrulanmadı.
- **Uygulama, derleme, Windows canlı test ve Mac canlı test: çalıştırılmadı.**
