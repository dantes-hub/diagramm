import type { Edge, Node, Position } from "@xyflow/react";

export type DiagramKind = "flowchart" | "swimlane";
export type StepType = "start" | "task" | "decision" | "end";
export type ConfidenceLevel = "high" | "medium" | "low";
export type DocumentType = "pdf" | "text";

export type BpmnNodeType =
  | "start_event"
  | "task"
  | "exclusive_gateway"
  | "end_event";

export type BpmnFlowType = "sequence_flow";
export type BpmnArtifactType = "text_annotation";

export interface SourceFragment {
  ref: string;
  fileName: string;
  text: string;
}

export interface Actor {
  id: string;
  name: string;
  type: "person" | "department" | "system" | "unknown";
}

export interface ProcessStep {
  id: string;
  actorId: string;
  action: string;
  type: StepType;
  sourceRef: string;
  confidence: ConfidenceLevel;
  branchLabel: string;
  branchParentId: string;
  branchTerminal: boolean;
  mergeTargetId: string;
}

export interface ProcessEdge {
  from: string;
  to: string;
  label: string;
}

export interface ExtractionResult {
  processName: string;
  summary: string;
  actors: Actor[];
  steps: ProcessStep[];
  edges: ProcessEdge[];
  warnings: string[];
  sourceFragments: SourceFragment[];
}

export interface BpmnProcessMeta {
  id: string;
  name: string;
  purpose: string;
  diagramKind: DiagramKind;
}

export interface BpmnParticipant {
  id: string;
  name: string;
}

export interface BpmnLane {
  id: string;
  participantId: string;
  actorId: string;
  name: string;
}

export interface BpmnNode {
  id: string;
  type: BpmnNodeType;
  laneId: string;
  actorId: string;
  label: string;
  sourceRef: string;
  confidence: ConfidenceLevel;
  branchLabel: string;
  branchParentId: string;
  branchTerminal: boolean;
  mergeTargetId: string;
}

export interface BpmnFlow {
  id: string;
  type: BpmnFlowType;
  sourceId: string;
  targetId: string;
  label: string;
}

export interface BpmnArtifact {
  id: string;
  type: BpmnArtifactType;
  text: string;
  sourceRef?: string;
  attachedToNodeId?: string;
}

export interface CanonicalProcessModel {
  version: "1.0";
  process: BpmnProcessMeta;
  participants: BpmnParticipant[];
  lanes: BpmnLane[];
  nodes: BpmnNode[];
  flows: BpmnFlow[];
  artifacts: BpmnArtifact[];
  warnings: string[];
}

export interface ProcessAnalysis {
  version: "1.0";
  extraction: ExtractionResult;
  model: CanonicalProcessModel;
}

export interface DiagramNodeData extends Record<string, unknown> {
  label: string;
  actorName: string;
  type: StepType;
  bpmnType: BpmnNodeType;
  sourceRef: string;
  sourceText: string;
  confidence: ConfidenceLevel;
}

export type DiagramNode = Node<DiagramNodeData> & {
  sourcePosition?: Position;
  targetPosition?: Position;
};

export type DiagramEdge = Edge;

export interface DiagramPayload {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  lanes: Array<{ actorId: string; actorName: string; laneId: string }>;
}

export interface ProcessRecord {
  id: string;
  createdBy: string;
  title: string;
  description: string;
  documentName: string;
  documentText: string;
  documentType: DocumentType;
  diagramKind: DiagramKind;
  status: "draft" | "review" | "ready";
  extraction: ExtractionResult | null;
  model: CanonicalProcessModel | null;
  diagram: DiagramPayload | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcessInput {
  title: string;
  description: string;
  documentName: string;
  documentText: string;
  documentType: DocumentType;
  diagramKind: DiagramKind;
  sourceFragments?: SourceFragment[];
  storageUrl?: string | null;
}
