import type { Locale } from "@/lib/i18n";
import type {
  BpmnArtifactType,
  BpmnFlowType,
  BpmnNodeType,
  CanonicalProcessModel
} from "@/types/process";

function msg(locale: Locale, en: string, mn: string) {
  return locale === "mn" ? mn : en;
}

export const supportedBpmnSubset = {
  version: "v1",
  nodeTypes: [
    "start_event",
    "task",
    "exclusive_gateway",
    "end_event"
  ] as const satisfies BpmnNodeType[],
  flowTypes: ["sequence_flow"] as const satisfies BpmnFlowType[],
  artifactTypes: ["text_annotation"] as const satisfies BpmnArtifactType[],
  structuralElements: ["lanes"] as const
};

export const bpmnExportAssumptions = [
  "Exactly one BPMN process is exported per diagram.",
  "All lanes belong to a single participant/pool in v1.",
  "Only sequence flows are exported in v1; message flows are not supported.",
  "Only text annotations are exported as BPMN artifacts in v1.",
  "Node positions are treated as diagram layout hints and not semantic BPMN meaning.",
  "React Flow grouping and styling are UI-only and are mapped to BPMN lanes/tasks/gateways/events."
] as const;

export interface CanonicalModelValidationResult {
  issues: string[];
  warnings: string[];
}

export function validateCanonicalProcessModel(
  model: CanonicalProcessModel,
  locale: Locale = "en"
): CanonicalModelValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  const participantIds = new Set(model.participants.map((participant) => participant.id));
  const laneIds = new Set(model.lanes.map((lane) => lane.id));
  const actorIds = new Set(model.lanes.map((lane) => lane.actorId));
  const nodeIds = new Set(model.nodes.map((node) => node.id));

  const startNodes = model.nodes.filter((node) => node.type === "start_event");
  const endNodes = model.nodes.filter((node) => node.type === "end_event");

  if (model.participants.length !== 1) {
    warnings.push(msg(locale,
      "V1 BPMN export assumes a single participant/pool.",
      "V1 BPMN экспорт нэг оролцогч/pool байна гэж үздэг."
    ));
  }

  if (startNodes.length !== 1) {
    issues.push(msg(locale,
      "V1 BPMN subset requires exactly one start event.",
      "Процесст яг нэг эхлэх цэг байх шаардлагатай."
    ));
  }

  if (endNodes.length < 1) {
    issues.push(msg(locale,
      "V1 BPMN subset requires at least one end event.",
      "Процесст дор хаяж нэг дуусах цэг байх шаардлагатай."
    ));
  }

  model.lanes.forEach((lane) => {
    if (!participantIds.has(lane.participantId)) {
      issues.push(msg(locale,
        `Lane ${lane.id} references missing participant ${lane.participantId}.`,
        `"${lane.id}" зурвас нь тодорхойгүй оролцогчид хамааралтай байна.`
      ));
    }
  });

  model.nodes.forEach((node) => {
    if (!laneIds.has(node.laneId)) {
      issues.push(msg(locale,
        `Node ${node.id} references missing lane ${node.laneId}.`,
        `"${node.id}" зангилаа нь тодорхойгүй зурваст хамааралтай байна.`
      ));
    }

    if (!actorIds.has(node.actorId)) {
      warnings.push(msg(locale,
        `Node ${node.id} references actor ${node.actorId} without a mapped lane actor.`,
        `"${node.id}" зангилаа нь зурвасд тохирох оролцогчгүй байна.`
      ));
    }
  });

  const incomingByNode = new Map<string, number>();
  const outgoingByNode = new Map<string, number>();

  model.flows.forEach((flow) => {
    if (flow.type !== "sequence_flow") {
      issues.push(msg(locale,
        `Flow ${flow.id} uses unsupported BPMN flow type ${flow.type}.`,
        `"${flow.id}" холболт дэмжигдээгүй BPMN төрөл ашиглаж байна.`
      ));
    }

    if (!nodeIds.has(flow.sourceId) || !nodeIds.has(flow.targetId)) {
      issues.push(msg(locale,
        `Flow ${flow.id} references invalid node ids.`,
        `"${flow.id}" холболт нь буруу зангилааны ID-д хамааралтай байна.`
      ));
      return;
    }

    outgoingByNode.set(flow.sourceId, (outgoingByNode.get(flow.sourceId) ?? 0) + 1);
    incomingByNode.set(flow.targetId, (incomingByNode.get(flow.targetId) ?? 0) + 1);
  });

  model.nodes.forEach((node) => {
    const incoming = incomingByNode.get(node.id) ?? 0;
    const outgoing = outgoingByNode.get(node.id) ?? 0;

    switch (node.type) {
      case "start_event":
        if (incoming > 0) {
          issues.push(msg(locale,
            `Start event ${node.id} must not have incoming sequence flows.`,
            `Эхлэх цэг рүү орох холболт байж болохгүй.`
          ));
        }
        if (outgoing < 1) {
          issues.push(msg(locale,
            `Start event ${node.id} must have at least one outgoing sequence flow.`,
            `Эхлэх цэгт дор хаяж нэг гарах холболт байх ёстой.`
          ));
        }
        break;
      case "end_event":
        if (outgoing > 0) {
          issues.push(msg(locale,
            `End event ${node.id} must not have outgoing sequence flows.`,
            `Дуусах цэгээс гарах холболт байж болохгүй.`
          ));
        }
        if (incoming < 1) {
          issues.push(msg(locale,
            `End event ${node.id} must have at least one incoming sequence flow.`,
            `Дуусах цэгт дор хаяж нэг орох холболт байх ёстой.`
          ));
        }
        break;
      case "task":
        if (incoming < 1 && !startNodes.some((startNode) => startNode.id === node.id)) {
          warnings.push(msg(locale,
            `Task ${node.id} has no incoming sequence flow.`,
            `"${node.id}" алхамд орох холболт байхгүй байна.`
          ));
        }
        if (outgoing < 1 && !endNodes.some((endNode) => endNode.id === node.id)) {
          warnings.push(msg(locale,
            `Task ${node.id} has no outgoing sequence flow.`,
            `"${node.id}" алхамаас гарах холболт байхгүй байна.`
          ));
        }
        break;
      case "exclusive_gateway":
        if (incoming < 1) {
          warnings.push(msg(locale,
            `Exclusive gateway ${node.id} has no incoming sequence flow.`,
            `"${node.id}" шийдвэрт орох холболт байхгүй байна.`
          ));
        }
        if (outgoing < 2) {
          warnings.push(msg(locale,
            `Exclusive gateway ${node.id} should have at least two outgoing sequence flows in v1.`,
            `"${node.id}" шийдвэрт дор хаяж хоёр гарах холболт байх ёстой.`
          ));
        }
        if (outgoing >= 2) {
          const unlabeled = model.flows.filter(
            (flow) => flow.sourceId === node.id && flow.label.trim().length === 0
          );
          if (unlabeled.length > 0) {
            warnings.push(msg(locale,
              `Exclusive gateway ${node.id} has unlabeled outgoing sequence flows.`,
              `"${node.id}" шийдвэрийн зарим гарах холболт шошгогүй байна.`
            ));
          }
        }
        break;
    }
  });

  model.artifacts.forEach((artifact) => {
    if (artifact.type !== "text_annotation") {
      issues.push(msg(locale,
        `Artifact ${artifact.id} uses unsupported BPMN artifact type ${artifact.type}.`,
        `"${artifact.id}" элемент дэмжигдээгүй BPMN artifact төрөл ашиглаж байна.`
      ));
    }

    if (artifact.attachedToNodeId && !nodeIds.has(artifact.attachedToNodeId)) {
      warnings.push(msg(locale,
        `Text annotation ${artifact.id} is attached to missing node ${artifact.attachedToNodeId}.`,
        `"${artifact.id}" тайлбар нь олдохгүй зангилаанд холбогдсон байна.`
      ));
    }
  });

  return { issues, warnings };
}
