// Build-time image format conversion only; the original generated logo is preserved.
#include <windows.h>
#include <gdiplus.h>
#include <filesystem>
#include <fstream>
#include <vector>
#include <cstdint>
#include <stdexcept>
void need(bool ok) { if (!ok) throw std::runtime_error("Logo conversion failed"); }
int wmain(int argc, wchar_t **argv) {
    if (argc != 3) return 2;
    Gdiplus::GdiplusStartupInput input; ULONG_PTR token = 0; if (Gdiplus::GdiplusStartup(&token, &input, nullptr) != Gdiplus::Ok) return 2;
    int result = 0;
    try {
        Gdiplus::Bitmap source(argv[1]); need(source.GetLastStatus() == Gdiplus::Ok);
        Gdiplus::Color corner; source.GetPixel(0, 0, &corner); need(corner.GetA() == 0);
        UINT count = 0, bytes = 0; Gdiplus::GetImageEncodersSize(&count, &bytes); std::vector<BYTE> storage(bytes);
        auto *encoders = reinterpret_cast<Gdiplus::ImageCodecInfo *>(storage.data()); Gdiplus::GetImageEncoders(count, bytes, encoders); CLSID png{}; bool found = false;
        for (UINT i = 0; i < count; i++) if (wcscmp(encoders[i].MimeType, L"image/png") == 0) { png = encoders[i].Clsid; found = true; } need(found);
        std::vector<std::vector<char>> frames; const std::vector<int> sizes{16, 24, 32, 48, 64, 128, 256};
        auto directory = std::filesystem::path(argv[2]); std::filesystem::create_directories(directory);
        for (auto size : sizes) {
            Gdiplus::Bitmap bitmap(size, size, PixelFormat32bppARGB);
            { Gdiplus::Graphics g(&bitmap); g.Clear(Gdiplus::Color(0, 0, 0, 0)); g.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic); need(g.DrawImage(&source, 0, 0, size, size) == Gdiplus::Ok); }
            IStream *stream = nullptr; need(SUCCEEDED(CreateStreamOnHGlobal(nullptr, TRUE, &stream))); need(bitmap.Save(stream, &png) == Gdiplus::Ok);
            STATSTG stats{}; need(SUCCEEDED(stream->Stat(&stats, STATFLAG_NONAME))); std::vector<char> frame(static_cast<size_t>(stats.cbSize.QuadPart)); LARGE_INTEGER zero{}; stream->Seek(zero, STREAM_SEEK_SET, nullptr); ULONG read = 0; need(SUCCEEDED(stream->Read(frame.data(), static_cast<ULONG>(frame.size()), &read)) && read == frame.size()); stream->Release();
            if (size == 256) { std::ofstream file(directory / L"app.png", std::ios::binary); file.write(frame.data(), static_cast<std::streamsize>(frame.size())); need(file.good()); }
            frames.push_back(std::move(frame));
        }
        std::ofstream icon(directory / L"app.ico", std::ios::binary); auto u16 = [&](std::uint16_t value) { icon.write(reinterpret_cast<const char *>(&value), 2); }; auto u32 = [&](std::uint32_t value) { icon.write(reinterpret_cast<const char *>(&value), 4); };
        u16(0); u16(1); u16(static_cast<std::uint16_t>(sizes.size())); std::uint32_t offset = 6 + static_cast<std::uint32_t>(sizes.size()) * 16;
        for (size_t i = 0; i < sizes.size(); i++) { char dimension = sizes[i] == 256 ? 0 : static_cast<char>(sizes[i]); icon.put(dimension); icon.put(dimension); u16(0); u16(1); u16(32); u32(static_cast<std::uint32_t>(frames[i].size())); u32(offset); offset += static_cast<std::uint32_t>(frames[i].size()); }
        for (const auto &frame : frames) icon.write(frame.data(), static_cast<std::streamsize>(frame.size())); need(icon.good());
    } catch (...) { result = 2; }
    Gdiplus::GdiplusShutdown(token); return result;
}
