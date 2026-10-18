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
| K-03 | Platform | Tam AutoCAD 2027; Windows ve macOS. Kullanıcı 2026-10-18 tarihinde Mac'in Apple Silicon (M serisi) olduğunu belirtti; ilk Mac test hedefi arm64. |
| K-04 | Kapsam | Yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme birlikte hedeflenir. |
| K-05 | Yerel köprü | Her kullanıcının bilgisayarında yerel köprü; zorunlu merkezi hesap/sunucu yok. |
| K-06 | Veri akışı | Yerel köprü, bulut AI sağlayıcısının veri akışını otomatik yerelleştirmez. AI istemcisinin buluta veri göndermesi ayrı veri akışıdır. |
| K-07 | Ürün yönü | İleride kurulabilir açık kaynak ürün hedeflenir. |
| K-08 | Lisans | Lisans kesinleşmedi. Apache-2.0 yalnız öneridir; `LICENSE` yazılmaz. |
| K-09 | Güncel izin | Kullanıcı Faz 2 Windows/ortak kodunu Codex'in kendisinin geliştirmesini istedi; bağımlılık, SDK, derleme ve izole Windows AutoCAD testi onaylı. Delegasyon, Mac bağlantısı, commit/push/yayın yok. |
| K-10 | Dil | Kullanıcı iletişimi ve proje belgeleri Türkçe. Prototip araç açıklamaları teknik varsayılan olarak İngilizce; kullanıcı belgeleri Türkçe. |
| K-11 | Commit dili | Bu depo için Türkçe; kapsamlar `init`, `agents`, `plan`, `docs`, ileride `bridge`, `plugin`, `mcp`, `installer`. |
| K-12 | Test ortamı | Stok şablon kopyalarıyla izole Core Console profili; gerçek müşteri/üretim dosyası yok. |
| K-13 | Yayın | GitHub Pages, Release ve paket yayını yok; depo kullanıcı istemeden public yapılmaz. |
| K-14 | Mac | Kullanıcı Mac'i ayrı Faz M olarak ayırdı. Güncel Faz 2–6 Windows kapsamındadır; Mac kabulü Windows ilerlemesini engellemez. Faz M ayrıca başlatılır; uygunluk/onay olmadan Mac'e bağlanılmaz. |
| K-15 | Hesap/imza | SDK koşullarını kabul etmek, hesap açmak, ödeme ve imzalama hesabı işlemleri kullanıcıya aittir. |
| K-16 | Önceki araştırma | `C:\Dev\Other Projects\AutoCAD-MCP` araştırma klasörü korunur; bu projenin kökü değildir. |
| K-17 | Raporlama | Her özellik; hedef, platform/API ve gerçek test durumuyla raporlanır. Serbest komut/LISP erişimi tam test kapsamı sayılmaz. |
| K-18 | Bu belge işindeki ajanlar | Kullanıcı EVREN MiMo ve EVREN DeepSeek kullanılmasını istedi. Önce MiMo denenir; çalışmazsa ayrı DeepSeek Pro ajanına geçilebilir. Paylaşılan kapsam teknik plan/kural/görev belgeleridir; sır veya kişisel çizim yok. |

## 2. Teknik öneriler (karar değil)

Bu maddeler yönetici tarafından belirlenen tasarım yönleridir. Faz 1 tasarım yönleridir. Windows prototipinde uygulanan alt küme aşağıdaki §4'te ayrılır; Mac ve ileri modüller öneri olarak kalır.

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
| A-01 | Intel/universal Mac dağıtımı | Apple Silicon/arm64 ilk test hedefi olarak netleşti; Intel/universal desteği ayrıca değerlendirilecek. |
| A-02 | AutoCAD LT desteği | İlk hedef tam AutoCAD 2027; LT ayrı karar. |
| A-03 | Lisans | Apache-2.0 yalnız öneri. |
| A-04 | Depo görünürlüğü | Şu an private; değişiklik açık kullanıcı talebi gerektirir. |
| A-05 | Streamable HTTP/uzak erişim | İlk sürümde yok; ayrı kapsam. |
| A-06 | Bulut istemci erişimi | Ayrı veri akışı ve gizlilik/güvenlik incelemesi. |
| A-07 | MCP araç metinlerinin dili | Prototip İngilizce; ürün yerelleştirmesi açık. |
| A-08 | Keyfi komut/LISP | Varsayılan kapalı önerisi; ayrı yetki ve güvenlik incelemesi. |
| A-09 | Yetki profillerinin ayrıntısı | Profil adları/kuralları kesin değil. |
| A-10 | Çoklu AutoCAD instance davranışı | [Sözleşme taslağı](ILETISIM_SOZLESMESI.md) açık instance/belge/epoch hedefi önerir; uygulama ve canlı test bekleniyor. |
| A-11 | Birim/koordinat politikası | Taslak ilk sürümde WCS ve açık birim ister. Fiziksel birim istenip INSUNITS bilinmiyorsa yazma reddedilir; açık drawing_unit seçimi ayrı durumdur. Windows prototipinde uygulandı; mm/metre/birimsiz testleri kabul belgesinde. |
| A-12 | 3B kapsamı | İlkel nesnelerle başlama önerisi; ileri modelleme açık. |
| A-13 | Layout/PDF kapsamı | Plot aygıtı ve platform farkları test edilmeli. |
| A-14 | Xref okuma/yazma sınırı | Önce envanter/okuma önerisi; yazma ayrı karar. |
| A-15 | AutoCAD 2027 dışı sürüm desteği | Önce 2027; genişletme ayrı karar. |
| A-16 | MCP SDK/spesifikasyon sürümü | Server/client 2.3.1 sabit. Resmî SDK istemcisiyle stdio geçti; Claude/Codex ve eski sürüm istemciler ayrı Faz 4 kabulü. |
| A-17 | Dağıtım kanalı | npm/paketli çalıştırılabilir; ilk sürüm için en dar yol. |
| A-18 | İmzalama/notarization kimliği | Kullanıcı sağlayacak; ayrı iş. |
| A-19 | Telemetri/günlük saklama | Varsayılan en az veri önerisi; ayrı karar. |
| A-20 | Desteklenen işletim sistemi sürümleri | Temiz cihaz testleriyle netleşecek. |
| A-21 | Performans hedefleri | Ölçüm olmadan sayı verilmez. |
| A-22 | Yerelleştirme | Belgeler Türkçe; araç/arayüz dili ayrı karar. |
| A-23 | Otomatik güncelleme | İlk sürümde varsayılan değil önerisi. |
| A-24 | Süreç yaşam döngüsü | stdio sunucusunu istemcinin otomatik başlatması önerilir; eklenti etkinleştirme, kapanma ve yeniden bağlanma teknik denemede netleşecek. Kullanıcıdan ayrı uygulama penceresi açması beklenmez. |

## 4. Faz 2 uygulama tercihleri ve gerçek sınır

- Node 24+, TypeScript 7.0.2; resmî MCP server/client 2.3.1, Zod 4.6.7. Sürümler manifest ve lock dosyasında sabit.
- Windows: ObjectARX 2027 C++20 modül, named pipe, stdio. Mac native eklenti/Unix sunucusu henüz uygulanmadı; native Mac eşleştirmesi kapalıdır.
- Kullanıcının seçtiği eşleştirme dosyası + kullanıcıya özel DACL + 256 bit sır ile nonce/HMAC-SHA256. 24 saatlik oturum; MCPSTOP dosyayı kaldırır. Dosyaya erişebilen aynı kullanıcı süreci yetkiyi kullanabilir; süreç bazlı işletim sistemi sandbox'ı iddiası yoktur.
- Her çağrı açık instance/belge/epoch hedefler. Yazma revision ve operationId ister. İşlem kayıtları bellekte, en fazla 10000; yeniden başlatma sonrası kalıcılık yok. Kör tekrar yok.
- Ayrı DWG: yalnız oturumun private output kökü (`test-output`), düz yeni dosya adı, üzerine yazma yok. Side-database snapshot, yeniden açma/geometri karşılaştırması ve no-replace yayın kullanılır.
- Ana thread'e Win32 mesaj sevki; application context ve belge kilidi. Core Console test pompası aynı mesaj yolunu kullanır. Görünür masaüstünde test pompası olmadan belge/context, meşgul LINE, UNDO ve dosya yarışları ayrıca geçti.
- `bridge.cancel` ve kalıcı işlem günlüğü uygulanmadı. MCP iptali yerel beklemeyi keser; gönderilmiş mutasyonun sonucu unknown olabilir.
- [Kabul belgesi](TEKNIK_DENEME_KABUL.md) gerçek sonuçları ve çalıştırılmayan kapıları ayırır. Mac ayrı Faz M'ye taşındı; Windows Faz 2'nin 26 masaüstü kontrolü geçti; Faz 3 güvenilirlik çalışmaları başladı.
- Commit/push/yayın için bu işte izin yoktur. Önceki belge işindeki ajan kayıtları tarihsel kayıttır; Faz 2 yöneticinin kendisi tarafından yazıldı.

## 5. Kaynaklar

- [Plan](PLAN.md) — aşamalar, mimari önerisi, test katmanları.
- [Yetenek matrisi](YETENEK_MATRISI.md) — modül/platform/test durumu.
- [Araştırma](arastirma/MEVCUT_COZUMLER_2026-10-18.md) — mevcut çözümler; canlı test yok.
- Autodesk 2027 API tablosu: <https://help.autodesk.com/cloudhelp/2027/ENU/AutoCAD-Customization/files/GUID-E6429154-36DF-4D84-8ABC-9FCA15B66158.htm>
- ObjectARX SDK genel bakış: <https://forge.autodesk.com/developer/overview/objectarx-autocad-sdk>
- MCP TypeScript SDK: <https://github.com/modelcontextprotocol/typescript-sdk>
- MCP spesifikasyon değişiklik günlüğü: <https://modelcontextprotocol.io/specification/2026-07-28/changelog>
