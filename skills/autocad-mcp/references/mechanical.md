# Mechanical drafting and modeling

Use actual capabilities from the selected plugin; the Windows development catalog has 60 tools. Claude has not been live tested. Mac, surfaces/meshes, sheet-metal unfolding, gear/spring design and manufacturing certification remain outside the verified subset.

## ISO drawing profile

Start a new ISO mechanical drawing with acad_setup_drawing_standard (standard=ISO). Choose lineGroup from the sheet size and density of detail (thick/thin pairs 0.25/0.13 up to 1.0/0.5), lettering height h (1.8-20 mm), decimal separator and precision; viewScale is the intended paper:model ratio so lettering and arrows have the right paper size. It creates PREFIX-VISIBLE (thick 01.2), THIN, HIDDEN (02.1), CENTER and CUTTING-PLANE (04.1), PHANTOM (05.1), DIMENSION, HATCH, TEXT and SYMBOL layers, ISO linetypes in paper millimetres, an isocp.shx lettering style and PREFIX-ISO129 dimension style, and sets PSLTSCALE=1. Put each entity on the layer of its line type; do not override layer lineweights per entity. Dimension proportions follow AutoCAD's ISO-25 style and the profile reports verification=pending_full_text: say so instead of claiming ISO certification. Existing names are never overwritten; choose another prefix if needed.

Use acad_create_leader for notes and symbol attachments. ISO practice: arrowhead where the leader ends on an outline, dot where it ends inside an outline, no terminator where it ends on a dimension line. The first vertex is the terminator point; the last vertex starts the horizontal reference line. Text placement "above" puts the note on the reference line. Block content (including future generated symbol blocks) connects at its insertion point at the end of the reference line.

## Written precision and applicable tolerances

Preserve the written number of decimals and trailing zeros. The nominal value of 11 and 11,00 is the same; the decimal count alone establishes neither a tighter tolerance nor a zero tolerance. Determine the applicable dimensional tolerance from an explicit dimension tolerance or fit designation, the applicable title-block/general notes, or the referenced standard and class. Use decimal-place-based tolerance tables only when the drawing explicitly defines them. Do not infer that a general ISO tolerance requires precision 0. If the applicable tolerance or verified fit data is missing or ambiguous, ask for it before declaring manufacturing acceptance.

For example, an explicitly specified 11,00 ±0,10 has nominal value 11 and tolerance ±0,10; its two displayed decimals do not make that tolerance zero. If a title block explicitly assigns different tolerances to whole-number and two-decimal dimensions, apply that mapping to 11 and 11,00 respectively. Without such a rule, do not invent ±0,01 from the latter's spelling.

Set each dimension's precision from the requested display and verify its actual measurement independently. Trailing zeros remain shown, and deviations can use their own tolerancePrecision. In hole callouts and fit deviations, pass values as written strings ("6,60", "11,00", "+0,021", "0"); reproduce them exactly, with only the decimal separator following the drawing. These formatting settings do not calculate or change the applicable tolerance.

Sources: [AutoCAD display precision](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-LT/files/GUID-8F311450-A848-4682-81A5-D0EC6E3499C9.htm), [ISO general-tolerance scope](https://www.iso.org/obp/ui/?_escaped_fragment_=iso%3Astd%3A7748%3Aen). Use the edition referenced by the drawing; these links do not supply fit tables or certify compliance.

## Dimension kinds and ISO notation

acad_create_dimension also creates angular (two lines), angular3 (center + two points), arc_length and ordinate dimensions. Optional notation adds ISO 129-1/286/14405 symbols around the live measured value without replacing it: count (4×), prefix (Ø, R, SØ, SR, square, t=), theoretical_exact (framed TED), reference (parentheses), not_to_scale (underlined), fit class (H7, g6, H7/g6) with optional written fitDeviations, limits (upper/lower limit sizes from tolerance), singleLimit min/max, sizeModifiers (Ⓔ, LP, GG, …) and suppress for half dimensions. Diameter and radius dimensions already show Ø/R; only the spherical S is added. Use acad_create_dimension_series for chain or baseline dimensioning so all members share one line or step evenly.

acad_create_hole_callout writes an ISO 15786-style leader note: 4× Ø6,6 with optional hole class and ×depth, counterbore ⌴Ø11×6,8, countersink ⌵Ø12×90°, or a metric thread such as M10-6H×15 / Ø8,5×20. Pass circle to have the noted diameter checked against the real hole; a mismatch is rejected. The callout layout is pending verification against the full ISO 15786 text.

## Geometrical tolerancing (ISO 1101)

Use acad_create_feature_control_frame with rows. Each row is one frame: a characteristic (straightness, flatness, roundness, cylindricity, line_profile, surface_profile, parallelism, perpendicularity, angularity, position, concentricity/coaxiality, symmetry, circular_runout, total_runout), a tolerance zone and up to three datum compartments. Write the tolerance value exactly as the user stated it ("0,05", "0,050"). Zone options: shape Ø/SØ, combined CZ/SZ/CZR/SIM, UZ offset, OZ/VA, derived feature Ⓐ, projected zone Ⓟ with its length, MMR Ⓜ or LMR Ⓛ with reciprocity Ⓡ, free state Ⓕ. A datum compartment is a letter, a common datum (letters A and B give A-B) and optional ISO 5459 modifiers ([CF], [PL], …) or Ⓜ/Ⓛ. Form tolerances take no datum; orientation, coaxiality/concentricity, symmetry and runout require one. Up to three rows stack independent requirements on the same feature. adjacent adds n×, UF, between A↔B or ACS/LD/MD/PD above the frame.

Attach the frame with leader: the first vertex lies on the toleranced feature and AutoCAD joins the frame end facing the last bend (a native LEADER associated with the frame). For a surface, use attachment surface with the outline curve, keeping the arrow clearly away from the dimension line. For an axis or median plane, use attachment axis with the linear/aligned dimension of that feature: the arrow must sit in line with the dimension line and the first segment must run along it; both are checked. allAround draws the all-around (one circle) or all-over (two circles) symbol on the bend.

Use acad_create_datum_feature for every datum letter used in a frame: vertices[0] is the datum triangle on the feature (filled or open), vertices[1] the letter frame. The same surface/axis checks apply; for an axis datum the triangle sits on the extension line in line with the dimension line and the leader runs along it. The leader and triangle are an MLEADER and the letter frame is a separate signed block insert: move or erase them together.

Add acad_create_general_specification near the title block only for references the user chose: ISO 8015, ISO 2768-1 class, ISO 14405 Ⓔ, ISO 22081 general size ±deviation, ISO 22081 general geometrical specification (surface profile frame with datums) and ISO 10579-NR with its restraint condition. Never add a general tolerance by default.

Ⓣ (tangent plane), intersection/orientation/direction/collection plane indicators and datum targets are not implemented: no native glyph exists for Ⓣ and the indicator shapes need the full ISO text. Modifier order, adjacent placement and symbol proportions are pending verification against the full texts; say so, and do not present a frame as engineering approval.

## Sheet, title block and section views

Draw the sheet with acad_create_drawing_sheet (ISO 5457 frame, 20 mm filing margin, centring marks) and put acad_create_title_block (layout education_122x31) on its titleBlockCorner. Fill only the fields the user gave: title, institution, department, scale, checkedBy, programme, number, name, idNumber, date. Leave every other field empty; never invent a name, ID, drawing number, checker or date. A value wider than its cell is rejected, so shorten it or lower textHeight. Choose projectionSymbol from the drawing's projection method; ISO E (first angle) puts the top view below and the left view right of the front view. SHX lettering such as isocp.shx has no Turkish İ, ı, Ş or Ğ, so use an arial.ttf text style for those words. Lay out the views in modelspace at the sheet scale and keep them clear of the title block.

For a section view, indicate the cutting plane where it appears as a line. Draw thick short ends, a bare acad_create_leader arrow at each end pointing in the viewing direction, and the letter beside each arrow. Label the view "A-A" above it. Hatch every cut face of one part with the same ANSI31 angle and spacing. Do not hatch ribs, webs, spokes, shafts or fasteners cut lengthwise; draw their outline only (ISO 128-50). Show visible edges behind the cutting plane and leave out hidden lines in sections. Dimension a hidden feature only when no view shows it as a visible edge.

For a technical PDF create the layout with plotStyle monochrome.ctb, so the layer display colours print black. Render the PDF and look at it before reporting.

To cross-check complex views, model the part as a solid. Use profilePlane XZ for front-view profiles such as an inclined arm, and for holes along Y. Then compare acad_section_solid region areas with the hatched section regions of the 2D drawing.

## Measured drawings

Create layers and simple center/hidden linetypes before geometry. Signed dash lengths use explicit units. TEXT/MTEXT are plain text; executable fields and formatting injection are rejected. A lineweight of 25 means 0.25 mm. Named text fonts are limited to arial.ttf/txt.shx; installed font availability can differ.

Use real DIMENSION objects: linear/aligned, diameter (opposite chord endpoints), radius (center and chord), angular, arc length or ordinate. Actual measurement is never replaced by a claimed number. Explicit lower/upper tolerance deviations and user-given fit classes are supported; do not infer an ISO fit class, surface finish, thread, weld or tolerances from an image. Dimensions are non-associative: after editing the part, recheck/recreate its definition points.

A native FCF records the chosen annotation; it does not validate engineering selection or certify ISO compliance. FCF visual extents are unavailable because an unrendered side database does not provide stable rendered bounds; text, position, height, scale and style are verified instead. Native surface-texture and weld-symbol tools are not implemented yet. Explicit user notes can be plain MTEXT and must be described as notes.

## Repeated parts and BOM

Define local named blocks from explicit planar curves/TEXT/MTEXT. Definition originals are preserved; basePoint becomes the block origin and attribute positions are block-local. Insertion uses uniform scale and Z rotation. Attributes follow native transforms once. Unknown attribute tags reject the entire change.

Read BOM quantities from explicitly selected INSERTs and explicit grouping attributes. Block name is also part of the grouping key. Missing keys fail; nested contents are not expanded and material/standard part data is never inferred. Use a real TABLE for returned rows with explicit column/row/text dimensions. An existing user-specified block can serve as a title block; this is not an included ISO/DIN parts library.

## Real solids and identity

Extrude/revolve one closed XY circle/polyline. Height, axes, angle and profile preservation are explicit. A zero-thickness contour is not a solid. Boolean operations and drilling compute on detached copies before replacing the target atomically. Use the returned NEW entityRef; the old target is erased. Boolean tools are preserved unless explicitly disabled.

Drilling uses explicit entry centers, diameter, total depth and +Z/-Z direction. Counterbore/countersink entry diameter/depth must be provided. A bolt circle can be computed from the user's explicit center/radius/count/start angle and passed as centers. Every hole must remove material or the whole operation rolls back. No thread geometry is generated. A shaft requires explicit segment lengths/diameters; sizes are not persistent parametric constraints. Keyways/reliefs can be explicit solid cutters and booleans, with every dimension supplied by the user.

Read native volume, surface area, centroid and bounds. Mass is reported only for user-provided densityKgM3 and known drawing units. Volume scales by length^3, area by length^2. Do not assume steel/alloy density or treat mass properties as FEA. Section_solid creates an actual planar REGION without altering the source. Hatch takes an outer circle/polyline followed by explicit holes; it is non-associative and area is checked.

## Camera, paper and PDF

Camera tools require the modelspace tab. Set center/direction/visible height; width follows the current viewport aspect ratio. Layout paperCenter/paperSize are always millimetres; modelCenter uses lengthUnit. Viewport scale is paper-mm/model-mm: 1 is 1:1, 0.5 is 1:2, independent of drawing INSUNITS. Choose an installed allowlisted PDF device and its exact canonical media name. Native validation may not silently change that name.

Paper coordinates refer to the physical sheet corner; the native layout compensates the device's printable origin. list_layouts reports plotMarginsMm in left/bottom/right/top order, plotOriginMm and plotCentered. A standard landscape A4 device can have 17mm top/bottom margins: keep content inside those margins or choose an installed full-bleed A4 media for a 10mm border. A viewport fitting the physical sheet does not guarantee that every device can print its edges. New viewport frames use the reserved _MCP_VIEWPORT_NONPLOT layer (plottable=false); incompatible existing properties reject layout creation rather than modifying that layer.

Export_pdf writes only a NEW flat .pdf name in the authorized output root, then restores the prior layout. A PDF header and native success do not prove readable content; inspect/render the PDF separately. Save_copy also verifies supported paper/layout viewport data and local layer/style/block metadata, not every possible DWG feature. Existing files and source drawing bytes must remain untouched.

## Xrefs and controlled automation

Only explicitly staged DWGs in session-input can be attached. No arbitrary path or URL is accepted. The initial preflight rejects nested xrefs, fields, custom entities, external image/underlay/data-link dependencies and font paths. Reload/bind revalidate the staged file; all direct modelspace references must be selected. Detach removes those references, never the source file. Dependency-managed symbols are marked dependent and not treated as local metadata. Xref query extents are unavailable; only the host reference transform/attributes are verified. An unbound DWG still depends on the staged file; bind it for a self-contained output. Do not describe xref attachment as copying all referenced geometry into the host.

Run_batch is a fixed create-only workflow (line/circle/box/polyline), max24 steps. Every constituent tool must be granted. It has one operationId, one final revision and atomic rollback. It cannot run arbitrary scripts, commands, LISP or nested batches. After unknown/partial/verification failure, reconcile the original operation before dependent writes; never blindly submit a fresh ID.
