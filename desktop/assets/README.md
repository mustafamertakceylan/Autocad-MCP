# Uygulama logosu

`autocad-mcp-logo.png`, 2026-10-19 tarihinde kullanıcının kırmızı logo isteğiyle yerleşik **imagegen** aracıyla üretildi. Kaynak görsel korunur; uygulama başlığı, EXE/tepsi simgesi ve rehberde kullanılır. Resmî Autodesk logosu değildir. Kırmızı vurgu `#D92532` tasarım seçimidir; resmî marka renk değeri iddiası yoktur.

Üretim tarifi: bağımsız yerel CAD–AI köprüsü için kırmızı, köşeli A/köprü monogramı; iki yapısal kol ve koyu bağlayıcı, güçlü negatif boşluk, küçük simgede okunaklı, yazısız ve şeffaf arka plan. Renkler `#D92532`, `#A71126`, `#25262B`. Yerleşik imagegen kullanıldı; haricî API anahtarı veya repo içeriği gönderilmedi.

CMake, build-time `AutocadMcpIconBuilder` ile aynı kaynaktan 16–256px ICO ve256px PNG üretir; yalnız boyut/format dönüşümü yapılır. Bu araç son kullanıcı paketine girmez. Üretilen iki dosya EXE kaynağına gömülür; kullanıcıda ek görsel dosyası veya çalışma zamanı gerekmez.
