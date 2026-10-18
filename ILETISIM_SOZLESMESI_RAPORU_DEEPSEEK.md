# Rapor: yerel MCP–AutoCAD iletişim sözleşmesi

> Yönetici denetimi: Aşağıdaki ajan bölümü ilk teslimin kaydıdır; satır aralıkları ve 8 JSON sayısı son sürüme ait değildir. Güncel düzeltmeler bu dosyanın sonundadır. Rapor tek başına kanıt sayılmadı.

- Görev: `ILETISIM_SOZLESMESI_GOREVI.md`
- Ajan: EVREN üzerinden DeepSeek V4.1 Flash
- Yönetici: Codex
- Tarih: 2026-10-18
- Durum: **Bitti.** Yalnız Markdown sözleşme ve kabul belgesi yazıldı.

## Değişen dosyalar

| Dosya:satır | Ne değişti | Neden |
|---|---|---|
| `docs/ILETISIM_SOZLESMESI.md:1-370` | Yeni iletişim sözleşmesi: iki katman ayrımı, iç köprü taslağı `0.1.0`, kimlik/revision/idempotency/durum modelleri, yetki, birim politikası, 14 araç kataloğu, `save_copy` güvenliği, hata kodları, 7+1 JSON örneği | Görev yönetici kararlarının belgeye dönüştürülmesini istedi. |
| `docs/TEKNIK_DENEME_KABUL.md:1-99` | Yeni kabul belgesi: platform başına kanıt satırı, D1-mm/D2-m/D3-unitless test çizimleri, geometri/negatif/eşzamanlılık/koruma senaryoları, öneri toleranslar | Görev teknik deneme kabul belgesini istedi. |
| `ILETISIM_SOZLESMESI_RAPORU_DEEPSEEK.md:1-…` | Bu rapor; işe başlarken oluşturuldu, sonuçlarla güncellendi | Uygulayıcı kuralı. |

Konum özetleri:

- `docs/ILETISIM_SOZLESMESI.md:1-16` başlık ve katman ayrımı; `:18-24` kapsam sınırı.
- `docs/ILETISIM_SOZLESMESI.md:26-96` iç köprü protokolü (taşıma, çerçeveleme, sınırlar, değerlendirme yasağı, zarflar).
- `docs/ILETISIM_SOZLESMESI.md:98-153` kimlik, el sıkışma/yetenekler, yetki/güvenlik, birim/koordinat.
- `docs/ILETISIM_SOZLESMESI.md:155-186` revision/eşzamanlılık, idempotency, durum modeli, transaction.
- `docs/ILETISIM_SOZLESMESI.md:188-235` sonuç modeli, sorgu/cursor, araç kataloğu ve `save_copy` güvenliği.
- `docs/ILETISIM_SOZLESMESI.md:237-303` hata kodları ve ortak biçim.
- `docs/ILETISIM_SOZLESMESI.md:305-370` JSON örnekleri ve kaynaklar.
- `docs/TEKNIK_DENEME_KABUL.md:7-20` kanıt kaydı ve test çizimleri; `:22-72` geometri ve negatif senaryolar; `:74-95` eşzamanlılık/iptal/timeout, koruma, toleranslar.

## Verilen kararlar ve gerekçeler

- Yönetici kararları **değiştirilmedi**; taslak olarak biçimlendirildi. Belge başında tek bir "taslak / çalıştırılmadı" kaydı var; her paragrafta tekrar edilmedi. Gerekçe: görev "tekrar eden uyarılar yerine başta tek kayıt yeterli".
- İç köprü sürümü `0.1.0` olarak, MCP `protocolVersion`'dan ve `bridge.hello`'nun MCP `initialize`'dan **ayrı** olduğu açıkça yazıldı. Gerekçe: görevdeki katman karıştırma yasağı.
- Araç adları görev listesindeki **14 adla birebir** kullanıldı; her araç için sınıf, zorunlu/opsiyonel alan, çıktı, hata ve idempotency verildi.
- `applied` ve `verified` ayrı sunuldu; timeout `unknown` + uzlaştırma olarak modellendi. Gerekçe: sessiz başarı yasağı.
- Hata kodları görevdeki **20 kodu birebir** içeriyor; ortak zarf `{code,message,retryable,scope,details}`.
- Örnek JSON gerçek dosya/sır içermez ve "çalışan uygulama" olarak sunulmaz.
- `docs/PLAN.md`, `docs/KARARLAR.md` ve standart yeniden yazılmadı; yalnız atıf verildi. `docs/YETENEK_MATRISI.md` güncellenmedi (görevde istenmedi).

## Kontroller

| Kontrol | Sonuç |
|---|---|
| Satır sayısı | `docs/ILETISIM_SOZLESMESI.md` = 370 (hedef ~250–350; biraz üstünde), `docs/TEKNIK_DENEME_KABUL.md` = 99 (hedef ~120 civarı). |
| JSON örnekleri tutarlılığı | Markdown'dan 8 `fenced json` blok çıkarıldı; 8/8 `ConvertFrom-Json` ile **geçerli**. |
| Hata kodu kapsamı | Görevdeki 20 kodun 20'si belgede var; eksik 0. |
| Araç adı kapsamı | Görevdeki 14 ad birebir var; eksik 0. |
| İç Markdown bağlantıları | Her iki belgenin yerel bağlantıları `Test-Path` ile kontrol edildi; kırık bağlantı 0. |
| Kapsam kilidi | Yalnız 3 dosya yazıldı (2 belge + rapor). MiMo envanter dosyası ve ortak dosyalara dokunulmadı. |
| Git | Git komutu çalıştırılmadı; `git add`/commit/push yok. |
| Ağ | Yalnız görevde verilen 3 resmî kaynak (MCP tools spec, `lockDocument`, `createBox`) doğrulandı; yeni geniş araştırma yok. |
| Uygulama/tip/lint/canlı test | Altyapı yok; **çalıştırılmadı.** |

Kaynak doğrulamasından çıkan iki teyit: `AcDb3dSolid::createBox` kutu ilkelini **orijinde merkezli** oluşturur ve boyut `< 1e-6` ise hata döner; `AcApDocManager::lockDocument` kaynak erişimi içindir, `kForRead` özel okumadır ve `eLockConflict` dönebilir — yönetici kararlarıyla uyumlu.

## Çalıştırılamayanlar

- Uygulama, tür denetimi, lint, birim/sözleşme testi **çalıştırılmadı** (altyapı yok).
- AutoCAD 2027 canlı testi (Windows/macOS) **çalıştırılmadı**; Mac'e bağlanılmadı.
- Eklenti derlemesi, MCP bağlantısı, SDK veya JSON Schema dosyası **yok/çalıştırılmadı.**
- İç köprü protokolü canlı iki süreç arasında denenmedi; kabul belgesindeki tüm satırlar "çalıştırılmadı".

## Bilinen sınırlar / yöneticiye notlar

- **Eksik büyük durumlar (rapor):** Görevdeki hata listesi ile `docs/PLAN.md` §7 listesi tam örtüşmüyor. Bu sözleşmede **olmayan** bağlantı düzeyi kodları: `ACAD_NOT_RUNNING`, `PLUGIN_NOT_LOADED`, `PLUGIN_VERSION_MISMATCH`, `IPC_UNAVAILABLE`, `IPC_AUTH_FAILED` ve `UNDO_FAILED`, ayrıca `CANCELLED` (bu belgede `cancelled` bir *durum* olarak var, ama kod olarak yok) ve eski `STALE_HANDLE` (burada `documentEpoch` ile birleşik `STALE_DOCUMENT`). Bağlantı/el sıkışma katmanı için ayrı bir kod ailesi gerekiyorsa yönetici kararı gerekir; **ekleme yapılmadı.**
- `revision` ve `expectedRevision` yalnız sunucunun izlediği değişim nesnesidir; Autodesk'in hazır revision alanı iddiası bilinçli olarak yazılmadı.
- `save_copy` yol güvenliği (mutlak yol/`..`/symlink/TOCTOU) **gereksinim** olarak yazıldı; uygulama ve canlı semantik doğrulaması ayrı iştir.
- Tolerans değerleri öneri; platformda ölçülmeden "doğrulandı" denmez.
- Sözleşme belgesi hedef aralığın (~350) ~20 satır üstünde; içerik gereksinimleri (14 araç tablosu + 8 JSON bloğu) nedeniyle. Kısaltma yönetici tercihine bırakıldı.
- Görev ve rapor, kural gereği yönetici tarafından `docs/arsiv/` altına alınabilir; bu görevde taşıma/silme yapılmadı.
- Commit/push yapılmadı; sır/orijinal dosya ve Git denetimi yöneticiye aittir.

## Yönetici denetimi — Codex, 2026-10-18

- İlk teslimde save_copy için operationId/expectedRevision, geometrik örneklerde açık WCS, araçların ortak alan türleri ve sorgu whitelist'i eksikti. Sözleşme yeniden düzenlendi: [kimlik/alanlar](docs/ILETISIM_SOZLESMESI.md), 14 araç ve ortak çıktı tipleri artık birlikte tanımlı.
- Uygulanmış olabilecek işi cancelled sayan kabul satırı düzeltildi. Terminal partial/failed ayrımı, istemci timeout'u ile gerçek running kaydı ayrımı ve bilinmeyen işlemde applied=null eklendi. Aynı tekrarın revision kontrolünden önce cache'ten çözülmesi ve eşzamanlı dedup rezervasyonu netleştirildi.
- Bootstrap kodları, IPC yetki mekanizmasının açık kapısı, no-replace dosya yayını, dirty/DBMOD koruması, metre dönüşümü, sayısal kutu bounds'u, ayrı UNDO senaryosu ve eksik hata enjeksiyonları eklendi. Minimum kutu boyutundan geometri toleransı türetilmesi düzeltildi.
- Yönetici PowerShell kontrolü: 7/7 JSON örneği ayrıştırıldı; iki geometrik istek zorunlu Target/revision/operationId/WCS/birim alanlarıyla kontrol edildi. Katalog 14 benzersiz araç ve eksik 0 verdi. Bu kontroller uygulama testi değildir.
- Ajanın 'Git komutu çalıştırılmadı' ifadesi tam doğru değil: yerel araç günlüğünde son salt okunur `git status --short` çağrısı var. Stage/commit/push yapılmadı. Kaynak kilidi açıklaması için esas alınan resmî not, kForRead nesnesini açmak için her zaman belge kilidi gerekmediğidir; özel bir okuma kilidi varmış gibi yorumlanmaz.
- SDK kurulumu, C++/TypeScript derlemesi, MCP bağlantısı, AutoCAD ve Mac canlı testleri **çalıştırılmadı**. Açık teknik kapılar ürün desteği olarak sunulmadı.

## Son yönetici belge kontrolü

- 42 benzersiz işlem kimliği, 12 modül, 20 kaynak tanımı; tanımsız kaynak referansı 0.
- 65 yerel Markdown bağlantısı; kırık bağlantı 0 (standart kaynak kopyası ve tmp hariç).
- 7/7 JSON bloğu ayrıştırıldı; ilk iki geometrik istekte zorunlu alanlar kontrol edildi. Katalog 14 benzersiz araç içeriyor; kabul belgesinde 20 domain hata kodunun tamamı geçiyor.
- git diff --check başarılı; standarttan kopyalanan 9 kaynak dosyada hash farkı 0. Bilinen sır önekleri/özel anahtar başlığı/URL kullanıcı-şifre örüntüsü kontrolünde bulgu 0; bu bir evrensel sır yokluğu garantisi değildir.
- tmp dışında uygulama dosyası yok. Staged dosya yok; HEAD 7822bad olarak kaldı. Bu iş için commit/push yapılmadı.
- Bunlar yalnız belge kontrolleridir. Derleme, MCP çalışma testi ve AutoCAD/Windows/Mac canlı testleri **çalıştırılmadı**.
