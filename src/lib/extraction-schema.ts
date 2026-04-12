import { z } from "zod";

export const actorSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: z.enum(["person", "department", "system", "unknown"])
});

export const stepSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string().min(1),
  type: z.enum(["start", "task", "decision", "end"]),
  sourceRef: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  branchLabel: z.string(),
  branchParentId: z.string(),
  branchTerminal: z.boolean(),
  mergeTargetId: z.string()
});

export const edgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string()
});

export const sourceFragmentSchema = z.object({
  ref: z.string(),
  fileName: z.string(),
  text: z.string()
});

export const extractionSchema = z.object({
  processName: z.string().min(1),
  summary: z.string(),
  actors: z.array(actorSchema),
  steps: z.array(stepSchema),
  edges: z.array(edgeSchema),
  warnings: z.array(z.string()),
  sourceFragments: z.array(sourceFragmentSchema)
});

export const bpmnProcessMetaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  purpose: z.string(),
  diagramKind: z.enum(["flowchart", "swimlane"])
});

export const bpmnParticipantSchema = z.object({
  id: z.string(),
  name: z.string().min(1)
});

export const bpmnLaneSchema = z.object({
  id: z.string(),
  participantId: z.string(),
  actorId: z.string(),
  name: z.string().min(1)
});

export const bpmnNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["start_event", "task", "exclusive_gateway", "end_event"]),
  laneId: z.string(),
  actorId: z.string(),
  label: z.string().min(1),
  sourceRef: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  branchLabel: z.string(),
  branchParentId: z.string(),
  branchTerminal: z.boolean(),
  mergeTargetId: z.string()
});

export const bpmnFlowSchema = z.object({
  id: z.string(),
  type: z.literal("sequence_flow"),
  sourceId: z.string(),
  targetId: z.string(),
  label: z.string()
});

export const bpmnArtifactSchema = z.object({
  id: z.string(),
  type: z.literal("text_annotation"),
  text: z.string(),
  sourceRef: z.string().optional(),
  attachedToNodeId: z.string().optional()
});

export const canonicalProcessModelSchema = z.object({
  version: z.literal("1.0"),
  process: bpmnProcessMetaSchema,
  participants: z.array(bpmnParticipantSchema),
  lanes: z.array(bpmnLaneSchema),
  nodes: z.array(bpmnNodeSchema),
  flows: z.array(bpmnFlowSchema),
  artifacts: z.array(bpmnArtifactSchema),
  warnings: z.array(z.string())
});

export const processAnalysisSchema = z.object({
  version: z.literal("1.0"),
  extraction: extractionSchema,
  model: canonicalProcessModelSchema
});

export const diagramNodeDataSchema = z.object({
  label: z.string(),
  actorName: z.string(),
  type: z.enum(["start", "task", "decision", "end"]),
  bpmnType: z.enum(["start_event", "task", "exclusive_gateway", "end_event"]),
  sourceRef: z.string(),
  sourceText: z.string(),
  confidence: z.enum(["high", "medium", "low"])
});

export const diagramNodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number()
  }),
  data: diagramNodeDataSchema,
  sourcePosition: z.enum(["left", "right", "top", "bottom"]).optional(),
  targetPosition: z.enum(["left", "right", "top", "bottom"]).optional(),
  parentId: z.string().optional(),
  extent: z.literal("parent").optional(),
  style: z.record(z.union([z.string(), z.number()])).optional(),
  draggable: z.boolean().optional(),
  selectable: z.boolean().optional()
});

export const diagramEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  type: z.string().optional()
});

export const diagramPayloadSchema = z.object({
  nodes: z.array(diagramNodeSchema),
  edges: z.array(diagramEdgeSchema),
  lanes: z.array(
    z.object({
      actorId: z.string(),
      actorName: z.string(),
      laneId: z.string()
    })
  )
});

export const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    processName: { type: "string" },
    summary: { type: "string" },
    actors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["person", "department", "system", "unknown"]
          }
        },
        required: ["id", "name", "type"]
      }
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          actorId: { type: "string" },
          action: { type: "string" },
          type: {
            type: "string",
            enum: ["start", "task", "decision", "end"]
          },
          sourceRef: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          branchLabel: { type: "string" },
          branchParentId: { type: "string" },
          branchTerminal: { type: "boolean" },
          mergeTargetId: { type: "string" }
        },
        required: [
          "id",
          "actorId",
          "action",
          "type",
          "sourceRef",
          "confidence",
          "branchLabel",
          "branchParentId",
          "branchTerminal",
          "mergeTargetId"
        ]
      }
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" }
        },
        required: ["from", "to", "label"]
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    sourceFragments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ref: { type: "string" },
          fileName: { type: "string" },
          text: { type: "string" }
        },
        required: ["ref", "fileName", "text"]
      }
    }
  },
  required: ["processName", "summary", "actors", "steps", "edges", "warnings", "sourceFragments"]
} as const;
