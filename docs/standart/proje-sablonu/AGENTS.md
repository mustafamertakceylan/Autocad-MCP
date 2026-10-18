# {{PROJE_ADI}} — ajan kuralları

Genel kurallar her ajanın kendi genel dosyasında (ajan standardı: https://github.com/{{GITHUB_KULLANICI}}/ajan-standardi). Bu dosya yalnız **bu projeye özel** bilgileri içerir; genel kuralı daraltır, çelişirse bu dosya kazanır.

## Proje
- Ne: {{KISA_ACIKLAMA}}
- Yığın: {{YIGIN}} (ör. Next.js 16, Prisma, PostgreSQL)
- Çalışma klasörü: `{{KOK}}`
- Kullanıcıya dönük metin dili: {{UI_DILI}}
- Commit dili: {{COMMIT_DILI}}; kapsamlar: {{KAPSAMLAR}}

## Komutlar
| İş | Komut |
|---|---|
| Kurulum | `{{KURULUM}}` |
| Geliştirme sunucusu | `{{DEV}}` |
| Tür denetimi | `{{TSC}}` |
| Lint | `{{LINT}}` |
| Testler | `{{TEST}}` (alanlara göre: {{TEST_GRUPLARI}}) |
| Sır taraması | `{{CHECK_SECRETS}}` |

## İzole test ortamı
- Veritabanı: {{QA_DB}}
- Uygulama: {{QA_APP}}
- Test hesapları / sahte anahtarlar: {{QA_HESAP}}
- Üretim veritabanı, ödeme, e-posta, dış API: **test için yok**.

## Yayın
- Bu projede yayın var mı: {{YAYIN_VAR_MI}} → ayrıntı `YAYIN_KURALLARI.md`.
- Sunucu (VDS): {{VDS}} — yönetici SSH ile kendisi bağlanır.
- Mac gerektiren iş: {{MAC}} — başlamadan kullanıcıya sorulur.

## Dokunulmaz alanlar ve özel kurallar
{{OZEL_KURALLAR}}

## Kasıtlı kararlar (hata sanıp düzeltme)
{{KASITLI_KARARLAR}}
