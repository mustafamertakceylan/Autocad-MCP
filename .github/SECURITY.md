# Security Policy / Güvenlik Politikası

**English** · [Türkçe](#türkçe)

## English

### Versions and scope

Reports are welcome for the latest public release and current `main`. Include
the exact release/commit and whether the issue affects an installed package or
source build. Older-version reports may need reproduction on a current version.
No fixed response or fix deadline is promised.

The bridge runs locally but processes client requests, CAD input and installer
artifacts. Report unauthorized CAD changes, permission/target bypass, replay
after uncertain operations, pairing-secret exposure, output path escape,
source-file overwrite or package integrity failures.

### Report privately

1. Check the [Security page](https://github.com/mustafamertakceylan/Autocad-MCP/security).
   If **Report a vulnerability** is available, use it to submit a private report.
2. If the button is unavailable, open a minimal public issue titled **Security
   contact request**, asking only for a private reporting method. Include no
   affected endpoints, payloads, exploit instructions or sensitive files in the
   public request. Wait for a private method before sharing details.

GitHub's private-reporting feature is separate from this policy and must be
enabled by a maintainer; this document does not enable it.

Privately provide a summary, affected version/component, prerequisites, minimal
synthetic reproduction and observed impact. Redact credentials, pairing secrets,
personal paths and customer data. Never attach `pairing.json`, private keys or
real customer drawings. Coordinate public disclosure with maintainers.

The published v1.0.0 Windows preview has unsigned ARX/desktop binaries and
unfinished clean-machine/reboot acceptance; see the [release notes](../docs/releases/v1.0.0.md).
These disclosures do not establish safety or make new integrity issues irrelevant.
Use the drawing issue form for accuracy problems unless a security boundary fails.

## Türkçe

### Sürümler ve kapsam

Son public sürüm ve güncel `main` için güvenlik bildirimleri kabul edilir.
Tam sürüm/commit'i ve sorunun kurulu pakette mi kaynak derlemesinde mi olduğunu
yazın. Eski sürüm bildirimi için güncel sürümde tekrar gerekebilir. Sabit yanıt
veya düzeltme süresi taahhüdü verilmez.

Köprü yerelde çalışır; istemci isteği, CAD girdisi ve kurulum dosyalarını işler.
Yetkisiz çizim değişikliği, yetki/hedef kontrolünün aşılması, belirsiz işlemden
sonra tekrar yürütme, eşleştirme sırrının açığa çıkması, çıktı kökünden kaçış,
kaynak dosyayı ezme ve paket bütünlüğü sorunlarını bildirin.

### Gizli bildirim

1. [Security sayfasını](https://github.com/mustafamertakceylan/Autocad-MCP/security)
   açın. **Report a vulnerability** varsa gizli raporu oradan gönderin.
2. Düğme yoksa yalnız özel bildirim yöntemi istemek için **Security contact request**
   başlıklı kısa bir public issue açın. Talebe etkilenen uç, payload, istismar
   adımı veya hassas dosya eklemeyin. Özel kanal belirlenmeden ayrıntı paylaşmayın.

GitHub'ın gizli bildirim özelliği bu dosyadan ayrıdır ve yönetici tarafından
etkinleştirilmelidir; bu belge ayarı kendiliğinden açmaz.

Özel kanalda özet, etkilenen sürüm/bileşen, ön koşullar, sentetik en küçük
tekrar ve gözlenen etkiyi paylaşın. Kimlik bilgisi, eşleştirme sırrı, kişisel yol
ve müşteri verilerini çıkarın. `pairing.json`, özel anahtar veya gerçek müşteri
çizimi eklemeyin. Açıklamanın herkese açılmasını yöneticilerle koordine edin.

v1.0.0 Windows önizlemesindeki ARX/masaüstü ikilileri imzasızdır; temiz cihaz/reboot
kabulü tamamlanmamıştır. [Sürüm notlarını](../docs/releases/v1.0.0.md) inceleyin.
Bu bilinen sınırlar güvenlik garantisi değildir; yeni bütünlük sorunları yine
bildirilmelidir. Güvenlik sınırı ihlali içermeyen çizim doğruluğu sorunlarında
çizim issue formunu kullanabilirsiniz.
