# Görev: Autocad MCP planlama belgelerini hazırla

Ajan: DeepSeek V4.1 Flash, en yüksek efor. Yönetici: Codex.
Önce AGENTS.md ve işaret edilen kuralları oku. Proje dışındaki dosyalara erişme. İşe başlar başlamaz KURULUS_BELGELERI_RAPORU_DEEPSEEK.md oluştur.

## Amaç
Kullanıcı private GitHub deposuna mevcut araştırma ve kararlaştırılan planın kaydedilmesini istiyor. Henüz kodlama istemiyor. Yalnız belgeleri hazırla; mimari ve ürün kararlarını değiştirme.

## Değiştirilemez kullanıcı kararları
- Ad: Autocad MCP. Proje klasörü bu klasör; GitHub adı Autocad-MCP, private. Görünürlük ileride ancak açık kullanıcı talebiyle değişir.
- Tam AutoCAD 2027; hem Windows hem Mac. Mac işlemci mimarisi belirtilmedi.
- Yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme.
- Her kuranda yerel köprü; zorunlu merkezi hesap/sunucu yok. Yerel köprü, bulut AI sağlayıcısının veri akışını otomatik yerelleştirmez.
- İleride kurulabilir açık kaynak ürün. Lisans kesinleşmedi; Apache-2.0 öneri, LICENSE yazma.
- Kodlama, kurulum, derleme, CI, çalışma ortamına/AutoCAD'e bağlanma YOK.

## Yönetici tarafından belirlenen plan yönü
TypeScript + resmi MCP SDK ile dış sunucu; C++/ObjectARX ile Windows/Mac için ayrı derlenen ortak eklenti. Windows named pipe, Mac Unix socket önerisi. stdio ilk temel; Streamable HTTP ve bulut istemci erişimi ayrıca kapsamlandırılacak. Bunlar uygulanmamış tasarım yönleri; çalışıyor deme.

İşlem: hedef instance/belge/nesne kimliği ve birim/koordinat sistemi belirle -> incele/hazırla -> uygula -> AutoCAD'den geri oku -> sonucu bildir. API erişimi ana iş parçacığında uygun bağlamda sıralanır. Tek belge transaction/undo ile dosya/komut/LISP yan etkilerinin sınırlarını ayır. Tekrar istek ve zaman aşımı için işlem kimliği ve bilinmiyor durumu gerekir. Gelişmiş LISP bir sandbox değildir. Platformda bulunmayan özellik destekleniyor denmez. Sürekli her işlemi kullanıcıya onaylatmayı varsayma; yetki profilleri öneridir.

## Yazılacak dosyalar
1. README.md: kısa ürün tanımı, mevcut durum yalnız planlama, yerel akış, hedef platformlar, plan/kararlar/matris/araştırma/AGENTS bağlantıları. Henüz çalıştırılabilir kurulum komutu verme. Repo linki https://github.com/mustafamertakceylan/Autocad-MCP (oluşturmayı yönetici yapar).
2. docs/PLAN.md: kullanıcı kararları ve öneriler ayrı; ürün akışı; önerilen mimari; modüller; hata durumları; özellik matrisi stratejisi; stdio/HTTP/uzak erişim ayrımı; test katmanları; paketleme; açık kararlar; kaynaklar. Aşamalar ve kabul: envanter -> iki platformda 2B+3B teknik deneme -> güvenilir inceleme/düzenleme -> ilk kullanılabilir sürüm -> ileri modüller -> temiz cihazda dağıtım. Süre tahmini uydurma.
3. docs/KARARLAR.md: sabit kullanıcı kararları, teknik öneriler, henüz karar olmayanlar. Uygulama izni yok. Sonraki somut adım özellik envanteri/API sözleşmesi, kod ancak kullanıcı ayrıca başlatınca.
4. docs/YETENEK_MATRISI.md: ilk plan tablosu. Her satırda modül, örnek işlemler, Windows2027 durumu, Mac2027 durumu, gerçek test durumu, aşama. Bütün uygulama/test hücreleri henüz uygulanmadı/çalıştırılmadı. Modüller bağlantı/belge/sorgu/2B/düzenleme/katman-stil/blok/açıklama/3B/görünüm-layout-PDF/xref-veri/otomasyon. Platform API ayrıntılarında kesin uyumluluk uydurma.
5. KURULUS_BELGELERI_RAPORU_DEEPSEEK.md: dosya:satır ile sonuç ve çalıştırılmayanlar; sadece belge işi.

## Okunacak kaynaklar
- docs/arastirma/MEVCUT_COZUMLER_2026-10-18.md: yönetici düzeltmesi ilk bölümde; ilk altı projeye ait Mac/3B yok ifadelerini tüm ekosisteme genelleme.
- docs/standart/ ve docs/sablonlar/ içindeki ilgili dosyalar.
- https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm (ObjectARX/AutoLISP Win+Mac, .NET/ActiveX Win)
- https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk (Mac tüm API'leri içermiyor)
- https://github.com/modelcontextprotocol/typescript-sdk ve https://modelcontextprotocol.io/specification/2026-07-28/changelog (sürüm farklılıkları test gerektirir)
Yeni internet araştırması yapma; mevcut araştırma ve bu kaynak bağlantıları yeterli. Kaynak iddiası ile tasarım önerisini ayır.

## Dokunulmayacaklar
AGENTS.md, CLAUDE.md, GEMINI.md, .gitignore, .gitattributes, .git/, docs/standart/, docs/sablonlar/, docs/arastirma/, diğer proje ve kullanıcı dosyaları. Bu görev dosyasını değiştirme. Kod/komut dosyası/package.json/CI/SDK/bağımlılık ekleme yok. Kişisel veri/sır yazma yok.

## Kontroller ve yasaklar
Markdown bağlantılarını ve tutarlılığı denetle. Kabukla sadece dosya okuma/listeme yapılabilir; git komutu, ağ, uygulama başlatma ve betik çalıştırma yok. Yönetici nihai dosya, sır ve Git kontrollerini kendisi yapar. Uygulama/tip/lint/test komutu henüz olmadığı için çalıştırılmadı yaz. Commit/push/yayın/git add/dosya silme YOK.
