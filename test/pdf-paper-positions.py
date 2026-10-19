"""Read-only PDF acceptance for plotting-windows.ts outputs.

Run with a Python environment containing pypdfium2. This verifies actual PDF
glyph positions, independently of the plugin's plot-setting metadata.
"""
import json
import pathlib
import sys

import pypdfium2 as pdfium


def markers(path):
    pdf = pdfium.PdfDocument(str(path))
    assert len(pdf) == 1, "Exactly one paper sheet required"
    page = pdf[0]
    width, height = page.get_size()
    assert abs(width * 25.4 / 72 - 297) < 0.2
    assert abs(height * 25.4 / 72 - 210) < 0.2
    text_page = page.get_textpage()
    content = text_page.get_text_range()
    rotation = page.get_rotation()
    _, _, unrotated_width, unrotated_height = page.get_mediabox()
    def display_box(box):
        left, bottom, right, top = box
        if rotation == 90:
            return [bottom, unrotated_width - right, top, unrotated_width - left]
        if rotation == 180:
            return [unrotated_width - right, unrotated_height - top,
                    unrotated_width - left, unrotated_height - bottom]
        if rotation == 270:
            return [unrotated_height - top, left, unrotated_height - bottom, right]
        return list(box)
    result = {}
    for name in ["MCP_TL", "MCP_TR", "MCP_BL", "MCP_BR"]:
        assert content.count(name) == 1, f"Missing/duplicate corner marker: {name}"
        start = content.index(name)
        boxes = [display_box(text_page.get_charbox(i)) for i in range(start, start + len(name))]
        result[name] = [min(b[0] for b in boxes), min(b[1] for b in boxes),
                        max(b[2] for b in boxes), max(b[3] for b in boxes)]
    text_page.close()
    page.close()
    pdf.close()
    return result


folder = pathlib.Path(sys.argv[1]).resolve()
full = markers(folder / "mechanical-a4.pdf")
standard = markers(folder / "mechanical-standard-a4.pdf")
rotated = markers(folder / "mechanical-rotated-a4.pdf")
checks = []
for name, box in full.items():
    # Standard-PC3 rounding is sub-point; a printable-origin shift is tens
    # of points. 0.75pt allows driver precision, while detecting the old bug.
    delta = max(abs(a - b) for a, b in zip(box, standard[name]))
    assert delta < 0.75, f"Printable margin displaced {name}: {delta}pt"
    checks.append({"name": name, "maxDifferencePt": delta, "passed": True})
    rotated_delta = max(abs(a - b) for a, b in zip(box, rotated[name]))
    assert rotated_delta < 0.75, f"Rotated printable margin displaced {name}: {rotated_delta}pt"
    checks.append({"name": name + "_rotated", "maxDifferencePt": rotated_delta, "passed": True})
assert abs((full["MCP_TR"][0] - full["MCP_TL"][0]) * 25.4 / 72 - 190) < 0.1
assert abs((full["MCP_TL"][1] - full["MCP_BL"][1]) * 25.4 / 72 - 142) < 0.1
report = {"passed": True, "method": "PDFium glyph coordinates in actual PDFs",
          "checks": checks, "horizontalSpacingMm": 190, "verticalSpacingMm": 142,
          "fullBleed": full, "standard": standard, "rotated": rotated}
(folder / "pdf-paper-positions.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "cornerMarkers": 4, "scale": "1:1", "report": str(folder / "pdf-paper-positions.json")}))
