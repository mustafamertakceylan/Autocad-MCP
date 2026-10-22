---
name: autocad-mcp
description: Inspect, create, and edit AutoCAD drawings through the local Autocad MCP tools, including measured technical-drawing references. Use when AutoCAD is explicitly targeted; check actual capabilities before promising a CAD operation.
---

Use the configured `autocad` MCP server. Client prefixes differ (for example `autocad_acad_*` or `mcp__autocad__acad_*`); identify tools by their `acad_*` suffix. Read [the tool contract](references/tools.md) when choosing arguments or interpreting results.

## Establish the target

Call list_instances, get_status, get_capabilities, and list_documents. Require a real objectarx backend for a real CAD result. Resolve an explicit instanceId, documentId, and documentEpoch; do not select a drawing merely because its tab is active. When there are multiple plausible documents, ask which to use. For an isolated exercise, use only the supplied synthetic target. Never read pairing.json, credentials, or user configuration with filesystem tools; the local MCP process handles pairing.

## Plan and draw

Preserve the decimals the user wrote, including trailing zeros; pass hole callout values and fit deviations as exact written strings. Display precision alone does not define a tolerance: 11 and 11,00 have the same nominal value. Determine the applicable tolerance from the dimension, title-block/general notes or the referenced standard and class. Use decimal-place-based tolerances only when the drawing explicitly defines that mapping; if the tolerance is unspecified or ambiguous, ask rather than inventing one. Set each dimension's precision from the requested display without replacing its actual measured value.

For an image, separate readable dimensions from assumptions. Ask about an unreadable dimension, missing unit, or symmetry needed to determine the geometry. Convert confirmed dimensions into explicit WCS coordinates before writing. Do not infer manufacturing tolerances from pixels.

The Windows development catalog covers technical annotations/styles, bounded 2D editing, blocks/attributes, solid modeling and drilling, sections/hatches, BOM/tables, model cameras, scaled paper layouts/PDF, staged xrefs and typed atomic batches. A running older plugin may still expose only the Phase4 subset: trust get_capabilities for that instance. Separate LINEs are not a joined polyline or a solid; a circle is not a drilled hole. Read [mechanical workflows](references/mechanical.md) for dimensions, solid identities, density, paper scale and xref limits. Arbitrary LISP, shell and general AutoCAD commands remain unavailable.

Before each mutation read document_info and use its fresh revision. Specify operationId, target, WCS and lengthUnit as required. Use a new unique operationId for each intended change. Preserve the exact request when checking a previous ID. Only edit or erase entities within the user's authorized scope.

## Verify and save

Check status, applied, verified, and measured geometry; then query the resulting entities independently. Compare endpoints, radius, extent, count, and units against the plan. A succeeded tool call alone does not establish dimensional accuracy.

If a request times out or returns unknown, query operation_status with the original ID. Missing records, restart, or a disconnected endpoint do not prove no effect. Never issue a fresh mutation to blindly replace an unresolved one. For partial results or failed post-commit verification, describe the known effects and stop dependent writes. Cancellation is cooperative; it cannot undo a committed change.

Use save_copy only with a new flat .dwg filename, outputRootId from capabilities, overwrite=false and a fresh revision. Do not rename or overwrite the source. The reply gives a session-relative output; do not invent a filesystem path. Summarize actual measurements, output, and any omitted annotations or untested client/platform.

For clients that cannot read local skill references, the same three fixed public resources are available at `skill://autocad-mcp/autocad-mcp/SKILL.md`, `skill://autocad-mcp/autocad-mcp/references/tools.md` and `skill://autocad-mcp/autocad-mcp/references/mechanical.md`. They contain no pairing data; read only the resource needed for the work.
