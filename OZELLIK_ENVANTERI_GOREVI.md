# Görev: AutoCAD 2027 özellik ve API envanteri

Ajan: EVREN üzerinden MiMo V2.6 Pro. Kullanıcı bu teknik belgelerin EVREN modelleriyle işlenmesini açıkça istedi. Yönetici: Codex. AGENTS.md ve ilgili yerel standartları oku. Raporu işe başlarken OZELLIK_ENVANTERI_RAPORU_MIMO.md olarak oluştur. Proje dışındaki dosyalara erişme.

## Amaç ve sabit kapsam
Şu an yalnız planın 1–2. belge aşamaları uygulanıyor; uygulama kodu yok. Tam AutoCAD 2027; Windows ve macOS; ilk Mac test hedefi Apple Silicon/arm64. Yerel köprü, TypeScript MCP + C++/ObjectARX önerisi, private depo. Canlı test yok. Kullanıcı verisi/çizimi yok.

## Çıktı ve dosya sınırı
Yalnız docs/OZELLIK_ENVANTERI.md ve OZELLIK_ENVANTERI_RAPORU_MIMO.md yaz. Başka dosya oluşturma/değiştirme. EVREN DeepSeek ajanı yönetici kararlarını iletişim sözleşmesinde biçimlendiriyor; onun dosyalarına dokunma. Ortak README/AGENTS/PLAN/matris/standart dosyalarını yönetici güncelleyecek.

## Yapılacaklar
1. Yaklaşık 35–45 anlamlı işlem için ID, modül, işlem, C++ ObjectARX sınıf/metot adayı, doğrudan resmî belge URL, belge sürümü, Windows belge kanıtı, Mac belge kanıtı, canlı doğrulama ve aşama sütunlu envanter yaz. Sonsuz araştırma yapma; 20 resmî kaynak civarında yeterli, sınıf sayfası birkaç satırı destekleyebilir.
2. Modüller: bağlantı/belge/sorgu/2B/düzenleme/katman-stil/blok/açıklama/3B/görünüm-layout-PDF/xref-veri/otomasyon. İlk teknik deneme: instance ve belge kimliği; katman/nesne sorgusu; çizgi; çember; kutu katı; ölçü ve hacim geri okuma; taşıma; güvenli ayrı dosyaya kaydetme. API adayı ile gerçekleşmiş desteği ayır.
3. Hem yeni çizim hem mevcut çizimde sorgu/düzenleme hedefini koru. Sonraki modülleri listele; tüm özellikler tamamlandı deme. 2B inceleme örneği ve 3B kutu örneği için beklenen geometrik ölçütleri yaz.
4. Mac 2027 detay sayfası bulunmazsa 'Mac 2027 sembolü doğrulanmadı; SDK başlıkları ve canlı test gerekiyor' yaz. Windows belgesini Mac kanıtı olarak kullanma. Eski sürüm belgesini 2027 diye sunma. Genel Mac ObjectARX desteği tek tek sembolü kanıtlamaz. API varlığı -> derlendi/çalıştı sonucu çıkarma.
5. Sayfa bulunamadı döndüren URL'yi kanıt yapma. En fazla iki erişim denemesinden sonra sınırı kaydet ve devam et. Yalnız Autodesk/help.autodesk.com/APS birincil belgeleri; topluluk yazısını API garantisi sayma. Kaynakları uzun alıntılar yerine kısa kendi özetlerinle kullan. SDK indirme/kurulum/lisans kabulü yok.

## Başlangıç kaynakları
- https://help.autodesk.com/view/OARX/2027/ENU/
- https://help.autodesk.com/view/OARXMAC/2027/ENU/
- https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm
- https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk
- https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDb3dSolid__createBox_double_double_double.html (kutu merkezi WCS orijini; eksenler WCS; min boyut 1e-6 çizim birimi)
- https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDbBlockTableRecord__appendAcDbEntity_AcDbObjectId__AcDbEntity_.html
- https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcApDocManager__lockDocument_AcApDocument__AcAp__DocLockMode_ACHAR__ACHAR__bool.html
- docs/arastirma/MEVCUT_COZUMLER_2026-10-18.md (tarihsel araştırma, ana teknik kanıt resmî belgeler olacak)

## Kontrol ve dersler
İlgili dersler: rapor kanıt değildir, canlı test abartılmaz; API belgesi yalnız belge kanıtıdır. Her satırdaki kaynak URL'si doğru işlem/sınıfı desteklesin. Rapor: dosya:satır, erişilen/erişilemeyen kaynaklar, çalıştırılmayan testler. Kabuk yalnız okuma/listeleme için kullanılabilir. Kod, manifest, SDK, AutoCAD başlatma/bağlanma, Mac SSH, git add/commit/push/yayın, dosya silme YOK.
