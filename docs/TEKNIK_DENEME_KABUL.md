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

## 9. Faz 5 Windows paket kabulleri

2026-10-19. Windows AutoCAD2027/Core Console X.60.0.0, stock-template sentetik kopyaları, resmi MCP SDK stdio istemcisi→TypeScript sunucu→imzalı yerel IPC→ObjectARX. Yönetici kendisi geliştirdi/test etti; dış model/ajana iş verilmedi. Normal modül `build/phase5-native`, `AUTOCAD_MCP_TESTING=OFF`. Yeni52 araç ve üç public skill resource kataloglandı; çalışan eski eklentinin otomatik güncellendiği iddia edilmez.

**İlk11 paket: 323/323 kontrol.** Toplu kanıt `tmp/phase5-regressions/4e661a2a-e13c-422e-8a41-79fd900d8f52/results.json`; her paket kendi yeni sürecini/kaynağını kullanır. O sürümün normal ARX SHA256: `1521835ef9836e98cd7f0639fbcb386333efe97421c87b5a0251365fe4a4c86b`. Sonraki braket testi ve PDF düzeltmelerinin güncel kabulü §10'dadır.

| Paket | Kontrol | Gerçek sınama | Nihai paket kanıtı |
|---|---:|---|---|
| annotations | 86/86 | Gerçek DIMENSION, sapma, yazı, katman/stil/linetype, birim, UNDO, DWG reopen | `tmp/phase5-runs/8aacf6a4-3122-4686-8fdb-45d40170e06e/results.json` |
| geometry2d | 31/31 | ARC/LWPOLYLINE, copy/rotate/scale/mirror, doğrusal/dairesel diziler, kayıt | `tmp/phase5-runs/2263a6e9-1086-4135-a8e5-57eb4f8f4bde/results.json` |
| curve-edits | 44/44 | Offset, trim, LINE extend, fillet/chamfer, yanlış sınır/no-effect ve kayıt | `tmp/phase5-runs/5f60a30d-6da6-40b0-805b-cb4cc6780ec6/results.json` |
| blocks | 23/23 | Tanım/insert/nitelik, transform ve unknown-tag atomik ret, unused block korunumu | `tmp/phase5-runs/e9827a55-2c15-422d-9b30-edc660593e5f/results.json` |
| solids | 41/41 | Extrude/revolve/boolean, gerçek Ø10 delik, volume/area/centroid/kütle, CW/mirror/+Z, reopen | `tmp/phase5-runs/1d8d133c-afa9-48b5-badc-4f9974ccb491/results.json` |
| detailing | 28/28 | HATCH, yatay/dikey REGION kesit, BOM/TABLE, yanlış satır boyutu rollback ve reopen | `tmp/phase5-runs/45be9e71-70a3-49a3-83ec-eb1844d9b15f/results.json` |
| machining | 19/19 | Delik dairesi, kademeli delik/havşa, kademeli mil, FCF; yanlış ikinci delik atomik ret | `tmp/phase5-runs/74a873ba-a2fb-4a70-9a6c-3b1cebef41ff/results.json` |
| plotting | 19/19 | Native1:1 A4 viewport, PDF, overwrite/hash ret, DWG pafta reopen | `tmp/phase5-runs/91afd811-6d49-4671-9350-238eead54296/results.json` |
| xrefs | 20/20 | Staged attach/overlay, nested ret, unload/reload/bind/detach, kaynak hash ve kayıt | `tmp/phase5-runs/3f7454f7-1bcd-42d2-bdc2-ac014c2a84c0/results.json` |
| batch | 6/6 | Tek revision/ID, dedup, ikinci adım hatasında tam rollback, DWG kayıt | `tmp/phase5-runs/e5b42eb0-ae99-4eba-a942-99dcc19366d6/results.json` |
| views | 6/6 | Üst/ön/sağ/izometrik kamera, birim dönüşümü, nesne korunumu | `tmp/phase5-runs/ac6e4ad9-cf82-4e22-9c1d-cfb9185d9a24/results.json` |

Eski çekirdek aynı normal modülde ayrıca mm26, metre26, birimsiz9 olmak üzere **61 kontrol** geçti. Kanıt `tmp/phase5-core-6f639741-2cdb-42f6-9ae0-80de3791e7dd/results.json`; alt kanıtlar `tmp/live-runs/f69d96af-49e6-45ac-ab20-f7421e8489b8`, `ff7cea55-0826-49db-9484-f34a51299ea2`, `edd38322-101b-4c6c-a870-b5e5ad2daa62`. Bu çağrılarda çekirdeğin opsiyonel ayrı UNDO varyantı açılmadı; Faz5 annotation paketinde gerçek UNDO/revision kabulü geçti. Eski live harness'in çıkış yanıtı `_Y` discard olarak düzeltildi.

`npm test` **33/33**, `npm run check`, CTest **1/1**, Skill Creator quick_validate başarılı. Sandbox içinde pointer rename EPERM verdi; aynı yerel IPC/istemci testi normal kullanıcı izinleriyle geçti, ACL değiştirilmedi. Validator sistem Python'ında eksik PyYAML için mevcut proje içi `tmp/skill-validation-deps` PYTHONPATH kullanıldı; global paket/ayar değiştirilmedi. `npm run catalog`:52 araç/3 resource. Codex/Claude/OpenCode bundle kopyalama, yeni katalog ve sabit resource akışı resmi SDK testindedir; Claude canlı modeli veya yeni52 aracın diğer AI modelleriyle pilotu **çalıştırılmadı**.

### Yakalanıp düzeltilen farklar

- WBLOCK kullanılmayan yerel katman/stil/block kayıtlarını atabiliyordu; eksikler kontrollü clone ve reopen karşılaştırmasıyla korunur. Xref-dependent kayıtlar yerel metadata sayılmaz; xref deklarasyonları ayrıca karşılaştırılır.
- MTEXT CRLF normalize edilir; reopen handle'ları yeniden numaralanabildiğinden karşılaştırma geometriye dayanır. Mirror ARC uç sırası native CCW normalizasyonunu dikkate alır.
- BlockReference native transform attribute'ları zaten taşıyordu; ikinci taşıma kaldırıldı, kilit kontrolü korundu.
- Boolean API operand gövdelerini hata durumunda tüketebilir; önce detached kopyalarda hesaplanır, kaynak ancak sonuç hazırken transaction içinde değiştirilir. Extrude explicit WCS Z yön vektörü kullanır; CW/mirrored normal sonucu ters çeviremez.
- FCF metin/konum/height/scale/style yeni süreçte aynı kaldı; render edilmemiş side database bounds cache'i farklıydı. FCF görsel bounds ölçülmüş veri sayılmaz, sorguda unavailable. Xref dış dosya bounds'ı da host-geometri doğrulaması sayılmaz.
- Plot aygıt stringleri refresh öncesi kopyalanır. Aktif viewport numarası kalıcı kimlik değildir; ilk kabulde paper viewport getViewportArray ilk ID ile ayrılıyordu. Çoklu layout/sideDB eksik array durumu sonraki §10 düzeltmesiyle ele alındı. Medya eşleştirmesi sonrası seçilen canonical adın tam eşitliği zorunludur.
- Native TABLE satırı isteği sessiz büyütebiliyordu; width/row/text boyutu commit öncesi kontrol edilir, uymazsa rollback. Negatif test geometriyi korurken abort bildirimlerinin revision'u16→50 artırdığını yakaladı; Transaction destructor kendi abort bildirimlerini dış edit saymayacak şekilde bastırır. Nihai test hem geometriyi hem revision'u korudu.

### PDF görsel kontrolü ve sınırlar

`tmp/phase5-runs/eab87581-a890-4992-abdf-fb0d0235e996` örneğinin A4 PDF'si PDFium ve Poppler ile render edildi; `render.png`/`poppler-render.png` yerel kanıttır. Bir sayfa, MediaBox yaklaşık297.039×209.903mm, gerçek80/40 ölçüleri ve başlık okunur; kırpılma/çakışma görülmedi. Bu çizim basit dikdörtgen pilotudur, fotoğraftaki çentikli parçanın yerine geçtiği iddia edilmez. Native dosya `runtime/exports/phase5-eab87581-a890-4992-abdf-fb0d0235e996/mechanical-a4.pdf`. PDF reader Autodesk çıktısında yinelenen PageMode metadata anahtarı uyarısı verdi; dosya render oldu, çıktı yeniden yazılmadı. Görsel inceleme baskı kalibrasyonu veya her font/aygıt/çizim için kabul değildir.

Windows ana paketler sınırlı geliştirici kabulündedir. Güncel test-controls ON modülü ayrıca derlendi; unsupported fixture artık POINT'tir, çünkü ARC destekleniyor. Yeni modülde tam masaüstü Faz3 hata-enjeksiyon senaryosu **çalıştırılmadı**; eski56/56 sonucu yeni52 aracın tamamına genellenmez. Mac/AppleSilicon, Claude canlı model, gerçek müşteri/büyük çizim, yüzey/mesh, kaynak-pürüzlülük sembol kütüphanesi, otomatik ISO fit/standart parça, sac/dişli/yay, FEA/CAM, HTTP ve temiz cihaz/installer/yayın bu kabulle tamamlanmış değildir. Üretim sertifikası/ISO uyumu iddiası yok. Yeni commit/push yapılmadı.

Uygulama ve yeniden üretme: `npm run test:phase5:windows` (AUTOCAD_MCP_PHASE5_TEST=1), [geliştirme](GELISTIRME.md), [mekanik kapsam](MAKINE_MUHENDISLIGI.md), [gerçek araç sözleşmesi](../skills/autocad-mcp/references/tools.md).

API dayanakları: [Boolean operand davranışı](https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-AcDb3dSolid__booleanOper_AcDb__BoolOperType_AcDb3dSolid_.html), [explicit extrusion](https://help.autodesk.com/cloudhelp/2027/ENU/OARX-RefGuide/files/OARX-RefGuide-__MEMBERTYPE_Methods_AcDb3dSolid.html), [FCF veri/stil ve sembol kodları](https://help.autodesk.com/cloudhelp/2018/ENU/OARXMAC-RefGuide/files/OREFMAC-AcDbFcf__setText_ACHAR__.html), [paper viewport kimliği](https://help.autodesk.com/cloudhelp/2018/ENU/OARXMAC-RefGuide/files/OREFMAC-AcDbLayout__getViewportArray.html), [Plot-to-File](https://help.autodesk.com/cloudhelp/2021/ENU/OARX-DevGuide/files/GUID-FBD88D4D-B266-447B-B64F-47A132CDE138.htm). Yerel SDK2027 başlıkları derleme otoritesidir; eski belge sürümleri güncel native kabulün yerine geçmez.

## 10. Braket denemesinde yakalanan PDF farkları

2026-10-19. Kullanıcı üçüncü açı/üç görünüş/dolu antet için GPT-6.1-Sol, EVREN MiMo ve DeepSeek Pro high çizim testini paralel yetkilendirdi. Bu bölüm kaynak geliştirmesinin dış ajana verildiği anlamına gelmez. Ajanlar yalnız ayrı sentetik çizimlere MCP üzerinden yazdı. Çizimin mühendislik doğruluğu ile başarılı araç/CLI çıkışı ayrı değerlendirilir. Yerel çıktı klasörü `runtime/exports/uc-gorunus-2026-10-19`; başlangıç run'ı `tmp/bracket-benchmarks/38df475b-b3e8-40d9-814a-c7804313aa8c`.

Codex özgün PDF'sinde başlık/arka yuvarlak görünüş kırpıldı. Gerçek normal yatay A4 margins `[5,17,5,17]`, plotOrigin `[0,0]` idi. Fiziksel kâğıt koordinatını printable alan başlangıcından ayırmak için yeni layout'un origin'i `[-left,-bottom]` yapılır. Sorguda `plotMarginsMm`, `plotOriginMm`, `plotCentered` ve katmanda `plottable` okunur. Kenar payları ve kâğıt boyutları native canonical medya eksenindedir;90° durumunda görüntü koordinatlarına dönüştürülür. Fiziksel sayfaya sığmak basılabilir alana sığmak demek değildir;10mm çerçeve için kurulu kenarsız A4 seçilir.

Floating viewport sınırı geometri değildir: yeni viewport `_MCP_VIEWPORT_NONPLOT` katmanındadır ve bu katman basılmaz. Uyumsuz aynı adlı mevcut katman değiştirilmez, oluşturma reddedilir. Çoklu pafta save/reopen testi, inactive/side database'de `getViewportArray()` sonucunun güvenilir bir overall-viewport ayıracı olmadığını da yakaladı. Overall viewport layout block-record'undaki ilk viewport ve aktifken number1 ile ayrılır; tarama1000 nesneyle sınırlıdır. Kaydı doğrulama atlanmaz; source geometry/hash/revision korunumları sınanır.

- Normal ARX SHA256 `a48ea6686a8f54bbe7c88a3d54db16fd2088218914b594b106b900862f64e6d5`.
- Yeni11 paket **335/335**: `tmp/phase5-regressions/f1f1a90f-593b-4a57-9e4d-917be5697aa1/results.json`. Önceki323 sonucu aynı binary sonucu diye sunulmaz.
- Sonraki normal/kenarsız/90° A4 genişletmesi **34/34 native**: `tmp/phase5-runs/3f3157c5-0800-4dbe-a66d-0bb339ea2b43/results.json`; değişen yalnız test kapsamıdır, ARX aynı.
- Gerçek üç PDF'de dört köşe glifi ve1:1 aralıkları bağımsız PDFium ile ölçüldü: `test/pdf-paper-positions.py`; kanıt `runtime/exports/phase5-3f3157c5-0800-4dbe-a66d-0bb339ea2b43/pdf-paper-positions.json`.190/142mm aralıkları, normal/rotated glif yerleri0.75pt fark sınırı geçti. İlk rotated karşılaştırma PDF'nin270° sayfa dönüşünü normalize etmiyordu; test düzeltildi, CAD geometrisi beklenene uydurulmadı. Poppler rotated PDF render'ı ayrıca görüldü.
- `npm run check`, normal izinle `npm test`33/33, CTest1/1 geçti. Sandbox rename EPERM tekrar görüldü; ACL değiştirilmeden normal izinle geçti.

Özgün model DWG/PDF'leri korunur. Yeni baskı motoruyla yönetici tarafından tekrar alınan PDF'ler modelin şekil/ölçü hatalarını düzeltmez ve bağımsız ilk model çıktısı gibi sunulmaz. Bu kabul Mac, Claude, bütün52 aracın her modelde denenmesi veya üretim çizimi/standart sertifikası değildir. Kullanıcının koşullu commit/push talebi, geometrik doğruluk kapısı geçmeden uygulanmaz.

### İstemci şema uyumluluğu

Codex ilk koordinat çağrısında; MiMo destekli turunda ise özellikle root `oneOf` kullanan stil çağrılarında sayı/dizi alanlarını metin gönderdi. İç şema JSON Schema2020-12 olarak geçerliydi; istemcilerde daha basit tip sunumu gerekti. `src/client-schema.ts` yalnız keşif şemasını uyumlu hale getirir: aynı türden numeric tuple→sabit uzunluklu items array; nesne varyantları→türleri açık ortak/opsiyonel alanlar ve discriminator açıklaması. İç `toolSchemas` ve native katı doğrulama korunur; metin sayı/diziye çevrilmez, başka varyantın alanı kabul edilmez. SDK StandardSchema validate aynı orijinal şemayı çağırır; ilan edilen opsiyonel alanlar çalışma zamanı sözleşmesini gevşetmez.

Yeni iki testle `npm test` **35/35**. Resmî SDK stdio testinde gerçek yayımlanan şemanın integer/number/array alanları okundu; eksik font ve stringified nokta isteği backend çağrı sayısını artırmadan isError döndü. Son sunucuyla native11paket **338/338**: `tmp/phase5-regressions/5447bc1b-086a-4b7b-8ab6-fc0e05c4437f/results.json`; plotting34 ve güncel gerçekPDF konum kanıtı `runtime/exports/phase5-640a9485-f08d-48cb-a808-0182946ba0ac/pdf-paper-positions.json`. Native ARX hash a48ea... değişmedi; değişen TypeScript sunucusudur. Katalog52 araç/3 resource yeniden üretildi.

Aynı EVREN MiMo ile yeni şemada ayrı gerçek kontrol: `tmp/bracket-benchmarks/0db617c4-92a2-40b8-9a83-32744ec88125/evren-mimo/summary.json`.61.9sn,4 başarılı model MCP çağrısı: status/document_info/create_style/list_styles. Model epoch1/revision0/dashes[3,-1.5] değerlerini gerçek sayı/dizi gönderdi; yönetici native geri okumada MIMO_SCHEMA_HIDDEN patternLength4.5 ve aynı dashes değerini doğruladı. Bu kontrol yeni sunucu tip uyumudur; bütün modellerin bütün52 aracı veya tam braket çizimini yeni metadata ile tekrar yaptığı iddia edilmez. Ana MiMo çizim turu önceki metadata ile başlamıştı; sonuçlar karıştırılmaz.

### Nihai çizim sonuçları

`runtime/exports/uc-gorunus-2026-10-19/SONUCLAR.md` ve [karşılaştırma](UC_GORUNUS_KARSILASTIRMASI.md) tam sonucu içerir. Her model adlı son DWG yeni AutoCAD sürecinde MCP ile tekrar okundu, teslim byte hash'leri native-review hash'leriyle eşleşti. Codex max73 nesne/11 gerçek ölçü: görünüşler seçtiği60-teğet/toplam75 yorumunda tutarlı, fakat üçüncü açı sembolü ters. MiMo59/8: bağımsız ilk tur0 geometri, koordinat destekli ikinci turda ölçüler tutarlı; HIDDEN/CENTER Continuous kaldı. Paftalı son kayıt teslim edildi, ilk kayıt saklandı. Pro53/10: toplam36mm, ön nervür/delik merkezinde5mm uyuşmazlık ve arka düz kapak hatası. Üçünde antet doludur; bu kontrol alanına mühendislik onayı verildiği anlamına gelmez. Hiçbiri koşullu tam doğruluk kabulünden geçmedi; commit/push yapılmadı.

## 11. Faz 6 — Windows özel ZIP ve kurulum yaşam döngüsü

2026-10-19. Kullanıcı modelin yanlış teknik resim kararlarını MCP araç kabulünden ayırıp yeni çizim doğruluğu skill'ini sonraya bıraktı; Faz6'ya geçilmesini istedi. Windows/ortak geliştirme yönetici tarafından yapıldı; bu aşamada başka model veya ücretli API çağrısı yoktur. Mac ve kişisel istemci/AutoCAD ayarlarına dokunulmadı. Commit/push/yayın yapılmadı.

**Yerel aday:** `runtime/packages/windows-0.1.0-preview-3.zip`,38.573.869 byte (yaklaşık36.8MiB). Paket kimliği `cf374016147ee2fc6000a7bd59eef88c360a66bd0f684ba673d550be008adee4`; ZIP SHA256 `d5fcbf771b1b294210fd0d2c9cdce9ba9a253951be72599a50d44eaaba0ed38c`.968 manifest dosyası: Node24.19.0 x64/tam lisans, üç üretim npm bağımlılığı ve lisansları, nlohmann/json3.12.0 gömülü bileşenlerin MIT bildirimleri, normal ARX, derlenmiş sunucu ve mevcut skill bundle'ı. SDK/host DLL, derleyici/npm geliştirme araçları, pairing ve çizim yoktur. ZIP Windows'un yerleşik tar aracıyla oluşturulur; PowerShell yürütme politikası değiştirilmez.

Native `build/phase6-native/Release/AutocadMcp.arx`, OFF; SHA256 `8be0b6a7568d8d4f81c6b8f3fd903ff6eb5493853945bcec41aabdb732f0ae7a`. Kaynak/test-bayrağı kimliği `636f0c08a6398cafd314e6102b8998b7edbc164241dcece4e7ff916255c8f933`. CMake post-build kaydı native hash/kimlik/bayrağı bağlar. Kurulu sunucu pairing ve IPC el sıkışmasında bu kimliği zorunlu tutar; farklı/kimliksiz native için `VERSION_MISMATCH`, CAD isteği gönderilmeden ret. Kaynak geliştirme sunucusunun tarihî sürüm desteği bununla karıştırılmaz. Ortam değişkeni verilmezse native runtime `%LOCALAPPDATA%/AutocadMCP/runtime` kullanır; pairing oturumunun özel ACL'si korunur.

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Ortak şema/IPC ve yeni kurulum yaşam döngüsü | **42/42** | `npm test`, normal kullanıcı izinleriyle; `test/distribution.test.ts` dahil |
| Güncel native ile 11 CAD paketi | **338/338** | `tmp/phase5-regressions/9734982b-bcec-452b-918f-3634960a9ba0/results.json`;20 CRX kopyasının hash'i yeni ARX ile eşleşti |
| Gerçek ZIP'ten yerel kurulum ve native kullanım | **28/28** | `tmp/installation-runs/5d83326a-7831-47bd-99d5-c31d51690e0e/results.json` |
| Tip ve C++ çekirdek | Geçti | `npm run check`, `ctest --test-dir build/phase6-native -C Release --output-on-failure`,1/1 |
| Native ARX dijital imza | **NotSigned** | `check-windows-release.mjs` ve doğrudan `Get-AuthenticodeSignature` |
| Paket içi Node dijital imza | **Valid** | Aynı salt okunur imza kontrolü |
| Genel yayın kapısı | **Reddedildi; beklenen sonuç** | Native imza, proje lisansı, public kanal yetkisi ve ayrı temiz cihaz kabulü yok |

Teslimin kısa makinece okunur kanıtları `runtime/packages/windows-0.1.0-preview-3.acceptance.json` ve `.release-check.json` içindedir; ZIP/yan SHA256 ve bu dosyalar yerel/gitignored kalır.

28 kontrollü paket kabulü: ZIP SHA/gerçek açılımı ve paket kimliği; derleyici/SDK istemcisinin yokluğu; gerçek CLI kurulum/tekrar kurulum, aynı ikililerle sentetik ikinci paket, önceki sürümün korunması, gerçek geri alma, boşluk/Türkçe karakterli yollar; açık Core Console varken kurulum reddi; kendi LOCALAPPDATA dizininde native fallback; kurulu Node ile PATH'te Node/npm olmadan gerçek MCP; üç istemci config/skill ve üç resource; gerçek native daire, mm ile geri okuma, ayrı DWG kaydı ve taze AutoCAD'de yeniden açma; kaynak/çıktı hash korunumu; gerçek kaldırma ve kullanıcı dosyalarının korunumu. Kaldırma dosya silmek yerine yönetilen bundle'ı arşivler. Model çizim karşılaştırması bu test değildir.

Ortak testlerde bozuk/eksik/ek dosya, test bayrağı, path traversal/ADS/rezerve ad, junction, yönetilmeyen bundle, eşzamanlı kurulum kilidi ve farklı native kimliği retleri vardır. Kesinti senaryolarında gerçek dosya/kayıt durumları hazırlanır: değiştirmeden önce, iki rename arası, yeni sürüm aktif olduktan sonra, receipt sonrası ve kaldırma ortası. Kurtarma eskiyi geri getirir veya tam yerleşmiş yeniyi tamamlar; canlı kilidi aşmaz, ölü ve tanınmış kilidi arşivler. Bunlar işletim sistemi güç kesme/VM reset deneyleri değildir. Sandbox atomic rename/junction EPERM normal kullanıcı izniyle aşıldı; ACL gevşetilmedi.

**Açık kapılar:** Ayrı geliştirici araçsız Windows makine/VM, AutoCAD otomatik bundle yükleme ve güven ekranı/SmartScreen, güvenilir native imzalama sertifikası, SDK dağıtım koşullarının incelemesi, proje lisansı ve genel yayın kararı **çalıştırılmadı/tamamlanmadı**. Testte paket ARX'i özel Core Console profiline açıkça yüklenir; bundle autoload kabulü iddia edilmez. Claude canlı modeli, Mac ve güncel native'de tam masaüstü fault suite çalıştırılmadı. Faz6 bütünü tamamlandı veya genel yayın hazır denmez. [Kurulum](WINDOWS_KURULUM.md), [yeniden üretme](GELISTIRME.md#faz-6--windows-özel-paket), [yayın kuralları](RELEASING.md).

## 12. Faz 6 — durum uygulaması, sistem tepsisi ve yeniden bağlantı

2026-10-19. Kullanıcının açık isteğiyle yönetici kendisi uyguladı. Windows Win32 durum/tepsi uygulaması ve paket içi Node denetleyicisi; kullanıcıya ait global AI/AutoCAD ayarı değiştirilmez. Oturum açılışında `--tray` başlama seçeneği varsayılan kapalıdır. Pencereyi kapatma/küçültme tepsiye gizler; tam çıkış denetleyiciyi ve seçili bağlantıyı kapatır, AutoCAD'i kapatmaz. Birden çok AutoCAD'de açık seçim gerekir. Aynı MCP stdio transportu yeni binding'i okur; önceki belge/instance kimliği veya kuyruktaki eski mutasyon yeni çizime yönlendirilmez. Üç istemci çalışma klasörü mevcut skill'lerle bir kez üretilir; son klasör yolu hatırlanır.

Native eklenti açılışta yalnız auth/özelACL korumalı `desktop_get_status` / `desktop_start` yönetim kanalını açar. CAD köprüsü açık **Bağlan** seçimiyle UI thread'inde hazırlanır.52 MCP CAD aracı ve3 sabit resource değişmedi. Yönetim kanalı ömrü dolmadan yenilenir; CAD pairing ömrü dolduğunda yenileme açık bağlantı seçimiyle yapılır.24 saatlik gerçek bekleme testi **çalıştırılmadı**. Yeni genel teknik resim doğruluğu skill'i hâlâ ertelendi.

**Güncel yerel aday:** `runtime/packages/windows-0.1.0-preview-6-desktop.zip`,38.683.117 byte. ZIP SHA256 `a5e0cfc5dd107e2f723bef657bff907017ded28b17174bc6f7cd41a2f5c90799`; paket kimliği `083f4caab98617574af017e6fc5908f095d040ef7d72a119cd958dbc9a5f6a57`,971 manifest dosyası. Yeni ARX SHA256 `76c345617722dd7f1a6f5d82039c4fe70e2b6fcd32d0b994ad23825ff81a77b9`, nativeBuildId `6fe07e7ec6d65fde3ab9e7de60e2eccbee19e34bf20ef00381b2eddfe5fcf0ec`. Desktop EXE SHA256 `5792c791c053348ad1f887825c31e6181a8aa29ddcae3bee7063453bf2b600b7`. §11 önceki preview3'ün tarihçesidir; güncel kanıt aşağıdadır.

| Kontrol | Sonuç | Kanıt |
|---|---|---|
| Ortak test / tip |46/46, tip kontrolü geçti | `npm test`, `npm run check`; aynı MCP transportuyla reconnect, kuyruk retleri, workspace sahipliği/eksik config, controller kilidi dahil |
| C++ çekirdek + Windows adaptörü | CTest2/2 | `desktop_platform_test`:8 gerçek sentetik registry kontrolü; gerçek Windows Run kaydı etkinleştirilmedi |
| Yeni native ile tüm11 CAD paketi |338/338 | `tmp/phase5-regressions/0b31e2f8-8887-4898-a2b2-7ac534f023c5/results.json` |
| Gerçek AutoCAD yeniden başlatma/çoklu seçim |23/23 | `tmp/desktop-runs/ffe6aedb-c285-485f-a06c-2b0aaf3c6fb8/results.json`;3 yeni Core Console oturumu, yeni kimlikler, native geometri/kayıt, kaynak korunumu |
| Son ZIP'ten kurulum yaşam döngüsü ve native MCP |28/28 | `tmp/installation-runs/7f1da416-ab4b-426c-bed4-bde4d3b14080/results.json`; özel plugins kökü, PATH'te Node/npm olmadan paket içi runtime |
| Görünür GUI ile gerçek bağlantı | Geçti | `tmp/desktop-ui-runs/fbc85229-4ed5-4b37-8165-afb8c4d878c2/results.json`, `connected.jpg`; sky ile Bağlan düğmesi,1 çizim/52 araç ve1 resmî SDK MCP istemcisi görüldü; kaynak hash korundu |
| Pencere/yeniden açılış/bakım | Görüldü | Aynı GUI: küçültmede görünür pencerelerden kayboldu; yeniden başlatma aynı pencereyi getirdi, bağlantı korundu. Tam çıkışta process bitti, controller.lock yok/lastSeenAt1. Taze açılışta seçilen test workspace geri geldi. GUI açıkken setup recover işlem öncesi reddedildi |
| İmzalar/yayın | Node Valid; ARX ve Desktop NotSigned; kapı kapalı | `runtime/packages/windows-0.1.0-preview-6-desktop.release-check.json`; lisans/clean-machine/public kanal kapıları da geçmedi |

Görsel testte Codex/Claude/OpenCode dosyaları yeni proje içi test klasörüne arayüzden üretildi. Gerçek Windows başlangıç kaydı ve gerçek Başlat kısayolu geliştirme kabulünde yazılmadı. Oturum açılışında pencere göstermeme kodu/sentetik kayıt komutu mevcut; **gerçek reboot, Explorer yeniden başlatma, tepsi sağ tık menüsünün tıklanması ve temiz cihaz autoload/güven ekranı çalıştırılmadı**. Native testte ARX özel Core Console profiline açıkça yüklenir; otomatik bundle kabulü sayılmaz. İmzalama, proje lisansı/SDK dağıtım incelemesi ve ayrı temiz cihaz kabulü genel yayın öncesi açıktır. Mac/Claude canlı model/tam masaüstü fault suite ayrıca açık. Model çağrısı/harcama, commit/push veya genel yayın yapılmadı.

Son incelemede eski/boş native oturum klasörleri ilk64 keşif girişini doldurup yeni hostu gizleyebiliyordu. Keşif artık önce mevcut descriptor dosyalarını bulur, en yenileri öne alır ve canlı prob sayısını64 ile sınırlar.150 eski host/istemci kalıntısı içeren regresyon eklendi; ölü MCP kayıtları yeni canlı istemci sayımını gizlemez. Preview6 yeni46/46 ortak ve23/23 gerçek desktop kabulünden geçti. Görünür GUI kabulü preview5 üzerinde yapıldı; preview6 ile EXE/ARX/Node byte hash'leri aynıdır. İki paket arasında yalnız desktop-agent.js ve desktop-state.js değişti. Güncel ZIP kurulum kabulü yukarıdaki yeni paket kimliğine aittir.

## 13. Faz 6 — Windows arayüz düzenlemesi

2026-10-19. Kullanıcının mevcut ekranı düzeltme talebi aynı yönetici tarafından uygulandı. `desktop/view.hpp` ve `desktop/main.cpp`: Bağlantı / İstemciler / Ayarlar sekmeleri, durum kartı, tek belirgin bağlantı düğmesi, istemci kartları ve açık klasör eylemleri. Boş AutoCAD listesi açıklamalı bekleme alanına dönüştü; ilk kurulum ve başlangıç kutusu ana ekranı doldurmaz. Yerel Win32 + işletim sisteminin GDI+ çizimi; yeni web/.NET çalışma zamanı yok. Native kontrollerin klavye odağı korunur, seçili sekme erişilebilir adıyla belirtilir; periyodik güncelleme giriş odağını veya oturum seçimini sıfırlamaz. Tepsi ve açık hedef seçimi korunur. Enter ile özel varsayılan düğme ataması yok; Tab/Shift+Tab ve Space ile düğme kullanımı görüldü.

**Yeni aday:** `runtime/packages/windows-0.1.0-preview-7-desktop.zip`,38.696.743byte, SHA256 `e7fb72776476d5058ef1aa0deeb80ffc0591d236cb08fcf27458f80316218e08`; paketID `b6523d214a0151ed1178deba68108137725cecab3f0e329406fd0cef9e4e1e40`. Desktop EXE SHA256 `56bf463e0856fbb5db419e13dfa0f685c7ddf422d73bbf5c662d90d07c7076fc`. Preview6 ile manifest dosyaları karşılaştırıldı: değişen tek bundle dosyası `Contents/desktop/AutocadMcpDesktop.exe`. ARX, sunucu, Node ve installer hash'leri aynı; §12'nin46/338/23/28 sonuçları aynı alt bileşenlerin önceki kabulüdür, yeni GUI'nin kapsamlı temiz cihaz kabulü sayılmaz.

Son EXE derlendi; CTest2/2 geçti. Gerçek yeni Core Console ve resmî MCP SDK istemcisiyle GUI'de **AutoCAD'e bağlan**,1 çizim/52 araç ve1 AI istemcisi görüldü. Kaynak byte hash'i korundu: `tmp/desktop-ui-runs/19594ff7-b1f2-4d30-b8ac-ca62335cbcd3/results.json`; `connected.jpg`, `clients.jpg`, `settings.jpg` görsel kanıttır. Üç sekme tıklanarak açıldı; yeni test workspace'ine üç istemci config/skill arayüzden üretildi, mevcut klasörde tekrar hazırlama dosyaları değiştirmeden tamamlandı. Giriş odağı birden fazla poll boyunca korundu. Ayarlar'daki başlangıç kutusu kapalı kaldı; gerçek Run kaydı değiştirilmedi. **Tepsiye gizle** ile pencere görünür listeden kayboldu ve tekrar açmada aynı pencere geri geldi.

Önceki geliştirici penceresi tamamen kapatılıp yeni paket açıldı. Kaynak CAD test süreci kapandı; yeni GUI kullanıcı incelemesi için açık bırakıldı. Model çağrısı, commit/push, Mac veya yayın yapılmadı. ARX/EXE imzasız; Node Valid. Gerçek reboot, farklı DPI/ekran okuyucu, tepsi sağ tık menüsü ve temiz Windows autoload/kısayol kabulü çalıştırılmadı. UI dışındaki önceki açık Faz6 kapıları sürer.

## 14. Faz 6 — kurulum rehberi ve kırmızı kimlik

2026-10-20. Kullanıcının basit bağlantı adımları, kırmızı logo ve tasarım iyileştirmesi isteği yönetici tarafından uygulandı. `desktop/guide.hpp`: AutoCAD için dört adım, APPLOAD yardım metni ve eklenti klasörünü açma; Codex masaüstü/IDE veya diğer STDIO istemcileri için komut ve dört ayrı argüman alanı/kopyalama; Codex CLI, Claude Code ve OpenCode1.x için ayrı dört proje adımı. İstemcilerin kişisel ayarlarına otomatik yazılmaz. Claude Desktop ile Claude Code aynı bağlantı yolu gibi gösterilmez; yeni OpenCode2.x desteği iddia edilmez. İstemci adımları resmî belgelerle karşılaştırıldı; kaynak bağlantılar Windows kurulum rehberindedir.

`desktop/assets/autocad-mcp-logo.png` kullanıcının isteğiyle yerleşik imagegen aracında üretildi; özgün kırmızı A/köprü simgesidir, resmî Autodesk logosu değildir. Prompt ve kaynak açıklaması `desktop/assets/README.md` içindedir. Build-time GDI+ dönüştürücü şeffaf köşeyi doğrular; 16/24/32/48/64/128/256px ICO ve256px PNG üretir. Logo EXE kaynağına gömülür, başlıkta/ana kartta/tepside kullanılır; tepside ayrı durum noktası korunur. Dönüştürücü son kullanıcı paketine girmez. Imagegen haricinde model çağrısı yapılmadı; repo içeriği gönderilmedi.

**Son yerel aday:** `runtime/packages/windows-0.1.0-preview-10-desktop.zip`,38.751.884byte. SHA256 `696300d8daa1738835545525f346599a19a4c14cc2f833ec2ed1af01ee028985`; paketID `ad84d00f518885de3c68d71254d833ce5125ccd67ff14ffaa333fcebdc040147`,971 manifest dosyası. EXE SHA256 `2fd723f3ce7f6a90d8b899b1a01ada6ea5f2728977048aede54e98ee03ff3f52`. Preview7 manifestiyle karşılaştırmada değişen tek bundle dosyası `Contents/desktop/AutocadMcpDesktop.exe`; paket dışındaki Windows kullanım rehberi de yenilendi. ARX/server/Node/installer byte olarak aynıdır.

| Kontrol | Sonuç / kanıt |
|---|---|
| Son kaynak derlemesi ve C++ testleri | Derlendi; CTest2/2. Sandbox tekrarında registry testi0xc0000409 verdi; normal kullanıcı izinli tekrar2/2 geçti. Gerçek Run ayarı değiştirilmedi |
| Logo ve rehber görünümü | Son preview10 EXE ile kırmızı logo/tema, AutoCAD dört adımı ve manuel MCP üç adımı görüldü; `tmp/desktop-guide-runs/2026-10-20-final/` ekranları |
| İstemci seçimi | Liste birden fazla2.5sn durum yenilemesinde açık kaldı; Claude Code seçilince doğru dört adım ve claude komutu görüldü. Poll sırasında aynı geometriyle MoveWindow çağrılması düzeltildi |
| Komut panosu | Komutu kopyala başarı bildirimi görüldü; uygulamanın geçici metin alanına yapıştırılan değer paket içi node.exe yoluyla eşleşti. Eski çalışma klasörü geri kondu, yapılandırma üretilmedi |
| Argümanlar | Dört satırın ekranda görünümü ve kaynak sırası doğrulandı. Argüman panosu için ayrı yapıştırma turu çalıştırılmadı |
| Paket doğrulama | ZIP SHA256 ve boyutu yeniden okundu; manifest/provenance kontrolü geçti; Node Valid, ARX/EXE NotSigned, genel yayın kapısı beklenen şekilde kapalı |

Makinece okunur sonuç `runtime/packages/windows-0.1.0-preview-10-desktop.acceptance.json`, görsel gözlem kaydı `tmp/desktop-guide-runs/2026-10-20-final/ui-observations.json`. Önceki46 ortak/338 native/23 desktop/28 kurulum sonuçları değişmeyen bileşenlerin önceki kabulüdür; son ZIP için tekrar çalıştırılmış gibi sunulmaz. Bu turda yeni canlı CAD/model bağlantısı, eklenti klasörü düğmesi tıklaması, gerçek reboot, farklı DPI/ekran okuyucu, temiz Windows veya Mac testi **çalıştırılmadı**. Yeni paket kullanıcı incelemesi için açık bırakıldı; commit/push/yayın yok. Faz6'nın önceki açık kapıları sürer.

## 15. v1.0.0 — public Windows önizlemesi

2026-10-20. Kullanıcı bütün değişikliklerin commit/push'unu, public repo, MorseCore düzeninde yalnız İngilizce/Türkçe README, Apache-2.0 ve v1.0.0 Release istedi. Kullanılabilir özel anahtarlı kod imzalama sertifikası yerel kullanıcı/makine depolarında bulunamadı. Son yönlendirme MorseCore yöntemi oldu; MorseCore Windows belgelerinde imzasız önizleme dağıtımı doğrulandı. Bu sürüm aynı açık sınırlamalarla `public-preview` olarak hazırlanır; sıkı imzalı/temiz cihaz kabulü geçti denmez. [Yayın profili](RELEASING.md).

**Paket:** `Autocad-MCP-1.0.0-Windows-x64.zip`,38.756.853byte. SHA256 `5430e17859c141c964ef0667292539cec6054573d58a8740c09c6f2e0dad4ea1`; paketID `fc0de4878a1209b38db9fcec9cc189e4cdf24a4e41f8656f54dba39062954557`;973 dosya. Yeni nativeBuildId `fe26d3a4608b7add8a47d6bcee943666fce7bdd402eccf8f1937517505534a52`. Ürün/CMake/npm/MCP server sürümü1.0.0; mevcut wire protocol `bridgeVersion=0.1.0` korunur. LICENSE/NOTICE pakette zorunludur; kanal değiştirmek imza doğrulaması sayılmaz. Bilinmeyen kanal/lisans, eksik bildirim ve değiştirilmiş lisans dosyası ortak regresyonda reddedilir.

| Yeni v1.0.0 kontrolü | Sonuç / kanıt |
|---|---|
| Tip/ortak/C++ | `npm run check`;47/47 ortak test; CTest2/2, gerçek Run ayarı değiştirilmedi |
| Normal yeni ARX ile11 CAD paketi |338/338; `tmp/phase5-regressions/e523fe95-b81d-448f-bf9c-63a3612b810d/results.json` |
| Gerçek ZIP kurulum/rollback/kaldırma/native-reopen |28/28; `tmp/installation-runs/f17ad7a0-7c5e-4b19-a7ee-d87c1e7cc43a/results.json` |
| Yeni ARX ile gerçek restart/çoklu hedef |23/23; `tmp/desktop-runs/6cbba4d5-13f1-4caf-b3c0-54e6ffe9a925/results.json` |
| İmza/lisans/manifest | Node Valid; ARX/EXE NotSigned. Apache-2.0, kanal ve manifest kapıları geçti. Sıkı kapı false; yalnız iki NotSigned ve ayrı temiz cihaz eksikliği var |
| Sır/temizlik | Kaynak ve Git geçmişi bilinen anahtar/özel anahtar/bearer/kimlikli URL kalıplarıyla tarandı; bulgu yok. Görev/rapor/ajan standartları/durum kayıtları yerelde korunup public Git ağacından çıkarıldı; geçmiş yeniden yazılmadı |

İlk kurulum turu açık bırakılan preview10 durum uygulaması nedeniyle bakım öncesi reddedildi: `tmp/installation-runs/d8523c28-679d-4d73-a0e8-735b4a96d236/`. GUI kendi **Tamamen kapat** düğmesiyle kapatıldı; yukarıdaki yeni tur geçti. Ret koruması kaldırılmadı. Paket kaynakları/örnek DWG byte'ları korundu.

Ayrı temiz Windows/VM, gerçek reboot ve başlangıç kaydı, Explorer restart/tepsi sağ tık, ekran okuyucu/farklı DPI,24 saat credential yenilemesi, güncel tam masaüstü fault suite, canlı Claude ve Mac **çalıştırılmadı**. v1.0.0 numarası bu eksikleri tamamlanmış saymaz. Yayınlanan asset'in indirilen byte hash'i yayın betiğinde yeniden doğrulanır; gerçekleşen sonuç [yayın günlüğüne](releases/PUBLICATION_LOG.md) yazılır.

## 16. Faz 6 — ek yerel Windows kabulü

2026-10-20. Kullanıcı bu bilgisayarda kalan testlerin yönetici tarafından çalıştırılmasını ve bulunan hataların düzeltilmesini istedi. Aşağıdaki kontrollerde ürün hatası bulunmadı; ürün kaynakları ve yayımlanmış paket değiştirilmedi. Bu bölüm yeni kabul kaydıdır; önceki bölümün tarihli eksik listesi güncel test sonucu gibi okunmamalıdır.

| Kontrol | Sonuç ve yerel kanıt |
|---|---|
| Güncel tam masaüstü hata senaryoları | **56/56**. Güncel kaynaklardan `AUTOCAD_MCP_TESTING=ON` ile ayrı ARX derlendi; gerçek AutoCAD 2027 masaüstünde sentetik çizim/profil ile çalıştırıldı. `tmp/desktop-runs/359b2b41-ea1d-4e1d-af9c-7090725c214a/phase3-results.json` |
| İptal, timeout, dedup ve işlem sınırları | Kuyruk iptali, timeout sonrası uzlaşma, eşzamanlı yinelenen istek, anahtar çakışması, atomik grup ve işlem sonrası doğrulama geçti; aynı56 kontrolün parçalarıdır |
| Hata ve protokol sınırları | Kayıt/reopen hataları, read-only/modal/veto, bozuk HMAC/JSON/UTF-8/frame, kapasite, yeniden başlatma ve belirsiz etki/karantina geçti; aynı56 kontrolün parçalarıdır |
| Eklenti klasörü rehberi | Yayımlanan1.0.0 EXE'de düğme, paket içindeki `Contents/Win64` klasörünü ve `AutocadMcp.arx` dosyasını açtı; `tmp/phase6-ui-final/plugin-folder.jpg` |
| MCP argümanlarını kopyala | Dört satır ayrı Not Defteri'ne yapıştırılıp kaydedildi; pilot yolu, `desktop-serve`, `--state-root` ve ekranda gösterilen durum yolu eşleşti. `tmp/phase6-ui-final/clipboard-check.json` |
| Klavye ve yerleşim | Tab/Shift+Tab ile sekme odağı ve Space ile etkinleştirme geçti. Varsayılan ve tam ekran yerleşimi görsel incelendi; `tmp/phase6-ui-final/maximized.jpg`. Farklı DPI veya minimum boyut kabulü sayılmaz |
| Penceresiz başlangıç ve tek oturum | Yeni sentetik köklerle `--tray`, yeni görünür pencere açmadan canlı yönetici başlattı. İkinci `--tray` çağrısı0 ile çıktı; aynı controller kimliği/PID korundu. Normal ikinci açılış aynı pencereyi gösterdi |
| Gizleme ve kapatma | **Tepsiye gizle** ve pencerenin **X** düğmesi pencereyi gizledi; yönetici ve heartbeat sürdü. İkinci açılış geri getirdi. **Tamamen kapat**, yerel/Node süreçlerini ve kilidi temizleyip canlılık kaydını geçersizleştirdi |
| Ani kapanmadan kurtarma | Yolu ve ebeveyni doğrulanan sentetik native süreç zorla kapatıldı; Job Object çocuk yöneticiyi sonlandırdı. Yeniden başlatma eski kilidi aşıp yeni controller kimliği/canlı heartbeat üretti. Kurtarılan oturum da kendi çıkış düğmesiyle temiz kapandı |
| Süreç ve UI kanıtı | `tmp/phase6-process-d4d8d31b-4cf9-4208-9e07-f958b479ddc4/{started,duplicate,show,hide-reshow,graceful-exit,crash-recovery,window-close,final-cleanup}.json`; gözlem özeti `tmp/phase6-ui-final/observations.json` |

UI testleri yayımlanmış normal1.0.0 EXE üzerinde yapıldı. Hata enjekte eden ARX yalnız `build/phase6-fault-tests` altında tutuldu; yayın paketine veya kullanıcı AutoCAD eklenti klasörüne taşınmadı. Mevcut normal ARX338/338, restart23/23 ve kurulum28/28 sonuçları önceki bölümdeki kabuldür; bu turda yeniden çalıştırılmış gibi sunulmaz. Kişisel Windows başlangıç kaydı, AutoCAD güvenlik ayarları ve global AI istemci ayarları değiştirilmedi. Yalnız testin oluşturduğu süreçler kapatıldı.

**Açık kalan kabul:** Tepsi sağ tık menüsü otomasyon aracında taskbar hedefi bulunamadığından doğrulanamadı; minimum pencere boyutuna yönelik sürüklemeler boyutu değiştirmedi, kabul sayılmadı. Gerçek reboot/Windows başlangıcı/Explorer restart, farklı DPI/ekran okuyucu, ayrı temiz Windows/VM,24 saat credential yenileme beklemesi, güvenilir kod imzası, canlı Claude ve Mac çalıştırılmadı. Bu yerel kabul Faz6'nın bütün yayın/cihaz kapılarının kapandığı anlamına gelmez. Yalnız kabul belgeleri değiştiği için ürün sürümü1.0.0 korundu; yeni release üretilmedi.

## 17. Faz 7 Ö1 — A1–A3: ISO profil, leader ve sembol motoru

2026-10-21, Windows AutoCAD 2027 Core Console, izole profil, stok `acadiso.dwt` sentetik kopyaları. Kullanıcı Ö1 listesini ([MAKINE_NATIVE_ARAC_LISTESI.md](MAKINE_NATIVE_ARAC_LISTESI.md)) onayladı; uygulama yönetici tarafından yapıldı.

| Kontrol | Sonuç |
|---|---|
| Ortak | `npm run check` temiz; `npm test` **49/49**; CTest **2/2**; `npm run catalog` **54 araç**/3 resource |
| Yeni canlı paket (test derlemesi, sembol motoru dahil) | `test/standards-windows.ts` **53/53**: ISO profil (katman kalınlıkları, çizgi deseni 12d/3d ve 24d/3d/nokta, isocp.shx, ölçü stili, tekrar kurulum reddi ve revizyon korunumu); ok/nokta/uçsuz leader, sağ/sol referans çizgisi, `above`/`after` metin, blok içerik ve nitelik, bilinmeyen nitelik/blok reddi, taşıma; sembol bloğu üretimi/yeniden kullanımı/imza ve yabancı aynı adlı blok reddi; A4 PDF; kaydet–yeniden aç. Kanıt `tmp/phase5-runs/78527471-fe29-4bfe-bac7-b5ddce039975/results.json` |
| Normal derleme tam regresyon | 12 paket: önceki 11 paket **338/338** değişmeden + yeni paket **42/42** (normal derlemede sembol kancası yoktur, atlandı). Kanıt `tmp/phase5-regressions/ed4fcbb6-7e56-4d36-b23f-394a7f829fb3/results.json` |
| PDF görsel denetim | `pypdfium2` ile 600 dpi işlendi: gizli/eksen/hayali çizgiler ISO desenleriyle, kalın/ince ayrımı, isocp yazılı ölçü, referans çizgisi üstünde metin, nokta/ok uçları ve blok/sembol bağlantıları doğru |

Geliştirmede bulunup düzeltilen hatalar: katman açıklaması veritabanına eklenmeden yazılınca `eNullObjectPointer`; `AcDmUtil::globalArrowName` dönüşünün serbest bırakılması AutoCAD'i çökertti (ok adı artık blok kaydından okunur); yerleşik ok bloğu adı `_Dot` biçimindedir; MLEADER içeriğe bağlanırken fazladan köşe ekliyordu (içerik bağlantı noktası referans çizgisi sonuna hizalanır, fazladan köşe kaldırılır ve okunarak doğrulanır).

**Çalıştırılmadı / sınırlar:** ISO tam metinleri olmadan ölçü oranları AutoCAD ISO-25 stiline, çizgi elemanları `acadiso.lin` çapraz kontrolüne dayanır ve sonuç `pending_full_text` bildirir. Görünür masaüstü AutoCAD, hata enjeksiyonu (Faz 3) ve kurulum paketi testleri bu değişiklikle tekrarlanmadı; yeni sürüm paketi üretilmedi. Mac çalıştırılmadı.

## 18. Faz 7 Ö1 — B1–B4: ölçü türleri, ISO gösterimi, seriler ve delik notu

2026-10-22, Windows AutoCAD 2027 Core Console, izole profil, stok `acadiso.dwt` sentetik kopyaları; uygulama yönetici tarafından yapıldı.

| Kontrol | Sonuç |
|---|---|
| Ortak | `npm run check` temiz; `npm test` **52/52**; CTest **2/2**; `npm run catalog` **56 araç**/3 resource |
| Yeni canlı paket (test derlemesi) | `test/dimensions-windows.ts` **61/61**: açısal (iki çizgi/üç nokta), yay uzunluğu, koordinat; zincir ve taban çizgili seri; Ø+H7+yazılı sapma, TED çerçevesi, referans, ölçek dışı, limit, max, Ⓔ/LP, 4×□, yarım ölçü, küre yarıçapı; sondaki sıfırların korunması ve ayrı sapma hassasiyeti; ⌴/⌵/diş delik notları, gerçek daireyle çap kontrolü ve yanlış çapın revizyon değişmeden reddi, `6,60`/`11,00` yazılı değerlerinin aynen korunması; şema düzeyinde çelişkili gösterim reddi; A4 PDF; kaydet–yeniden aç. Kanıt `tmp/phase5-runs/52384df3-a3d9-4f64-a882-c896f8a203f6/results.json` |
| Normal derleme tam regresyon | 13 paket: önceki 11 paket **338/338** değişmeden, ISO profil **44/44**, ölçü paketi **61/61**. Kanıt `tmp/phase5-regressions/74636caa-ee0f-4d2d-a25d-de574224ac92/results.json` |
| PDF görsel denetim | 600 dpi: Ⓔ, □, ×, ⌴, ⌵, °, ⌒ (yay uzunluğu), TED çerçevesi, alt çizgi, H7 yanında yığılmış sapma ve limit ölçü doğru çiziliyor; çap ölçüsünde tek Ø |

Kullanıcı kuralı (2026-10-22, anlamı 2026-10-23'te netleştirildi): yazılan ondalık basamaklar korunur; elle yazılan değerler metin olarak aynen iletilir ve ölçülerde sondaki sıfırlar gizlenmez (DIMZIN/DIMTZIN 0). `11` ve `11,00` aynı anma değeridir; basamak sayısı kendi başına tolerans belirlemez. Ondalığa göre tolerans eşlemesi yalnız antet/genel notlarda açıkça tanımlanmışsa uygulanır; diğer durumlarda ölçüdeki tolerans/geçme veya belirtilen standart ve sınıf esas alınır. Bu açıklama düzeltmesi, yukarıdaki tarihli canlı testlerin yeniden çalıştırıldığı anlamına gelmez.

Geliştirmede bulunup düzeltilenler: AutoCAD MText `\U+` kaçışlarını okumada karaktere çevirdiği için × ve Ⓔ doğrudan UTF-8 yazılır; açısal ölçüde yay noktası yay üzerinde normalleştiği için yarıçap doğrulanır; çap/yarıçap ölçüsünde Ø/R iki kez çıkıyordu (AutoCAD kendisi ekliyor); sayıların JSON'dan biçimlenmesi kullanıcının yazdığı basamakları değiştiriyordu (yazılı metne geçildi). Doğrulama başarısız olduğunda okunan geometri artık sonuçta döner.

**Çalıştırılmadı / sınırlar:** ISO 15786 not düzeni ve ISO 14405 kod listesi tam metinden doğrulanmadı (`pending_full_text`). Eski sayısal `tolerance` alanının gösterim basamağı `precision`/`tolerancePrecision` ile belirlenir; yazılı metin biçimine geçirilmedi. Görünür masaüstü, hata enjeksiyonu, kurulum paketi ve Mac testleri bu değişiklikle çalıştırılmadı.

## 19. Yazım hassasiyeti ile toleransın ayrılması

2026-10-23 kullanıcı kararı: yazılan ondalık basamaklar korunur; tolerans ölçüden, antet/genel notlardan veya belirtilen standart ve sınıftan belirlenir. Ondalık basamağa göre tolerans yalnız çizimde açıkça tanımlanmışsa uygulanır; `11,00` kendi başına sıfır veya ±0,01 tolerans anlamına gelmez. Belirsiz tolerans uydurulmaz. Genel skill, makine referansı, iki MCP araç açıklaması, katalog, ilgili kod yorumları ve test açıklamaları buna göre düzeltildi.

Kontroller: `npm run check` geçti; normal Windows kullanıcı bağlamında `npm test` **52/52**, skill-creator `quick_validate.py` doğrulaması geçti. Sandbox içindeki ilk test denemesinde süreç/ACL kullanan masaüstü testleri hata verdi ve deneme durduruldu; normal kullanıcı bağlamındaki tam tekrar geçti. Doğrulayıcının PyYAML bağımlılığı yalnız Git dışındaki `tmp/skill-validator-deps` klasörüne kuruldu.

Resmî MCP istemcisiyle katalog yeniden üretildi: **56 araç / 3 resource**. Önceki katalogla nesne karşılaştırmasında yalnız `acad_create_dimension` ve `acad_create_hole_callout` açıklamalarının değiştiği, bütün şemalar ve diğer metadata'nın korunduğu doğrulandı. İki native başlığın yorumlar çıkarıldıktan sonraki içerikleri önceki commit ile eşit; sayı yazımı ve geometri yürütme davranışı değiştirilmedi. `git diff --check` geçti.

Bu görev açıklama/skill düzeltmesidir; veritabanı veya migration yoktur. Native derleme, canlı AutoCAD/DWG/PDF, model üzerinden skill davranış testi, kurulum ve Mac testleri yeniden çalıştırılmadı. Yeni release üretilmedi; v1.0.0 paket/tag byte'ları korunur.
