# Faz 2 durum kaydı

2026-10-18. Kullanıcı Faz 2'yi Codex'in kendisinin geliştirmesini istedi; delegasyon yok. Mac ayrı Faz M olarak ayrıldı; güncel kapsam Windows. Bu kısa kayıt kullanıcı onayıyla tutulur; yalnız kilometre taşlarında güncellenir.

- **Durum:** 2A ortak MCP/IPC ve 2B Windows ObjectARX prototipi geliştirildi. 11 ortak test ve 1 C++ testi geçti. Gerçek Core Console'da mm/metre için UNDO dahil 30+30, birimsiz çizim için 9 kontrol geçti. Eski 2C paketi ayrı Faz M'ye taşındı; Mac Windows fazlarını engellemez. 2D'nin Windows masaüstü/çoklu belge ve kalan kabul kapıları açık, Faz 2 devam ediyor.
- **Ortam:** Windows AutoCAD 2027 R26.0.60.0.0 / Core Console X.60.0.0; Node 24.19.0, npm 11.17.0, Visual Studio 18 Community, MSVC 14.51.36231. SDK'nın önerdiği MSVC 14.44 yerine daha yeni 14.51 ile derleme/yükleme başarılı; resmî araç zinciri eşleşmesi iddiası yok.
- **Tamamlanan:** MCP SDK server/client 2.3.1, Zod 4.6.7 ve TypeScript 7.0.2 sabit. 14 araç, HMAC/özel DACL, açık hedef ve birim, revision/epoch, dedup, geometri geri okuma; ayrı DWG snapshot/geometri doğrulaması ve no-replace kayıt. Resmî SDK client → stdio → pipe → gerçek ObjectARX zinciri sınandı. Kod yönetici tarafından yazıldı/denetlendi.
- **SDK:** Kullanıcı lisans/indirmeyi onayladı ve resmî formun insan doğrulamasını tamamladı. Autodesk imzası geçerli Windows 2027 paketi tmp/sdk/CDROM1 içine açıldı; SDK repoya alınmaz. Nlohmann JSON 3.12.0 sabit SHA256 ile CMake bağımlılığıdır.
- **Kanıt:** tmp/live-runs/981a1da6-c31c-4c22-880b-2c78b3a13d87 (mm+UNDO), 1e14c371-8cf0-4b1e-b7dd-21828c2bb19d (m+UNDO), 01b12360-632d-4916-bad2-0ad0f7d4a0f2 (birimsiz); sonuç JSON ve günlükler Git dışında. Kaynak hash/dirty korundu, kopya geometri yeniden açılarak karşılaştırıldı, tek UNDO yalnız taşımayı geri aldı.
- **Belgeler:** README, plan/kararlar, matris, sözleşme ve kabul tablosu güncel. Kurulum/derleme ve opt-in test docs/GELISTIRME.md içinde. Proje lisansı seçilmedi; üçüncü taraf notları ayrı.
- **Sıradaki:** Masaüstü async dispatcher/çoklu sekme, modal-kilit çatışması ve dosya yarışı kabulü; Mac ayrı Faz M'de, kullanıcı ayrıca başlatınca. Claude/Codex pilotları Faz 4'te. Kişisel istemci ayarları değiştirilmedi.
- **Açık kapılar:** Core Console sonuçları masaüstü event loop, çoklu belge/sekme, kilit çatışması ve bütün dosya yarışı testlerini kanıtlamaz. Aynı kullanıcı hesabını tamamen ele geçiren sürece karşı dosya tabanlı eşleştirme sandbox iddiası taşımaz.
- **Mac / Faz M:** Bağlanılmadı; derleme/canlı test çalıştırılmadı. Windows Faz 2–6 kabulüne dahil değildir.
- **Git:** Önceki belge değişiklikleri korunur; commit/push yapılmaz.
