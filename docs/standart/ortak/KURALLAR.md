# Ortak kurallar (her ajan, her proje)

Bu dosya yöneticiye (Claude, Codex) ve uygulayıcılara (DeepSeek, Gemini, EVREN…) aynen uygulanır. Projenin kendi `AGENTS.md` dosyası bunları **daraltabilir** ya da projeye özel ayrıntı ekleyebilir; çelişirse proje dosyası kazanır.

## Dil ve rapor
- Kullanıcıyla Türkçe konuş; kısa, kanıtlı, dolgusuz yaz. Ayrıntı: `USLUP.md`.
- Her iddiaya kanıt: `dosya:satır` ya da komut çıktısı. Çalıştıramadığın şeyi **"çalıştırılmadı"** diye açıkça yaz.
- Denenmemiş bir şeye "çalışıyor", "test edildi" deme.

## Git ve commit
- **Commit, push ve yayın yalnız kullanıcı açıkça söylediğinde.** İzin o işe aittir; sonraki işlere geçmez. Söylediğinde işi kendin yaparsın; başka ajanın denetimi gerekmez.
- `git add -A`, `git add .`, `git commit -a` **yasak**. Dosyaları tek tek stage et; `git diff --cached --stat` ile kontrol et.
- Commit öncesi sır taraması zorunlu: projede `check:secrets` benzeri betik varsa onu çalıştır; yoksa `git diff --cached`'i anahtar, token, şifre, bağlantı dizesi, `.env` için oku.
- Başkasının (kullanıcının ya da başka ajanın) commit edilmemiş değişikliğine dokunulmaz, stage edilmez, geri alınmaz.
- Geçmiş yeniden yazılmaz: zorla push, `reset --hard`, yayınlanmış commit'i amend yok. Geri alma `git revert` ile. Henüz push edilmemiş kendi commit'in düzeltilebilir.
- Büyük ikili dosyalar (model ağırlıkları, veri setleri, derleme çıktıları) repoya girmez.

## Commit mesajı
[Conventional Commits](https://www.conventionalcommits.org/):

```
<tip>(<kapsam>): <özet>

<gövde: ne değişti ve NEDEN; satırlar ~72 karakterde kırılır>

<altbilgi: Migration / BREAKING CHANGE / Refs / Co-Authored-By>
```
- Dil: projenin commit geçmişindeki dil (proje dosyası söylüyorsa o). Türkçe ise Türkçe karakterlerle.
- Özet en fazla 72 karakter, emir kipi (`ekle`, `düzelt` / `add`, `fix`), küçük harfle başlar, sonda nokta yok. "wip", "güncellemeler", "fix bug" gibi anlamsız özet yok.
- Tipler: `feat`, `fix`, `security`, `perf`, `refactor`, `test`, `docs`, `build`, `chore`, `revert`.
- Gövde zorunlu: `fix`/`security`/`perf` (sorun, sebep, çözüm), davranış değişikliği (eski → yeni), bilerek bırakılan sınır ("X yapılmadı çünkü Y").
- Migration içeren commit: gövdede `Migration: <ad>` satırı ve verinin nasıl etkilendiği.
- Bir commit = bir konu. Test, test ettiği değişiklikle aynı commit'e girer.
- Kodu yapay zekâ yazdıysa altbilgide her katkıcı için `Co-Authored-By: <model> <noreply@…>` (yönetici + kodu yazan ajanlar).
- Commit mesajına ve rapora asla: sır, kişisel veri (ad, e-posta, telefon, ödeme numarası). Gerekirse `kullanıcı #12` gibi kimlik.

## Sırlar
- `.env`, anahtar, token, şifre, bağlantı dizesi, SSH özel anahtarı: koda, commit'e, sohbete, rapora, günlüğe **yazılmaz, ekrana basılmaz**.
- Kullanıcı bir sırrı **dosyaya** koyar (ör. `~/.ssh/<ad>.txt`); ajan dosyayı okuyup değeri yalnız **stdin / ortam değişkeni** ile taşır. Doğrularken yalnız uzunluk/önek ya da API'nin durum kodunu göster.
- Kullanıcı sırrı sohbete yapıştırırsa kullanma; sızmış say, değiştirmesini öner.
- API anahtarları **yalnız yerelde** (ajan aracının yerel ayarı, sunucu ortam dosyası) durur; araçların bulut hesaplarına (ör. OpenCode Console) bağlanmaz. Her kullanım için ayrı anahtar (ajanlar ayrı, üretim ayrı); mümkünse harcama sınırı.
- Bir araç ya da sağlayıcı sızıntı duyurursa: ilgili anahtarları hemen yenile, eski kullanımı kontrol et, sonra devam et.

## Üretim ve veri
- Test izole ortamda yapılır (yerel/QA veritabanı, sahte anahtarlar). Test amaçlı üretim veritabanına yazma, ödeme sağlayıcısı, gerçek e-posta/SMS **yok**.
- Üretim verisine **okuma**: salt okunur (ör. `SET default_transaction_read_only=on`), yalnız gerektiği kadar, kişisel veri ekrana basılmadan (sayım/özet tercih edilir).
- Üretim verisine **yazma**: yalnız kullanıcının o iş için açık onayıyla.
- Veritabanını sıfırlama (`migrate reset`, `--force-reset`), toplu `DELETE`/`TRUNCATE` yok.

## Genel
- Kullanıcıya sormadan dosya/klasör **silinmez** (kendi oluşturduğun geçici dosyalar hariç).
- Kullanıcı adına sözleşme/şart kabul etme, hesap açma, ödeme yapma, mesaj gönderme yok; bunları kullanıcı yapar.
- İşin dışına taşan bir sorun görürsen düzeltmeye kalkma; rapora ya da kullanıcıya not düş.
