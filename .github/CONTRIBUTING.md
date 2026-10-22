# Contributing / Katkıda Bulunma

**English** · [Türkçe](#türkçe)

## English

Read the [README](../README.md), [Code of Conduct](CODE_OF_CONDUCT.md) and
[development guide](../docs/GELISTIRME.md). English and Turkish issue/PR
descriptions are welcome.

### Issues and proposals

Use the issue forms for reproducible bugs, drawing/output problems or feature
requests. Check existing issues and the [plan](../docs/PLAN.md) before proposing
a large change. Vulnerabilities follow [SECURITY.md](SECURITY.md).

Include the release/commit, OS, full AutoCAD version, MCP client/version,
reproduction steps and expected/actual behavior. Use minimal synthetic drawings.
Remove secrets, personal paths and customer data from logs and screenshots;
never upload `pairing.json` or a private drawing.

### Development and verification

Shared TypeScript development requires Node.js 24 or newer:

```powershell
npm ci --ignore-scripts
npm run check
npm test
```

Common tests use local test backends; they do not establish real AutoCAD support.
Native work additionally needs the separately licensed AutoCAD/ObjectARX SDK,
CMake and suitable C++ tools. Follow the development guide for native builds and
explicitly opted-in, isolated CAD tests. Do not weaken AutoCAD trust settings or
use personal drawings to make a test pass.

For a tool/schema change, update validation, native handling, readback, relevant
tests and the generated [catalog](../docs/TOOL_CATALOG.json):

```powershell
npm run catalog
```

Verify drawing changes with separately saved DWGs and rendered PDFs where
relevant: geometry, real dimensions, units, layers, lineweights, linetypes, plot
styles, layout and title block. Preserve written decimals; determine tolerances
from the drawing's explicit requirements. State tests not run and platform limits.

### Pull requests

- Keep a PR focused; explain the problem, resulting behavior and verification.
- Follow Conventional Commits; the existing history uses Turkish summaries.
- Verify significant AI-assisted contributions yourself and describe limitations.
- Include no SDK binaries, build outputs, credentials, pairing data or private CAD files.
- Update affected documentation and the unreleased changelog when behavior changes.
- Use the PR template. Do not change published release assets or tags.

Source contributions use [Apache-2.0](../LICENSE). Preserve third-party licenses
and notices; do not copy proprietary standards tables or SDK content.

## Türkçe

Önce [README](../README.tr.md), [davranış kuralları](CODE_OF_CONDUCT.md) ve
[geliştirme rehberini](../docs/GELISTIRME.md) okuyun. Issue ve PR açıklamaları
Türkçe veya İngilizce olabilir.

### Issue ve öneriler

Hata, çizim/çıktı sorunu ve özellik önerisi için issue formlarını kullanın.
Büyük değişiklikten önce mevcut issue'ları ve [planı](../docs/PLAN.md) inceleyin.
Güvenlik açıklarını [güvenlik politikasına](SECURITY.md) göre bildirin.

Sürüm/commit, işletim sistemi, tam AutoCAD sürümü, MCP istemcisi/sürümü,
tekrarlama adımları ve beklenen/gerçek sonucu yazın. En küçük sentetik çizimi
kullanın. Günlük ve görsellerden sırları, kişisel yolları ve müşteri verilerini
çıkarın; `pairing.json` veya özel çizim yüklemeyin.

### Geliştirme ve doğrulama

Ortak kod için Node.js 24+ ve yukarıdaki `npm ci --ignore-scripts`,
`npm run check`, `npm test` komutlarını kullanın. Ortak testler yerel test
backend'leri kullanır; gerçek AutoCAD desteği kanıtı değildir. Native geliştirme
için ayrı lisanslanan AutoCAD/ObjectARX SDK, CMake ve uygun C++ araçları gerekir.
Native derleme ve açıkça etkinleştirilen izole CAD testleri için geliştirme
rehberini izleyin. Kişisel çizim kullanmayın, AutoCAD güvenlik ayarlarını gevşetmeyin.

Araç/şema değişiminde doğrulama, native uygulama, geri okuma ve ilgili testleri
birlikte güncelleyin; `npm run catalog` ile kataloğu yeniden üretin. Gerektiğinde
ayrı DWG ve işlenmiş PDF üzerinden geometri, gerçek ölçü, birim, katman, çizgi
kalınlığı/tipi, plot stili, yerleşim ve anteti denetleyin. Yazılan basamakları
koruyun; toleransı çizimin açık gerekliliklerinden belirleyin. Çalıştırılmayan
testleri ve platform sınırlarını yazın.

### Pull request

- Tek konuya odaklanın; sorunu, sonucu ve doğrulamayı açıklayın.
- Conventional Commits kullanın; mevcut geçmişte özetler Türkçedir.
- Önemli AI katkılarını kendiniz doğrulayın ve sınırlarını açıklayın.
- SDK ikilisi, derleme çıktısı, sır, eşleştirme verisi veya özel CAD dosyası eklemeyin.
- Davranış değişiyorsa ilgili belgeleri ve yayımlanmamış sürüm notunu güncelleyin.
- PR şablonunu kullanın; yayımlanmış paketleri ve tag'leri değiştirmeyin.

Kaynak katkıları [Apache-2.0](../LICENSE) kapsamında sunulur. Üçüncü taraf
lisans/bildirimlerini koruyun; ücretli standart tablolarını veya SDK içeriğini kopyalamayın.
