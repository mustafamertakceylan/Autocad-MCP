# Autocad MCP

Windows ve macOS'te **tam AutoCAD 2027** ile MCP istemcileri arasında bağlantı kurmak için planlanan yerel köprü. Yeni 2B/3B çizim ile mevcut çizimi inceleme/düzenleme birlikte hedeflenir. Ürünün ileride kurulabilir açık kaynak olarak dağıtılması amaçlanır.

> **Durum: yalnız planlama.** Bu depoda çalıştırılabilir kod, MCP sunucusu, eklenti, kurulum paketi veya derleme yok. Aşağıdaki mimari ve akış tasarım önerisidir; gerçek AutoCAD ile doğrulanmamıştır. Kurulum/derleme komutu bu aşamada verilmez.

## Kısa tanım

- Hedef: kullanıcının kendi bilgisayarında çalışan yerel köprü; zorunlu merkezi hesap veya sunucu yok.
- Hedef platformlar: Windows ve macOS üzerinde tam AutoCAD 2027. Mac işlemci mimarisi henüz belirtilmedi.
- Hedef kapsam: yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme.
- Yerel köprü, bulut AI sağlayıcısının veri akışını otomatik olarak yerelleştirmez; AI istemcisinin buluta veri göndermesi ayrı bir veri akışıdır.
- Depo şu an **private**. Görünürlük ancak kullanıcı açıkça isterse değişir.

## Yerel akış (öneri)

```text
MCP istemcisi
   │ stdio (ilk hedef)
   ▼
Yerel TypeScript MCP sunucusu
   │ yerel IPC: Windows named pipe / macOS Unix socket (öneri)
   ▼
AutoCAD eklentisi (C++/ObjectARX, platforma özel derleme)
   │
   ▼
AutoCAD 2027 ve açık çizim
```

Bu akış uygulanmadı. Windows named pipe, macOS Unix socket, stdio ve Streamable HTTP ayrımları [PLAN.md](docs/PLAN.md) içinde öneri olarak açıklanır.

## Belgeler

| Belge | İçerik |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Ürün akışı, önerilen mimari, modüller, hata durumları, test katmanları, aşamalar ve açık kararlar |
| [docs/KARARLAR.md](docs/KARARLAR.md) | Sabit kullanıcı kararları, teknik öneriler ve henüz karar olmayanlar |
| [docs/YETENEK_MATRISI.md](docs/YETENEK_MATRISI.md) | Modül, platform, gerçek test ve aşama bazlı ilk plan tablosu |
| [docs/arastirma/MEVCUT_COZUMLER_2026-10-18.md](docs/arastirma/MEVCUT_COZUMLER_2026-10-18.md) | Mevcut AutoCAD MCP projeleri ve ürünleri karşılaştırması |
| [AGENTS.md](AGENTS.md) | Projeye özel ajan kuralları ve güncel kapsam kilidi |
| [docs/standart/README.md](docs/standart/README.md) | Yerel ajan standardı kopyası |

## Kapsam ve sınırlar

- **Kodlama yok:** Kaynak kodu, bağımlılık kurulumu, paket manifesti, CI, SDK kurulumu, AutoCAD bağlantısı ve derleme mevcut kapsamda değildir.
- **Canlı test yok:** Hiçbir platformda AutoCAD 2027 ile bağlantı kurulmadı; hiçbir test paketi çalıştırılmadı.
- **Platform farkları:** Autodesk'in 2027 API tablosuna göre ObjectARX ve AutoLISP Windows/macOS için, .NET ve ActiveX yalnız Windows için belgelidir. ObjectARX SDK'sı tüm API'lerin Mac'te bulunmadığını belirtir; bu nedenle özellik matrisi zorunludur.
- **Lisans:** Henüz seçilmedi. Apache-2.0 yalnız öneridir; `LICENSE` dosyası bilinçli olarak eklenmedi.
- **3B ve Mac:** Ürün hedefidir; işlem ayrıntıları ve Mac işlemci mimarisi henüz netleşmedi. Uzak HTTP ayrı kapsam önerisidir. Hiçbiri uygulanmış destek olarak sunulmaz.

## Depo

GitHub: <https://github.com/mustafamertakceylan/Autocad-MCP>. Depo oluşturuldu; görünürlüğü private olarak doğrulandı. Ürün yayını yapılmadı.
