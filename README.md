# Autocad MCP

Her kullanıcının bilgisayarında çalışan AutoCAD–MCP köprüsü. Hedef tam AutoCAD 2027, Windows ve Mac Apple Silicon; yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme. Depo **private**; kurulum paketi veya genel yayın yok.

**Durum: Windows Faz 2 ve Faz 3 tamamlandı.** Güvenilir çekirdek; bağımsız işlem durumu/iptal kanalı, eşzamanlı tekilleştirme, yetki denetimi ve güvenli DWG çıktısını içerir. Faz 3 gerçek AutoCAD masaüstünde 56/56 kontrolü; ortak testler 17/17, C++ testi 1/1 geçti. Önceki Faz 2 kanıtı 69 Core Console + 26 masaüstü kontrolüdür. Mac ayrı **Faz M**, Claude/Codex pilotları **Faz 4** kapsamındadır. Kurulum paketi ve genel yayın yok.

```text
MCP istemcisi → yerel Node/TypeScript süreci (stdio)
             → imzalı yerel Windows named pipe
             → ObjectARX eklentisi → açık AutoCAD çizimi
```

Port veya köprüye ait LLM anahtarı gerekmez. İstemci MCP sürecini başlatır; eklentiyle eşleştirme yerel özel dosya üzerinden yapılır. AI istemcisinin buluta gönderdiği veriler ayrı veri akışıdır.

## Başlangıç

Node 24+ ile proje klasöründe:

```powershell
npm ci --ignore-scripts
npm run check
npm test
```

Bu testler AutoCAD açmaz. Native derleme, izole gerçek test ve eşleştirme adımları: [geliştirme rehberi](docs/GELISTIRME.md).

## Şu anki alt küme

- 14 sabit MCP aracı: keşif, durum/yetenek, belge bilgisi, sorgu/tek nesne, çizgi/çember/kutu, taşıma/silme, işlem durumu ve ayrı DWG kopyası.
- WCS ve açık birim; instance/belge/epoch, revision, operationId ile tekrar istek kontrolü; geometri geri okuma.
- Windows sentetik çiziminde tek işlem UNDO, fiziksel birim dönüşümü, hash/dirty koruması ve kopyayı yeniden açıp geometri karşılaştırması geçti.
- Salt modelspace ve sınırlı nesne türleri; ileri AutoCAD özellikleri henüz uygulanmadı. Native Mac taşıması/eklenti derlemesi kapalı. Genel LISP/komut ve HTTP yok.

## Belgeler

| Belge | İçerik |
|---|---|
| [Geliştirme](docs/GELISTIRME.md) | Gereksinimler, derleme, test, eşleştirme ve mevcut sınırlar |
| [Kabul kanıtları](docs/TEKNIK_DENEME_KABUL.md) | Gerçek sonuçlar ve çalıştırılmayan kapılar |
| [Plan](docs/PLAN.md) | Altı faz, bağımlılıklar ve tamamlanma ölçütleri |
| [Kararlar](docs/KARARLAR.md) | Kullanıcı kararları ve prototip uygulama tercihleri |
| [Yetenek matrisi](docs/YETENEK_MATRISI.md) | Platform/işlem düzeyinde gerçek destek sınırı |
| [İletişim sözleşmesi](docs/ILETISIM_SOZLESMESI.md) | 14 araç ve 0.1.0 uygulama profili |
| [İşlem envanteri](docs/OZELLIK_ENVANTERI.md) | 42 işlem için araştırma/API adayları |
| [Kaynak notları](docs/arastirma/ASAMA1_KAYNAK_NOTLARI.md) | Resmî belgeler ve SDK düzeltmeleri |
| [Mevcut çözümler](docs/arastirma/MEVCUT_COZUMLER_2026-10-18.md) | İlk araştırma |
| [Kısa durum](FAZ2_DURUM.md) | Kullanıcı onaylı tek checkpoint |
| [Ajan kuralları](AGENTS.md) | Yetki, çalışma ve yayın sınırları |
| [Üçüncü taraf notları](THIRD_PARTY_NOTICES.md) | Bağımlılıklar ve lisans sınırları |

Lisans henüz seçilmedi. Açık kaynak ürün yönü korunuyor; private depoyu public yapmak veya paket yayınlamak için ayrıca kullanıcı talebi gerekir.
