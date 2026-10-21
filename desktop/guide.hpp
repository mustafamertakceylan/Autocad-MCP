// Short instructions for the supported local desktop/CLI clients. No settings are changed here.
namespace guide {
int stage = 0, client = 0;
struct Step { const wchar_t *title; const wchar_t *body; };
bool manual() { return stage == 1 && (client == 0 || client == 4); }
void set(int id, const std::wstring &value) { if (text(controls[id]) != value) { SetWindowTextW(controls[id], value.c_str()); InvalidateRect(controls[id], nullptr, TRUE); } }
std::vector<std::wstring> arguments() { return {(server_root / L"dist" / L"src" / L"pilot.js").wstring(), L"desktop-serve", L"--state-root", state_root.wstring()}; }
std::wstring command() { return (server_root / L"runtime" / L"node.exe").wstring(); }
std::wstring argument_lines() { std::wstring value; for (const auto &arg : arguments()) { if (!value.empty()) value += L"\r\n"; value += arg; } return value; }
std::vector<Step> steps() {
    if (stage == 0) return {
        {L"Kurulumu yap", L"AutoCAD kapalıyken, indirdiğin paketteki install.cmd dosyasını çalıştır."},
        {L"AutoCAD 2027'yi aç", L"Tam AutoCAD sürümünde yeni bir çizim aç. AutoCAD LT desteklenmez."},
        {L"Oturumunu bağla", L"Bağlantı sekmesine dön, AutoCAD oturumunu seç ve AutoCAD'e bağlan'a bas."},
        {L"Hazır olduğunu gör", L"AutoCAD'e bağlı ve araç sayısı göründüğünde MCP bağlantısı adımına geç."}
    };
    if (manual()) return {
        {L"Yerel MCP sunucusu ekle", client == 0 ? L"Codex'te Ayarlar > MCP sunucuları > Sunucu ekle. Ad: autocad; tür: STDIO." : L"İstemcinin MCP ayarlarından yeni bir yerel / STDIO sunucusu ekle. Adı: autocad."},
        {L"Aşağıdaki alanları kullan", L"Komutu kopyala. Argümanların her satırını, sırayı bozmadan ayrı bir argüman olarak ekle."},
        {L"Kaydet ve kontrol et", L"İstemcide MCP'yi yeniden başlat. Sohbette 'AutoCAD durumunu kontrol et' yaz."}
    };
    const wchar_t *launch = client == 1 ? L"Codex klasöründe terminal açıp codex çalıştır. Proje güvenini ve MCP iznini onayla." : client == 2 ? L"Claude klasöründe terminal açıp claude çalıştır. Proje ve autocad MCP onaylarını ver." : L"OpenCode klasöründe terminal açıp opencode çalıştır. Sunucunun etkin olduğundan emin ol.";
    const wchar_t *folder = client == 1 ? L"Codex klasörünü aç düğmesiyle codex alt klasörüne git." : client == 2 ? L"Claude klasörünü aç düğmesiyle claude alt klasörüne git. Bu yol Claude Code içindir." : L"OpenCode klasörünü aç düğmesiyle opencode alt klasörüne git. Bu ayar OpenCode 1.x içindir.";
    return {
        {L"Bağlantı klasörünü hazırla", L"İstemciler sekmesinde boş bir klasör seçip Bağlantı dosyalarını hazırla'ya bas."},
        {L"Doğru alt klasöre git", folder},
        {L"AI istemcisini orada başlat", launch},
        {L"Bir durum sorgusu dene", L"'AutoCAD durumunu kontrol et' yaz. Burada AI istemcisi bağlı görünmeli; model erişimi ayrıca gerekir."}
    };
}
void copy(const std::wstring &value) {
    if (!OpenClipboard(window)) { feedback(L"Pano şu an kullanımda. Tekrar kopyalamayı dene.", true); return; }
    auto memory = GlobalAlloc(GMEM_MOVEABLE, (value.size() + 1) * sizeof(wchar_t));
    if (!memory) { CloseClipboard(); throw std::runtime_error("Clipboard unavailable"); }
    auto bytes = GlobalLock(memory); if (!bytes) { GlobalFree(memory); CloseClipboard(); throw std::runtime_error("Clipboard unavailable"); }
    memcpy(bytes, value.c_str(), (value.size() + 1) * sizeof(wchar_t)); GlobalUnlock(memory);
    if (!EmptyClipboard() || !SetClipboardData(CF_UNICODETEXT, memory)) { GlobalFree(memory); CloseClipboard(); throw std::runtime_error("Clipboard unavailable"); }
    CloseClipboard(); feedback(L"Kopyalandı. İstemcinin MCP ayarına yapıştırabilirsin.");
}
} // namespace guide
