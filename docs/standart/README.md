# Ajan standardı

Yapay zekâ ajanlarıyla yazılım işi yaparken uyduğum kuralların tek kaynağı. Projeden bağımsızdır; her proje bunları alıp kendi `AGENTS.md`'siyle daraltır.

## Roller
- **Yönetici:** işi kullanıcıdan alan Claude ya da Codex. Planlar, görev yazar, uygulayıcılara dağıtır, denetler, kullanıcı söyleyince commit/yayın yapar.
- **Uygulayıcı:** DeepSeek V4 Pro / Flash, Gemini 3.8 Flash, EVREN. Görev dosyasını uygular, rapor yazar; commit/yayın yapmaz.

## İçerik
| Dosya | Ne |
|---|---|
| `ortak/KURALLAR.md` | Herkesin uyduğu çekirdek: git/commit, sırlar, üretim verisi, kanıtlı rapor |
| `ortak/USLUP.md` | Konuşma üslubu |
| `roller/YONETICI.md` | Ajan tablosu, görev yazımı, gönderme, denetim, yayın, VDS (SSH), Mac |
| `roller/UYGULAYICI.md` | Uygulayıcının yapacakları / yapmayacakları |
| `ders-kitabi.md` | Gerçek hatalardan çıkan dersler |
| `sunucu/VDS_GUVENLIGI.md` | VDS güvenlik katmanları, aynı sunucuda çok site, yeni site ekleme sırası, salt okunur denetim |
| `proje-sablonu/` | Yeni projeye kopyalanan dosyalar (AGENTS, CLAUDE, GEMINI, yayın kuralları, günlük, görev/rapor şablonu) |
| `beceriler/` | Claude ve Codex becerileri: `proje-kur`, `ajana-ver` |
| `kur.ps1` | Kuralları ve becerileri araçlara kurar |

## Kurulum
```powershell
git clone https://github.com/<kullanıcı>/ajan-standardi C:\Dev\ajan-standardi
pwsh -File C:\Dev\ajan-standardi\kur.ps1 -Onizle   # önce bak
pwsh -File C:\Dev\ajan-standardi\kur.ps1           # kur (eski dosyaların yedeğini alır)
```
Üretilen dosyalar: `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` (yönetici), `~/.config/opencode/AGENTS.md`, `~/.gemini/GEMINI.md` (uygulayıcı), `~/.claude/skills/*`, `~/.codex/skills/*`.

## Güncelleme
Kuralı bu klasörde değiştir → commit → `kur.ps1`. Araçlardaki üretilmiş dosyaları elle düzenleme.

## Yeni proje
Claude ya da Codex'e "/proje-kur" (ya da "bu projeye standardı kur") de.
