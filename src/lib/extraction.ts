import dagre from "@dagrejs/dagre";
import { Position } from "@xyflow/react";
import type { Locale } from "@/lib/i18n";

import type {
  Actor,
  BpmnNodeType,
  CanonicalProcessModel,
  DiagramPayload,
  ExtractionResult,
  ProcessEdge,
  ProcessRecord,
  ProcessStep,
  SourceFragment,
  StepType
} from "@/types/process";

const actorCatalog = [
  {
    match: /\bemployee\b|\brequester\b|\bstaff\b|ажилтан|хүсэлт гаргагч/i,
    name: { en: "Employee", mn: "Ажилтан" },
    type: "person" as const
  },
  {
    match: /\bmanager\b|\bsupervisor\b|менежер|удирдлага/i,
    name: { en: "Manager", mn: "Менежер" },
    type: "person" as const
  },
  {
    match: /\bhr\b|\bhuman resources\b|хүний нөөц/i,
    name: { en: "HR", mn: "Хүний нөөц" },
    type: "department" as const
  },
  {
    match: /\bfinance\b|\baccounts\b|санхүү/i,
    name: { en: "Finance", mn: "Санхүү" },
    type: "department" as const
  },
  {
    match: /\bprocurement\b|\bpurchase\b|худалдан авалт/i,
    name: { en: "Procurement", mn: "Худалдан авалт" },
    type: "department" as const
  },
  {
    match: /\blegal\b|\bcontract\b|хууль|гэрээ/i,
    name: { en: "Legal", mn: "Хууль" },
    type: "department" as const
  },
  {
    match: /\bit\b|\bsystem\b|\bportal\b|систем|портал|мэдээллийн систем/i,
    name: { en: "System", mn: "Систем" },
    type: "system" as const
  },
  {
    match: /\bdirector\b|\bexecutive\b|захирал/i,
    name: { en: "Director", mn: "Захирал" },
    type: "person" as const
  }
];

function detectDocumentLanguage(text: string) {
  return /[\u0400-\u04FF]/.test(text) ? "mn" : "en";
}

export function toSourceFragments(documentName: string, documentText: string) {
  return documentText
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map(
      (text, index): SourceFragment => ({
        ref: `doc1:p${index + 1}`,
        fileName: documentName,
        text
      })
    );
}

function detectActors(text: string) {
  const actors: Actor[] = [];
  const language = detectDocumentLanguage(text);

  actorCatalog.forEach((entry, index) => {
    if (entry.match.test(text)) {
      actors.push({
        id: `a${index + 1}`,
        name: entry.name[language],
        type: entry.type
      });
    }
  });

  if (actors.length === 0) {
    actors.push({
      id: "a1",
      name: "Process Owner",
      type: "unknown"
    });
  }

  return actors;
}

function inferProcessName(record: ProcessRecord, sourceFragments: SourceFragment[]) {
  const titleCandidate = record.title.trim();
  if (titleCandidate.length > 0) {
    return titleCandidate;
  }

  const firstLine = sourceFragments[0]?.text.split(/\n/)[0];
  return firstLine?.slice(0, 80) || "Untitled Process";
}

function detectWarnings(text: string, actors: Actor[]) {
  const warnings: string[] = [];

  if (!/\bapprove|approval|review\b|зөвшөөр|батал|хяна/i.test(text)) {
    warnings.push("Approval owner unclear or not explicitly described.");
  }

  if (!/\bif\b|\bunless\b|\botherwise\b|\bexception\b|тохиолдолд|бол\b|эсэх|давсан бол/i.test(text)) {
    warnings.push("Decision branches or exception handling are not clearly documented.");
  }

  if (actors.some((actor) => actor.type === "unknown")) {
    warnings.push("At least one actor was inferred generically and should be reviewed.");
  }

  if (warnings.length === 0) {
    warnings.push("Draft generated from explicit steps; review for missing escalation paths.");
  }

  return warnings;
}

function actorDetectionSource(line: string) {
  const trimmed = line.trim();

  if (/^хэрэв\s+/i.test(trimmed)) {
    const stripped = trimmed.replace(/^хэрэв\s+.*?(?:вал|вэл|вөл|бол)\s+/i, "");
    if (stripped && stripped !== trimmed) {
      return stripped;
    }
  }

  if (/тохиолдолд/i.test(trimmed)) {
    const stripped = trimmed.replace(/^.*?тохиолдолд\s+/i, "");
    if (stripped && stripped !== trimmed) {
      return stripped;
    }
  }

  if (/\bбол\b/i.test(trimmed)) {
    const stripped = trimmed.replace(/^.*?\bбол\b\s+/i, "");
    if (stripped && stripped !== trimmed) {
      return stripped;
    }
  }

  return trimmed;
}

function detectActorForLine(
  line: string,
  actors: Actor[],
  fallbackIndex: number,
  previousActorId?: string
) {
  const detectionText = actorDetectionSource(line);
  const matches = actorCatalog
    .map((entry) => {
      const match = detectionText.match(entry.match);
      return {
        entry,
        index: match?.index ?? Number.POSITIVE_INFINITY
      };
    })
    .filter((candidate) => Number.isFinite(candidate.index))
    .sort((left, right) => left.index - right.index);

  const directMatch = matches[0]?.entry;
  if (directMatch) {
    const resolved = actors.find(
      (actor) => actor.name === directMatch.name.en || actor.name === directMatch.name.mn
    );
    if (resolved) {
      return resolved;
    }
  }

  const previousActor = previousActorId
    ? actors.find((actor) => actor.id === previousActorId)
    : null;

  if (previousActor) {
    return previousActor;
  }

  return actors[fallbackIndex % actors.length];
}

function detectStepType(line: string): StepType {
  const lower = line.toLowerCase();

  if (
    /\bif\b|\bunless\b|\botherwise\b|\bwhether\b|\bexceeds?\b|\bthreshold\b|\beligible\b|\bserious\b|\bdecides?\b|\bdetermine\b/i.test(lower)
  ) {
    return "decision";
  }

  if (/\?/.test(line)) {
    return "decision";
  }

  if (
    /тохиолдолд|бол\b|эсэх|давсан бол|ноцтой|зөвшөөрсөн тохиолдолд|шаардлагатай бол|шийд|тогтооно/i.test(line)
  ) {
    return "decision";
  }

  if (/\bapprove\b|\breject\b|\bverify\b|\breview\b|\bcheck\b/i.test(lower) && /\bif\b/i.test(lower)) {
    return "decision";
  }

  return "task";
}

function toSentenceCase(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function cleanBranchLabel(rawLabel: string) {
  const label = rawLabel.trim();

  if (/менежер\s+татгалз/i.test(label)) return "Татгалзсан";
  if (/менежер\s+зөвшөөр/i.test(label)) return "Зөвшөөрсөн";
  if (/чөлөөний үлдэгдэл хүрэлцээтэй/i.test(label)) return "Хүрэлцээтэй";
  if (/чөлөөний үлдэгдэл хүрэлцэхгүй/i.test(label)) return "Хүрэлцэхгүй";
  if (/approved/i.test(label)) return "Approved";
  if (/rejected/i.test(label)) return "Rejected";
  if (/available leave balance|sufficient/i.test(label)) return "Sufficient";
  if (/insufficient|unavailable/i.test(label)) return "Insufficient";

  return toSentenceCase(label);
}

function isTerminalBranchAction(action: string) {
  return /\b(end|complete|closed?)\b|дуус|хаагд|мэдэгдэл илгээж процесс дуус/i.test(action);
}

function parseConditionalMetadata(line: string) {
  const trimmed = line.trim();

  const mongolianIf = trimmed.match(/^Хэрэв\s+(.+?)(?:вал|вэл|вөл|бол)\s+(.+)$/i);
  if (mongolianIf) {
    return {
      branchLabel: cleanBranchLabel(mongolianIf[1].trim()),
      action: toSentenceCase(mongolianIf[2].trim())
    };
  }

  const mongolianCase = trimmed.match(/^(.+?)\s+тохиолдолд\s+(.+)$/i);
  if (mongolianCase) {
    return {
      branchLabel: cleanBranchLabel(`${mongolianCase[1].trim()} тохиолдолд`),
      action: toSentenceCase(mongolianCase[2].trim())
    };
  }

  const mongolianBol = trimmed.match(/^(.+?)\s+бол\s+(.+)$/i);
  if (mongolianBol && /хүрэлц|зөвшөөр|татгалз|давсан|шаардлагатай|боломжтой/i.test(trimmed)) {
    return {
      branchLabel: cleanBranchLabel(`${mongolianBol[1].trim()} бол`),
      action: toSentenceCase(mongolianBol[2].trim())
    };
  }

  const englishIf = trimmed.match(/^If\s+(.+?),\s+(.+)$/i);
  if (englishIf) {
    return {
      branchLabel: cleanBranchLabel(englishIf[1].trim()),
      action: toSentenceCase(englishIf[2].trim())
    };
  }

  return {
    branchLabel: "",
    action: trimmed
  };
}

function isDecisionLikeAction(action: string) {
  return /\b(review|reviews|check|checks|verify|verifies|approve|approves|decide|decides|determine|determines)\b|шалг|хян|батлах эсэх|шийд/i.test(
    action
  );
}

function buildSteps(
  record: ProcessRecord,
  actors: Actor[],
  sourceFragments: SourceFragment[]
) {
  const processName = inferProcessName(record, sourceFragments);
  const candidateLines = record.documentText
    .split("\n")
    .map((line) => line.replace(/^\s*[-*0-9.)]+\s*/, "").trim())
    .filter((line) => line.length > 12)
    .filter((line) => line.toLowerCase() !== processName.trim().toLowerCase())
    .filter((line) => /[.?!]$|^\d+/.test(line) || /\b(бол|эсэх|тохиолдолд|илгээнэ|шалгана|батална|бүртгэнэ|өгнө|хянана)\b/i.test(line))
    .slice(0, 7);

  const steps: ProcessStep[] = [];

  candidateLines.forEach((line, index) => {
    const conditional = parseConditionalMetadata(line);
    const actor = detectActorForLine(
      conditional.action,
      actors,
      index + 1,
      steps[steps.length - 1]?.actorId
    );
    const source = sourceFragments[index % sourceFragments.length];
    const type = conditional.branchLabel ? "task" : detectStepType(line);

    steps.push({
      id: `s${index + 1}`,
      actorId: actor.id,
      action: conditional.action.slice(0, 96),
      type,
      sourceRef: source?.ref ?? "doc1:p1",
      confidence: type === "decision" ? "medium" : "high",
      branchLabel: conditional.branchLabel,
      branchParentId: "",
      branchTerminal: false,
      mergeTargetId: ""
    });
  });

  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index];
    const next = steps[index + 1];

    if (!next?.branchLabel) {
      continue;
    }

    if (current.type === "task" && isDecisionLikeAction(current.action)) {
      current.type = "decision";
      current.confidence = "medium";
    }
  }

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];

    if (!step.branchLabel) {
      continue;
    }

    const parentDecision = [...steps.slice(0, index)]
      .reverse()
      .find((candidate) => candidate.type === "decision");

    step.branchParentId = parentDecision?.id ?? "";
    step.branchTerminal = step.type !== "decision" && isTerminalBranchAction(step.action);

    if (!step.branchTerminal && step.type !== "decision") {
      const mergeTarget = steps.slice(index + 1).find((candidate) => candidate.branchLabel === "");
      step.mergeTargetId = mergeTarget?.id ?? "";
    }
  }

  return steps;
}

function buildEdges(steps: ProcessStep[]) {
  const edges: ProcessEdge[] = [];
  const seen = new Set<string>();

  function pushEdge(from: string, to: string, label: string) {
    const key = `${from}->${to}:${label}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ from, to, label });
    }
  }

  for (let index = 0; index < steps.length; index += 1) {
    const current = steps[index];

    if (current.type === "decision" && !current.branchLabel) {
      const branches = steps.filter((step) => step.branchParentId === current.id);

      if (branches.length === 0) {
        const nextSequential = steps.slice(index + 1).find((step) => step.branchLabel === "");
        if (nextSequential) {
          pushEdge(current.id, nextSequential.id, "Yes");
        }
      }

      for (const branch of branches) {
        pushEdge(current.id, branch.id, branch.branchLabel);
      }

      continue;
    }

    if (current.branchLabel) {
      if (!current.branchTerminal && current.mergeTargetId) {
        pushEdge(current.id, current.mergeTargetId, "");
      }

      if (
        current.type === "decision" &&
        current.branchParentId &&
        !current.mergeTargetId
      ) {
        const childBranches = steps.filter((step) => step.branchParentId === current.id);
        for (const branch of childBranches) {
          pushEdge(current.id, branch.id, branch.branchLabel);
        }
      }

      continue;
    }

    const nextSequential = steps.slice(index + 1).find((step) => step.branchLabel === "");
    if (nextSequential) {
      pushEdge(current.id, nextSequential.id, "");
    }
  }

  return edges;
}

function reconnectEdgesAroundRemovedSteps(
  edges: ProcessEdge[],
  removedIds: Set<string>
) {
  const incomingByTarget = new Map<string, ProcessEdge[]>();
  const outgoingBySource = new Map<string, ProcessEdge[]>();

  edges.forEach((edge) => {
    if (!incomingByTarget.has(edge.to)) {
      incomingByTarget.set(edge.to, []);
    }
    if (!outgoingBySource.has(edge.from)) {
      outgoingBySource.set(edge.from, []);
    }
    incomingByTarget.get(edge.to)!.push(edge);
    outgoingBySource.get(edge.from)!.push(edge);
  });

  const result: ProcessEdge[] = [];
  const seen = new Set<string>();

  edges.forEach((edge) => {
    if (removedIds.has(edge.from) || removedIds.has(edge.to)) {
      return;
    }
    const key = `${edge.from}->${edge.to}:${edge.label}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(edge);
    }
  });

  removedIds.forEach((removedId) => {
    const incoming = incomingByTarget.get(removedId) ?? [];
    const outgoing = outgoingBySource.get(removedId) ?? [];

    for (const left of incoming) {
      if (removedIds.has(left.from)) continue;
      for (const right of outgoing) {
        if (removedIds.has(right.to) || left.from === right.to) continue;
        const label = right.label || left.label || "";
        const key = `${left.from}->${right.to}:${label}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ from: left.from, to: right.to, label });
        }
      }
    }
  });

  return result;
}

export function normalizeExtraction(extraction: ExtractionResult): ExtractionResult {
  const removedIds = new Set(
    extraction.steps
      .filter(
        (step) =>
          /^Start workflow intake$/i.test(step.action) ||
          /^Complete process and record outcome$/i.test(step.action)
      )
      .map((step) => step.id)
  );

  const steps = extraction.steps
    .filter((step) => !removedIds.has(step.id))
    .map((step) => ({
      ...step,
      type: step.type === "start" || step.type === "end" ? "task" : step.type,
      branchLabel: step.branchLabel ?? "",
      branchParentId: step.branchParentId ?? "",
      branchTerminal: step.branchTerminal ?? false,
      mergeTargetId: step.mergeTargetId ?? ""
    }));
  const edges = reconnectEdgesAroundRemovedSteps(extraction.edges, removedIds);

  return {
    ...extraction,
    steps,
    edges
  };
}

function toBpmnNodeType(type: StepType): BpmnNodeType {
  if (type === "start") return "start_event";
  if (type === "decision") return "exclusive_gateway";
  if (type === "end") return "end_event";
  return "task";
}

function toVisualStepType(type: BpmnNodeType): StepType {
  if (type === "start_event") return "start";
  if (type === "exclusive_gateway") return "decision";
  if (type === "end_event") return "end";
  return "task";
}

export function toCanonicalProcessModel(
  record: Pick<ProcessRecord, "id" | "diagramKind">,
  extraction: ExtractionResult
): CanonicalProcessModel {
  const normalizedExtraction = normalizeExtraction(extraction);
  const participantId = "participant-1";
  const participants = [{ id: participantId, name: "Organization" }];
  const usedActorIds = new Set(normalizedExtraction.steps.map((step) => step.actorId));
  const activeActors = normalizedExtraction.actors.filter((actor) => usedActorIds.has(actor.id));
  const fallbackActors = activeActors.length > 0 ? activeActors : normalizedExtraction.actors.slice(0, 1);

  const lanes = fallbackActors.map((actor) => ({
    id: `lane-${actor.id}`,
    participantId,
    actorId: actor.id,
    name: actor.name
  }));

  const laneIdByActor = new Map(lanes.map((lane) => [lane.actorId, lane.id] as const));

  const visibleNodes = normalizedExtraction.steps.map((step) => ({
    id: step.id,
    type: toBpmnNodeType(step.type),
    laneId: laneIdByActor.get(step.actorId) ?? lanes[0]?.id ?? "lane-a1",
    actorId: step.actorId,
    label: step.action,
    sourceRef: step.sourceRef,
    confidence: step.confidence,
    branchLabel: step.branchLabel,
    branchParentId: step.branchParentId,
    branchTerminal: step.branchTerminal,
    mergeTargetId: step.mergeTargetId
  }));

  const firstVisibleNode = visibleNodes[0] ?? null;
  const lastVisibleNode = visibleNodes.at(-1) ?? null;

  const startNode = firstVisibleNode
    ? {
        id: "__start__",
        type: "start_event" as const,
        laneId: firstVisibleNode.laneId,
        actorId: firstVisibleNode.actorId,
        label: "Start",
        sourceRef: firstVisibleNode.sourceRef,
        confidence: "high" as const,
        branchLabel: "",
        branchParentId: "",
        branchTerminal: false,
        mergeTargetId: ""
      }
    : null;

  const endNode = lastVisibleNode
    ? {
        id: "__end__",
        type: "end_event" as const,
        laneId: lastVisibleNode.laneId,
        actorId: lastVisibleNode.actorId,
        label: "End",
        sourceRef: lastVisibleNode.sourceRef,
        confidence: "medium" as const,
        branchLabel: "",
        branchParentId: "",
        branchTerminal: true,
        mergeTargetId: ""
      }
    : null;

  const flows = normalizedExtraction.edges.map((edge, index) => ({
    id: `flow-${index + 1}`,
    type: "sequence_flow" as const,
    sourceId: edge.from,
    targetId: edge.to,
    label: edge.label
  }));

  if (startNode && firstVisibleNode) {
    flows.unshift({
      id: "flow-start",
      type: "sequence_flow",
      sourceId: startNode.id,
      targetId: firstVisibleNode.id,
      label: ""
    });
  }

  if (endNode && lastVisibleNode) {
    flows.push({
      id: "flow-end",
      type: "sequence_flow",
      sourceId: lastVisibleNode.id,
      targetId: endNode.id,
      label: ""
    });
  }

  const artifacts = normalizedExtraction.warnings.map((warning, index) => ({
    id: `artifact-${index + 1}`,
    type: "text_annotation" as const,
    text: warning
  }));

  return {
    version: "1.0",
    process: {
      id: record.id,
      name: extraction.processName,
      purpose: extraction.summary,
      diagramKind: record.diagramKind
    },
    participants,
    lanes,
    nodes: [...visibleNodes, ...(startNode ? [startNode] : []), ...(endNode ? [endNode] : [])],
    flows,
    artifacts,
    warnings: normalizedExtraction.warnings
  };
}

export function extractProcess(record: ProcessRecord, locale: Locale = "en") {
  const sourceFragments = toSourceFragments(record.documentName, record.documentText);
  const actors = detectActors(record.documentText);
  const steps = buildSteps(record, actors, sourceFragments);
  const summary =
    locale === "mn"
      ? `${record.documentName} баримтаас ${steps.length} алхамтай процессын ноорог.`
      : `AI draft for ${record.documentName} with ${steps.length} mapped nodes.`;
  const extraction: ExtractionResult = {
    processName: inferProcessName(record, sourceFragments),
    summary,
    actors,
    steps,
    edges: buildEdges(steps),
    warnings: detectWarnings(record.documentText, actors),
    sourceFragments
  };

  return normalizeExtraction(extraction);
}

export function buildDiagram(
  model: CanonicalProcessModel,
  sourceFragments: SourceFragment[]
): DiagramPayload {
  const laneWidth = 280;
  const nodeWidth = 206;
  const lanePaddingX = Math.round((laneWidth - 16 - nodeWidth) / 2);
  const topOffset = 72;
  const verticalGap = 56;
  const lanes = model.lanes.map((lane) => ({
    actorId: lane.actorId,
    actorName: lane.name,
    laneId: lane.id
  }));

  const laneById = new Map(model.lanes.map((lane, index) => [lane.id, index] as const));
  const sourceByRef = new Map(sourceFragments.map((fragment) => [fragment.ref, fragment.text] as const));
  const laneNameById = new Map(model.lanes.map((lane) => [lane.id, lane.name] as const));
  const incomingByNode = new Map<string, string[]>();
  const outgoingByNode = new Map<string, string[]>();

  model.nodes.forEach((node) => {
    incomingByNode.set(node.id, []);
    outgoingByNode.set(node.id, []);
  });

  model.flows.forEach((flow) => {
    incomingByNode.get(flow.targetId)?.push(flow.sourceId);
    outgoingByNode.get(flow.sourceId)?.push(flow.targetId);
  });

  const visibleGraphNodes = model.nodes.filter(
    (node) => node.type !== "start_event" && node.type !== "end_event"
  );
  const visibleNodeIds = new Set(visibleGraphNodes.map((node) => node.id));
  const visibleFlows = model.flows.filter(
    (flow) => visibleNodeIds.has(flow.sourceId) && visibleNodeIds.has(flow.targetId)
  );
  const incomingVisibleByNode = new Map<string, string[]>();
  const outgoingVisibleByNode = new Map<string, string[]>();

  visibleGraphNodes.forEach((node) => {
    incomingVisibleByNode.set(node.id, []);
    outgoingVisibleByNode.set(node.id, []);
  });

  visibleFlows.forEach((flow) => {
    incomingVisibleByNode.get(flow.targetId)?.push(flow.sourceId);
    outgoingVisibleByNode.get(flow.sourceId)?.push(flow.targetId);
  });

  // Use dagre for rank assignment — replaces the hand-rolled iterative topological sort
  // which mislaid parallel branch nodes causing overlaps. We only need the rank ordering
  // (Y in TB mode); lane membership still drives the X position below.
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 1, nodesep: 1, marginx: 0, marginy: 0 });

  for (const node of visibleGraphNodes) {
    dagreGraph.setNode(node.id, { width: 1, height: 1 });
  }

  for (const flow of visibleFlows) {
    dagreGraph.setEdge(flow.sourceId, flow.targetId);
  }

  dagre.layout(dagreGraph);

  const sortedYs = [...new Set(
    visibleGraphNodes.map((n) => dagreGraph.node(n.id)?.y ?? 0)
  )].sort((a, b) => a - b);

  const stageByNode = new Map<string, number>(
    visibleGraphNodes.map((node, index) => {
      const y = dagreGraph.node(node.id)?.y;
      const rank = y !== undefined ? sortedYs.indexOf(y) : index;
      return [node.id, rank === -1 ? index : rank];
    })
  );

  function estimateNodeHeight(label: string, type: BpmnNodeType) {
    const charactersPerLine = type === "exclusive_gateway" ? 16 : 18;
    const lineCount = Math.max(
      2,
      Math.ceil(label.replace(/\s+/g, " ").trim().length / charactersPerLine)
    );
    const lineHeight = type === "exclusive_gateway" ? 20 : 22;
    const baseHeight = type === "exclusive_gateway" ? 34 : 38;

    return Math.max(type === "exclusive_gateway" ? 88 : 84, baseHeight + lineCount * lineHeight);
  }

  const nodeHeightById = new Map(
    model.nodes.map((node) => [node.id, estimateNodeHeight(node.label, node.type)] as const)
  );
  const modelNodeById = new Map(model.nodes.map((node) => [node.id, node] as const));
  const visibleOrderById = new Map(visibleGraphNodes.map((node, index) => [node.id, index] as const));
  const groupedStageLaneNodes = new Map<number, Map<string, typeof visibleGraphNodes>>();
  const extraGapAfterLevel = new Map<number, number>();

  visibleGraphNodes.forEach((node) => {
    const level = stageByNode.get(node.id) ?? 0;

    if (!groupedStageLaneNodes.has(level)) {
      groupedStageLaneNodes.set(level, new Map());
    }

    const laneGroup = groupedStageLaneNodes.get(level)!;
    const laneNodes = laneGroup.get(node.laneId) ?? [];
    laneNodes.push(node);
    laneGroup.set(node.laneId, laneNodes);

    const branchCount = outgoingVisibleByNode.get(node.id)?.length ?? 0;
    const crossLaneBranchCount = (outgoingVisibleByNode.get(node.id) ?? [])
      .map((targetId) => modelNodeById.get(targetId))
      .filter((target): target is NonNullable<typeof target> => Boolean(target))
      .filter((target) => target.laneId !== node.laneId).length;

    let branchGap = 0;

    if (node.type === "exclusive_gateway") {
      branchGap += 52;
    }

    if (branchCount > 1) {
      branchGap += 28 + (branchCount - 2) * 18;
    }

    if (crossLaneBranchCount > 0) {
      branchGap += 24;
    }

    if (branchGap > 0) {
      extraGapAfterLevel.set(level, Math.max(extraGapAfterLevel.get(level) ?? 0, branchGap));
    }
  });

  groupedStageLaneNodes.forEach((laneGroup) => {
    laneGroup.forEach((laneNodes, laneId) => {
      laneGroup.set(
        laneId,
        [...laneNodes].sort((left, right) => {
          const orderDelta =
            (visibleOrderById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (visibleOrderById.get(right.id) ?? Number.MAX_SAFE_INTEGER);

          if (orderDelta !== 0) {
            return orderDelta;
          }

          if (left.type === "exclusive_gateway" && right.type !== "exclusive_gateway") {
            return -1;
          }

          if (left.type !== "exclusive_gateway" && right.type === "exclusive_gateway") {
            return 1;
          }

          return left.id.localeCompare(right.id);
        })
      );
    });
  });

  const stageSlotByNode = new Map<string, number>();
  const stageHeightByLevel = new Map<number, number>();
  const slotOffsetByStage = new Map<number, number[]>();
  const slotGap = 36;

  groupedStageLaneNodes.forEach((laneGroup, level) => {
    const slotHeights: number[] = [];

    laneGroup.forEach((laneNodes) => {
      laneNodes.forEach((node, slotIndex) => {
        stageSlotByNode.set(node.id, slotIndex);
        slotHeights[slotIndex] = Math.max(
          slotHeights[slotIndex] ?? 0,
          nodeHeightById.get(node.id) ?? 96
        );
      });
    });

    const slotOffsets: number[] = [];
    let slotTop = 0;
    slotHeights.forEach((height, slotIndex) => {
      slotOffsets[slotIndex] = slotTop;
      slotTop += height + slotGap;
    });

    slotOffsetByStage.set(level, slotOffsets);
    stageHeightByLevel.set(level, Math.max(slotTop - slotGap, slotHeights[0] ?? 96));
  });

  const maxLevel = Math.max(...Array.from(stageByNode.values()), 0);
  const topOffsetByLevel = new Map<number, number>();
  let currentTop = topOffset;

  for (let level = 0; level <= maxLevel; level += 1) {
    topOffsetByLevel.set(level, currentTop);
    currentTop +=
      (stageHeightByLevel.get(level) ?? 96) +
      verticalGap +
      (extraGapAfterLevel.get(level) ?? 0);
  }

  const laneNodes = model.lanes.map((lane, index) => ({
    id: lane.id,
    type: "group",
    position: { x: index * laneWidth, y: 0 },
    data: {
      label: lane.name,
      actorName: lane.name,
      type: "task" as const,
      bpmnType: "task" as const,
      sourceRef: "",
      sourceText: "",
      confidence: "high" as const
    },
    style: {
      width: laneWidth - 16,
      height: Math.max(currentTop + 84, 420),
      background:
        /system|систем/i.test(lane.name)
          ? "#f7f6f2"
          : index % 2 === 0
            ? "#f6fbff"
            : "#edf5fb",
      border: /system|систем/i.test(lane.name) ? "1px solid #e5ddd2" : "1px solid #d9e7f2",
      borderRadius: 22
    },
    draggable: false,
    selectable: false
  }));

  const stepNodes = model.nodes
    .filter((node) => node.type !== "start_event" && node.type !== "end_event")
    .map((node, index) => {
      const visualType = toVisualStepType(node.type);
      const level = stageByNode.get(node.id) ?? index;
      const slotIndex = stageSlotByNode.get(node.id) ?? 0;
      const slotOffset = slotOffsetByStage.get(level)?.[slotIndex] ?? 0;
      const branchStageOffset = node.branchParentId ? 18 : 0;
      const nodeHeight = nodeHeightById.get(node.id) ?? 96;
      const laneIndex = laneById.get(node.laneId) ?? 0;

      visibleNodeIds.add(node.id);

      let sourcePosition = Position.Bottom;
      let targetPosition = Position.Top;

      const incomingLaneIndexes = (incomingVisibleByNode.get(node.id) ?? [])
        .map((sourceId) => modelNodeById.get(sourceId))
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
        .map((candidate) => laneById.get(candidate.laneId) ?? laneIndex);

      const outgoingLaneIndexes = (outgoingVisibleByNode.get(node.id) ?? [])
        .map((targetId) => modelNodeById.get(targetId))
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
        .map((candidate) => laneById.get(candidate.laneId) ?? laneIndex);

      const incomingCrossLane = incomingLaneIndexes.find((indexValue) => indexValue !== laneIndex);
      const outgoingCrossLane = outgoingLaneIndexes.find((indexValue) => indexValue !== laneIndex);

      if (incomingCrossLane !== undefined) {
        targetPosition = incomingCrossLane < laneIndex ? Position.Left : Position.Right;
      }

      if (outgoingCrossLane !== undefined) {
        sourcePosition = outgoingCrossLane > laneIndex ? Position.Right : Position.Left;
      }

      return {
        id: node.id,
        type: "process",
        position: {
          x: lanePaddingX,
          y: (topOffsetByLevel.get(level) ?? topOffset) + slotOffset + branchStageOffset
        },
        sourcePosition,
        targetPosition,
        parentId: node.laneId,
        extent: "parent" as const,
        data: {
          label: node.label,
          actorName: laneNameById.get(node.laneId) ?? "Unknown",
          type: visualType,
          bpmnType: node.type,
          sourceRef: node.sourceRef,
          sourceText: sourceByRef.get(node.sourceRef) ?? "No source text found.",
          confidence: node.confidence
        },
        style: {
          width: nodeWidth,
          minHeight: nodeHeight,
          background: "transparent",
          border: "none",
          boxShadow: "none"
        }
      };
    });

  const isMongolian = sourceFragments.some((fragment) => /[\u0400-\u04FF]/.test(fragment.text));
  const edges = model.flows
    .filter((flow) => visibleNodeIds.has(flow.sourceId) && visibleNodeIds.has(flow.targetId))
    .map((flow, index) => ({
      id: flow.id || `e${index + 1}`,
      source: flow.sourceId,
      target: flow.targetId,
      label:
        flow.label === "Yes"
          ? isMongolian
            ? "Тийм"
            : "Yes"
          : flow.label === "No"
            ? isMongolian
              ? "Үгүй"
              : "No"
            : flow.label,
      type: "smoothstep"
    }));

  return {
    nodes: [...laneNodes, ...stepNodes],
    edges,
    lanes
  };
}
