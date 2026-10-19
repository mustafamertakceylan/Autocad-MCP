# Mechanical drafting and modeling

Use actual capabilities from the selected plugin; the Windows development catalog has 52 tools. Claude has not been live tested. Mac, surfaces/meshes, sheet-metal unfolding, gear/spring design and manufacturing certification remain outside the verified subset.

## Measured drawings

Create layers and simple center/hidden linetypes before geometry. Signed dash lengths use explicit units. TEXT/MTEXT are plain text; executable fields and formatting injection are rejected. A lineweight of 25 means 0.25 mm. Named text fonts are limited to arial.ttf/txt.shx; installed font availability can differ.

Use real DIMENSION objects: linear/aligned, diameter (opposite chord endpoints) or radius (center and chord). Actual measurement is never replaced by a claimed number. Explicit lower/upper tolerance deviations are supported; do not infer an ISO fit class, surface finish, thread, weld or tolerances from an image. Dimensions are non-associative: after editing the part, recheck/recreate its definition points.

A native FCF accepts an explicit characteristic, tolerance, optional diameter zone/MMC/LMC and datum labels. It records the chosen annotation; it does not validate engineering selection or certify ISO compliance. FCF visual extents are unavailable because an unrendered side database does not provide stable rendered bounds; text, position, height, scale and style are verified instead. Native roughness/weld-symbol tools are not implemented. Explicit user notes can be plain MTEXT and must be described as notes.

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
