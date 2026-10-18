# Yerel MCP–AutoCAD iletişim sözleşmesi

> 2026-10-18, iç protokol `0.1.0`. Windows prototipi uygulandı ve Core Console ile sınandı. Aşağıdaki §0, mevcut kodun desteklediği profildir; gelecekteki genel sözleşme ayrıntılarının hepsi uygulanmış değildir. Mac native taşıması ve arm64 derlemesi yapılmadı.

İlgili belgeler: [Plan](PLAN.md), [Kararlar](KARARLAR.md), [Envanter](OZELLIK_ENVANTERI.md), [Kabul ölçütleri](TEKNIK_DENEME_KABUL.md), [Kaynak notları](arastirma/ASAMA1_KAYNAK_NOTLARI.md). Güncel uygulama Windows kapsamındadır; Mac taşıması ve doğrulaması ayrı Faz M'de yürütülür, Windows fazları için ön koşul değildir.

## 0. Uygulanan Windows profili

Kod otoritesi: `src/protocol.ts`, `src/bridge.ts`, `src/tools.ts`, `native/bridge.cpp`, `native/plugin.cpp`. Kanıt: [teknik kabul](TEKNIK_DENEME_KABUL.md).

- MCP server/client SDK 2.3.1; stdio. Resmî SDK istemcisiyle gerçek child-process testi yapıldı. Claude/Codex ve 2025-11-25 istemci kabulü ayrı çalıştırılmadı; tüm MCP istemcileriyle uyumluluk iddiası yok.
- Native Windows: bağlantı başına tek istek/id:1. Kalıcı iki ana pipe instance'ı ve bağımsız tek kontrol pipe'ı aynı HMAC/DACL ile korunur; tüm uçlar grant yayımlanmadan bağlanır. Grant optional `controlEndpoint=endpoint+"-control"` taşır. Kontrol kanalı yalnız işlem durumu/iptali kabul eder; test derlemesinin probe'u normal grant'te yoktur. Windows ACL'sini eklenti oluşturur; Node ayrıca Windows ACL doğrulaması yapmaz.
- Sunucu her bağlantıda `{nonce,instanceId,bridgeVersion}` challenge gönderir. Nonce 32 rastgele baytın küçük hex gösterimidir. İstek/yanıt satırı `{nonce,body,mac}`; body UTF-8 JSON-RPC'nin canonical base64 gösterimidir. MAC: HMAC-SHA256(keyBytes, `direction + LF + nonce + LF + body`), direction request/response. Yanıt doğrulanmadan iç veri işlenmez. Challenge `bridge.hello` adlı RPC değildir.
- LF hariç zarf 1 MiB, açılmış gövde 512 KiB. İç JSON derinlik 8, dizi/nesne 1000, string 4096 UTF-8 bayt. Outer base64 body bu string sınırının dışındadır; kendi bayt sınırı vardır. İç yinelenen anahtarlar reddedilir. Native dış zarf da düz nesne/tekrarsız anahtar ister.
- Kullanıcı tarafından seçilen özel pairing dosyası 256 bit sır, izinli yöntemler ve 24 saatlik expiresAt taşır. Named pipe uzak istemci kabul etmez; DACL yalnız kullanıcı SID'si. MCPSTOP kendi pairing dosyasını kaldırır. Dosyayı okuyabilen aynı kullanıcı süreci yetkiyi kullanabilir; süreç bazlı sandbox değildir.
- Şu an 14 yöntem aynı grant ile sunulur; profil yönetim UI'si ve kök seçme UI'si yok. `acad_list_instances` yalnız operatörün eşlediği tek instance'ı listeler; liveness için status gerekir. Açık hedef zorunludur.
- Modelspace, WCS; mm/m/inch/drawing_unit. INSUNITS 1/4/6 dönüşümü var; inch canlı testi yok. Taşıma/silme en fazla **100** hedef. 3DSOLID yazması yalnız bu oturumda köprüden üretilmiş kutulara açılır.
- Win32 mesajları API işini tek CAD thread'ine taşır; application context'te açık hedef belgeye kısa read/write kilidi alınır. Normal snapshot read lock kullanır. Revision transaction öncesinde denetlenir; açık kalmış başka transaction varken yeni mutasyon DOC_BUSY ile reddedilir. Reentrant CAD queue drain engellenir; komut, standart OS modal ve haricî lock veto yolları DOC_BUSY ile sınandı. UNDO ve çoklu belge/context Faz 2 temel kabulündedir.
- Kayıtlar queued/running/terminal olarak mutex altında tutulur. Aynı epoch+operationId ve aynı gövde eşzamanlı geldiğinde aynı shared future/result paylaşılır; farklı gövde IDEMPOTENCY_CONFLICT. Terminal hatalar da tutulur. 10000 kayıt ve 64 MiB muhasebe bütçesi; kayıt için yürütmeden önce yanıt rezervi ayrılır. Doluysa yeni iş DOC_BUSY; bilinen tekrar kapasite/revision öncesinde bulunur. Kayıt silerek eski kimliği yeniden yürütme yoktur. Restart sonrası kalıcılık yok; eksik kayıt unknown/null.
- TypeScript iş admission sınırı 64; tek normal IPC çağrısı yürür. Durum okumaları ayrı, en fazla 4 yerel admission ile iş kuyruğunu aşar. Native iş kuyruğu üst sınırı 64, kabul bekleme 8 saniye; Node varsayılanı 10 saniye. Node grant'i yürütmeden önce okur; native de CAD yürütmesi ve commit kontrol noktasında grant varlığını denetler. MCPSTOP veya pairing dosyasını kaldırma yetkiyi iptal eder; mevcut işlem listesini değiştirmek için pairing yeniden başlatılır. Otomatik mutasyon retry veya hedef değiştirme yoktur.
- Gönderim öncesi yerel iptal CANCELLED/cancelled/applied=false. Gönderilmiş mutasyonun istemci sonucu TIMEOUT_UNKNOWN kalabilir; AbortSignal bağımsız kontrol pipe'ından iç `bridge.cancel` isteği yollar (750 ms, best effort). Native kuyrukta iş kaldırılır; çalışan iş commit öncesindeki cooperative kontrol noktalarında durur. Uzun SDK fonksiyonu zorla kesilmez. CancelRequested iptal kanıtı değildir; commit sonrası iş cancelled sayılmaz. 15. MCP aracı eklenmedi.
- Save copy: yalnız `test-output` oturum kökü, en fazla 255 karakter düz yeni `.dwg` adı. Alt dizin/aygıt/ADS yok. Kök ve atalar reparse kontrolüyle handles üzerinden sabitlenir; wblock side database snapshot geçici dosyaya yazılır, yeniden açılıp desteklenen geometri karşılaştırılır; MoveFileEx no-replace ile yayımlanır. Orijinal filename/DBMOD/INSUNITS ayrıca denetlenir. `verification` alanı doğrulanan kapsamı açıklar; bütün DWG metadata'sı doğrulanmaz.
- Çıktı şeması şu an genel object. error.code ve applied/verified/status esas alınır. Commit sonrası ölçüm hatası applied=true/VERIFICATION_FAILED; snapshot sırasında bilinen kaynak yan etkisi partial/applied=true/PARTIAL_APPLY verir. Abort sonucu doğrulanamazsa unknown/null ve yazma karantinası; pairing yeniden başlatılana kadar yeni yazma DOC_BUSY. Sonuç alınamayan status çağrısı da asıl işlemin etkisiz olduğunu iddia etmez. Büyük yanıt RESULT_TOO_LARGE; bilinmeyen etki null.

## 1. İki protokol

| Katman | Taşıma ve sürüm | Sorumluluk |
|---|---|---|
| MCP istemcisi ↔ TypeScript sunucu | Önce stdio; resmî MCP SDK | Araç keşfi, şemalı çağrı ve sonuç; doğal dili AI istemcisi işler. Köprünün kendi LLM anahtarı gerekmez. |
| Sunucu ↔ C++ ObjectARX eklentisi | Windows named pipe / macOS Unix socket; iç protokol `0.1.0` | Açık AutoCAD hedefleri, yetki, iş kuyruğu, API işlemi ve geri okuma. |

İç sürüm MCP `protocolVersion` değildir. İç nonce challenge, MCP `initialize` değildir. MCP 2026-07-28 ve 2025-11-25 farklı yaşam döngülerine sahiptir; SDK ve istemci sürümleri uygulama başında sabitlenip ayrı sınanacak. Yeni sürümde gerekli `_meta` ve `resultType` gibi alanları dış adaptör/SDK yönetir; aşağıdaki iç mesajlar doğrudan MCP tel mesajı değildir.

İlk 14 MCP araç adı sabittir. Seçilen çizime veya önceki bağlantı çağrısına göre `tools/list` değiştirilmez; platform ve özellik durumu `acad_get_capabilities` sonucundadır. Bu, MCP'nin yetkiye göre liste süzmesine izin vermediği iddiası değildir. Araç `inputSchema`/`outputSchema` kullanır. Dış sonuçta `structuredContent` ve eski istemciler için aynı verinin metin gösterimi hedeflenir; yürütme hatasında `isError:true`. MCP zarf/araç-adı hataları JSON-RPC hata kanalındadır.

## 2. İç çerçeve ve sınırlar

- JSON-RPC 2.0 iç nesnesi UTF-8'dir; §0'daki imzalı base64 zarf tek LF ile ayrılır. Batch ve mutasyon notification'ları kabul edilmez.
- Çerçeve sınırı LF hariç **1 MiB**. Ayrıştırmadan önce bayt sınırı uygulanır; geçersiz UTF-8/JSON/derinlikte uygulama yapılmaz. Aşımda bağlantı kapatılabilir; eksik çerçeve iş kuyruğuna girmez.
- `id`: güvenli tamsayı veya 1..64 bayt string. Güvenli tamsayı aralığı ±9007199254740991; `revision` 0..üst sınır, `documentEpoch` 1..üst sınır.
- Koordinat ve boyutlar sonlu double; NaN/Infinity, taşan birim dönüşümü, yinelenen JSON anahtarları ve bilinmeyen alanlar reddedilir.
- String en fazla 4096 UTF-8 bayt; kimlik 1..128 bayt; dizi en fazla 1000 öğe; nesne derinliği en fazla 8. `handle` 1..16 hex karakter, karşılaştırma büyük/küçük harften bağımsızdır.
- Yanıt da 1 MiB sınırındadır. Sorgu bu sınırdan önce sayfalanır; tek nesne projeksiyonu sığmıyorsa `VALIDATION_FAILED`. Sınır aşımı sessiz veri kesme değildir.
- Ham komut, LISP, script, kabuk veya ifadeyi değerlendiren alan yoktur. İlk deneme TCP/HTTP açmaz.

## 3. Kimlik ve yetki

| Alan | Anlam ve ömür |
|---|---|
| `instanceId` | AutoCAD süreci/eklenti yaşamını tanımlar; yeniden başlatmada değişir. |
| `documentId` | Açık çizim kimliği; yol kimlik değildir. Yeniden açma yeni kimliktir. |
| `documentEpoch` | Instance genelinde yeniden kullanılmayan açma/yeniden yükleme nesli; farklı belgeler aynı epoch'u paylaşmaz. İzleme koparsa yenilenir. |
| `EntityRef` | `{documentId, documentEpoch, handle}`. Yalnız bu belge yaşamında anlamlıdır; ObjectId/pointer dışarı çıkmaz. |
| `operationId` | İstemcinin verdiği mutasyon kimliği; JSON-RPC `id`'sinden bağımsızdır. |

Belge kapsamlı her çağrı `Target={instanceId,documentId,documentEpoch}` taşır. Aktif sekme örtük hedef değildir. Nesne referanslarının belge/epoch alanları Target ile eşleşmelidir. Salt sekme değiştirmek epoch'u değiştirmez; belge kapanması/yeniden açılması değiştirir. Hedef alanı eksikse şema hatasıdır; keşif sonucu birden fazla instance varsa yazma hedefi otomatik seçilmez.

Pipe/socket yalnız yerel kullanıcı ACL/izinleriyle sınırlandırılır; aynı hesaptaki tüm süreçler güvenilir sayılmaz. Windows prototipinde özel DACL, pairing dosyası ve HMAC mekanizması §0'da uygulandı. Mac mekanizması uygulanmadı; o platformda native mutasyon açılmaz. Çağıranın `profile` alanı, belge/işlem kimliği veya tahmin edilemez kimlik tek başına yetki sağlamaz. Her çağrıda ve kilit altında yetki yeniden denetlenir; cache/status okumaları da yetkilidir.

Profiller salt okuma/çizim/düzenleme/otomasyon olarak önerilir; ayrıntıları açık. Gerekli IPC kimlik bilgisi yalnız bellekte/OS korumalı yerelde tutulur; sır ve çizim içeriği günlüğe yazılmaz. Tam dosya yolları varsayılan yanıtta yoktur; dosya hedefi göreli kimliktir. Çizimden gelen metin veri sayılır, ajan talimatı sayılmaz.

## 4. Birim, alanlar ve ilk nesne kapsamı

- `Point3`/`Vector3`: tam 3 sonlu sayı. Geometrik çağrıda `coordinateSystem:"WCS"` zorunludur; başka sistem reddedilir. Yön/normal boyutsuz; açılar ileride derece olacaktır.
- `lengthUnit`: `mm|m|inch|drawing_unit`. Geometrik yazmada zorunlu; geometrik okumada varsayılan `drawing_unit`. Yanıt birimini açık taşır; hacim o birimin küpüdür.
- Fiziksel birim → çizimin INSUNITS birimine dönüştürülür. INSUNITS bilinmiyor/birimsiz/uygulanabilir dönüşüm yoksa `UNITS_UNKNOWN`; çizimin INSUNITS değeri değiştirilmez. Açık `drawing_unit` doğrudan çizim birimidir ve birimsiz çizimde de kullanılabilir.
- `Mutation=Target+operationId+expectedRevision`; `GeometryMutation=Mutation+coordinateSystem+lengthUnit`. `save_copy` de Mutation ister; `erase` ve `save_copy` geometrik alan istemez.
- İlk deneme yalnız modelspace ve native `LINE`, `CIRCLE`, kutu olarak oluşturulmuş `3DSOLID` üzerindedir. Proxy, xref içi ve paperspace yazmaları reddedilir. Kilitli katman `SECURITY_DENIED` sebebiyle ön kontrolde reddedilir.
- Oluşturmada `layer` opsiyonel 1..255 bayt mevcut katman adıdır; verilmezse uygulama öncesinde okunup sonuçta bildirilen geçerli katman kullanılır. Olmayan katman otomatik oluşturulmaz (`TARGET_NOT_FOUND`).
- Çizgi start/end farklıdır; çember radius>0 ve normal yalnız `[0,0,1]`; kutu size bileşenleri çizim birimine dönüşünce >=1e-6 olmalıdır. Bu kutu API sınırı genel geometri doğrulama toleransı değildir.
- Kutu API'si orijinde merkezli üretir; `center` için ardından dönüşüm gerekir. İlk kutu WCS eksenlerine paraleldir. Blok içeriğine kör birim dönüşümü uygulanmaz.

## 5. Thread, revision ve transaction

`revision` eklentinin izlediği değişim neslidir; Autodesk'in hazır bir revision alanı olduğu iddia edilmez. Elle düzenleme, undo/redo ve bridge yazmaları nesli ilerletir. İzleme boşluğunda eski nesle güvenilmez; epoch yenilenir veya yazma kapatılır. Sayaç taşmadan yeni epoch gerekir.

Tüm AutoCAD API okumaları/yazmaları ana thread ve uygun document/application context'e sevk edilir. IPC thread'i Autodesk nesnesine erişmez. Belge kilidi bu sevkin yerine geçmez. Dispatcher iki platformda doğrulanacak; bekleyen kullanıcı komutlarını iptal eden API'ler sessizce kullanılmaz. Meşgul/modal durumunda kısa kuyruk veya `DOC_BUSY`; kullanıcı komutu iptal edilmez.

Yeni mutasyon sırası: yetki/zarf kontrolü → dedup kaydı ayırma → kuyruğa alma → uygun bağlam/kilit → hedef/epoch/yetki/expectedRevision/nesne ve katmanı yeniden okuma → kısa transaction ve undo grubu → değişiklik → commit → geri okuma → kayıtlı sonuç. Tek belge içindeki doğrudan DB değişiklikleri için atomiklik hedeflenir; bir hedef geçersizse toplu işlem başlamadan reddedilir. Kilit LLM yanıtı veya IPC turu beklerken tutulmaz.

DB transaction hata halinde gerçekten abort edilmişse `applied:false`; etkilerden emin olunamıyorsa false uydurulmaz. Commit sonrası doğrulama hatası geri alındı sayılmaz. `save_copy` dosya yan etkisi DB transaction/UNDO dışında kalır. Genel undo aracı yoktur; kabul testinde kullanıcı UNDO yapar. API transaction ile kullanıcı undo grubu eşanlamlı değildir; ikisi ayrı doğrulanır.

## 6. Tekrar istek, durum ve iptal

Dedup anahtarı `instanceId+documentEpoch+operationId`; epoch instance genelinde tekildir. Yetki bağlamı da kayıtla eşlenir. Anahtar aynıysa araç adı/Target/işlem parametreleri/expectedRevision'ın kanonik gövdesi karşılaştırılır. Nesne anahtar sırası ve JSON-RPC `id` farkı yeni işlem değildir; dizi sırası anlamlıdır. Kanonik sayısal gösterim uygulama sözleşme testinde sabitlenecek.

Kayıt kontrolü **yeni expectedRevision kontrolünden önce** yapılır: aynı gövdenin cevabı kayıttan döner, eski revision gerekçesiyle tekrar uygulanmaz. Farklı gövde `IDEMPOTENCY_CONFLICT`. Yetki iptali cache erişimini de engeller. Kuyruğa alma ve anahtar ayırma eşzamanlı iki çağrıda tek işlem oluşturmalıdır.

İlk deneme önerisi: instance yaşamı boyunca en fazla 10000 işlem kaydı; epoch içinde anahtarlar TTL ile silinmez/yeniden kullanılmaz. Kapasite dolarsa yeni işlem **uygulamadan önce** `DOC_BUSY` ile reddedilir. Sonraki TTL/kalıcı saklama tasarımı açık; eski anahtarın yeniden uygulanmasına yol açan sessiz eviction yapılamaz. Restart sonrası kayıtların korunduğu veya exactly-once çalıştığı iddia edilmez. Eski instance hedefi reddedilir; otomatik mutasyon tekrarı yoktur.

| Durum | Sonraki durum | Anlam |
|---|---|---|
| `queued` | running / cancelled / failed / unknown | Henüz uygulanmadı; kesin kuyruk iptalinde applied=false. |
| `running` | succeeded / failed / partial / unknown / cancelled | cancelled yalnız hiçbir yan etki olmadığı veya eksiksiz abort kanıtlandığında. |
| `unknown` | queued / running / succeeded / failed / partial / cancelled | Uzlaştırma yeni bilgi sağlar; yeniden yürütme anlamına gelmez. |
| `succeeded`, `failed`, `partial`, `cancelled` | terminal | partial gerçekleşmiş kısmi etkidir; sonradan failed diye gizlenmez. |

`succeeded`: uygulama ve doğrulama başarılı; `failed`: hata, `applied` gerçek etkiyi ayrıca söyler; `partial`: bilinen kısmi etki. `applied`/`verified` bool|null; null bilinmiyordur. Kuyruk/çalışma sırasında verified=null. Doğrulama hatasında applied=true, verified=false olabilir. Mutasyon başarısı yalnız ekrandaki görüntü değildir.

**Gelecek sözleşme; henüz uygulanmadı:** iç yönetim çağrısı `bridge.cancel` Target+operationId ister; yetkisi ayrıca kontrol edilir, 15. MCP aracı değildir. MCP istemci iptali yalnız müzakere edilen sürüm/SDK destekliyorsa buna çevrilir; aksi durumda yerel test harness'i kullanılır. İptal isteği yanıtı yalnız `cancelRequested` bilgisidir. İşlem durumunu değiştirmeye garanti vermez.

İstemci timeout'u yürütmeyi durdurmaz. Sunucunun running kaydı sırf istemci beklemeyi bıraktı diye unknown yapılmaz; istemci sonucu bilmiyorsa `TIMEOUT_UNKNOWN` ve status sorgusu kullanır. Bağlantı/süreç kaybında etki belirsizse unknown. Kayıt bulunmaması `applied:false` kanıtı değildir: status unknown döner; kör retry yoktur. İşlem kaydı eski/kapalı belge için yetkili kullanıcıya sorgulanabilir, yeni yazma izni sağlamaz.

## 7. Sorgu ve ortak çıktılar

`filter`: `{type?:LINE|CIRCLE|3DSOLID,layer?:string}`; `{}` desteklenen türleri tarar. Keyfi ifade/regex yok. `projection`: handle,type,layer,start,end,center,radius,size,extents,volume alanlarından tekrarsız liste. Türe uymayan alan omitted+`unavailableFields` olur; uydurma sıfır verilmez. İlk varsayılan handle/type/layer; geometri isteği WCS alanını da ister.

`limit` 1..1000, varsayılan100; bir çağrıda en fazla10000 nesne tarama önerisi. `scanned` bu sayfadaki taranan sayıdır; `truncated` taramanın sürdüğünü söyler. `cursor` string|null sorgu+projeksiyon+birim+epoch+revision+tarama konumuna bağlıdır; değişiklikte `STALE_CURSOR`. Sayfa boş olup cursor devam edebilir. Tutarlı snapshot için her sayfa revision bildirir; değişmiş çizim sessizce birleştirilmez.

`MutationResult`: operationId, Target, status, applied, verified, revision(int|null), created/modified/erased(EntityRef[]), observedGeometry(object|null), error(Error|null). Boş listeler [] döner. `observedGeometry` ölçü birimini/WCS'yi ve gerçek geri okunan değerleri içerir. Kuyruk yanıtı terminal sonuç diye sunulmaz. Dosya sonucunda ek `output={outputRootId,relativePath}` bulunur; tam makine yolu yoktur.

## 8. İlk 14 araç

Tablodaki Target/Mutation/GeometryMutation yukarıda tanımlı **zorunlu** alan gruplarıdır. Opsiyoneller aksi yazılmadıkça yoktur. Her çağrıda yetki, instance ve alan doğrulaması uygulanır; ortak hata kodları tüm araçlara uygulanabilir. Salt okuma snapshot'ı yeni revision'da farklı olabilir; dedup mutasyon içindir.

| Araç | Sınıf ve zorunlu giriş | Opsiyonel / ek sınır | Çıktı | Özel hata / tekrar davranışı |
|---|---|---|---|---|
| acad_list_instances | inceleme; boş nesne | yok | instances[{instanceId,autocadVersion,pluginVersion,platform,architecture}], boş liste geçerli | Tek instance otomatik hedef seçimi değildir. |
| acad_get_status | inceleme; instanceId | yok | connected,busy,bridgeVersion,queueDepth | INSTANCE_NOT_FOUND; çizim verisi okumaz. |
| acad_get_capabilities | inceleme; instanceId | documentId+documentEpoch birlikte | operations[{name,supported,reason}], limits | Belge verilirse epoch doğrulanır; destek listesi tools/list değildir. |
| acad_list_documents | inceleme; instanceId | yok | documents[{documentId,documentEpoch,revision,readOnly,insunits}] | Salt okuma; yol varsayılan dönmez. |
| acad_get_document_info | inceleme; Target | yok | Target,revision,readOnly,dirty,insunits | DOC_NOT_FOUND / STALE_DOCUMENT. |
| acad_query_entities | inceleme; Target,filter,coordinateSystem=WCS | projection,limit,cursor,lengthUnit | items,unavailableFields,scanned,truncated,cursor,revision,lengthUnit,coordinateSystem | STALE_CURSOR / UNITS_UNKNOWN; §7 sayfalama. |
| acad_get_entity | inceleme; Target,entityRef,coordinateSystem=WCS | projection,lengthUnit | entity,unavailableFields,revision,lengthUnit,coordinateSystem | TARGET_NOT_FOUND; referanslar eşleşmeli. |
| acad_create_line | mutasyon; GeometryMutation,start:Point3,end:Point3 | layer | MutationResult; uçlar ve uzunluk geri okuma | VALIDATION_FAILED / UNITS_UNKNOWN; kayıtlı dedup. |
| acad_create_circle | mutasyon; GeometryMutation,center:Point3,radius:number>0 | normal=[0,0,1],layer | MutationResult; merkez/radius/normal | Başka normal VALIDATION_FAILED; kayıtlı dedup. |
| acad_create_box | mutasyon; GeometryMutation,center:Point3,size:Point3 | layer | MutationResult; merkez/extents/hacim | Boyut dönüşümünden sonra >=1e-6 DU; kayıtlı dedup. |
| acad_move_entities | mutasyon; GeometryMutation,targets:EntityRef[],delta:Vector3 | hedefler1..100,tekrarsız | MutationResult; modified ve ölçüler | TARGET_NOT_FOUND / SECURITY_DENIED; tüm hedef ön kontrolü, dedup. |
| acad_erase_entities | mutasyon; Mutation,targets:EntityRef[] | hedefler1..100,tekrarsız | MutationResult; erased ve silinme geri okuması | DOC_READ_ONLY / TARGET_NOT_FOUND; tüm hedef ön kontrolü, dedup. |
| acad_get_operation_status | inceleme; Target,operationId | yok | MutationResult veya unknown+null etkiler | Yetkili kayıt varsa kapalı belgeyi de sorgular; kayıt yoksa false uydurulmaz. |
| acad_save_copy | dosya; Mutation,outputRootId,relativePath,overwrite:false | prototipte düz yeni dosya adı, en fazla255 karakter ve .dwg uzantı | MutationResult+output; yeniden açma kanıtı | OUTPUT_PATH_DENIED / FILE_EXISTS; dosya yan etkisi için de dedup, exactly-once yok. |

### Ayrı kopyanın güvenliği ve açık uygulama kapısı

`outputRootId` kullanıcı tarafından önceden izin verilmiş köke işaret eder. Caller kökü/yetkiyi kendi argümanıyla ekleyemez. Mutlak yol, sürücü/UNC/aygıt yolu, NUL, `..`, alternatif veri akışı ve symlink/junction kaçışı reddedilir. Yol kanonikleştirme tek başına yeterli değildir: kök/ebeveyn değişimi ve hedef dosyasının sonradan oluşturulması yarışlarında da üzerine yazmama gerekir.

Öneri: izinli kökte yeni geçici dosyaya kayıt, yeniden açıp doğrulama, OS düzeyinde no-replace atomik yayımlama. Desteklenmiyorsa fail-closed; yalnız exists kontrolü + normal saveAs yeterli değildir. Windows prototipinde §0'daki dar kök/düz ad politikasıyla uygulandı; symlink/junction yarış enjeksiyonlarının tamamı ve Mac çalıştırılmadı. Hata sonrası bridge'in kendi geçici dosyası temizlenebilir; mevcut kullanıcı dosyası silinmez/değiştirilmez.

`saveAs(...,bBakAndRename=false,...)` açık belge adını koruyan adaydır; orijinal byte'ları, dirty/DBMOD ve INSUNITS korunması Core Console ve masaüstü temel kabulünde ayrıca sınandı. Doğrulanamazsa save_copy yeteneği kapalı kalır. Output yayımlandıktan sonra hata olursa dosya yokmuş gibi `applied:false` dönülmez; gerçek etki/unknown döner. Doğrulama sonrası mevcut kaydı silip yeniden üretme otomatik yapılmaz.

## 9. Hatalar

Bootstrap/bağlantı kodları ayrıca tanımlanır: `ACAD_NOT_RUNNING` yalnız süreç yokluğu kanıtlandığında; `PLUGIN_NOT_LOADED` yalnız eklenti yokluğu biliniyorsa; `PLUGIN_VERSION_MISMATCH` sürüm uyuşmazlığı; `IPC_UNAVAILABLE` endpoint/taşıma kurulamadı; `IPC_AUTH_FAILED` eşleştirme/çağıran doğrulama reddi. Erişim reddi eklenti yokluğu diye yorumlanmaz. El sıkışma reddi JSON-RPC error.data.code içinde, yerel discovery/status tanısı yapılandırılmış sonuçta taşınabilir. Bunlar aşağıdaki 20 domain kodundan ayrıdır. İlk katalogda UNDO aracı yoktur; planın UNDO_FAILED gelecekteki undo otomasyonu içindir. CANCELLED iç iptal hata kodudur; cancelled terminal durumudur; eski STALE_HANDLE ayrımı bu taslakta STALE_DOCUMENT veya TARGET_NOT_FOUND ile açıklanır.

İçte zarf/parse/bilinmeyen metot hataları JSON-RPC error; domain yürütme sonucu `result.error={code,message,retryable:false,scope,details}` taşır. Scope instance|document|entity|operation|file. `message/details` sırsız ve içerik taşımayan sabit açıklamalardır. Dış adaptör domain hatasını MCP `isError:true` sonucuna çevirir. `retryable` hiçbir zaman otomatik mutasyon tekrarı izni değildir.

| Kod | Anlam |
|---|---|
| VALIDATION_FAILED | Şema, sınır, geometri veya dönüşüm reddi; uygulama öncesi. |
| UNSUPPORTED_ON_PLATFORM | İşlem/platform/nesne türü yeteneği yok. |
| INSTANCE_AMBIGUOUS | Keşifte birden fazla aday; otomatik hedef seçilemez. |
| INSTANCE_NOT_FOUND | Eski veya bulunamayan instance. |
| DOC_NOT_FOUND | Yeni işlem için kapalı/bulunamayan belge. |
| STALE_DOCUMENT | Eski veya izleme güveni kaybolmuş epoch. |
| STALE_REVISION | Yeni mutasyonun beklediği nesil farklı. |
| STALE_CURSOR | Sorgu sayfası bağlamı değişmiş. |
| UNITS_UNKNOWN | İstenen fiziksel birime geçerli dönüşüm yok. |
| TARGET_NOT_FOUND | Handle/katman/hedef yok; bilinmeyen işlem sonucu false sayılmaz. |
| DOC_READ_ONLY | DB değişikliği salt okunur belgede reddedilir; save_copy ayrı izin ve API denemesi gerektirir. |
| DOC_BUSY | Güvenli bağlam/kilit/kuyruk/kayıt kapasitesi yok; yan etki öncesi ret. |
| SECURITY_DENIED | Eşleştirme/yetki/katman izni reddi. |
| IDEMPOTENCY_CONFLICT | Aynı işlem anahtarı farklı anlamsal gövdeyle kullanılmış. |
| EXECUTION_FAILED | API işlemi hata döndürdü; applied ayrıca gerçek durumu söyler. |
| PARTIAL_APPLY | Bilinen kısmi etki; terminal partial sonucu. |
| VERIFICATION_FAILED | Geri okuma doğrulaması başarısız; geri alındığı varsayılmaz. |
| TIMEOUT_UNKNOWN | Çağıran etkiyi bilmiyor; uzlaştırma zorunlu. |
| OUTPUT_PATH_DENIED | Çıktı kökü/yolu/kanonik hedef/yayımlama güvenliği reddi. |
| FILE_EXISTS | No-replace yayımlamada hedef var; mevcut dosya değişmez. |

## 10. İç mesaj örnekleri

Örnekler sentetiktir; canlı çıktı değildir. `bridge.hello` isteği bridgeVersion/clientKind/clientVersion string alanlarını taşır. Başarılı yanıt örneği:

```json
{"jsonrpc":"2.0","id":1,"result":{"bridgeVersion":"0.1.0","instanceId":"inst-1","pluginVersion":"0.0.0-dev","autocadVersion":"2027","platform":"windows","architecture":"x64","capabilities":["acad_query_entities","acad_create_line","acad_create_circle","acad_create_box"]}}
```

Sorgu; içteki acad_* metotları dış MCP `tools/call` zarfının açılmış karşılığıdır:

```json
{"jsonrpc":"2.0","id":2,"method":"acad_query_entities","params":{"instanceId":"inst-1","documentId":"doc-1","documentEpoch":3,"coordinateSystem":"WCS","filter":{"type":"LINE"},"projection":["handle","type","start","end"],"lengthUnit":"mm","limit":100}}
```

Çizgi isteği:

```json
{"jsonrpc":"2.0","id":3,"method":"acad_create_line","params":{"instanceId":"inst-1","documentId":"doc-1","documentEpoch":3,"expectedRevision":41,"operationId":"op-line-1","coordinateSystem":"WCS","lengthUnit":"mm","start":[0,0,0],"end":[100,0,0]}}
```

Çizginin sentetik başarılı sonucu:

```json
{"jsonrpc":"2.0","id":3,"result":{"instanceId":"inst-1","documentId":"doc-1","documentEpoch":3,"operationId":"op-line-1","status":"succeeded","applied":true,"verified":true,"created":[{"documentId":"doc-1","documentEpoch":3,"handle":"2A7"}],"modified":[],"erased":[],"revision":42,"observedGeometry":{"lengthUnit":"mm","coordinateSystem":"WCS","layer":"0","start":[0,0,0],"end":[100,0,0],"length":100},"error":null}}
```

Kutu isteği:

```json
{"jsonrpc":"2.0","id":4,"method":"acad_create_box","params":{"instanceId":"inst-1","documentId":"doc-1","documentEpoch":3,"expectedRevision":42,"operationId":"op-box-1","coordinateSystem":"WCS","lengthUnit":"mm","center":[200,0,0],"size":[100,50,20]}}
```

Kutunun sentetik başarılı sonucu; hacim birimi mm³:

```json
{"jsonrpc":"2.0","id":4,"result":{"instanceId":"inst-1","documentId":"doc-1","documentEpoch":3,"operationId":"op-box-1","status":"succeeded","applied":true,"verified":true,"created":[{"documentId":"doc-1","documentEpoch":3,"handle":"2A8"}],"modified":[],"erased":[],"revision":43,"observedGeometry":{"lengthUnit":"mm","volumeUnit":"mm^3","coordinateSystem":"WCS","layer":"0","center":[200,0,0],"extents":{"min":[150,-25,-10],"max":[250,25,10]},"volume":100000},"error":null}}
```

Ayrı `op-unresolved-1` için status sorgusu ardından dönebilecek belirsiz sonuç (sorgu Target+operationId taşır):

```json
{"jsonrpc":"2.0","id":5,"result":{"instanceId":"inst-1","documentId":"doc-1","documentEpoch":3,"operationId":"op-unresolved-1","status":"unknown","applied":null,"verified":null,"created":[],"modified":[],"erased":[],"revision":null,"observedGeometry":null,"error":{"code":"TIMEOUT_UNKNOWN","message":"İşlemin etkisi doğrulanamadı.","retryable":false,"scope":"operation","details":{}}}}
```

## 11. Kaynak ve açık kapılar

Faz 4 gerçek MCP metadata çıktısı: [TOOL_CATALOG.json](TOOL_CATALOG.json), `npm run catalog` ile yeniden üretilir. 14 araç değişmedi; iki sabit ve eşleştirme bilgisi içermeyen [skill resource](PILOT_KURULUM.md) eklendi. Girdi şemaları katı; MCP outputSchema halen genel JSON object'tir. Aşağıdaki örnekler her çıktı alanı için dar statik tip doğrulaması sayılmaz. Windows temel uygulama kapıları Faz 2–3 kabulüyle kapandı; Mac ve ileri özellikler açık kalır.

- [MCP 2026-07-28 araçlar](https://modelcontextprotocol.io/specification/2026-07-28/server/tools): şema, dış araç zarfı, liste ve structuredContent davranışı.
- [MCP sürüm değişiklikleri](https://modelcontextprotocol.io/specification/2026-07-28/changelog): dış sürüm uyumluluğu iç bridge sürümünden ayrıdır.
- [Belge kilidi](https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcApDocManager__lockDocument_AcApDocument__AcAp__DocLockMode_ACHAR__ACHAR__bool.html): kaynak kilidi; ana thread dispatcher kanıtı değildir.
- [Kutu API'si](https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDb3dSolid__createBox_double_double_double.html): merkez ve asgari boyut.
- Dispatcher, IPC eşleştirme/yetki mekanizması, revision takibinin bütünlüğü ve güvenli ayrı kayıt **uygulanabilirlik kapılarıdır**; [kaynak notları](arastirma/ASAMA1_KAYNAK_NOTLARI.md) ve [kabul senaryoları](TEKNIK_DENEME_KABUL.md) ile kapanacak. Mac 2027 sembol eşleşmesi SDK/arm64 derlemesi bekler. Belge varlığı uygulama başarısı sayılmaz.
