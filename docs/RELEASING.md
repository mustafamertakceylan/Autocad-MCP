# Yayın kuralları

2026-10-20 kullanıcı talebi: bütün değişiklikler commit/push edilir, depo public yapılır, kaynak kod Apache-2.0 lisanslanır ve v1.0.0 yayımlanır. Son yöntem talebi MorseCore'daki Windows yayını gibidir: **imzasız public önizleme**. Bu sürümde sertifika/ayrı temiz cihaz eksikleri açıkça yazılır; test edilmiş veya imzalanmış gibi gösterilmez. Önceki private-preview adayları tarihçedir. npm/Pages, sertifika/hesap satın alma veya Mac yayını yetkisi yoktur.

## v1.0.0 için açık imzasız önizleme istisnası

- Kullanıcı MorseCore yöntemini istedi; oradaki README/Windows kurulum belgesi imzasız dağıtımı açıkça bildirir. Bu istisna yalnız `public-preview` kanalı ve açık `--profile unsigned-preview` yayın komutuyla uygulanır.
- `scripts/check-windows-release.mjs` sıkı imzalı/temiz cihaz kabulünü aynen raporlar; başarısız sonuç başarıya çevrilmez. Yayın betiği yalnız ARX/EXE **NotSigned** ve ayrı temiz cihaz kabulü eksikliğini bu profil altında istisna sayar. Geçersiz/bozuk/bilinmeyen imza, Node imzası, lisans, kaynak/paket bütünlüğü veya test kontrolü kapıları gevşetilmez.
- Türkçe/İngilizce README, release notları ve paket içi README imzasızlığı/temiz cihaz sınırını belirtir. Şüpheli imzayı atlama veya AutoCAD/Windows güven ayarını otomatik değiştirme yoktur. Kişisel ajan kuralları/görevler/durum kayıtları Git dışında `.local-notes/` altında tutulur; public kökte yayımlanmaz.
- `node scripts/publish-windows-release.mjs --bundle <bundle> --notes docs/releases/v1.0.0.md --target <push-edilmiş-40-karakter-commit> --profile unsigned-preview` tek yayın yoludur. Temiz checkout, origin/main, public repo, doğru sürüm, manifest ve SHA256 denetlenir; draft asset indirilip byte hash'i eşleşmeden yayımlanmaz. Yayınlanan asset yeniden indirilip doğrulanır.
- Güvenilir imzalı ve temiz cihaz kabulü tamamlanmış genel dağıtım için aşağıdaki sıkı kapılar hâlâ gereklidir. v1.0.0 numarası Faz6'nın bütünü tamamlandı anlamına gelmez.

## Windows adayını üretme

1. `npm run check`, ortak testler, CTest ve yeni native modülle gerekli AutoCAD regresyonlarını çalıştır.
2. Native modülü `AUTOCAD_MCP_TESTING=OFF` olarak derle. CMake post-build kaydı ikili hash'i, kaynak derleme kimliğini ve test bayrağını bağlar. Paketleyici bu kaydı doğrular; test kontrol derlemesini kabul etmez. Kayıt dijital yayıncı imzası değildir.
3. Yalnız proje çalışma zamanı, sabitlenmiş üretim bağımlılıkları ve lisansları, Node 24 ikilisi/tam LICENSE, ARX ve Windows tepsi EXE'si paketlenir. Autodesk SDK/host DLL, anahtar, pairing, çizim, kullanıcı ayarı ve testler pakete girmez. İkili/ZIP depoya commit edilmez.
4. Yeni çıktı dizinine `npm run package:windows -- --native-build <build> --output <yeni-dizin> --node-license <o-Node-sürümünün-tam-LICENSE-dosyası>` çalıştır. ZIP ve SHA256 yan dosyası oluşur. Mevcut adayın üzerine yazılmaz.
5. Paketin kendisiyle `test:installation:windows` çalıştır. Bu yerel geliştirme bilgisayarı kabulüdür; temiz cihaz yerine geçmez.

## İmzalı ve temiz cihaz kabulü tamamlanmış yayın kapıları

- Kullanıcı proje lisansını ve yayımlamayı açıkça onayladı: Apache-2.0 ve v1.0.0. Üçüncü taraf bildirimleri korunur. Autodesk SDK/host DLL taşınmaz; AutoCAD/SDK ayrı lisanslıdır. Resmî SDK koşulları THIRD_PARTY_NOTICES.md içindedir.
- Native ARX ve Windows tepsi EXE'si güvenilir yayıncı sertifikasıyla SHA256/zaman damgalı imzalanır. İmzalama ikili hash'ini değiştirir; native/desktop provenance ve paket manifesti **imzalamadan sonra** yeniden üretilir. Sertifika özel anahtarı dosyaya, argümana veya depoya yazılmaz. Şu anda sertifika yok; imzalama çalıştırılmadı.
- Birbirinden farklı eklenti derlemesi ile kurulu sunucu karışımı reddedilmeli. Aynı sürüm etiketli farklı derlemeler de kimlikle ayrılır. AutoCAD yeniden başlatılır; tepsi uygulamasında açık hedef seçimiyle aynı MCP transportunun yeni instance/belgeyi keşfettiği doğrulanır. Eski kimliğe bağlı kuyruk isteği yeni çizime taşınamaz.
- Windows oturum açılışında tepside başlangıç varsayılan kapalıdır. Etkinleştir/kapat ve gerçek yeniden başlatma sonrasında pencere zorlamadan başlama; Explorer yeniden başlarsa simgenin dönmesi; Başlat kısayolu ve kaldırmada kendi başlangıç kaydının temizlenmesi ayrı cihazda doğrulanır. Geliştirme sentetik registry testi gerçek reboot kabulü değildir.
- Geliştirici araçları olmayan ayrı Windows makine/VM ve gerçek AutoCAD 2027 ile ZIP'ten kurulum, bundle otomatik yükleme, güven uyarısı, MCP bağlantısı, çizim/kayıt, sürüm yükseltme, geri alma ve kaldırma doğrulanır. Kişisel ayarlar/çizimler korunur. Kurulum bozulması, açık AutoCAD, test ikilisi ve yanlış sürüm retleri de denenir.
- `node scripts/check-windows-release.mjs --bundle <bundle> --clean-machine-evidence <doğrulanmış-json>` başarısızken yayın yapılmaz. Mevcut private-preview adayının başarısız olması beklenir; lisans, imza ve temiz cihaz kapıları geçilmeden yayınlanabilir sayılmaz.
- Yayın hedefi kullanıcının açık talebiyle GitHub Releases'tir; tek betik yukarıdadır. Repo görünürlüğü yönetici tarafından açık komutla değiştirilir; kurucu/derleme betiği bunu yapmaz.
- Yayın sonrası indirilen paketin hash/imza ve taze kullanıcı kurulum kabulü doğrulanır; sonuç `docs/releases/PUBLICATION_LOG.md` içine kaydedilir. Yayın kaydı sonraki ayrı belge commit'ine girer.

Mac imza/notarization ve temiz Mac kurulumu ayrı Faz M'dedir. Modelin teknik çizim doğruluğu bu kurulum kapısının yerine geçmez; yeni teknik resim skill'i kullanıcı tarafından sonraya bırakılmıştır.
