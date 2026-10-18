# Current tool contract

Discover the actual schemas from the MCP server; these notes explain the workflow, not extra tools.

| Tool suffix | Arguments beyond the explicit target | Result to inspect |
|---|---|---|
| acad_list_instances | none | paired instances; connected=false here is not a liveness test |
| acad_get_status | instanceId only | connected, backend, simulation |
| acad_get_capabilities | instanceId; optional documentId+documentEpoch together | operations, limits, authorized outputRoots |
| acad_list_documents | instanceId only | explicit document identity, revision, units, readOnly |
| acad_get_document_info | target | revision, insunits, readOnly, dirty |
| acad_query_entities | WCS, unit, filter, limit; optional projection/cursor | bounded items and revision-bound cursor |
| acad_get_entity | entityRef, WCS, unit, projection | measured entity and revision |
| acad_create_line | mutation fields, start/end | created refs and observedGeometry |
| acad_create_circle | mutation fields, center/radius; normal [0,0,1] | measured radius and center |
| acad_create_box | mutation fields, center/positive size | measured volume and extents |
| acad_move_entities | mutation fields, targets/delta | modified refs and measured result |
| acad_erase_entities | target, operationId, expectedRevision, targets | erased refs, verified |
| acad_get_operation_status | target, original operationId | queued/running/terminal or unknown/null |
| acad_save_copy | target, operationId, expectedRevision, outputRootId, relativePath, overwrite=false | verified output and explicit verification scope |

Target = instanceId + documentId + documentEpoch. Mutation fields = target + operationId + expectedRevision + coordinateSystem=WCS + lengthUnit. EntityRef = documentId + documentEpoch + hexadecimal handle. Erase/save do not take WCS/unit fields.

Units: mm, m, inch, drawing_unit. Physical conversion requires known drawing units. Query projections: handle, type, layer, start, end, center, radius, size, extents, volume; absent fields are listed under unavailableFields. Limits: 100 mutation targets, 1000 query items, bounded scan/cursors. Match the query exactly when continuing its cursor; any edit can invalidate it.

`applied=false` is evidence of no application only for the recorded request. `verified=false, applied=true` means a change occurred and verification failed. `partial` is not rollback. `unknown, applied=null` requires reconciliation. Failed operation_status transport/auth cannot establish the original mutation's effect. A readOnly flag on a tool does not grant access by itself.
