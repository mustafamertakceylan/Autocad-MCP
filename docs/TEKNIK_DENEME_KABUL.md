# Teknik deneme kabul belgesi

> Durum: 2026-10-18 **Windows Faz 2–4 sınırlı pilot kabulü tamamlandı**. Mm/metre için UNDO dahil 30+30, birimsiz çizim için 9 kontrol geçti. Görünür Windows masaüstünde 26 kontrol geçti. Faz 3'te aşağıdaki sınırlı alt küme için 56/56 masaüstü hata enjeksiyonu kontrolü geçti; sınırsız stres/üretim kabulü değildir. Mac ayrı Faz M kapsamındadır ve Windows kabulünü engellemez. Sözleşme: [ILETISIM_SOZLESMESI.md](ILETISIM_SOZLESMESI.md). Plan: [PLAN.md](PLAN.md) §12. Matris: [YETENEK_MATRISI.md](YETENEK_MATRISI.md).
>
> Kullanıcı bu işte Windows/ortak kod ve izole AutoCAD testini onayladı; Mac'i ayrı Faz M olarak ayırdı. Bu belge gelecekteki Mac/ürün yayını için onay değildir.

## 1. Kanıt kaydı (platform başına ayrı)

Her satır, gerçek çalıştırmada tarih/platform/AutoCAD sürümü/test çizimi/gerçek çıktı ile doldurulur. Bir platformdaki sonuç diğerine genellenmez.

| Platform | Durum | Tarih | AutoCAD sürümü | Test çizimi | Kanıt |
|---|---|---|---|---|---|
| Windows 2027 | **Core Console ve masaüstü temel kabulü geçti** | 2026-10-18 | R26.0.60.0.0 / Core Console X.60.0.0 | Stok acadiso.dwt kopyaları; INSUNITS 4/6/0 | Aşağıdaki kanıt kimlikleri; `test/live-windows.ts` |
| macOS 2027 (Apple Silicon/arm64) | **Çalıştırılmadı** | — | — | — | — |

- Windows ve macOS için **ayrı** kanıt satırı zorunludur.
- Hiçbir hücre "çalıştırılmadı" durumundan doğrudan "geçti"ye atlanmaz; gerçek çıktı yazılır.

### Gerçek komut sonuçları ve yerel kanıt

- `npm test`: **21/21** güncel ortak test (Faz 2 tabanı 11, Faz 3 +6, Faz 4 +4: üç pilot/resource/eşleştirme ve bir bağımsız geometri testi). Protokol/şema, mock IPC, gerçek MCP stdio ve iptal; AutoCAD başarısı değildir. Son koşu normal kullanıcı izinleriyle geçti; Codex sandbox'ı mevcut pointer dosyasının atomik rename işlemini EPERM ile engellediği için o koşu yükseltilmiş komutla yapıldı, ACL değiştirilmedi.
- `cmake --build build/native --config Release`: ObjectARX 2027 eklentisi derlendi. MSVC 14.51 kullanıldı; SDK önerisi 14.44 ile ayrıca çalıştırılmadı.
- `ctest --test-dir build/native -C Release --output-on-failure`: **1/1** C++ test executable: protokol/HMAC ve gerçek Jobs kayıt/kapasite/16-thread dedup/kuyruk iptali/timeout/bütçe kontrolleri; HMAC golden vector TypeScript ile aynı.
- Gerçek zincir: resmî MCP SDK client → ayrı Node stdio süreci → imzalı named pipe → ObjectARX → AutoCAD Core Console. Mock değil (`backend=objectarx`, `simulation=false`).

| Kimlik | Yerel kanıt dizini (`tmp/live-runs/` altında) | Sonuç |
|---|---|---|
| W-mm | `981a1da6-c31c-4c22-880b-2c78b3a13d87` | **30/30**; INSUNITS=4, UNDO, native kopya geometrisi, negatif yollar |
| W-m | `1e14c371-8cf0-4b1e-b7dd-21828c2bb19d` | **30/30**; INSUNITS=6, aynı fiziksel ölçüler ve UNDO |
| W-DU | `01b12360-632d-4916-bad2-0ad0f7d4a0f2` | **9/9**; INSUNITS=0, fiziksel yazma reddi/açık drawing_unit |

Her dizinde `results.json`, `autocad.log`, sentetik kaynak DWG ve özel oturum altında output DWG bulunur. Sır/DWG/log Git'e eklenmez. Komut ve opt-in değişkenleri [geliştirme rehberinde](GELISTIRME.md). Kanıt dosyaları bu bilgisayarda yereldir; başka ortamda yeniden çalıştırılmalıdır.

Ölçülen fiziksel değerler: çizgi 100 mm; çember radius 25 mm; kutu volume 100000 mm³, center [200,0,0], min [150,-25,-10], max [250,25,10] mm; taşınan çizgi uçları [10,0,0]–[110,0,0] mm. Metre çizimi aynı mm girdileriyle sınandı; ayrıca get_entity end=0.11 m ölçüldü. Tek UNDO taşıma öncesi [0,0,0]–[100,0,0] uçlarına döndü, diğer iki nesne korundu. Eski revision reddedildi.

Core Console kanıtına ek aşağıdaki W-desktop kabulü test pompası olmadan gerçek masaüstü event loop/çoklu sekme ve bekleyen LINE komutunu sınar. Standart OS modal ve haricî veto senaryoları aşağıdaki Faz 3 paketinde ayrıca geçti. Kaynak dosyanın SHA256 eşitliği ve dirty eşitliği harness'te; filename/DBMOD/INSUNITS koruması ile yeniden açılan geometrinin eşitliği native kodda doğrulandı. Diğer DWG metadata/özel nesneler için doğrulama iddiası yok.

### W-desktop — görünür masaüstü kabulü (26/26)

Kanıt: `tmp/desktop-runs/236c7661-7d52-4113-b0af-b59fac43fea6/desktop-results.json`; gerçek AutoCAD 2027 masaüstü, yeni test profili, stok şablondan primary/secondary kopyaları, `usesTestPump:false`. Harness: `test/desktop-windows.ts` ve `test/start-desktop.ps1`.

- İkinci sekme aktifken açık hedef primary çizimine çember yazıldı; secondary boş kaldı, geçici current context ve aktif sekme geri korundu, epoch değişmedi.
- Masaüstü UNDO yalnız taşımayı geri aldı; çizgi/çember korundu. Kontrol, asenkron komutun ölçülen sonucunu bekler.
- Gerçek LINE komutu kullanıcı girdisi beklerken mutasyon DOC_BUSY/applied=false döndü. LINE aktif kaldı; yalnız açık test cleanup kendi komutunu iptal etti.
- Kilitli katmana yazma SECURITY_DENIED ve geometrinin değişmemesiyle doğrulandı.
- Secondary kapat/aç ile eski kimlik reddedildi, yeni kimlik/epoch üretildi.
- Native parent traversal ve junction kökü reddedildi; dış dizine DWG yazılmadı.
- Snapshot staging başladıktan sonra test tarafından oluşturulan hedef dosya FILE_EXISTS ile korundu; sentinel içeriği değişmedi. Ayrı normal DWG'nin yeniden açılan geometrisi ve kaynak dirty/hash durumu eşleşti.

Test kontrolleri yalnız `-DAUTOCAD_MCP_TESTING=ON` derlemesi + `MCP_TEST_MODE=1` ortamında vardır; normal derlemede `bridge.test_action` bulunmaz. Sabit sentetik adlar kullanılır, keyfi komut/yol MCP aracı açılmaz. Kullanıcı profili yerine yeni adlandırılmış test profili kullanılır; SECURELOAD=2 açık kalır.

**Faz sınırı:** Windows Faz 2 temel köprüsü ve Faz 3 güvenilir çekirdeği kapandı. Destek kapsamı hâlâ 14 araç/modelspace/WCS/LINE-CIRCLE-bridge kutusudur. Genel AutoCAD özellikleri, çoklu otomatik instance keşfi, bütün metadata, büyük çizim stresi ve dağıtım Faz 2–3 kabulünün dışındadır; istemci pilotu aşağıdaki W-phase4 bölümündedir. Mac ayrı Faz M.

### W-phase3 — güvenilir çekirdek (56/56)

Kanıt: `tmp/desktop-runs/b948ceb0-63f9-48e7-a0aa-cfdc76a6e7f3/phase3-results.json`. Harness `test/phase3-windows.ts`; gerçek AutoCAD 2027, yeni test profili, stok şablon kopyaları, test pompası yok. Test sonunda yalnız sahip olunan sentetik süreç, işlem çalışırken kontrollü olarak sonlandırıldı. AutoCAD test penceresi şu an bu koşu tarafından kapatıldı.

- Projeksiyon, cursor imzası, dış API düzenlemesi/revision, eksik handle, desteklenmeyen nesne, grup atomikliği, açık yabancı transaction ve read-only retleri.
- Gerçek iki IPC istemcisinde eşzamanlı aynı/farklı operationId gövdesi; kuyrukta ve çalışırken native iptal; commit öncesi/kuyrukta yetki iptali. Status ayrı kanalda CAD işi sürerken cevap verdi.
- Gerçek transaction abort ve geometri etkisizliği; commit sonrası doğrulama kaybında applied=true; native kayıt doluyken yeni iş reddi ve eski başarı/hata tekrarları. Kapasite testi aynı kontrolü test-only sınırı doluma indirerek çalıştırır; 10000 CAD işlemi üretilmedi.
- Standart Windows modal, haricî DocumentLockModeChanged veto, ayrı kayıt reopen hatası, kaynakta bilinen yan etki/partial, kök ata rename yarışı, yayın sonrası yanıt kaybı/dedup.
- Gerçek pipe üzerinde yanlış HMAC, yinelenen anahtarlar, derin JSON, taşma, bozuk UTF-8, >1 MiB zarf, yanlış instance ve kontrol kanalında mutasyon reddi; iptal edilmiş pairing ile cache/status erişimi reddi. Tam rastgele fuzz/stres çalıştırılmadı.
- Plugin restart ile yeni instance/belge/epoch; eksik kayıt unknown/null; işlem sırasında süreç ölümü TIMEOUT_UNKNOWN ve IPC_UNAVAILABLE, otomatik mutasyon tekrarı yok.

**Enjeksiyon sınırı:** `abort_unconfirmed` gerçek abort çağrısından sonra kanıt eksikliğini taklit eder; gerçek SDK abort başarısızlığı ölçülmedi. `source_side_effect` test derlemesinde snapshot için write lock alıp sentetik INSUNITS'ı gerçekten değiştirir; normal save_copy read lock kullanır. Bu fixture gerçek partial bildirimini ve çıktı yayımlanmamasını ölçer; test-only restore ile birim geri alınır. Native fault/probe/seal kontrolleri normal build'de etkin değildir.

**Normal eklenti regresyonu:** `AUTOCAD_MCP_TESTING=OFF`; `tmp/live-runs/9b38e0f9-80c4-4cc2-9e12-28b48cf74ad0/results.json` **30/30**. Resmî SDK stdio → gerçek ObjectARX zinciri, mm geometri/UNDO, dedup, ayrı kayıt/reopen ve source hash/dirty yeniden geçti. Önceki metre/birimsiz kanıtları yukarıdadır; son kodla bu iki birim yeniden çalıştırılmadı.

### W-phase4 — gerçek model istemcileri ve fotoğraftan sayısal çizim

2026-10-18, AutoCAD 2027 R26.0.60.0.0 / Windows x64, normal `build/native` modülü (`AUTOCAD_MCP_TESTING=OFF`). Yeni test profili, stok acadiso.dwt kopyası, INSUNITS=4. Geometri görünür masaüstü event loop'unda, MCP üzerinden üretildi; canlı yazmada test_action/test pompası veya başka CAD API'si kullanılmadı. Yalnız sunum için UI üzerinden Zoom Extents ve uzaklaşma yapıldı; çizim penceresi açık bırakıldı.

Yerel kanıt kökü: `tmp/desktop-runs/d9ec835d-81cc-40a9-ad31-b9d5110fd502/`. `pilot-results.json` native sonuçları, `verification-both.json` bağımsız ölçüm/reopen kabulünü içerir. Model günlükleri kanıttır; modelin kendi başarı metni kabul yerine geçmez. Kaynak fotoğraf sağlayıcılara gönderilmedi; kullanıcıca onaylanan sayısal ölçüler gönderildi.

| İstemci | Gerçek akış | Sonuç / kanıt |
|---|---|---|
| OpenCode 1.18.34, EVREN MiMo V2.6 Pro, max | Yerel skill okuma → boş çizimi sorgu → 20 LINE + 1 CIRCLE → tümünü +5X taşı/geri taşı → sorgu → ayrı DWG | `opencode-draw.jsonl`, `opencode-draw-summary.json`; 58 araç çağrısı, 24 native mutasyonun tamamı succeeded/applied=true/verified=true; model exit 0 |
| Codex CLI 0.160.0, gpt-6.1-sol, high | MCP resource skill okuma → mevcut 21 nesneyi incele → geçici R2 çember oluştur → +10X taşı → geri oku → yalnız geçici çemberi sil → sorgu → ikinci DWG | `codex-edit.jsonl`, `codex-edit-summary.json`; 4 native mutasyon succeeded/applied=true/verified=true; model exit 0. Aşağıdaki iki ret ayrıca kaydedildi |
| Claude Code | `.mcp.json`, `.claude/skills` üretimi ve aynı canonical skill doğrulaması | **Canlı çağrı çalıştırılmadı:** kullanıcı limiti yok. Claude Desktop testi de yapılmadı |

Codex'in ilk çember isteğinde koordinatlar string gönderildi; SDK girdi şeması isteği native katmana gitmeden reddetti. Ardından hiç gönderilmemiş ID için işlem durumu unknown/null döndü. Model revision/geometri sorgulayıp girdi tipini düzelterek aynı ID ile tek gerçek çember oluşturdu. Bu iki çağrı hata olarak saklandı; kusursuz ilk deneme iddiası yoktur. Bilinmeyen bir native mutasyon körlemesine tekrarlanmadı. Önceki Codex probe'da shell üzerinden skill okuması politika tarafından reddedilmişti; shell izni gevşetilmedi, iki sabit MCP resource ile okuma geçti.

Bağımsız doğrulayıcı `test/verify-client-drawing.ts`, istemci fixture'ındaki vertex listesini beklenen geometri olarak kullanmaz; onaylı ölçülerden konturu ayrı türetir. Her kenarı, merkez/radius, tam nesne sayısı ve tarama sayısını karşılaştırır; tolerans 1e-6 mm.

| Ölçü | Gerçek geri okuma |
|---|---|
| Modelspace | 20 LINE + 1 CIRCLE; cursor null, scanned=21 |
| Dış ölçü | 80×40 mm; min [-40,-20,0], max [40,20,0] |
| Yan boşluk | İç kenarlar x=±25 (aralık 50); açıklık 20, derinlik 15 mm |
| Orta çentik | Genişlik 20; iç kenarlar y=±15 (aralık 30); derinlik 5 mm |
| Merkez çember | [0,0,0], R5 / Ø10 mm |
| Dış kontur çevresi | 320 mm |
| Hesaplanan alan | Kontur 2400 mm²; çember çıkarılınca 2321.460183660255 mm². Bu hesap 2B sınır üzerinden yapılır; DWG'de bölge/katı oluşturulmadı |

İki kopya ayrı Core Console süreçlerinde yeniden açıldı; salt okuma MCP sorgularıyla aynı 21 nesne ve ölçüler doğrulandı. Kanıt dizinleri `tmp/reopen-runs/d3e4b02c-5026-4673-b639-dbb8263dc6d8` (OpenCode) ve `38e94904-75c6-4a65-be61-3476ae083331` (Codex). Kaynak template kopyasının SHA256 değeri korundu; reopen için kullanılan scratch DWG de çıkış sonrası byte düzeyinde değişmedi. İlk reopen betiğinde QUIT sorusuna `_N` verilmesi scratch kopyanın kaydına yol açtı; gerçek prompt "discard all changes" olduğundan `_Y` ile düzeltildi ve iki son kabul geçti. Asıl model çıktısı değiştirilmedi.

Kullanıcı çıktıları Git dışında `runtime/exports/d9ec835d-81cc-40a9-ad31-b9d5110fd502/`: `teknik-resim-opencode.dwg`, `teknik-resim-codex.dwg`, gerçek entity geri okumasından `observed-geometry.json`, `teknik-resim.svg` ve `teknik-resim.png`. PNG bir AutoCAD ekran görüntüsü değildir; ölçülen geometri önizlemesidir. Kaynak fotoğraf düzenlenmedi.

Pilot setup unit/stdio testleri: secret kopyalanmaması, üç istemcinin aynı bağlantıya yönelmesi, dolu klasörün korunması, yanlış instance pointer reddi, 14 araç + 2 sabit resource, keyfi resource yolu reddi, explicit re-pair/config koruması geçti. Skill Creator `quick_validate.py`: **Skill is valid!**. `npm run check` ve CTest **1/1** geçti. [Kullanıcı rehberi](PILOT_KURULUM.md) ve [şema kataloğu](TOOL_CATALOG.json) eklendi. Katı input şemaları yanında outputSchema halen genel object'tir; dar statik çıktı doğrulaması kapsam dışı sınır olarak belgelenir.

**Ek bağımsız Codex kabulü:** Kullanıcının açık isteğiyle ayrı Codex görevi, önceki fotoğraf/fixture/vertex/DWG'yi kullanmadan yalnız sayısal ölçülerden konturu türetti. Resmî SDK Client + StdioClientTransport üzerinden MCP create_line/create_circle/save_copy ile yeni stok kaynakta 21 nesne ve ayrı DWG oluşturdu. `tmp/independent-codex-29497083-1944-48f2-816c-5a4416d33bf9/evidence.json`: **52 kontrol**, 22 doğrulanmış mutasyon (20 çizgi, bir çember, bir kayıt), iki ayrı Core Console oturumu, bütün kenar/çentik ölçüleri, kaynak/çıktı SHA256 ve normal kapanış geçti. İlk denemelerde sandbox registry izni ve sürücünün eksik projection alanı sorunu vardı; son başarılı deneme yeni boş kaynakla yapıldı, eksik deneme kanıtı korundu. Kaynak/config/plan koduna değişiklik yapılmadı; bu geçici sürücü ve çıktılar Git dışında kalır.

Yönetici yalnız rapora dayanmadı: çıktı DWG'sinin kopyasını üçüncü, yeni Core Console sürecinde **salt okuma MCP sorgularıyla yeniden açtı**. Önceki bağımsız geometri doğrulayıcısı tüm 20 kenarı, Ø10 merkezi, 80×40 sınırı ve 320 mm çevreyi doğruladı; modül/kaynak/çıktı hash'leri korundu. Kanıt: `tmp/independent-review-5d66cf45-8557-4f75-9b71-016bf691a7f1/review.json`. DWG: `runtime/exports/independent-codex-29497083-1944-48f2-816c-5a4416d33bf9/teknik-resim-codex-bagimsiz.dwg`. Kullanıcının son isteğine göre ölçü yazıları eklenmedi. Bağımsız test Core Console'dadır; bu çizim için görünür masaüstü testi çalıştırılmadı.

**Faz 4 kapanışı:** Kullanıcının seçtiği Codex + OpenCode alternatifiyle Windows geliştirici pilotu tamamlandı. 14 aracın önceki native temel kabulü korunur; bu model deneyi 3B kutu dahil her aracı yeniden kullanmış sayılmaz. Claude canlı kabulü ertelendi. Native ölçü/yazı, birleşik polyline, 3B delik, temiz cihaz/paketleme, Mac ve bütün AutoCAD özellikleri bu kapanışa dahil değildir. Kullanıcı tamamlanmış Faz 4 değişikliklerinin commit ve private main'e push'unu onayladı; bu yetki Faz 5 kodlamasını içermez.

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
| G-9 | Açık hedef ve sekme | A belgesini hedefle, kullanıcı B sekmesine geçsin | Epoch değişmez; A doğru bağlamda işlenir veya DOC_BUSY, B değişmez | W-desktop geçti; inactive primary yazıldı, secondary/context korundu |
| G-10 | Transaction ve UNDO | G-4 taşımasını AutoCAD UNDO ile geri al | Uçlar `[0,0,0]`–`[100,0,0]` mm; revision ilerler, eski yazma reddedilir; diğer işlemler korunur | W-mm/W-m ve W-desktop geçti; tek UNDO, diğer nesneler korundu |

Azami çerçeve (1 MiB), sayı/string/dizi sınırları pozitif testin parçası olarak en az bir kez sınanır.

## 4. Negatif senaryolar (en az bir per hata ailesi)

| # | Senaryo | Beklenen hata | Durum |
|---|---|---|---|
| N-1 | D3'te fiziksel lengthUnit=mm ile yazma | `UNITS_UNKNOWN`; açık drawing_unit bu retle karıştırılmaz | W-DU geçti |
| N-2 | Geçersiz geometri (`size` bileşeni `<= 0`, eksik alan) | `VALIDATION_FAILED` | Native negatif boyut reddi + ortak şema testleri geçti; tüm alanlar tek tek native denenmedi |
| N-3 | Olmayan/eski `instanceId` | `INSTANCE_NOT_FOUND` | W-phase3 gerçek native yanlış instance ve restart reddi geçti |
| N-4 | İki instance keşfi / zorunlu instanceId eksik çağrı | Keşifte belirsizlik INSTANCE_AMBIGUOUS; eksik alanlı doğrudan çağrıda VALIDATION_FAILED; ikisinde de otomatik yazma yok | Mevcut profilde yalnız operatörün seçtiği tek grant var; otomatik çoklu keşif uygulanmadı/kapsam dışı. Eksik zorunlu hedef TS şemada reddedilir |
| N-5 | Kapalı/olmayan belge | `DOC_NOT_FOUND` | W-mm/W-m olmayan belge; W-desktop kapat/aç eski kimlik reddi geçti |
| N-6 | Belgeyi kapatıp yeniden aç / izleme boşluğu; eski documentEpoch | `STALE_DOCUMENT`; yalnız sekme değişimi epoch yenilemez | W-desktop kapat/aç ve W-phase3 pairing restart ile yeni kimlik/epoch geçti. Reaktörün dışarıdan sökülmesi için desteklenen bir yol yok; böyle bir SDK bozulması enjekte edilmedi |
| N-7 | Kullanıcı düzenlemesi/undo ile revision değişimi | `STALE_REVISION` | UNDO ve W-phase3 dış API düzenlemesi eski revision retleri geçti; UI üzerinden el ile çizim bu koşuda yapılmadı |
| N-8 | Veri değişimi ardından eski cursor | `STALE_CURSOR` | W-mm/W-m geçti |
| N-9 | Olmayan handle ile sorgu | `TARGET_NOT_FOUND` | W-phase3 gerçek native olmayan handle reddi geçti |
| N-10 | Salt okunur belgeye yazma | `DOC_READ_ONLY` | W-phase3 kRequireReadOnly ile açılmış secondary belgesine yazma reddi geçti |
| N-11 | Meşgul komut/modal durumda çağrı | Kısa kuyruk veya DOC_BUSY; kullanıcının komutu iptal edilmez | W-desktop LINE; W-phase3 aktif/owner-disabled standard OS modal ve haricî veto geçti; başka vendor modal çeşitleri denenmedi |
| N-12 | Yetki bağlamı dışı işlem | `SECURITY_DENIED` | Node grant izin listesi ve W-phase3 kontrol kanalında mutasyon reddi geçti; profil yönetim UI yok |
| N-13 | Aynı dedup anahtarı, farklı gövde | `IDEMPOTENCY_CONFLICT` | W-mm/W-m geçti |
| N-14 | Aynı dedup anahtarı, aynı gövde | Kayıtlı sonuç; yeniden uygulanmaz | W-mm/W-m geçti |
| N-15 | `save_copy` `..`/mutlak yol kaçışı | `OUTPUT_PATH_DENIED` | Ortak şema + W-desktop native parent traversal reddi geçti |
| N-16 | `overwrite:false` ile var olan hedef | `FILE_EXISTS` | W-mm/W-m geçti |
| N-17 | Platformda desteklenmeyen ops | `UNSUPPORTED_ON_PLATFORM` | W-phase3 gerçek ARC nesnesine taşıma UNSUPPORTED_ON_PLATFORM reddi geçti |
| N-18 | Geri okuma/ölçü doğrulaması tutmazsa | `VERIFICATION_FAILED` | W-phase3 commit sonrası ölçüm fault: VERIFICATION_FAILED/applied=true/verified=false geçti |
| N-19 | API hatası ve kanıtlı transaction abort enjeksiyonu | EXECUTION_FAILED, applied=false; nesne/revision etkileri kontrol edilir | W-phase3 append sonrası fault, gerçek abort ve nesne sayısının korunması geçti; abort belirsizliği ayrıca unknown/null + yazma karantinası verdi |
| N-20 | Dosya/DB dışında bilinen kısmi etki enjeksiyonu | PARTIAL_APPLY, partial; false başarı veya sahte rollback yok | W-phase3 test-only write-lock snapshot yan etkisi: kaynak INSUNITS gerçekten değişti, partial/applied=true, çıktı yayımlanmadı; rapor değişmezliği geçti |
| N-21 | Çerçeve >1 MiB, NaN/taşma, fazla derinlik/öğe, yinelenen anahtar | VALIDATION_FAILED veya parse hatası; API'ye erişmeden ret | TS/C++ sınırları ve W-phase3 gerçek pipe malformed/UTF8/depth/overflow/duplicate/oversize retleri geçti; tam fuzz yok |
| N-22 | Yanlış belgeye ait EntityRef / kilitli katman | VALIDATION_FAILED / SECURITY_DENIED; diğer belge veya hedefler değişmez | Ortak cross-doc ref ve W-desktop kilitli katman/no-effect; W-phase3 geçersiz ikinci hedefte tüm grubun etkisizliği geçti |
| N-23 | Yetkisi olmayan aynı kullanıcı süreci / sahte profile / yetki iptali | SECURITY_DENIED veya IPC_AUTH_FAILED; cache/status erişimi de korunur | W-phase3 yanlış HMAC, kaldırılmış pairing ile cache/status reddi, kuyruk/commit öncesi revocation geçti. Sırrı okuyabilen aynı kullanıcı sürecine OS sandbox iddiası yok |
| N-24 | Aynı operationId ile eşzamanlı iki aynı istek, sonra farklı gövde | Tek nesne; iki çağrı aynı kaydı alır; farklı gövde IDEMPOTENCY_CONFLICT | W-phase3 iki gerçek BridgeClient, aynı kayıt/tek geometri ve eşzamanlı farklı gövde reddi geçti |
| N-25 | Kayıt kapasitesi dolu, eski revision'lı bilinen tekrar | Yeni işlem DOC_BUSY; bilinen aynı tekrar kayıtlı sonuç, ikinci uygulama yok | W-phase3 test-only dolum sınırında aynı production kontrolü: yeni iş ret, bilinen eski başarı/hata tekrarları geçti. C++ testi byte bütçesini de sınar |
| N-26 | AutoCAD kapalı / eklenti yok / sürüm uyuşmaz / IPC kapalı | Kanıtına göre bootstrap kodu; erişim reddi eklenti yok sayılmaz | W-phase3 öldürülmüş gerçek endpoint IPC_UNAVAILABLE; ortak test yanlış handshake sürümünü gönderimden önce reddetti. ACAD_NOT_RUNNING/PLUGIN_NOT_LOADED özel teşhisleri uygulanmadı; kanıt olmadan uydurulmaz |

## 5. Eşzamanlılık, iptal, zaman aşımı senaryoları

| # | Senaryo | Beklenen | Durum |
|---|---|---|---|
| E-1 | Kuyrukta iptal (iç bridge.cancel/test harness) | `cancelled`, `applied:false`; 15. MCP aracı gerekmez | TS kuyruk iptali + W-phase3 native queued durumunu görüp iptal/false ve geometri etkisizliği geçti |
| E-2 | Çalışırken iptal | cancelRequested sonucu iptal garantisi değildir; uygulanmış iş cancelled olmaz; kanıtlı abort yoksa gerçek sonuç/partial/unknown | W-phase3 running durumunu görüp AbortSignal → bridge.cancel → gerçek abort/cancelled/false geçti; commit sonrası iş iptal edilmiş sayılmadı |
| E-3 | Yanıt gelmeden timeout | `unknown` / `TIMEOUT_UNKNOWN`; `operation_status` ile uzlaştırılır | W-phase3 commit sonrası cevap timeout ve ayrı kontrol kanalından ölçülmüş başarıya uzlaştırma geçti |
| E-4 | Timeout sonrası kör retry | Yapılmaz; `operation_status` ile karar | Ortak tek-gönderim testi ve W-phase3 status ardından kayıtlı aynı sonuç geçti; otomatik replay yok |
| E-5 | Süreç yeniden başlatma | Mutasyonlar otomatik tekrar edilmez; eski `instanceId` reddedilir | W-phase3 MCPSTOP/MCPSTART yeni pairing/instance/belge/epoch ve eski instance reddi geçti; süreç ölümü ayrıca sınandı |
| E-6 | Doğrulama başarısız sonrası | "commit sonrası rollback" varsayılmaz; gerçek durum raporlanır | W-phase3 post-commit verification fault, applied=true ve değişmiş geometri geçti |
| E-7 | Timeout sonrası kayıt bulunamaması / süreç ölümü | unknown ve applied=null; kayıt yok diye tekrar uygulanmaz | W-phase3 kayıtsız/restart sonrası unknown/null, çalışan mutasyon sırasında süreç ölümü ve kör retry olmaması geçti |
| E-8 | Status sorgusu / normal terminal hatadan sonra sorgu | Kayıtlı terminal sonuç değişmez; sırf timeout oldu diye running kaydı yanlışlıkla değiştirilmez | W-phase3 başarı, abort, verification-failure, partial terminal sonuçları cache/status ile tutarlı; kapasite doluyken de kayıtlar korundu |
| E-9 | İkinci hedef başarısız / commit sonrası doğrulama kaybı | Ön kontrolde tüm grup reddedilir veya kanıtlı abort; commit olduysa applied=true/null ve doğrulama hatası | W-phase3 geçersiz ikinci hedefte ilk geometri değişmedi; post-commit doğrulama kaybında gerçek uygulanmış etki korundu |

## 6. Kaynak dosyanın korunması

| # | Senaryo | Beklenen | Durum |
|---|---|---|---|
| S-1 | `save_copy` sonrası orijinal | Orijinal dosya byte düzeyinde değişmez (hash karşılaştırması) | W-mm/W-m SHA256 eşitliği geçti |
| S-2 | Çizimin `INSUNITS` değeri | Test boyunca değiştirilmez | Hazırlık sonrası MCP boyunca native kontrol geçti; W-DU değeri 0 kaldı |
| S-3 | Aktif belge adı | `save_copy` aktif belgeyi yeniden adlandırmaz | Native filename öncesi/sonrası kontrolü geçti |
| S-4 | Başlangıç/bitiş dirty ve DBMOD | Kaydedilmemiş düzenleme durumu korunur; bu kapı geçmezse save_copy devre dışı | Harness dirty eşitliği + native DBMOD eşitliği W-mm/W-m geçti |
| S-5 | Symlink/junction, kök/ebeveyn değiştirme, hedefi yarışta oluşturma | Kök dışına/var olan dosyaya yazma yok; OUTPUT_PATH_DENIED veya FILE_EXISTS | W-desktop junction/target-create yarışı; W-phase3 sabitlenmiş output atasının rename reddi geçti. Uzun süreli stres/farklı dosya sistemleri denenmedi |
| S-6 | Kayıt tamamlandıktan sonra cevap kaybı / yeniden açma hatası | Dedup ile ikinci dosya üretilmez; gerçek çıktı/partial/unknown bildirilir | W-phase3 snapshot reopen fault yayımlanmadan ret; yayın sonrası timeout, status ve aynı kayıt/dosya ile tekrar sonucu geçti |

## 7. Toleranslar (öneri)

- İlk sentetik küçük geometri testi için öneri: fiziksel konum/uzunluk/radius/bounds mutlak hata <=1e-6 mm; hacim göreli hata <=1e-8. Metre sonuçları önce aynı fiziksel birime dönüştürülür. Büyük koordinatlı gerçek çizimler için ayrı hata bütçesi gerekir.
- Birimsiz drawing_unit örneğinde uzunluk toleransı <=1e-6 DU önerisidir. Bu karşılaştırma toleransı, createBox'ın minimum boyut API sınırından türetilmez.
- Kutu native minimumu dönüşümden sonra sınanır: 1e-6 DU altı ret; sınır ve üstü ayrı ölçülür. Önerilen toleranslar henüz platformda doğrulanmadı; beklenen değerler ölçüme uydurulmaz, sapma raporlanır.

## 8. Kaynaklar

- Sözleşme: [ILETISIM_SOZLESMESI.md](ILETISIM_SOZLESMESI.md) — durum modeli, hata kodları, kimlikler.
- Plan: [PLAN.md](PLAN.md) §10 test katmanları, §12 aşamalar.
- Autodesk `AcDb3dSolid::createBox` — kutu orijinde merkezli; boyut `< 1e-6` ise hata: <https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDb3dSolid__createBox_double_double_double.html>

Test komutları ve çerçeve mevcut; CI ve ayrı lint yapılandırması yok. Tip denetimi npm test içindeki TypeScript build ile yapıldı. Yukarıda belirtilmeyen kabul yolları **çalıştırılmadı**. Windows Faz 2–3, yukarıdaki sınırlı profil ve kanıtlarla kapandı. Çalıştırılmayan varyantlar açıkça etiketlidir; sınırsız hata/stres veya genel ürün kabulü değildir. Mac satırı yalnız Faz M kabulüne aittir; Windows fazları için ön koşul değildir.
