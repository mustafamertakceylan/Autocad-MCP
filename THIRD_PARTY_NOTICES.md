# Üçüncü taraf bağımlılıkları

Projenin kendi kaynak kodu kullanıcı kararıyla Apache-2.0 lisanslıdır; LICENSE ve NOTICE geçerlidir. Aşağıdaki üçüncü taraflar kendi lisanslarını korur.

| Bileşen | Sürüm | Lisans / kullanım |
|---|---|---|
| @modelcontextprotocol/server ve client | 2.3.1 | Apache-2.0; kurulu paketlerin LICENSE dosyaları geçerlidir. |
| Zod | 4.6.7 | MIT; kurulu paketin LICENSE dosyası geçerlidir. |
| nlohmann/json | 3.12.0 | MIT; tek başlık lisans bildirimini içerir. Kaynak: https://github.com/nlohmann/json/tree/v3.12.0 |
| TypeScript ve @types/node | 7.0.2 / 24.10.0 | Geliştirme bağımlılıkları; kurulu paketlerin lisans bildirimleri korunmalıdır. |
| Autodesk ObjectARX 2027 SDK | Windows 2027 | Autodesk'in kullanıcı tarafından kabul edilen ayrı SDK koşullarına tabidir; açık kaynak bağımlılığı değildir. SDK veya kütüphaneleri Git'e eklenmez. |
| AutoCAD 2027 | Windows test ortamı | Ayrı kurulum/lisans gerekir; ürün bu depoyla dağıtılmaz. |

Tam bağımlılık ağacı ve bütünlük hash'leri `package-lock.json` içindedir. Üretim bağımlılıklarının lisans ve bildirimleri pakete dahil edilir; npm yayını yapılmaz. İmzalı/temiz cihaz kabulü tamamlanmış dağıtım sonraki iştir.

v1.0.0 imzasız public önizlemesi için proje LICENSE/NOTICE, Node24 tam LICENSE, üretim bağımlılıklarının kendi lisansları ve nlohmann/json bildirimleri pakettedir. Autodesk SDK başlıkları/kütüphaneleri/host DLL'leri pakete veya Git'e eklenmez. Resmî [ObjectARX2027 koşulları](https://aps.autodesk.com/developer/overview/autocad-objectarx-sdk-licensing) incelendi: hedef tam AutoCAD'dir; LT desteği verilmez. Bu kontrol Autodesk SDK'sının Apache-2.0 olduğu veya Autodesk onayı alındığı anlamına gelmez.
