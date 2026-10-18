# Üçüncü taraf bağımlılıkları

Bu dosya proje için bir lisans seçmez. Projenin kendi lisansı henüz onaylanmadı.

| Bileşen | Sürüm | Lisans / kullanım |
|---|---|---|
| @modelcontextprotocol/server ve client | 2.3.1 | Apache-2.0; kurulu paketlerin LICENSE dosyaları geçerlidir. |
| Zod | 4.6.7 | MIT; kurulu paketin LICENSE dosyası geçerlidir. |
| nlohmann/json | 3.12.0 | MIT; tek başlık lisans bildirimini içerir. Kaynak: https://github.com/nlohmann/json/tree/v3.12.0 |
| TypeScript ve @types/node | 7.0.2 / 24.10.0 | Geliştirme bağımlılıkları; kurulu paketlerin lisans bildirimleri korunmalıdır. |
| Autodesk ObjectARX 2027 SDK | Windows 2027 | Autodesk'in kullanıcı tarafından kabul edilen ayrı SDK koşullarına tabidir; açık kaynak bağımlılığı değildir. SDK veya kütüphaneleri Git'e eklenmez. |
| AutoCAD 2027 | Windows test ortamı | Ayrı kurulum/lisans gerekir; ürün bu depoyla dağıtılmaz. |

Tam bağımlılık ağacı ve bütünlük hash'leri `package-lock.json` içindedir. Gelecekte ikili/npm dağıtımı yapılmadan önce tüm transitif bağımlılıkların lisans ve bildirimleri paketlemeye dahil edilmelidir; dağıtım henüz yapılmadı.
