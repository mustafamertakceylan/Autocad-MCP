// Native presentation only. Pairing, process lifetime and CAD routing stay in main.cpp.
namespace view {
constexpr COLORREF background = RGB(249, 247, 248), ink = RGB(42, 33, 39), muted = RGB(113, 101, 109), accent = RGB(217, 37, 50), border = RGB(234, 227, 230), hero = RGB(51, 28, 35);
int page = 0;
HWND hovered = nullptr;
std::vector<int> displayed;
std::map<int, RECT> placements;
HFONT small_font = nullptr, strong_font = nullptr, title_font = nullptr;
std::wstring notice;
bool notice_error = false;
ULONGLONG notice_until = 0;
RECT rect(int x, int y, int width, int height) { return {scaled(x), scaled(y), scaled(x + width), scaled(y + height)}; }
Gdiplus::Color color(COLORREF value) { return Gdiplus::Color(255, GetRValue(value), GetGValue(value), GetBValue(value)); }
void rounded(HDC dc, RECT r, COLORREF fill, int radius = 12, COLORREF outline = CLR_INVALID) {
    Gdiplus::Graphics g(dc); g.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias);
    Gdiplus::GraphicsPath path; float d = static_cast<float>(scaled(radius * 2));
    float x = static_cast<float>(r.left), y = static_cast<float>(r.top), w = static_cast<float>(r.right - r.left - 1), h = static_cast<float>(r.bottom - r.top - 1);
    d = (std::min)(d, (std::min)(w, h));
    path.AddArc(x, y, d, d, 180, 90); path.AddArc(x + w - d, y, d, d, 270, 90); path.AddArc(x + w - d, y + h - d, d, d, 0, 90); path.AddArc(x, y + h - d, d, d, 90, 90); path.CloseFigure();
    Gdiplus::SolidBrush brush(color(fill)); g.FillPath(&brush, &path);
    if (outline != CLR_INVALID) { Gdiplus::Pen pen(color(outline), 1.0f); g.DrawPath(&pen, &path); }
}
void label(HDC dc, const std::wstring &value, RECT r, HFONT font, COLORREF tint, UINT format = DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS) {
    auto old = SelectObject(dc, font); SetBkMode(dc, TRANSPARENT); SetTextColor(dc, tint); DrawTextW(dc, value.c_str(), static_cast<int>(value.size()), &r, format); SelectObject(dc, old);
}
int width() { RECT r{}; GetClientRect(window, &r); return MulDiv(r.right, 96, static_cast<int>(GetDpiForWindow(window))); }
int height() { RECT r{}; GetClientRect(window, &r); return MulDiv(r.bottom, 96, static_cast<int>(GetDpiForWindow(window))); }
bool connected() { return last_snapshot.value("connected", false); }
bool prepared() {
    try { auto folder = std::filesystem::path(text(controls[WORKSPACE])); return std::filesystem::is_regular_file(folder / L".autocad-desktop-workspace.json"); } catch (...) { return false; }
}
void show_controls(std::initializer_list<int> ids) { displayed.insert(displayed.end(), ids.begin(), ids.end()); }
void layout() {
    int w = width(), h = height();
    displayed.clear();
    auto place = [&](int id, int x, int y, int width, int height) {
        RECT requested{scaled(x), scaled(y), scaled(width), scaled(height)};
        auto previous = placements.find(id);
        if (previous == placements.end() || !EqualRect(&previous->second, &requested)) {
            MoveWindow(controls[id], requested.left, requested.top, requested.right, requested.bottom, TRUE);
            placements[id] = requested;
        }
    };
    show_controls({HEADER, NAV_CONNECTION, NAV_CLIENTS, NAV_SETTINGS, NAV_GUIDE});
    if (!notice.empty()) show_controls({FEEDBACK});
    place(HEADER, 76, 22, 235, 32);
    place(NAV_CONNECTION, 28, 91, 116, 40); place(NAV_CLIENTS, 152, 91, 116, 40); place(NAV_SETTINGS, 276, 91, 116, 40);
    place(NAV_GUIDE, 400, 91, 172, 40);
    place(FEEDBACK, 28, h - 50, w - 56, 38);
    if (page == 0) {
        show_controls({CAD_STATUS, HINT, HOST_LABEL, CONNECT, REFRESH, CLIENT_STATUS, CLIENT_SETUP});
        place(CAD_STATUS, 50, 194, w - 220, 40); place(HINT, 50, 242, w - 220, 43);
        place(HOST_LABEL, 48, 340, w - 210, 28); place(REFRESH, w - 148, 338, 100, 32);
        if (!host_ids.empty()) { show_controls({HOSTS}); place(HOSTS, 48, 380, w - 96, 54); }
        place(CONNECT, w - 238, 476, 210, 42);
        if (connected()) { show_controls({DISCONNECT}); place(DISCONNECT, w - 412, 476, 162, 42); }
        place(CLIENT_STATUS, 96, 552, w - 310, 27); place(CLIENT_SETUP, w - 194, 558, 146, 36);
    } else if (page == 1) {
        show_controls({CONFIG_LABEL, WORKSPACE, BROWSE, CONFIGURE, OPEN_FOLDER, OPEN_CODEX, OPEN_CLAUDE, OPEN_OPENCODE});
        int column = (w - 80) / 3;
        place(OPEN_CODEX, 48, 300, column - 40, 36); place(OPEN_CLAUDE, 60 + column, 300, column - 40, 36); place(OPEN_OPENCODE, 72 + column * 2, 300, column - 40, 36);
        place(CONFIG_LABEL, 28, 375, w - 56, 26); place(WORKSPACE, 49, 416, w - 237, 28); place(BROWSE, w - 166, 409, 118, 40);
        place(CONFIGURE, 48, 475, 270, 42); place(OPEN_FOLDER, 330, 475, 145, 42);
        bool ready = prepared(); for (int id : {OPEN_CODEX, OPEN_CLAUDE, OPEN_OPENCODE, OPEN_FOLDER}) EnableWindow(controls[id], ready);
    } else if (page == 2) {
        show_controls({STARTUP, HIDE_APP, EXIT_APP});
        place(STARTUP, 50, 249, w - 100, 28); place(HIDE_APP, w - 214, 374, 166, 38); place(EXIT_APP, w - 214, 510, 166, 38);
    } else {
        show_controls({GUIDE_CAD, GUIDE_MCP, GUIDE_NOTE});
        place(GUIDE_CAD, 28, 218, 182, 38); place(GUIDE_MCP, 220, 218, 170, 38);
        if (guide::stage == 1) { show_controls({GUIDE_CLIENT}); place(GUIDE_CLIENT, 410, 222, w - 438, 250); }
        auto steps = guide::steps(); int spacing = guide::manual() ? 55 : 62;
        for (size_t i = 0; i < steps.size(); i++) {
            int id = GUIDE_STEP1 + static_cast<int>(i) * 2, y = 281 + static_cast<int>(i) * spacing;
            show_controls({id, id + 1}); guide::set(id, steps[i].title); guide::set(id + 1, steps[i].body);
            place(id, 90, y, w - 140, 23); place(id + 1, 90, y + 26, w - 140, 34);
        }
        if (guide::manual()) {
            show_controls({GUIDE_COMMAND_LABEL, GUIDE_COMMAND, GUIDE_ARGS_LABEL, GUIDE_ARGS, GUIDE_COPY_COMMAND, GUIDE_COPY_ARGS});
            guide::set(GUIDE_COMMAND, guide::command()); guide::set(GUIDE_ARGS, guide::argument_lines());
            place(GUIDE_COMMAND_LABEL, 28, 463, w - 56, 22); place(GUIDE_COMMAND, 42, 495, w - 272, 24); place(GUIDE_COPY_COMMAND, w - 204, 488, 176, 35);
            place(GUIDE_ARGS_LABEL, 28, 526, w - 56, 22); place(GUIDE_ARGS, 42, 555, w - 272, 72); place(GUIDE_COPY_ARGS, w - 204, 550, 176, 35);
            guide::set(GUIDE_NOTE, L"Yerel / STDIO\nURL veya port gerekmez."); place(GUIDE_NOTE, w - 204, 590, 176, 40);
        } else {
            show_controls({GUIDE_ACTION}); guide::set(GUIDE_ACTION, guide::stage == 0 ? L"MCP adımına geç" : L"İstemcilere git");
            place(GUIDE_ACTION, w - 240, 551, 212, 42);
            if (guide::stage == 0) { show_controls({GUIDE_PLUGIN_FOLDER}); place(GUIDE_PLUGIN_FOLDER, 28, 551, 212, 42); }
            guide::set(GUIDE_NOTE, guide::stage == 0 ? L"Listede görünmüyorsa AutoCAD'e APPLOAD yaz; eklenti klasöründeki AutocadMcp.arx dosyasını seç." : L"Sonraki kullanımda yalnız AutoCAD'i açıp Bağlan'a bas. Aynı istemci ayarı geçerlidir.");
            place(GUIDE_NOTE, 28, 603, w - 56, 36);
        }
    }
    for (auto [id, control] : controls) {
        bool desired = std::find(displayed.begin(), displayed.end(), id) != displayed.end();
        bool visible = (GetWindowLongPtrW(control, GWL_STYLE) & WS_VISIBLE) != 0;
        if (desired != visible) ShowWindow(control, desired ? SW_SHOW : SW_HIDE);
    }
    for (int id : {NAV_CONNECTION, NAV_CLIENTS, NAV_SETTINGS, NAV_GUIDE}) {
        std::wstring name = id == NAV_CONNECTION ? L"Bağlantı" : id == NAV_CLIENTS ? L"İstemciler" : id == NAV_SETTINGS ? L"Ayarlar" : L"Kurulum rehberi";
        if (page == (id == NAV_GUIDE ? 3 : id - NAV_CONNECTION)) name += L" (seçili)";
        SetWindowTextW(controls[id], name.c_str()); InvalidateRect(controls[id], nullptr, FALSE);
    }
    InvalidateRect(controls[GUIDE_CAD], nullptr, FALSE); InvalidateRect(controls[GUIDE_MCP], nullptr, FALSE);
    InvalidateRect(window, nullptr, FALSE);
}
void paint(HDC dc) {
    int w = width(), h = height(); RECT area{}; GetClientRect(window, &area);
    SetDCBrushColor(dc, background); FillRect(dc, &area, static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));
    RECT bar = rect(0, 0, w, 77); SetDCBrushColor(dc, RGB(255, 255, 255)); FillRect(dc, &bar, static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));
    branding::draw(dc, rect(23, 14, 46, 46));
    rounded(dc, rect(w - 166, 27, 138, 26), RGB(251, 233, 235), 13); label(dc, L"Yerel bağlantı", rect(w - 166, 27, 138, 26), small_font, accent, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
    if (page == 0) {
        rounded(dc, rect(28, 151, w - 56, 157), hero, 16);
        label(dc, L"BAĞLANTI DURUMU", rect(50, 169, 240, 20), small_font, RGB(223, 178, 187));
        rounded(dc, rect(w - 142, 189, 76, 76), RGB(255, 241, 243), 22);
        branding::draw(dc, rect(w - 136, 195, 64, 64));
        rounded(dc, rect(28, 326, w - 56, 128), RGB(255, 255, 255), 14, border);
        if (host_ids.empty()) {
            label(dc, L"Henüz bir AutoCAD oturumu görünmüyor", rect(49, 382, w - 100, 24), regular_font, muted);
            label(dc, L"İlk kullanımda Kurulum rehberi > AutoCAD adımlarını izle.", rect(49, 409, w - 100, 20), small_font, muted);
        }
        if (!connected()) label(dc, L"Bağlanacağınız AutoCAD'i siz seçersiniz.", rect(28, 480, w - 292, 34), small_font, muted);
        rounded(dc, rect(28, 538, w - 56, 76), RGB(255, 255, 255), 14, border);
        rounded(dc, rect(48, 557, 34, 34), RGB(255, 237, 240), 9); label(dc, L"AI", rect(48, 557, 34, 34), strong_font, accent, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
        label(dc, L"Codex  ·  Claude Code  ·  OpenCode", rect(96, 582, w - 310, 20), small_font, muted);
    } else if (page == 1) {
        label(dc, L"AI istemcilerini bağla", rect(28, 151, w - 56, 38), title_font, ink);
        label(dc, L"Bir kez hazırla; AutoCAD yeniden açıldığında aynı ayarla devam et.", rect(28, 194, w - 56, 24), regular_font, muted);
        int column = (w - 80) / 3; const wchar_t *names[] = {L"Codex", L"Claude Code", L"OpenCode"}; const wchar_t *marks[] = {L">_", L"C", L"O"};
        for (int i = 0; i < 3; i++) {
            int x = 28 + i * (column + 12);
            rounded(dc, rect(x, 237, column, 119), RGB(255, 255, 255), 14, border);
            rounded(dc, rect(x + 18, 255, 32, 30), RGB(238, 242, 247), 8); label(dc, marks[i], rect(x + 18, 255, 32, 30), strong_font, ink, DT_CENTER | DT_VCENTER | DT_SINGLELINE);
            label(dc, names[i], rect(x + 62, 256, column - 76, 25), strong_font, ink);
        }
        rounded(dc, rect(28, 402, w - 204, 52), RGB(255, 255, 255), 10, border);
        label(dc, L"Yeni veya boş bir klasör seçin. Kişisel istemci ayarlarınız değiştirilmez.", rect(28, 536, w - 56, 25), small_font, muted);
        label(dc, L"Sonra Kurulum rehberi > MCP'yi bağla adımından istemcini seç.", rect(28, 563, w - 56, 25), small_font, muted);
    } else if (page == 2) {
        label(dc, L"Uygulama ayarları", rect(28, 151, w - 56, 38), title_font, ink);
        label(dc, L"Arka planda nasıl çalışacağını seçin.", rect(28, 194, w - 56, 24), regular_font, muted);
        rounded(dc, rect(28, 235, w - 56, 103), RGB(255, 255, 255), 14, border);
        label(dc, custom_root ? L"Deneme dizininde başlangıç ayarı kapalıdır." : L"Oturum açıldığında yalnız sistem tepsisinde başlar; pencere açılmaz.", rect(50, 287, w - 100, 30), small_font, muted, DT_LEFT | DT_WORDBREAK);
        rounded(dc, rect(28, 356, w - 56, 102), RGB(255, 255, 255), 14, border);
        label(dc, L"Sistem tepsisinde çalış", rect(50, 372, w - 290, 26), strong_font, ink);
        label(dc, L"Pencereyi kapatmak bağlantıyı kesmez.", rect(50, 410, w - 100, 26), small_font, muted);
        rounded(dc, rect(28, 476, w - 56, 102), RGB(255, 255, 255), 14, border);
        label(dc, L"Uygulamadan çık", rect(50, 491, w - 290, 26), strong_font, ink);
        label(dc, L"MCP bağlantısı kesilir. AutoCAD ve çizimleriniz açık kalır.", rect(50, 532, w - 290, 30), small_font, muted, DT_LEFT | DT_WORDBREAK);
    } else {
        label(dc, L"İlk bağlantını kur", rect(28, 151, w - 56, 38), title_font, ink);
        label(dc, L"Önce AutoCAD'i hazırla, sonra AI istemcisini bağla.", rect(28, 190, w - 56, 24), regular_font, muted);
        auto steps = guide::steps(); int spacing = guide::manual() ? 55 : 62;
        rounded(dc, rect(28, 270, w - 56, guide::manual() ? 187 : 267), RGB(255, 255, 255), 14, border);
        for (size_t i = 0; i < steps.size(); i++) { int y = 282 + static_cast<int>(i) * spacing; rounded(dc, rect(48, y, 28, 28), RGB(255, 234, 237), 14); label(dc, std::to_wstring(i + 1), rect(48, y, 28, 28), strong_font, accent, DT_CENTER | DT_VCENTER | DT_SINGLELINE); }
        if (guide::manual()) { rounded(dc, rect(28, 488, w - 244, 36), RGB(255, 255, 255), 8, border); rounded(dc, rect(28, 550, w - 244, 82), RGB(255, 255, 255), 8, border); }
    }
    if (notice.empty() && page != 3) label(dc, L"Yardım için Kurulum rehberi  ·  Pencereyi kapatınca tepside çalışır.", rect(28, h - 47, w - 56, 28), small_font, muted);
}
void button(const DRAWITEMSTRUCT &item) {
    int id = static_cast<int>(item.CtlID); bool nav = (id >= NAV_CONNECTION && id <= NAV_SETTINGS) || id == NAV_GUIDE, stage = id == GUIDE_CAD || id == GUIDE_MCP;
    bool selected = (nav && page == (id == NAV_GUIDE ? 3 : id - NAV_CONNECTION)) || (stage && guide::stage == (id == GUIDE_CAD ? 0 : 1));
    bool primary = id == CONNECT || id == CONFIGURE || id == GUIDE_ACTION, disabled = (item.itemState & ODS_DISABLED) != 0, hot = hovered == item.hwndItem || (item.itemState & ODS_SELECTED);
    COLORREF fill = primary ? (disabled ? RGB(235, 229, 232) : hot ? RGB(181, 22, 40) : accent) : selected ? RGB(255, 231, 235) : hot ? RGB(248, 235, 238) : nav || stage ? background : RGB(255, 255, 255);
    bool on_canvas = nav || stage || id == CONNECT || id == DISCONNECT || id == CONFIGURE || id == BROWSE || id == OPEN_FOLDER || (id >= GUIDE_PLUGIN_FOLDER && id <= GUIDE_COPY_ARGS);
    RECT outer = item.rcItem; SetDCBrushColor(item.hDC, on_canvas ? background : RGB(255, 255, 255)); FillRect(item.hDC, &outer, static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));
    rounded(item.hDC, outer, fill, 9, nav || stage || primary || id == REFRESH ? CLR_INVALID : border);
    auto tint = disabled ? RGB(153, 139, 147) : primary ? RGB(255, 255, 255) : id == EXIT_APP ? RGB(175, 55, 55) : selected ? accent : ink;
    std::wstring caption = nav ? (id == NAV_CONNECTION ? L"Bağlantı" : id == NAV_CLIENTS ? L"İstemciler" : id == NAV_SETTINGS ? L"Ayarlar" : L"Kurulum rehberi") : text(item.hwndItem);
    RECT content = outer; InflateRect(&content, -scaled(8), 0); label(item.hDC, caption, content, strong_font, tint, DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_END_ELLIPSIS);
    if (item.itemState & ODS_FOCUS) { RECT focus = outer; InflateRect(&focus, -scaled(4), -scaled(4)); DrawFocusRect(item.hDC, &focus); }
}
void list_item(const DRAWITEMSTRUCT &item) {
    if (item.itemID == static_cast<UINT>(-1)) return;
    bool selected = (item.itemState & ODS_SELECTED) != 0; RECT r = item.rcItem;
    SetDCBrushColor(item.hDC, RGB(255, 255, 255)); FillRect(item.hDC, &r, static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));
    InflateRect(&r, -scaled(1), -scaled(3)); rounded(item.hDC, r, selected ? RGB(255, 239, 242) : RGB(251, 248, 249), 9, selected ? RGB(244, 188, 198) : border);
    auto length = SendMessageW(item.hwndItem, LB_GETTEXTLEN, item.itemID, 0); if (length < 0 || length > 512) return;
    std::wstring value(static_cast<size_t>(length) + 1, 0); SendMessageW(item.hwndItem, LB_GETTEXT, item.itemID, reinterpret_cast<LPARAM>(value.data())); value.resize(static_cast<size_t>(length));
    r.left += scaled(14); r.right -= scaled(14); label(item.hDC, value, r, regular_font, selected ? RGB(157, 28, 47) : ink);
    if (item.itemState & ODS_FOCUS) { InflateRect(&r, -scaled(2), -scaled(2)); DrawFocusRect(item.hDC, &r); }
}
void guide_text(const DRAWITEMSTRUCT &item) {
    int id = static_cast<int>(item.CtlID); bool note = id == GUIDE_NOTE;
    SetDCBrushColor(item.hDC, note ? background : RGB(255, 255, 255)); FillRect(item.hDC, &item.rcItem, static_cast<HBRUSH>(GetStockObject(DC_BRUSH)));
    auto font = reinterpret_cast<HFONT>(SendMessageW(item.hwndItem, WM_GETFONT, 0, 0));
    label(item.hDC, text(item.hwndItem), item.rcItem, font ? font : regular_font, note || (id - GUIDE_STEP1) % 2 == 1 ? muted : ink, DT_LEFT | DT_WORDBREAK | DT_NOPREFIX);
}
LRESULT CALLBACK hover_proc(HWND button, UINT message, WPARAM w, LPARAM l, UINT_PTR, DWORD_PTR) {
    if (message == WM_MOUSEMOVE && hovered != button) { auto old = hovered; hovered = button; if (old) InvalidateRect(old, nullptr, FALSE); InvalidateRect(button, nullptr, FALSE); TRACKMOUSEEVENT track{sizeof(track), TME_LEAVE, button, 0}; TrackMouseEvent(&track); }
    if (message == WM_MOUSELEAVE) { if (hovered == button) hovered = nullptr; InvalidateRect(button, nullptr, FALSE); }
    return DefSubclassProc(button, message, w, l);
}
} // namespace view

void layout() { view::layout(); }
void fonts() {
    for (auto *font : {&regular_font, &header_font, &view::small_font, &view::strong_font, &view::title_font}) if (*font) { DeleteObject(*font); *font = nullptr; }
    auto make = [](int size, int weight) { return CreateFontW(-scaled(size), 0, 0, 0, weight, FALSE, FALSE, FALSE, DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH, L"Segoe UI"); };
    regular_font = make(15, FW_NORMAL); header_font = make(21, FW_SEMIBOLD); view::small_font = make(13, FW_NORMAL); view::strong_font = make(15, FW_SEMIBOLD); view::title_font = make(28, FW_SEMIBOLD);
    for (auto [id, control] : controls) { bool step = id >= GUIDE_STEP1 && id <= GUIDE_STEP4 + 1; HFONT font = id == HEADER ? header_font : id == CAD_STATUS ? view::title_font : id == HINT ? regular_font : (id == FEEDBACK || id == GUIDE_NOTE || id == GUIDE_ARGS || (step && (id - GUIDE_STEP1) % 2 == 1)) ? view::small_font : (id == HOST_LABEL || id == CLIENT_STATUS || id == CONFIG_LABEL || (step && (id - GUIDE_STEP1) % 2 == 0)) ? view::strong_font : regular_font; SendMessageW(control, WM_SETFONT, reinterpret_cast<WPARAM>(font), TRUE); }
    SendMessageW(controls[HOSTS], LB_SETITEMHEIGHT, 0, scaled(48));
}
