# AutoCAD MCP contract

The development Windows 2027 plugin exposes 54 tools. A running older plugin can support fewer; get_capabilities is authoritative for the paired instance. The server uses stdio and fixed public skill resources; no HTTP port is required. Strict input schemas are listed by MCP tools/list and exported in docs/TOOL_CATALOG.json. Output schemas are still generic objects; interpret the fields below.

Installed Windows previews pin the native source build identity in both the pairing grant and IPC handshake. VERSION_MISMATCH is terminal before a CAD request is sent: restart AutoCAD with the matching installed plugin, explicitly pair its new grant and restart the MCP client transport. Do not bypass the mismatch by editing a pairing file or retrying mutations. Source-checkout development servers can still use historical protocol-compatible test builds; they are not installed distribution acceptance.

## Common arguments and results

Select instanceId/documentId/documentEpoch explicitly. Read document_info immediately before a mutation, then provide expectedRevision and a unique operationId. Spatial tools require coordinateSystem=WCS and lengthUnit=mm/m/inch/drawing_unit. Angles are radians except the layout rotation enum. Unknown INSUNITS cannot be converted into a physical unit; mass also requires known drawing units.

Use actual JSON numbers/arrays/booleans, never stringified numeric arguments. The public tool metadata uses homogeneous arrays and typed object properties for client compatibility. Variant fields can appear optional in discovery: include only fields for the chosen kind/mode/tool; branch-specific required/forbidden fields remain strictly validated at execution. There is no string-to-number/JSON coercion. Reconnect the client MCP transport after a server update to refresh cached tool definitions.

Entity references are document/epoch/handle triples, not indices or active selections. Cross-document, duplicate, erased and missing references fail. Only explicit authorized entities may be edited. Most entity tools require modelspace; layout tools have their own paper viewport contract.

Successful mutations report status=succeeded, applied=true, verified=true. Geometry mutations provide created/modified/erased references and observedGeometry.items. Metadata tools can instead provide createdLayers/createdStyles/createdBlocks/createdLayouts. Read results back independently. New solid references returned by boolean/drill replace erased old targets. DIMENSION.dimensionScale is its DIMLFAC measurement multiplier; FCF.dimensionScale is its DIMSCALE renderer scale. Style metadata sizes are drawing units.

A native rejection before commit/confirmed rollback has applied=false. Verification failure after commit has applied=true and verified=false. Timeout, cancellation after send, absent operation records or process death can leave applied=null/status=unknown. Query operation_status with the ORIGINAL operationId; it may return the immutable terminal result or unknown. Never retry a mutation with a new ID to hide an unresolved effect. Job records are pairing-lifetime memory; restarting loses them.

## Discovery and read tools

- acad_list_instances, acad_get_status, acad_get_capabilities, acad_list_documents, acad_get_document_info.
- acad_query_entities: bounded filter/projection/cursor; cursor is bound to target, revision and exact request. Unsupported projected fields appear in unavailableFields. Max1000 returned/10000 scanned and a response budget apply.
- acad_get_entity: one explicit reference. Supported types: LINE/CIRCLE/ARC/LWPOLYLINE/3DSOLID/TEXT/MTEXT/DIMENSION/INSERT/HATCH/REGION/TABLE/FCF/MLEADER.
- acad_list_layers, acad_list_styles: bounded metadata; dependent=true denotes external-xref-managed symbols.
- acad_get_block: local named non-layout/non-xref/non-anonymous definition. Max132 definition objects.
- acad_get_bom: explicit INSERTs, max100; group by block name and up to8 explicit attribute tags. Does not expand nested blocks.
- acad_get_mass_properties: native volume/area/centroid/bounds. Optional explicit densityKgM3 adds massKg, never an inferred density.
- acad_get_plot_devices, acad_list_layouts, acad_list_xrefs, acad_get_view: [paper/camera/xref rules](mechanical.md).
- acad_get_operation_status: reconciliation, not a retry or proof of no effect.

## Geometry, editing and mechanical tools

- acad_create_line, acad_create_circle, acad_create_arc, acad_create_polyline, acad_create_box. New circles/arcs/polylines use WCS XY; polylines are straight-segment, max512 vertices. Closing vertex is implicit.
- acad_move_entities, acad_erase_entities: explicit modelspace targets, max100, lock checks and atomic transaction.
- acad_transform_entities: planar curves only; copy/rotate/scale/mirror, linear/circular arrays. Count includes originals, max100 new copies. Mirror can reverse native arc endpoint order while preserving the locus.
- acad_offset_entity: positive offset toward explicit sidePoint, preserves source. Ambiguous/impossible results fail.
- acad_edit_curve: trim retains segment nearest keepPoint and replaces the source; extend accepts LINE only, start/end to nearest forward boundary. Boundaries are preserved.
- acad_corner: exactly2 XY LINEs sharing one endpoint; fillet radius or chamfer distances must fit. Optional trim in the same transaction; no implicit extension.
- acad_create_layer, acad_create_style: create new metadata records, no replacement. Text fonts are arial.ttf/txt.shx; dimension and simple dash linetype styles have explicit sizes.
- acad_create_text, acad_create_mtext, acad_create_dimension: plain text and non-associative measured dimensions; explicit tolerance deviations only. See [mechanical](mechanical.md).
- acad_define_block, acad_insert_block, acad_set_attributes: local planar definitions, uniform insertion, bounded plain attributes. Original definition geometry is preserved.
- acad_extrude, acad_revolve, acad_boolean: native solids from closed profiles; detached modeler computation, atomic replacement.
- acad_drill_holes: max64 explicit cylindrical/counterbore/countersink holes along +/-Z. Every hole must remove material; no thread or standard fastener inference.
- acad_create_shaft: max32 explicit coaxial length/diameter segments along +Z, no persistent design constraints.
- acad_section_solid, acad_create_hatch, acad_create_table, acad_create_feature_control_frame: native REGION/HATCH/TABLE/FCF. No ISO certification or engineering selection is implied.
- acad_setup_drawing_standard: once per drawing, before drafting. Creates prefixed ISO layers/linetypes/lettering/dimension style atomically; any existing name rejects the whole profile. Reports the numeric basis and verification=pending_full_text.
- acad_create_leader: native MLEADER with explicit vertices, terminator arrow/dot/none, optional reference line and none/text/block content. Reads back vertices, terminator, landing, content and contentConnection (the point where content joins the reference line).

## Paper, files and batches

- acad_set_view: modelspace camera center/direction/visible height, width from current viewport aspect; get_view rereads it.
- acad_create_layout: new paper layout, installed allowlisted PDF PC3 and canonical media, locked model viewport. Paper coordinates are mm; viewport.scale=paper-mm/model-mm.
- acad_export_pdf: existing paper layout to NEW flat .pdf under outputRootId; no physical printer or overwrite, restores previous layout. Native result verifies file signature and completion, not rendered readability.
- acad_save_copy: NEW flat .dwg under outputRootId, overwrite=false. Verifies supported modelspace data, local layer/style/named blocks, supported paper/layout viewports and xref declarations. Unbound external file contents, unsupported/custom DWG data and manufacturing correctness are not verified. FCF and xref visual bounds are explicitly unavailable.
- acad_attach_xref: inputRootId=session-input, flat staged .dwg only, 64MiB bound and dependency preflight. No path/URL access. Staged file is pinned read-only during import.
- acad_manage_xref: reload/unload/bind/detach with ALL direct modelspace references selected. Reload/bind revalidate the private staged source. No source file is modified/deleted. Bind makes referenced content local; unbound exports retain file dependencies.
- acad_run_batch: max24 typed create steps; each step tool must also be granted. One operationId, one final revision, atomic rollback. No arbitrary command/LISP/shell/nested batch.

The paired plugin reports authorized root IDs; do not invent filesystem locations. General commands/LISP, surfaces/mesh, advanced manufacturing-symbol catalogs, HTTP, Mac native runtime and clean-device installer acceptance are not implemented by these tools.
