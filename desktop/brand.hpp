#pragma once
namespace branding {
std::unique_ptr<Gdiplus::Bitmap> logo;
IStream *stream = nullptr;
void clear() { logo.reset(); if (stream) stream->Release(); stream = nullptr; }
void load(HINSTANCE module) {
    auto resource = FindResourceW(module, MAKEINTRESOURCEW(102), RT_RCDATA); desktop::require(resource != nullptr, "Logo resource missing");
    auto bytes = SizeofResource(module, resource); auto data = LockResource(LoadResource(module, resource));
    desktop::require(bytes > 0 && data != nullptr, "Logo resource invalid");
    auto memory = GlobalAlloc(GMEM_MOVEABLE, bytes); desktop::require(memory != nullptr, "Logo memory unavailable");
    auto destination = GlobalLock(memory); if (!destination) { GlobalFree(memory); throw std::runtime_error("Logo memory unavailable"); }
    memcpy(destination, data, bytes); GlobalUnlock(memory);
    if (FAILED(CreateStreamOnHGlobal(memory, TRUE, &stream))) { GlobalFree(memory); throw std::runtime_error("Logo stream unavailable"); }
    logo.reset(Gdiplus::Bitmap::FromStream(stream)); desktop::require(logo && logo->GetLastStatus() == Gdiplus::Ok, "Logo invalid");
}
void draw(HDC dc, RECT rectangle) {
    if (!logo) return; Gdiplus::Graphics g(dc); g.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic);
    g.DrawImage(logo.get(), static_cast<INT>(rectangle.left), static_cast<INT>(rectangle.top), static_cast<INT>(rectangle.right - rectangle.left), static_cast<INT>(rectangle.bottom - rectangle.top));
}
HICON status_icon(COLORREF status) {
    if (!logo) return nullptr;
    Gdiplus::Bitmap bitmap(32, 32, PixelFormat32bppARGB);
    { Gdiplus::Graphics g(&bitmap); g.Clear(Gdiplus::Color(0, 0, 0, 0)); g.SetSmoothingMode(Gdiplus::SmoothingModeAntiAlias); g.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic); g.DrawImage(logo.get(), 1, 0, 29, 29);
      Gdiplus::SolidBrush white(Gdiplus::Color(255, 255, 255)); g.FillEllipse(&white, 20, 20, 12, 12); Gdiplus::SolidBrush dot(Gdiplus::Color(255, GetRValue(status), GetGValue(status), GetBValue(status))); g.FillEllipse(&dot, 22, 22, 8, 8); }
    HICON result = nullptr; bitmap.GetHICON(&result); return result;
}
} // namespace branding
