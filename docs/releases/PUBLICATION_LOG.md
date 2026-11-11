# Publication log / Yayın günlüğü

## v1.2.0 — 2026-11-12

- Repository: public; Apache-2.0.
- Release: https://github.com/mustafamertakceylan/Autocad-MCP/releases/tag/v1.2.0
- Source/tag commit: `b8320aa1fd00c2a2608b20e386fb1af03f3b486c`.
- Profile: `unsigned-preview`; Windows x64 / full AutoCAD2027 only. Version 1.1.0 skipped by user request.
- Asset: `Autocad-MCP-1.2.0-Windows-x64.zip`, 38,892,705 bytes, plus SHA256 sidecar.
- SHA256: `85003dbd43e5d5c8b839301a91da1e56d040014fd7992ce6301a4142951352e4`.
- Package ID: `01a77b69f2f48482fb461527bcc36c184fc145bf8fecce381bc455d7a3293455`.
- Draft upload downloaded and verified; published asset downloaded again and verified.
- Current acceptance: type check; 60 common tests; CTest 2/2; 526 native CAD (15 suites);
  23 real reconnect; 28 real ZIP installation/rollback/uninstall/native-reopen checks.
- Node v24.19.0 signature Valid; ARX/desktop EXE NotSigned. Strict signed/clean-machine gate remains false.
- No SDK/host DLL, drawing, pairing secret, certificate or developer agent reports in the package.

Yayımlanan dosyanın byte hash'i yerel paketle eşleşti. Ayrı temiz Windows,
gerçek reboot/başlangıç kaydı, gerçek v1.0.0 kurulumundan yükseltme, canlı
Claude ve Mac kabulü çalıştırılmadı.

## v1.0.0 — 2026-10-20

- Repository: public; Apache-2.0.
- Release: https://github.com/mustafamertakceylan/Autocad-MCP/releases/tag/v1.0.0
- Source/tag commit: `24c544b13f332f7abb35c6ec8141b56dd7240725`.
- Profile: `unsigned-preview`; Windows x64 / full AutoCAD2027 only.
- Asset: `Autocad-MCP-1.0.0-Windows-x64.zip`,38,756,853bytes, plus SHA256 sidecar.
- SHA256: `5430e17859c141c964ef0667292539cec6054573d58a8740c09c6f2e0dad4ea1`.
- Package ID: `fc0de4878a1209b38db9fcec9cc189e4cdf24a4e41f8656f54dba39062954557`.
- Draft upload downloaded and verified; published asset downloaded again and verified.
- Current acceptance: type check;47 common tests; CTest2/2;338 native CAD;
  23 real reconnect;28 real ZIP installation/rollback/uninstall/native-reopen checks.
- Rollback was verified locally in the package acceptance; no live release rollback was required.
- Node signature Valid; ARX/desktop EXE NotSigned. Strict signed/clean-machine gate remains false.
- User-selected MorseCore-style public preview discloses unsigned binaries and missing
  separate clean-machine acceptance in English/Turkish README and release notes.
- No SDK/host DLL, drawing, pairing secret, certificate or developer agent reports in the package.

Yayımlanan dosyanın byte hash'i yerel paketle eşleşti. Bu sonuç ayrı temiz
Windows, gerçek reboot/başlangıç kaydı, Explorer restart, güvenilir imza,
canlı Claude veya Mac kabulü değildir. Faz6'nın bu kapıları açıktır.
