# Kararlar

> Durum: 2026-10-18. Bu dosya karar kaydıdır; **uygulama izni vermez.**
>
> - **Sabit:** Kullanıcı kararı; değiştirilmez.
> - **Öneri:** Teknik yön; karar değil, uygulanmadı ve doğrulanmadı.
> - **Açık:** Henüz karar yok; tahminle doldurulmaz.

İlgili belgeler: [Plan](PLAN.md), [Yetenek matrisi](YETENEK_MATRISI.md), [Araştırma](arastirma/MEVCUT_COZUMLER_2026-10-18.md), [Ajan kuralları](../AGENTS.md).

## 1. Sabit kullanıcı kararları

| No | Karar | Ayrıntı |
|---|---|---|
| K-01 | Ad ve konum | Proje adı **Autocad MCP**; çalışma klasörü bu depo. |
| K-02 | GitHub | Depo adı `Autocad-MCP`; görünürlük **private**. Public ancak açık kullanıcı talebiyle. |
| K-03 | Platform | Tam AutoCAD 2027; Windows ve macOS. Mac işlemci mimarisi belirtilmedi. |
| K-04 | Kapsam | Yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme birlikte hedeflenir. |
| K-05 | Yerel köprü | Her kullanıcının bilgisayarında yerel köprü; zorunlu merkezi hesap/sunucu yok. |
| K-06 | Veri akışı | Yerel köprü, bulut AI sağlayıcısının veri akışını otomatik yerelleştirmez. AI istemcisinin buluta veri göndermesi ayrı veri akışıdır. |
| K-07 | Ürün yönü | İleride kurulabilir açık kaynak ürün hedeflenir. |
| K-08 | Lisans | Lisans kesinleşmedi. Apache-2.0 yalnız öneridir; `LICENSE` yazılmaz. |
| K-09 | Güncel izin | Yalnız depo kurulumu, araştırma ve planlama belgeleri. Kodlama, kurulum, derleme, CI, SDK kurulumu ve AutoCAD bağlantısı yok. |
| K-10 | Dil | Kullanıcı iletişimi ve proje belgeleri Türkçe. MCP araç metinlerinin dili uygulama öncesinde netleştirilecek. |
| K-11 | Commit dili | Bu depo için Türkçe; kapsamlar `init`, `agents`, `plan`, `docs`, ileride `bridge`, `plugin`, `mcp`, `installer`. |
| K-12 | Test ortamı | Henüz kurulmadı. Gelecekte yalnız sahte veya açık örnek çizimlerin kopyaları; gerçek müşteri/üretim dosyası yok. |
| K-13 | Yayın | GitHub Pages, Release ve paket yayını yok; depo kullanıcı istemeden public yapılmaz. |
| K-14 | Mac | Mac derlemesi ve canlı testi ileride gerekir; kullanıcı o iş için onay vermeden Mac'e bağlanılmaz. |
| K-15 | Hesap/imza | SDK koşullarını kabul etmek, hesap açmak, ödeme ve imzalama hesabı işlemleri kullanıcıya aittir. |
| K-16 | Önceki araştırma | `C:\Dev\Other Projects\AutoCAD-MCP` araştırma klasörü korunur; bu projenin kökü değildir. |
| K-17 | Raporlama | Her özellik; hedef, platform/API ve gerçek test durumuyla raporlanır. Serbest komut/LISP erişimi tam test kapsamı sayılmaz. |

## 2. Teknik öneriler (karar değil)

Bu maddeler yönetici tarafından belirlenen tasarım yönleridir. Hiçbiri uygulanmadı veya canlı test edilmedi; karar gibi okunmamalıdır.

| No | Öneri | Gerekçe / sınır |
|---|---|---|
| Ö-01 | Dış katmanda TypeScript ve resmî MCP SDK | MCP ekosistemi ve stdio için doğal seçim; SDK/spesifikasyon sürüm farkları test gerektirir. |
| Ö-02 | İçeride C++/ObjectARX ortak kaynaklarından Windows ve macOS için ayrı derleme | ObjectARX iki platformda belgeli; .NET/ActiveX yalnız Windows. Mac SDK tüm API'leri içermiyor. |
| Ö-03 | Windows'ta named pipe, macOS'ta Unix domain socket | Yerel süreçler arası, varsayılan ağ dinleyicisi gerektirmeyen taşıma. |
| Ö-04 | MCP taşımasında önce stdio | En dar yerel kapsam; ağ yüzeyi açmaz. |
| Ö-05 | Streamable HTTP ve bulut istemci erişimini ayrı kapsamda ele almak | Kimlik doğrulama, TLS, origin, maruz kalma ve veri akışı ayrı karar gerektirir. |
| Ö-06 | İşlem hattı: hedef çözümleme → inceleme/hazırlık → uygulama → geri okuma → bildirim | Başarıyı istek kabulüne değil, AutoCAD'den gerçek geri okumaya bağlar. |
| Ö-07 | AutoCAD API erişimini ana iş parçacığında uygun bağlamda sıralamak | İş parçacığı/bağlam kısıtları ve eşzamanlı değişiklik riski. |
| Ö-08 | Belge başına transaction/undo grubu; dosya/komut/LISP yan etkilerinin sınırını ayırmak | Geri alınabilirliği artırır; transaction dışı etkiler ayrı raporlanmalı. |
| Ö-09 | İşlem kimliği, tekrar istek ve zaman aşımı için "bilinmiyor" durumu | Zaman aşımında başarı/başarısızlık uydurmamak; uzlaştırma sorgusu gerekir. |
| Ö-10 | Yetki profilleri (salt okuma, çizim, düzenleme, otomasyon) | Öneri; her işlemi kullanıcıya onaylatma varsayımı yok. |
| Ö-11 | Gelişmiş LISP/komut erişimini varsayılan kapalı ve ayrı yetkiyle ele almak | Gelişmiş LISP bir güvenlik sandbox'ı değildir. |
| Ö-12 | Platform/API/gerçek test durumunu yetenek matrisinde tutmak | Genel API belgeli olması, özelliğin o platformda çalıştığını kanıtlamaz. |
| Ö-13 | Test katmanlarını ve dağıtımı ayrı aşamalara bölmek | Canlı AutoCAD testi olmadan ürün iddiası kurmamak. |
| Ö-14 | Paketlemede Windows için ARX + kurulum, macOS için bundle + notarization önerisi | Platform araç zinciri ve imzalama açık karar. |
| Ö-15 | MCP sunucusunu npm paketi veya paketlenmiş çalıştırılabilir olarak dağıtma önerisi | Node çalışma zamanı ve sürüm sabitleme açık karar. |

## 3. Henüz karar olmayanlar

| No | Açık karar | Not |
|---|---|---|
| A-01 | Mac işlemci mimarisi | Universal/arm64/x86_64; kullanıcı belirtecek. |
| A-02 | AutoCAD LT desteği | İlk hedef tam AutoCAD 2027; LT ayrı karar. |
| A-03 | Lisans | Apache-2.0 yalnız öneri. |
| A-04 | Depo görünürlüğü | Şu an private; değişiklik açık kullanıcı talebi gerektirir. |
| A-05 | Streamable HTTP/uzak erişim | İlk sürümde yok; ayrı kapsam. |
| A-06 | Bulut istemci erişimi | Ayrı veri akışı ve gizlilik/güvenlik incelemesi. |
| A-07 | MCP araç metinlerinin dili | Uygulama öncesi netleştirilecek. |
| A-08 | Keyfi komut/LISP | Varsayılan kapalı önerisi; ayrı yetki ve güvenlik incelemesi. |
| A-09 | Yetki profillerinin ayrıntısı | Profil adları/kuralları kesin değil. |
| A-10 | Çoklu AutoCAD instance davranışı | Hedef seçimi ve belirsizlik politikası. |
| A-11 | Birim/koordinat politikası | Belgeden okuma; bilinmiyorsa yazma yok önerisi. |
| A-12 | 3B kapsamı | İlkel nesnelerle başlama önerisi; ileri modelleme açık. |
| A-13 | Layout/PDF kapsamı | Plot aygıtı ve platform farkları test edilmeli. |
| A-14 | Xref okuma/yazma sınırı | Önce envanter/okuma önerisi; yazma ayrı karar. |
| A-15 | AutoCAD 2027 dışı sürüm desteği | Önce 2027; genişletme ayrı karar. |
| A-16 | MCP SDK/spesifikasyon sürümü | Sürüm sabitleme ve uyumluluk testi gerekir. |
| A-17 | Dağıtım kanalı | npm/paketli çalıştırılabilir; ilk sürüm için en dar yol. |
| A-18 | İmzalama/notarization kimliği | Kullanıcı sağlayacak; ayrı iş. |
| A-19 | Telemetri/günlük saklama | Varsayılan en az veri önerisi; ayrı karar. |
| A-20 | Desteklenen işletim sistemi sürümleri | Temiz cihaz testleriyle netleşecek. |
| A-21 | Performans hedefleri | Ölçüm olmadan sayı verilmez. |
| A-22 | Yerelleştirme | Belgeler Türkçe; araç/arayüz dili ayrı karar. |
| A-23 | Otomatik güncelleme | İlk sürümde varsayılan değil önerisi. |
| A-24 | Süreç yaşam döngüsü | stdio sunucusunu istemcinin otomatik başlatması önerilir; eklenti etkinleştirme, kapanma ve yeniden bağlanma teknik denemede netleşecek. Kullanıcıdan ayrı uygulama penceresi açması beklenmez. |

## 4. Uygulama izni ve sıradaki adım

- **Mevcut izin yalnız belge işidir.** Bu dosya kodlama, kurulum, derleme, CI, SDK kurulumu veya AutoCAD bağlantısı izni vermez.
- **Sonraki somut adım:** özellik envanteri ve API sözleşmesi. Bu adım da belge/araştırma düzeyindedir; canlı AutoCAD testi ve kod içermez.
- **Kod ancak kullanıcı ayrıca başlatırsa** yazılır. Önceki bir izin sonraki işlere aktarılmaz.
- Uygulayıcılar commit/push yapmaz; commit yalnız kullanıcı açıkça istediğinde yönetici tarafından yapılır.

## 5. Kaynaklar

- [Plan](PLAN.md) — aşamalar, mimari önerisi, test katmanları.
- [Yetenek matrisi](YETENEK_MATRISI.md) — modül/platform/test durumu.
- [Araştırma](arastirma/MEVCUT_COZUMLER_2026-10-18.md) — mevcut çözümler; canlı test yok.
- Autodesk 2027 API tablosu: <https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm>
- ObjectARX SDK genel bakış: <https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk>
- MCP TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>
- MCP spesifikasyon değişiklik günlüğü: <https://modelcontextprotocol.io/specification/2026-07-28/changelog>
