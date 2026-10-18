# Autocad MCP — ajan kuralları

Standart kaynak: https://github.com/mustafamertakceylan/ajan-standardi
Yerel standart kopyası: `docs/standart/`; sürüm kaydı: `docs/standart/KAYNAK.md`.

Göreve başlamadan `docs/standart/ortak/KURALLAR.md` ve `docs/standart/ortak/USLUP.md` okunur. Yönetici ayrıca `docs/standart/roller/YONETICI.md`, uygulayıcı `docs/standart/roller/UYGULAYICI.md` okur. Görevle ilgili dersler `docs/standart/ders-kitabi.md` içindedir. Bu dosya yalnız projeye özel kararları ve daha dar kapsamı belirler.

## Proje
- Ad: Autocad MCP. GitHub depo adı: `Autocad-MCP`; görünürlük **private**.
- Çalışma klasörü: `C:\Dev\Other Projects\Autocad MCP`.
- Hedef: Her kullanıcının bilgisayarında yerel çalışan, tam AutoCAD 2027 ile MCP istemcileri arasında köprü; Windows ve macOS.
- Yeni 2B/3B çizim ve mevcut çizimi inceleme/düzenleme birlikte hedeflenir.
- Mimari yönü: dış TypeScript MCP sunucusu, içeride ortak C++/ObjectARX kaynaklarından platforma özel derlenen eklenti. Windows dikey dilimi gerçek AutoCAD 2027 Core Console ile doğrulandı; masaüstü UI ve Mac kabulü tamamlanmadı.
- Kullanıcı iletişimi ve proje belgeleri Türkçe; Prototip MCP araç açıklamaları İngilizce; kullanıcı belgeleri Türkçe.
- Commit dili bu yeni depo için Türkçe; kapsamlar: `init`, `agents`, `plan`, `docs`, ileride `bridge`, `plugin`, `mcp`, `installer`.

## Güncel kapsam kilidi
- **Kullanıcı 2026-10-18 tarihinde Faz 2'yi yöneticinin kendisinin geliştirmesini istedi.** Ortak MCP/IPC kodu, test altyapısı, Windows ObjectARX eklentisi ve izole Windows AutoCAD denemeleri bu işte yetkilidir. Ajanlara görev verilmez.
- Kullanıcı 2026-10-18 tarihinde Mac'i ayrı **Faz M** olarak ayırdı. Güncel Faz 2–6 Windows üzerinden ilerler; Mac bu fazların bitişini engellemez. Ortak kaynak hazırlanabilir; Mac'e SSH, Mac derlemesi ve canlı Mac testi bu işte yapılmaz. Faz M ayrıca kullanıcı tarafından başlatılır.
- Gerekli yerel bağımlılıklar, proje derleme betikleri ve manifestler eklenebilir. SDK lisans/koşul kabulü, hesap, ödeme, public yayın ve istemcilerin kişisel ayarlarını değiştirme kullanıcıya aittir. Commit/push için ayrıca açık talep gerekir.
- Bu kurulum işi için yönetici private depoyu oluşturur ve yalnız denetlenen plan/kural belgelerini ilk commit ile kaydeder. Bu izin sonraki geliştirme işlerine aktarılmaz.
- Uygulayıcılar commit/push yapamaz. Görev dosyası proje kökünde, rapor hemen oluşturulur. Biten görev ve rapor `docs/arsiv/` altında saklanır.
- Depo kullanıcı açıkça istemeden public yapılmaz; GitHub Pages, Release ve paket yayını yok.

## Komutlar ve doğrulama
- Ortak kod: `npm ci --ignore-scripts`, `npm run check`, `npm test`. Native: `cmake --build build/native --config Release`, `ctest --test-dir build/native -C Release --output-on-failure`. Kurulum ve izole canlı test: `docs/GELISTIRME.md`. Gerçek sonuçlar FAZ2_DURUM.md ve teknik kabul belgesinde tutulur.
- Commit öncesinde sır taraması gerekir; betik henüz yoksa staged diff elle incelenir.
- Belgeler için bağlantı, kapsam, şablon ve dosya listesi kontrolü yapılır; uygulama testi sayılmaz.

## İzole test ortamı
- İzole Core Console profili ve stok şablondan üretilen sentetik çizimler `tmp/live-runs/` altında kullanılır. Yalnız bu testin başlattığı süreçler kapatılır; kullanıcı oturumuna dokunulmaz.
- Gerçek müşteri çizimleri, anahtarlar ve kullanıcıya ait üretim dosyaları bu depoya alınmaz.
- Veritabanı, ödeme, e-posta/SMS ve merkezi bulut hizmeti mevcut kapsamda yok.

## Yayın ve Mac
- Şu an ürün yayını veya VDS yok; `YAYIN_KURALLARI.md` ve `YAYIN_GUNLUGU.md` uygulanabilir aşamada hazırlanacak.
- Mac derlemesi ve canlı testi ileride gerekir. Kullanıcı o iş için uygunluk/onay vermeden Mac'e bağlanılmaz.
- SDK koşullarını kabul etmek, hesap açmak, ödeme ve imzalama hesabı işlemleri kullanıcıya aittir.

## Kasıtlı kararlar ve açık noktalar
- Kullanıcı yerel köprü istiyor; zorunlu merkezi sunucu/hesap planlanmıyor. AI istemcisinin buluta veri göndermesi ayrı veri akışıdır.
- Hedef ileride kurulabilir açık kaynak ürün; **şu an depo private**. Apache-2.0 yalnız öneridir; lisans seçimi henüz onaylanmadı ve LICENSE eklenmez.
- Bütün özellikler hedefi, platform/API ve gerçek test durumuyla raporlanır; serbest komut/LISP erişimi tam test kapsamı sayılmaz.
- Mac test hedefi kullanıcı tarafından Apple Silicon (M serisi, arm64) olarak belirtildi. Intel/universal dağıtımı ayrıca değerlendirilecek. HTTP/uzak bağlantı, gelişmiş LISP, paketleme ve sürüm desteği ayrıntıları plan önerisidir.
- Önceki `C:\Dev\Other Projects\AutoCAD-MCP` araştırma klasörü korunur; bu projenin kökü değildir.
