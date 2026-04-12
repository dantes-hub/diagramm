# BPMN V1 Subset

Diagramm uses a BPMN-compatible canonical model under the React Flow UI. V1 intentionally supports only a small subset so the product stays understandable to users and stable for export.

## Supported Elements

### Node types
- `start_event`
- `task`
- `exclusive_gateway`
- `end_event`

### Flow types
- `sequence_flow`

### Structural elements
- `participant` (single pool in v1)
- `lanes`

### Artifact types
- `text_annotation`

## Invalid Or Unsupported Combinations

These are outside the V1 subset and should be rejected or downgraded to warnings:

- multiple participants/pools in one exported process
- message flows
- parallel gateways
- intermediate events
- subprocesses
- boundary events
- data objects
- tasks or events without a mapped lane
- flows that reference missing nodes
- start events with incoming flows
- end events with outgoing flows
- exclusive gateways with fewer than 2 outgoing flows

## Export Assumptions

V1 BPMN export assumes:

- one BPMN process per diagram
- one participant/pool per diagram
- lanes represent actor ownership
- node positions are layout hints only
- sequence flows are the only semantic connection type
- text annotations are optional and non-executable
- React Flow presentation details do not affect BPMN semantics

## Mapping Rules

### UI -> canonical model
- `start` -> `start_event`
- `task` -> `task`
- `decision` -> `exclusive_gateway`
- `end` -> `end_event`

### Canonical model -> UI
- lanes render as swimlane groups
- node types render as start/task/decision/end cards
- sequence flows render as editor edges
- text annotations remain optional and are not yet exposed fully in the UI

## Validation Rules

The canonical model validator currently enforces or warns on:

- exactly one start event
- at least one end event
- valid lane and participant references
- valid node references for all flows
- no incoming flows to start events
- no outgoing flows from end events
- labeled outgoing flows for exclusive gateways where possible

This document defines the contract for future BPMN XML export.
