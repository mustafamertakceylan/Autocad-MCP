# Teknik deneme kabul belgesi

> Durum: 2026-10-18 **Windows Core Console kısmi kabulü kanıtlı**. Mm/metre için UNDO dahil 30+30, birimsiz çizim için 9 kontrol geçti. Windows masaüstü UI/çoklu sekme ve kalan hata enjeksiyonları çalıştırılmadı; Windows Faz 2 kabulü devam ediyor. Mac ayrı Faz M kapsamındadır ve Windows kabulünü engellemez. Sözleşme: [ILETISIM_SOZLESMESI.md](ILETISIM_SOZLESMESI.md). Plan: [PLAN.md](PLAN.md) §12. Matris: [YETENEK_MATRISI.md](YETENEK_MATRISI.md).
>
> Kullanıcı bu işte Windows/ortak kod ve izole AutoCAD testini onayladı; Mac'i ayrı Faz M olarak ayırdı. Bu belge gelecekteki Mac/ürün yayını için onay değildir.

## 1. Kanıt kaydı (platform başına ayrı)

Her satır, gerçek çalıştırmada tarih/platform/AutoCAD sürümü/test çizimi/gerçek çıktı ile doldurulur. Bir platformdaki sonuç diğerine genellenmez.

| Platform | Durum | Tarih | AutoCAD sürümü | Test çizimi | Kanıt |
|---|---|---|---|---|---|
| Windows 2027 | **Core Console alt kümesi geçti** | 2026-10-18 | R26.0.60.0.0 / Core Console X.60.0.0 | Stok acadiso.dwt kopyaları; INSUNITS 4/6/0 | Aşağıdaki kanıt kimlikleri; `test/live-windows.ts` |
| macOS 2027 (Apple Silicon/arm64) | **Çalıştırılmadı** | — | — | — | — |

- Windows ve macOS için **ayrı** kanıt satırı zorunludur.
- Hiçbir hücre "çalıştırılmadı" durumundan doğrudan "geçti"ye atlanmaz; gerçek çıktı yazılır.

### Gerçek komut sonuçları ve yerel kanıt

- `npm test`: **11/11** ortak test (protokol/şema, mock IPC, gerçek MCP stdio ve iptal; AutoCAD başarısı değildir).
- `cmake --build build/native --config Release`: ObjectARX 2027 eklentisi derlendi. MSVC 14.51 kullanıldı; SDK önerisi 14.44 ile ayrıca çalıştırılmadı.
- `ctest --test-dir build/native -C Release --output-on-failure`: **1/1** C++ protokol testi; HMAC golden vector TypeScript ile aynı.
- Gerçek zincir: resmî MCP SDK client → ayrı Node stdio süreci → imzalı named pipe → ObjectARX → AutoCAD Core Console. Mock değil (`backend=objectarx`, `simulation=false`).

| Kimlik | Yerel kanıt dizini (`tmp/live-runs/` altında) | Sonuç |
|---|---|---|
| W-mm | `981a1da6-c31c-4c22-880b-2c78b3a13d87` | **30/30**; INSUNITS=4, UNDO, native kopya geometrisi, negatif yollar |
| W-m | `1e14c371-8cf0-4b1e-b7dd-21828c2bb19d` | **30/30**; INSUNITS=6, aynı fiziksel ölçüler ve UNDO |
| W-DU | `01b12360-632d-4916-bad2-0ad0f7d4a0f2` | **9/9**; INSUNITS=0, fiziksel yazma reddi/açık drawing_unit |

Her dizinde `results.json`, `autocad.log`, sentetik kaynak DWG ve özel oturum altında output DWG bulunur. Sır/DWG/log Git'e eklenmez. Komut ve opt-in değişkenleri [geliştirme rehberinde](GELISTIRME.md). Kanıt dosyaları bu bilgisayarda yereldir; başka ortamda yeniden çalıştırılmalıdır.

Ölçülen fiziksel değerler: çizgi 100 mm; çember radius 25 mm; kutu volume 100000 mm³, center [200,0,0], min [150,-25,-10], max [250,25,10] mm; taşınan çizgi uçları [10,0,0]–[110,0,0] mm. Metre çizimi aynı mm girdileriyle sınandı; ayrıca get_entity end=0.11 m ölçüldü. Tek UNDO taşıma öncesi [0,0,0]–[100,0,0] uçlarına döndü, diğer iki nesne korundu. Eski revision reddedildi.

Core Console test pompası Win32 dispatcher'ı application context'te işler; masaüstü async context callback, kullanıcı modal komutu ve sekme geçişi kanıtı değildir. Kaynak dosyanın SHA256 eşitliği ve dirty eşitliği harness'te; filename/DBMOD/INSUNITS koruması ile yeniden açılan geometrinin eşitliği native kodda doğrulandı. Diğer DWG metadata/özel nesneler için doğrulama iddiası yok.

## 2. Test çizimleri

| Kimlik | İçerik | Not |
|---|---|---|
| D1-mm | Yeni çizim, `INSUNITS=mm` | Ana pozitif test. |
| D2-m | Yeni çizim, `INSUNITS=m` (metre) | Birim dönüşümü testi. |
| D3-unitless | Birimsiz/`INSUNITS` bilinmeyen çizim | Negatif birim testi. |

Yalnız sahte/açık örnek çizimlerin kopyaları kullanılır; gerçek müşteri çizimi yoktur.

## 3. Geometri kabul senaryoları

Beklenen değerler, birim açıkça verildiğinde (D1-mm) geçerlidir.

| # | İşlem | Girdi | Beklenen | Durum |
|---|---|---|---|---|
| G-1 | `acad_create_line` | `start [0,0,0]`, `end [100,0,0]`, `lengthUnit=mm` | Uzunluk **100 mm**; geri okuma start/end eşleşir | Windows W-mm/W-m geçti |
| G-2 | `acad_create_circle` | `center` WCS XY, `radius 25 mm`, `normal [0,0,1]` | **Çap 50 mm**; merkez/normal geri okunur | Windows W-mm/W-m geçti; radius 25 mm |
| G-3 | `acad_create_box` | `center [200,0,0] mm`, `size [100,50,20] mm` | **Hacim 100000 mm³**; min `[150,-25,-10]`, max `[250,25,10]` mm; centroid `[200,0,0]` mm | Windows W-mm/W-m geçti |
| G-4 | `acad_move_entities` | G-1 nesnesi, `delta [10,0,0] mm` | Yeni uçlar `[10,0,0]`–`[110,0,0]`; revision artar | Windows W-mm/W-m geçti |
| G-5 | `acad_save_copy` | D1-mm, `outputRootId`, göreli `.dwg`, `overwrite:false` | Yeni bağımsız kopya; kaynak dosya **değişmez** | Windows W-mm/W-m geçti |
| G-6 | Tekrar açma | Kopyayı yeniden aç | Nesneler ve ölçüler G-1..G-4 ile uyuşur | Windows native reopen/geometri karşılaştırması geçti |
| G-7 | D2-m dönüşümü | D1 ile aynı fiziksel mm girdileri | Çizgi 0.1 m; radius 0.025 m; kutu boyutu `[0.1,0.05,0.02]` m, merkezi `[0.2,0,0]` m, hacim 0.0001 m³ | W-m aynı fiziksel mm değerleriyle geçti |
| G-8 | Açık drawing_unit | D3 üzerinde lengthUnit=drawing_unit | Girdi sayıları doğrudan kullanılır; birim tahmin edilmez, INSUNITS değişmez | W-DU geçti |
| G-9 | Açık hedef ve sekme | A belgesini hedefle, kullanıcı B sekmesine geçsin | Epoch değişmez; A doğru bağlamda işlenir veya DOC_BUSY, B değişmez | Çalıştırılmadı |
| G-10 | Transaction ve UNDO | G-4 taşımasını AutoCAD UNDO ile geri al | Uçlar `[0,0,0]`–`[100,0,0]` mm; revision ilerler, eski yazma reddedilir; diğer işlemler korunur | Windows W-mm/W-m geçti; tek UNDO ve eski revision reddi |

Azami çerçeve (1 MiB), sayı/string/dizi sınırları pozitif testin parçası olarak en az bir kez sınanır.

## 4. Negatif senaryolar (en az bir per hata ailesi)

| # | Senaryo | Beklenen hata | Durum |
|---|---|---|---|
| N-1 | D3'te fiziksel lengthUnit=mm ile yazma | `UNITS_UNKNOWN`; açık drawing_unit bu retle karıştırılmaz | W-DU geçti |
| N-2 | Geçersiz geometri (`size` bileşeni `<= 0`, eksik alan) | `VALIDATION_FAILED` | Native negatif boyut reddi + ortak şema testleri geçti; tüm alanlar tek tek native denenmedi |
| N-3 | Olmayan/eski `instanceId` | `INSTANCE_NOT_FOUND` | Mock IPC yanlış instance reddi geçti; native restart senaryosu yok |
| N-4 | İki instance keşfi / zorunlu instanceId eksik çağrı | Keşifte belirsizlik INSTANCE_AMBIGUOUS; eksik alanlı doğrudan çağrıda VALIDATION_FAILED; ikisinde de otomatik yazma yok | Çalıştırılmadı |
| N-5 | Kapalı/olmayan belge | `DOC_NOT_FOUND` | Olmayan belge W-mm/W-m geçti; kapat/aç senaryosu yok |
| N-6 | Belgeyi kapatıp yeniden aç / izleme boşluğu; eski documentEpoch | `STALE_DOCUMENT`; yalnız sekme değişimi epoch yenilemez | Yanlış epoch W-mm/W-m geçti; gerçek kapat/aç ve izleme boşluğu denenmedi |
| N-7 | Kullanıcı düzenlemesi/undo ile revision değişimi | `STALE_REVISION` | UNDO revision değişimi W-mm/W-m geçti; manuel kullanıcı düzenlemesi yok |
| N-8 | Veri değişimi ardından eski cursor | `STALE_CURSOR` | W-mm/W-m geçti |
| N-9 | Olmayan handle ile sorgu | `TARGET_NOT_FOUND` | Çalıştırılmadı |
| N-10 | Salt okunur belgeye yazma | `DOC_READ_ONLY` | Çalıştırılmadı |
| N-11 | Meşgul komut/modal durumda çağrı | Kısa kuyruk veya DOC_BUSY; kullanıcının komutu iptal edilmez | Çalıştırılmadı |
| N-12 | Yetki bağlamı dışı işlem | `SECURITY_DENIED` | Mock grant izin listesi reddi geçti; native profil UI yok |
| N-13 | Aynı dedup anahtarı, farklı gövde | `IDEMPOTENCY_CONFLICT` | W-mm/W-m geçti |
| N-14 | Aynı dedup anahtarı, aynı gövde | Kayıtlı sonuç; yeniden uygulanmaz | W-mm/W-m geçti |
| N-15 | `save_copy` `..`/mutlak yol kaçışı | `OUTPUT_PATH_DENIED` | Ortak şema geçti; native yol yarış enjeksiyonu yok |
| N-16 | `overwrite:false` ile var olan hedef | `FILE_EXISTS` | W-mm/W-m geçti |
| N-17 | Platformda desteklenmeyen ops | `UNSUPPORTED_ON_PLATFORM` | Çalıştırılmadı |
| N-18 | Geri okuma/ölçü doğrulaması tutmazsa | `VERIFICATION_FAILED` | Çalıştırılmadı |
| N-19 | API hatası ve kanıtlı transaction abort enjeksiyonu | EXECUTION_FAILED, applied=false; nesne/revision etkileri kontrol edilir | Çalıştırılmadı |
| N-20 | Dosya/DB dışında bilinen kısmi etki enjeksiyonu | PARTIAL_APPLY, partial; false başarı veya sahte rollback yok | Çalıştırılmadı |
| N-21 | Çerçeve >1 MiB, NaN/taşma, fazla derinlik/öğe, yinelenen anahtar | VALIDATION_FAILED veya parse hatası; API'ye erişmeden ret | TS/C++ protokol testleri kısmi geçti; gerçek pipe saldırı/fuzz testi yok |
| N-22 | Yanlış belgeye ait EntityRef / kilitli katman | VALIDATION_FAILED / SECURITY_DENIED; diğer belge veya hedefler değişmez | Ortak çapraz EntityRef reddi geçti; native kilitli katman senaryosu yok |
| N-23 | Yetkisi olmayan aynı kullanıcı süreci / sahte profile / yetki iptali | SECURITY_DENIED veya IPC_AUTH_FAILED; cache/status erişimi de korunur | Mock imza/grant/süre retleri geçti; gerçek native çoklu süreç saldırısı/iptal yönetimi yok |
| N-24 | Aynı operationId ile eşzamanlı iki aynı istek, sonra farklı gövde | Tek nesne; iki çağrı aynı kaydı alır; farklı gövde IDEMPOTENCY_CONFLICT | Mock eşzamanlı aynı istek geçti; native tek istemci sıralı tekrar kanıtlı |
| N-25 | Kayıt kapasitesi dolu, eski revision'lı bilinen tekrar | Yeni işlem DOC_BUSY; bilinen aynı tekrar kayıtlı sonuç, ikinci uygulama yok | Çalıştırılmadı |
| N-26 | AutoCAD kapalı / eklenti yok / sürüm uyuşmaz / IPC kapalı | Kanıtına göre bootstrap kodu; erişim reddi eklenti yok sayılmaz | Çalıştırılmadı |

## 5. Eşzamanlılık, iptal, zaman aşımı senaryoları

| # | Senaryo | Beklenen | Durum |
|---|---|---|---|
| E-1 | Kuyrukta iptal (iç bridge.cancel/test harness) | `cancelled`, `applied:false`; 15. MCP aracı gerekmez | Yerel gönderim öncesi abort geçti; native bridge.cancel uygulanmadı |
| E-2 | Çalışırken iptal | cancelRequested sonucu iptal garantisi değildir; uygulanmış iş cancelled olmaz; kanıtlı abort yoksa gerçek sonuç/partial/unknown | Mock gönderim sonrası abort unknown geçti; native running-job abort yok |
| E-3 | Yanıt gelmeden timeout | `unknown` / `TIMEOUT_UNKNOWN`; `operation_status` ile uzlaştırılır | Mock timeout unknown geçti; native timeout enjeksiyonu yok |
| E-4 | Timeout sonrası kör retry | Yapılmaz; `operation_status` ile karar | Mock testte tek gönderim kanıtlı |
| E-5 | Süreç yeniden başlatma | Mutasyonlar otomatik tekrar edilmez; eski `instanceId` reddedilir | Çalıştırılmadı |
| E-6 | Doğrulama başarısız sonrası | "commit sonrası rollback" varsayılmaz; gerçek durum raporlanır | Çalıştırılmadı |
| E-7 | Timeout sonrası kayıt bulunamaması / süreç ölümü | unknown ve applied=null; kayıt yok diye tekrar uygulanmaz | Olmayan operation kaydı Windows unknown/null geçti; süreç ölümü enjeksiyonu yok |
| E-8 | Status sorgusu / normal terminal hatadan sonra sorgu | Kayıtlı terminal sonuç değişmez; sırf timeout oldu diye running kaydı yanlışlıkla değiştirilmez | Native başarılı kaydın status ile aynı sonucu döndürmesi geçti; tüm terminal hata yolları denenmedi |
| E-9 | İkinci hedef başarısız / commit sonrası doğrulama kaybı | Ön kontrolde tüm grup reddedilir veya kanıtlı abort; commit olduysa applied=true/null ve doğrulama hatası | Çalıştırılmadı |

## 6. Kaynak dosyanın korunması

| # | Senaryo | Beklenen | Durum |
|---|---|---|---|
| S-1 | `save_copy` sonrası orijinal | Orijinal dosya byte düzeyinde değişmez (hash karşılaştırması) | W-mm/W-m SHA256 eşitliği geçti |
| S-2 | Çizimin `INSUNITS` değeri | Test boyunca değiştirilmez | Hazırlık sonrası MCP boyunca native kontrol geçti; W-DU değeri 0 kaldı |
| S-3 | Aktif belge adı | `save_copy` aktif belgeyi yeniden adlandırmaz | Native filename öncesi/sonrası kontrolü geçti |
| S-4 | Başlangıç/bitiş dirty ve DBMOD | Kaydedilmemiş düzenleme durumu korunur; bu kapı geçmezse save_copy devre dışı | Harness dirty eşitliği + native DBMOD eşitliği W-mm/W-m geçti |
| S-5 | Symlink/junction, kök/ebeveyn değiştirme, hedefi yarışta oluşturma | Kök dışına/var olan dosyaya yazma yok; OUTPUT_PATH_DENIED veya FILE_EXISTS | Çalıştırılmadı |
| S-6 | Kayıt tamamlandıktan sonra cevap kaybı / yeniden açma hatası | Dedup ile ikinci dosya üretilmez; gerçek çıktı/partial/unknown bildirilir | Çalıştırılmadı |

## 7. Toleranslar (öneri)

- İlk sentetik küçük geometri testi için öneri: fiziksel konum/uzunluk/radius/bounds mutlak hata <=1e-6 mm; hacim göreli hata <=1e-8. Metre sonuçları önce aynı fiziksel birime dönüştürülür. Büyük koordinatlı gerçek çizimler için ayrı hata bütçesi gerekir.
- Birimsiz drawing_unit örneğinde uzunluk toleransı <=1e-6 DU önerisidir. Bu karşılaştırma toleransı, createBox'ın minimum boyut API sınırından türetilmez.
- Kutu native minimumu dönüşümden sonra sınanır: 1e-6 DU altı ret; sınır ve üstü ayrı ölçülür. Önerilen toleranslar henüz platformda doğrulanmadı; beklenen değerler ölçüme uydurulmaz, sapma raporlanır.

## 8. Kaynaklar

- Sözleşme: [ILETISIM_SOZLESMESI.md](ILETISIM_SOZLESMESI.md) — durum modeli, hata kodları, kimlikler.
- Plan: [PLAN.md](PLAN.md) §10 test katmanları, §12 aşamalar.
- Autodesk `AcDb3dSolid::createBox` — kutu orijinde merkezli; boyut `< 1e-6` ise hata: <https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDb3dSolid__createBox_double_double_double.html>

Test komutları ve çerçeve mevcut; CI ve ayrı lint yapılandırması yok. Tip denetimi npm test içindeki TypeScript build ile yapıldı. Yukarıda belirtilmeyen kabul yolları **çalıştırılmadı**. Windows masaüstü/çoklu belge ve kalan Faz 2 kabul kapıları kapanmadan Faz 2 tamamlanmış sayılmaz. Mac satırı yalnız Faz M kabulüne aittir; Windows fazları için ön koşul değildir.
