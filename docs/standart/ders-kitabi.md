# Ders kitabı

Gerçek işlerde yaşanmış hatalardan çıkan, projeden bağımsız dersler. Yönetici ilgili maddeleri görev dosyasına ekler. Yeni ders: kısa madde + (varsa) kaçınma yolu.

## Ajan tuzakları
- Ajanlar proje dışına (Temp, kullanıcı klasörü) erişmeye kalkınca izin reddiyle **sessizce ölür**. Görev, rapor ve ek dosyalar proje içinde olmalı; mesajda "proje dışına erişme" yazılmalı.
- Ajan rapor yazmadan ölebilir → görevde "raporu işe başlar başlamaz oluştur" şart.
- Bakiye bitince ajan işin sonunda "Insufficient Balance" ile durur; günlüğün sonunu oku, iş büyük ölçüde bitmiş olabilir — yönetici tamamlar.
- Gemini (agy) başsız modda komut çalıştırma izni olmayınca ölür → mesajda "kabuk komutu çalıştırma" yaz, kontrolleri yönetici çalıştırır.
- Model açıkça verilmezse opencode yerel varsayılana düşer.
- Ajan testleri kendi koşullarına göre yazabilir (aynı kullanıcı adını iki kez oluşturmak, saat dilimi kayması): **test başarısızsa önce testin kendisini şüpheyle oku**.
- Ajan raporu tarayıcı/uçtan uca testi abartabilir; her zaman kendin dene.
- Ajan "küçük" diye `update` → koşullu `updateMany` gibi davranış değiştiren refaktör yapabilir; kilit ve koşulları satır satır doğrula.
- Kullanılmayan model: **Qwen** (OpenCode'da olmayan araç çağırıp döngüye girdi, bütçe yaktı). **MiMo** doğrudan kullanılmaz (paralel ajan değişikliklerini görünce kararsız kalıp dosya yazmamıştı); yalnız EVREN üzerinden, düşük riskli işlerde.
- Gemini (agy) komut sözdizimi değişti: `agy --model … --mode … -p "<mesaj>"`. `-p`'den hemen sonra `--model` gelirse model adı mesaj sanılır.
- Codex'in Windows korumalı alanı bazı klasörlere EPERM ile yazamayabilir; Codex yeni dosyaya yazar, bağlamayı yönetici yapar. Klasör izinlerine (ACL) dokunulmaz.
- Ajana "bu dosyaya dokunma, başka iş değiştiriyor" dendiğinde dosyanın diskte değişmesini bekle; ajanın son durumunu değil diskteki hâli denetle.
- İki ajan aynı anda şema dosyasına ya da ortak stil dosyasına dokunmamalı.

## Git ve kabuk (Windows / Git Bash)
- `git apply --cached --unidiff-zero` satır numaralarını yeni dosyaya göre kaydırıp parçaları **yanlış yere** koyabilir. Kısmi stage için içerik bazlı yol: dosyanın istenen hâlini üret → `git hash-object -w` → `git update-index --cacheinfo`.
- Bash'te tırnak içindeki Python/Node betiklerinde `\D`, `\b`, `\s` ve kesme işaretleri bozulur. Betiği dosyaya yaz (editörle), sonra çalıştır.
- `sed -i` ile ters eğik çizgi içeren değişiklik yapma; düzenleme aracını kullan.
- Windows yollarında Git Bash için `MSYS_NO_PATHCONV=1` gerekebilir.
- Paralel `git stash` kullanma (yığın paylaşılır); geçici iş için WIP commit ya da ayrı çalışma ağacı.

## Veri ve veritabanı
- Nullable alanda `NOT IN` / `NOT {in}` NULL satırları düşürür.
- Para ve durum değiştiren işlemde kilit + kilit altında yeniden okuma; aynı kaynağı değiştiren tüm akışlar aynı kilit anahtarını kullanır.
- Saat dilimsiz TIMESTAMP sütununa ham SQL'de JS `Date` ya da `now()` yazma; ORM kullan ya da açıkça UTC ver (`now() AT TIME ZONE 'UTC'`).
- Ücretsiz/hediye işlemler 0 tutarlı gerçek kayıt açabilir; gelir/satış sayımlarından hariç tut.
- Silinen kaydın dış kaynağı (toplantı odası, dosya) önce kapatılır.
- Şemayı değiştirdikten sonra çalışan geliştirme sunucusu eski ORM istemcisiyle kalır → istemciyi yeniden üret, sunucuyu yeniden başlat.
- Yerelde migration/veritabanı komutu çalıştırmadan önce **hedef sunucu adını** (değer basmadan) kontrol et. Araç yapılandırması başka bir değişkeni öncelikli okuyabilir (ör. Prisma `DIRECT_URL ?? DATABASE_URL`); yalnız birini vermek komutu `.env`'deki başka bir veritabanına gönderebilir. Test için ikisini birden ver.

## Web / arayüz
- `type="number"` alanında Türkçe binlik ayraç ("1.137") ondalık okunur ve reddedilir → tam sayı alanlarında metin + `inputMode="numeric"`, rakam dışını temizle.
- Render içinde `Date.now()`/`Math.random()` yok (hydration uyuşmazlığı); state güncelleyicisinde yan etki yok.
- Tek kartlık ızgarada `auto-fit` kartı tüm genişliğe yayar; `auto-fill` kullan.
- Modal üstünde modal varken Esc/Tab'ı yutma.
- Tarih olarak girilen alanda saat gösterme; sıfır tutarda "−₺0" yazma.
- Büyük dosya yüklemesinde yalnız uygulama sınırını değil **ters vekil (nginx) gövde sınırını** da kontrol et.
- Canlı yenileme: değişikliği yapan uç olay yayınlamalı **ve** ekran o konuyu dinlemeli; ikisi de test edilmeli.
- Ana sayfa efektlerini telefonda (CPU yavaşlatmalı) ölçmeden yayınlama; `backdrop-filter` + kaydırmada transform takılma yapar.

## Yayın
- `ssh … 'bash -s' < betik` ile çalıştırırken sudo şifresini de aynı stdin'e koyma: bash şifreyi komut sanıp hata mesajında ekrana basar (sır sızar). Betiği ayrı gönder, şifreyi ayrı stdin ver.
- Yeniden başlatma anında ilk sağlık isteği 502 olabilir; tekrarla doğrula.
- Yayın sonrası yalnız sağlık ucuna bakmak yetmez: servis durumu, ana sayfalar, yetki yönlendirmesi, son günlükte hata.
- Yayın günlüğü her yayında yazılır; atlanınca geçmiş kaybolur.
