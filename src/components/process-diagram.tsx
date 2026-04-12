"use client";

import "@xyflow/react/dist/style.css";

import dagre from "@dagrejs/dagre";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type NodeProps,
  type Connection,
  type EdgeChange,
  type EdgeProps,
  type NodeChange,
  type ReactFlowInstance,
  type Viewport
} from "@xyflow/react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import {
  ChevronLeft,
  Download,
  FileText,
  Hand,
  Maximize2,
  MousePointer2,
  Plus,
  Save,
  Settings,
  Trash2,
  ZoomIn,
  ZoomOut
} from "lucide-react";

import type { Translations } from "@/lib/i18n";
import type { DiagramEdge, DiagramKind, DiagramNode, DiagramPayload, StepType } from "@/types/process";

type ToolMode = "select" | "pan";

const laneColors = ["#d3682b", "#5b7cfa", "#10b981", "#8b5cf6", "#0ea5e9"];
const swimlaneWidth = 280;
const diagramNodeWidth = 206;
const decisionNodeMinHeight = 108;
const taskNodeMinHeight = 84;
const flowchartColumnGap = 72;
const flowchartRowGap = 56;
const manualNodeGap = 36;
const edgeLabelStyle = {
  fill: "#655b51",
  fontSize: 11,
  fontWeight: 600
} as const;
const edgeLabelBackgroundStyle = {
  fill: "#f8f4ed",
  fillOpacity: 1,
  stroke: "#ded3c5",
  strokeWidth: 1
} as const;
const edgeLineStyle = {
  stroke: "#8f8579",
  strokeWidth: 1.4
} as const;

function ProcessEdgeComponent({
  id,
  label,
  markerEnd,
  sourcePosition,
  sourceX,
  sourceY,
  style,
  targetPosition,
  targetX,
  targetY
}: EdgeProps<DiagramEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    offset: 18
  });
  const labelText = typeof label === "string" ? label.trim() : "";
  const edgeDeltaX = targetX - sourceX;
  const isCrossLaneBranch = labelText.length > 0 && Math.abs(edgeDeltaX) > 80;
  const labelOffsetX = isCrossLaneBranch
    ? Math.sign(edgeDeltaX) * Math.min(44, Math.abs(edgeDeltaX) * 0.2)
    : 0;
  const labelOffsetY =
    labelText.length === 0 ? 0 : isCrossLaneBranch ? (edgeDeltaX < 0 ? -16 : 16) : -12;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...edgeLineStyle, ...style }}
      />
      {labelText ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-md border border-[#ded3c5] bg-[#f8f4ed] px-2.5 py-0.5 text-[11px] font-semibold text-[#655b51] shadow-[0_1px_2px_rgba(16,32,51,0.08)]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + labelOffsetX}px, ${labelY + labelOffsetY}px)`,
              whiteSpace: "nowrap"
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function FlowHandle({
  type,
  position
}: {
  type: "source" | "target";
  position: Position;
}) {
  return (
    <Handle
      type={type}
      position={position}
      className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#3b4654] shadow-sm"
    />
  );
}

function ProcessNode({ data, selected, sourcePosition, targetPosition }: NodeProps<DiagramNode>) {
  const isDecision = data.type === "decision";
  const isMongolian = /[\u0400-\u04FF]/.test(String(data.label));

  return (
    <div className="relative">
      <FlowHandle type="target" position={targetPosition ?? Position.Top} />
      <div
        className={
          isDecision
            ? "relative min-h-[108px]"
            : "relative rounded-2xl border border-[#b8cde0] bg-white px-4 py-4 shadow-[0_16px_30px_rgba(16,32,51,0.08)]"
        }
        style={{
          width: diagramNodeWidth,
          minHeight: isDecision ? decisionNodeMinHeight : taskNodeMinHeight
        }}
      >
        {isDecision ? (
          <div
            className={`relative mx-auto flex min-h-[108px] items-center justify-center overflow-hidden border bg-[#fff8e8] px-6 py-5 text-center shadow-[0_16px_30px_rgba(16,32,51,0.08)] ${
              selected ? "border-[#d3682b]" : "border-[#d9c8a7]"
            }`}
            style={{
              width: diagramNodeWidth,
              clipPath: "polygon(14% 0%, 86% 0%, 100% 50%, 86% 100%, 14% 100%, 0% 50%)"
            }}
          >
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9b7a43]">
                {isMongolian ? "Шийдвэр" : "Decision"}
              </div>
              <div className="text-[13px] font-medium leading-6 text-[#102033]">{String(data.label)}</div>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[13px] font-medium leading-6 text-[#102033]">{String(data.label)}</div>
          </div>
        )}
      </div>
      <FlowHandle type="source" position={sourcePosition ?? Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  process: ProcessNode
} as const;

const edgeTypes = {
  processEdge: ProcessEdgeComponent
} as const;

function getNodeDimensions(node: Pick<DiagramNode, "data" | "style" | "width" | "height">) {
  const width =
    typeof node.style?.width === "number"
      ? node.style.width
      : typeof node.width === "number"
        ? node.width
        : diagramNodeWidth;
  const height =
    typeof node.style?.height === "number"
      ? node.style.height
      : typeof node.style?.minHeight === "number"
        ? node.style.minHeight
        : typeof node.height === "number"
          ? node.height
          : node.data.type === "decision"
            ? decisionNodeMinHeight
            : taskNodeMinHeight;

  return { width, height };
}

function getConfidenceRatio(level: string) {
  if (level === "high") return 0.95;
  if (level === "medium") return 0.78;
  return 0.55;
}

function estimateNodeHeight(label: string, type: StepType): number {
  const isDecision = type === "decision";
  // Task node: 206px wide, px-4 padding (32px) → 174px usable text width.
  //   Mongolian/CJK chars ~8.5px wide → ~20 chars/line. Use 18 to be safe.
  // Decision hexagon: clipPath clips ~28% horizontally + px-6 padding (48px)
  //   → ~100px usable. At 8.5px/char → ~12 chars/line. Use 11 to be safe.
  const charsPerLine = isDecision ? 11 : 18;
  const text = String(label).replace(/\s+/g, " ").trim();
  const lineCount = Math.max(2, Math.ceil(text.length / charsPerLine));
  // lineHeight: leading-6 = 24px for task. Decision is tighter.
  // baseHeight includes top+bottom padding plus a 24px safety buffer.
  const lineHeight = isDecision ? 20 : 24;
  const baseHeight = isDecision ? 64 : 56;
  return Math.max(isDecision ? decisionNodeMinHeight : taskNodeMinHeight, baseHeight + lineCount * lineHeight);
}

function toFlowchartNodes(diagram: DiagramPayload): DiagramNode[] {
  const sourceNodes = diagram.nodes.filter((node) => !node.id.startsWith("lane-"));
  const visibleIds = new Set(sourceNodes.map((node) => node.id));

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "LR",
    nodesep: flowchartRowGap + 24,
    ranksep: flowchartColumnGap + 16,
    marginx: 80,
    marginy: 60
  });

  for (const node of sourceNodes) {
    const nodeHeight = estimateNodeHeight(node.data.label, node.data.type);
    g.setNode(node.id, { width: diagramNodeWidth, height: nodeHeight });
  }

  for (const edge of diagram.edges) {
    if (visibleIds.has(edge.source) && visibleIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return sourceNodes.map((node) => {
    const { x, y } = g.node(node.id);
    const nodeHeight = estimateNodeHeight(node.data.label, node.data.type);

    return {
      ...node,
      parentId: undefined,
      extent: undefined,
      position: {
        x: x - diagramNodeWidth / 2,
        y: y - nodeHeight / 2
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        ...node.style,
        width: diagramNodeWidth,
        minHeight: nodeHeight,
        background: "transparent",
        border: "none",
        boxShadow: "none"
      }
    };
  });
}

function normalizeDiagramEdges(edges: DiagramEdge[]) {
  return edges.map((edge) => ({
    ...edge,
    type: "processEdge"
  }));
}

export function ProcessDiagram({
  diagram,
  title,
  updatedLabel,
  initialMode,
  processId,
  t
}: {
  diagram: DiagramPayload;
  title: string;
  updatedLabel: string;
  initialMode: DiagramKind;
  processId: string;
  t: Translations;
}) {
  const router = useRouter();
  const isSwimlaneMode = initialMode === "swimlane";
  const [selectedId, setSelectedId] = useState<string | null>(
    diagram.nodes.find((node) => !node.id.startsWith("lane-"))?.id ?? null
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<DiagramNode, DiagramEdge> | null>(
    null
  );
  const [nodes, setNodes] = useState<DiagramNode[]>(() => {
    if (initialMode !== "flowchart") return diagram.nodes;
    // Fresh from extraction: step nodes still have parentId pointing at a lane node.
    // After a save: lane nodes are stripped and step nodes have parentId = undefined.
    // Only run dagre when we detect the raw extraction state.
    const laneIds = new Set(
      diagram.nodes.filter((n) => n.id.startsWith("lane-")).map((n) => n.id)
    );
    const needsLayout = diagram.nodes.some(
      (n) => !n.id.startsWith("lane-") && n.parentId != null && laneIds.has(n.parentId)
    );
    return needsLayout ? toFlowchartNodes(diagram) : diagram.nodes;
  });
  const [edges, setEdges] = useState<DiagramEdge[]>(() => normalizeDiagramEdges(diagram.edges));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [currentUpdatedLabel, setCurrentUpdatedLabel] = useState(updatedLabel);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"png" | "pdf" | "bpmn" | null>(null);
  const canvasPaneRef = useRef<HTMLDivElement | null>(null);
  const exportSurfaceRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const editableNodes = useMemo(
    () => nodes.filter((node) => !node.id.startsWith("lane-")),
    [nodes]
  );

  const surfaceDimensions = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    let maxRight = initialMode === "swimlane" ? Math.max(diagram.lanes.length * swimlaneWidth, 900) : 900;
    let maxBottom = 720;

    for (const node of nodes) {
      const parent = node.parentId ? nodeById.get(node.parentId) : null;
      const parentX = parent?.position.x ?? 0;
      const parentY = parent?.position.y ?? 0;
      const { width: nodeWidth, height: nodeHeight } = getNodeDimensions(node);

      const absoluteX = parentX + node.position.x;
      const absoluteY = parentY + node.position.y;

      maxRight = Math.max(maxRight, absoluteX + nodeWidth + 64);
      maxBottom = Math.max(maxBottom, absoluteY + nodeHeight + 96);
    }

    return {
      width: maxRight,
      height: maxBottom
    };
  }, [diagram.lanes.length, initialMode, nodes]);

  const selected = useMemo(
    () => editableNodes.find((node) => node.id === selectedId) ?? null,
    [editableNodes, selectedId]
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  const zoomPercent = Math.round((viewport.zoom || 1) * 100);

  function rebuildLayout() {
    setNodes(isSwimlaneMode ? diagram.nodes : toFlowchartNodes(diagram));
    setEdges(normalizeDiagramEdges(diagram.edges));
    setSelectedId(diagram.nodes.find((node) => !node.id.startsWith("lane-"))?.id ?? null);
    setSelectedEdgeId(null);
    setDirty(false);
    setSaveError(null);
  }

  useEffect(() => {
    setNodes(initialMode === "flowchart" ? toFlowchartNodes(diagram) : diagram.nodes);
    setEdges(normalizeDiagramEdges(diagram.edges));
    setSelectedId(diagram.nodes.find((node) => !node.id.startsWith("lane-"))?.id ?? null);
    setSelectedEdgeId(null);
    setDirty(false);
    setSaveError(null);
  }, [diagram, initialMode]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!exportMenuRef.current?.contains(event.target as Node)) {
        setExportOpen(false);
      }
    }

    if (exportOpen) {
      document.addEventListener("mousedown", onPointerDown);
      return () => document.removeEventListener("mousedown", onPointerDown);
    }
  }, [exportOpen]);

  function markDirty() {
    setDirty(true);
    setSaveError(null);
  }

  function updateSelectedNode(updater: (node: DiagramNode) => DiagramNode) {
    if (!selectedId) return;
    setNodes((current) =>
      current.map((node) => (node.id === selectedId ? updater(node) : node))
    );
    markDirty();
  }

  function updateSelectedEdge(updater: (edge: DiagramEdge) => DiagramEdge) {
    if (!selectedEdgeId) return;
    setEdges((current) =>
      current.map((edge) => (edge.id === selectedEdgeId ? updater(edge) : edge))
    );
    markDirty();
  }

  function handleNodesChange(changes: NodeChange<DiagramNode>[]) {
    if (isSwimlaneMode) {
      const safeChanges = changes.filter((change) => change.type !== "position");
      setNodes((current) => applyNodeChanges(safeChanges, current));
      return;
    }

    setNodes((current) => applyNodeChanges(changes, current));
    if (changes.length > 0) {
      markDirty();
    }
  }

  function handleEdgesChange(changes: EdgeChange<DiagramEdge>[]) {
    setEdges((current) => applyEdgeChanges(changes, current));
    if (changes.length > 0) {
      markDirty();
    }
  }

  function handleConnect(connection: Connection) {
    if (isSwimlaneMode) {
      return;
    }

    setEdges((current) =>
      addEdge(
        {
          ...connection,
          id: `edge-${Date.now()}`,
          type: "processEdge",
          label: ""
        },
        current
      )
    );
    markDirty();
  }

  async function saveDiagram() {
    setSaving(true);
    setSaveError(null);

    const response = await fetch(`/api/processes/${processId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagram: {
          nodes,
          edges,
          lanes: diagram.lanes
        }
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(payload?.error ?? "Failed to save diagram changes.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setDirty(false);
    setCurrentUpdatedLabel(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }

  function exportFileName(extension: "png" | "pdf") {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram";
    const date = new Date().toISOString().slice(0, 10);
    return `${slug}-${initialMode}-${date}.${extension}`;
  }

  async function createExportImage() {
    const target = exportSurfaceRef.current;
    if (!target) {
      throw new Error("Diagram canvas is not ready for export.");
    }

    const previousViewport = flowInstance?.getViewport() ?? viewport;

    if (flowInstance) {
      if (initialMode === "swimlane") {
        await flowInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 0 });
      } else {
        await flowInstance.fitView({
          padding: 0.18,
          duration: 0,
          includeHiddenNodes: true
        });
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
      );
    }

    const width = Math.max(target.scrollWidth, target.clientWidth);
    const height = Math.max(target.scrollHeight, target.clientHeight);

    try {
      return await toPng(target, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f4f1e9",
        width,
        height,
        canvasWidth: width * 2,
        canvasHeight: height * 2,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          overflow: "visible"
        },
        filter: (node) => {
          if (!(node instanceof HTMLElement)) {
            return true;
          }

          return !node.classList.contains("react-flow__controls");
        }
      });
    } finally {
      if (flowInstance) {
        await flowInstance.setViewport(previousViewport, { duration: 0 });
      }
    }
  }

  function downloadDataUrl(dataUrl: string, filename: string) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function exportDiagram(format: "png" | "pdf") {
    setExporting(format);
    setSaveError(null);
    setExportOpen(false);

    try {
      const imageDataUrl = await createExportImage();

      if (format === "png") {
        downloadDataUrl(imageDataUrl, exportFileName("png"));
        return;
      }

      const pdf = new jsPDF({
        orientation:
          exportSurfaceRef.current &&
          Math.max(exportSurfaceRef.current.scrollWidth, exportSurfaceRef.current.clientWidth) >
            Math.max(exportSurfaceRef.current.scrollHeight, exportSurfaceRef.current.clientHeight)
            ? "landscape"
            : "portrait",
        unit: "px",
        format: "a4"
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const image = new Image();
      image.src = imageDataUrl;
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
      const renderWidth = image.width * scale;
      const renderHeight = image.height * scale;
      const x = (pageWidth - renderWidth) / 2;
      const y = (pageHeight - renderHeight) / 2;

      pdf.addImage(imageDataUrl, "PNG", x, y, renderWidth, renderHeight);
      pdf.save(exportFileName("pdf"));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to export diagram.");
    } finally {
      setExporting(null);
    }
  }

  async function exportBpmn() {
    setExporting("bpmn");
    setSaveError(null);
    setExportOpen(false);

    try {
      const response = await fetch(`/api/processes/${processId}/bpmn`);

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to export BPMN.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = /filename="([^"]+)"/.exec(disposition);
      const filename = filenameMatch?.[1] || `${title}.bpmn`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to export BPMN.");
    } finally {
      setExporting(null);
    }
  }

  function deleteSelectedEdge() {
    if (isSwimlaneMode || !selectedEdgeId) return;
    setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    markDirty();
  }

  function addNode(type: StepType = "task") {
    if (isSwimlaneMode) {
      return;
    }

    const selectedNode = editableNodes.find((node) => node.id === selectedId) ?? null;
    const selectedLaneId = selectedNode?.parentId ?? diagram.lanes[0]?.laneId;
    const lane =
      diagram.lanes.find((candidate) => candidate.laneId === selectedLaneId) ?? diagram.lanes[0];
    const nextId = `node-${Date.now()}`;
    const sameLaneNodes = editableNodes;
    const nextY =
      sameLaneNodes.reduce((maxY, node) => {
        const { height } = getNodeDimensions(node);
        return Math.max(maxY, node.position.y + height);
      }, 104) + manualNodeGap;
    const nextNode: DiagramNode = {
      id: nextId,
      position: { x: 120, y: nextY },
      parentId: undefined,
      extent: undefined,
      data: {
        label: type === "decision" ? t.newDecisionLabel : t.newStepLabel,
        actorName: lane?.actorName ?? t.unassigned,
        type,
        bpmnType:
          type === "start"
            ? "start_event"
            : type === "decision"
              ? "exclusive_gateway"
              : type === "end"
                ? "end_event"
                : "task",
        sourceRef: "manual",
        sourceText: t.manuallyAdded,
        confidence: "medium"
      },
      style: {
        width: diagramNodeWidth,
        minHeight: type === "decision" ? decisionNodeMinHeight : taskNodeMinHeight,
        background: "transparent",
        border: "none",
        boxShadow: "none"
      }
    };

    setNodes((current) => [...current, nextNode]);
    setSelectedId(nextId);
    setSelectedEdgeId(null);
    markDirty();
  }

  function deleteSelectedNode() {
    if (isSwimlaneMode || !selectedId) return;

    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId)
    );
    setSelectedId(null);
    markDirty();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            {t.back}
          </Link>
          <div className="h-4 w-px bg-[var(--line)]" />
          <div>
            <h1 className="text-sm font-medium text-[var(--ink)]">{title}</h1>
            <p className="text-xs text-[var(--muted)]">
              {dirty ? t.unsavedChanges : `${t.lastSaved} ${currentUpdatedLabel}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTool("select")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              tool === "select"
                ? "bg-[var(--panel-strong)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
            }`}
          >
            <MousePointer2 className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setTool("pan")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              tool === "pan"
                ? "bg-[var(--panel-strong)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
            }`}
          >
            <Hand className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="mx-2 h-4 w-px bg-[var(--line)]" />
          <button
            type="button"
            onClick={() => addNode("task")}
            disabled={isSwimlaneMode}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
          {isSwimlaneMode ? (
            <>
              <div className="mx-2 h-4 w-px bg-[var(--line)]" />
              <button
                type="button"
                onClick={rebuildLayout}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
              >
                <Maximize2 className="h-4 w-4" strokeWidth={2} />
                Auto-layout
              </button>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/60 px-2">
            <button
              type="button"
              onClick={() => flowInstance?.zoomOut()}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              <ZoomOut className="h-3 w-3" strokeWidth={2} />
            </button>
            <span className="w-12 text-center text-xs font-medium text-[var(--ink)]">{zoomPercent}%</span>
            <button
              type="button"
              onClick={() => flowInstance?.zoomIn()}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              <ZoomIn className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((current) => !current)}
              disabled={exporting !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)] disabled:opacity-60"
            >
              <Download className="h-4 w-4" strokeWidth={2} />
              {exporting ? t.exporting : t.exportLabel}
            </button>
            {exportOpen ? (
              <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => exportDiagram("png")}
                  className="flex h-9 w-full items-center rounded-lg px-3 text-sm text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                >
                  {t.exportPng}
                </button>
                <button
                  type="button"
                  onClick={() => exportDiagram("pdf")}
                  className="flex h-9 w-full items-center rounded-lg px-3 text-sm text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                >
                  {t.exportPdf}
                </button>
                <button
                  type="button"
                  onClick={exportBpmn}
                  className="flex h-9 w-full items-center rounded-lg px-3 text-sm text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
                >
                  {t.exportBpmn}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={saveDiagram}
            disabled={saving || !dirty}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--deep)] px-3 text-sm font-semibold text-white transition hover:bg-[var(--deep-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" strokeWidth={2} />
            {saving ? t.saving : t.saveChanges}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div ref={canvasPaneRef} className="relative flex-1 overflow-auto bg-[var(--panel-strong)]/60">
          <div
            ref={exportSurfaceRef}
            className="flex min-w-full flex-col"
            style={{ minHeight: surfaceDimensions.height }}
          >
            {initialMode === "swimlane" ? (
              <div className="sticky top-0 z-10 flex border-b border-[var(--line)] bg-[var(--panel)]/85 backdrop-blur">
                {diagram.lanes.map((lane, index) => (
                  <div
                    key={lane.actorId}
                    className="flex items-center gap-2 border-r border-[var(--line)] px-4 py-2"
                    style={{ width: swimlaneWidth }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: laneColors[index % laneColors.length] }}
                    />
                    <span className="text-sm font-medium text-[var(--ink)]">{lane.actorName}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className="relative min-w-full flex-1"
              style={{ minHeight: surfaceDimensions.height }}
            >
              <section
                className="overflow-hidden"
                style={{
                  width: surfaceDimensions.width,
                  height: surfaceDimensions.height,
                  minWidth: surfaceDimensions.width,
                  minHeight: surfaceDimensions.height
                }}
              >
                <ReactFlow
                  fitView={initialMode === "flowchart"}
                  fitViewOptions={{ padding: 0.15 }}
                  defaultViewport={initialMode === "swimlane" ? { x: 0, y: 0, zoom: 1 } : undefined}
                  minZoom={0.15}
                  maxZoom={2}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                defaultEdgeOptions={{
                  type: "processEdge",
                  style: edgeLineStyle
                }}
                panOnDrag={tool === "pan"}
                nodesDraggable={tool === "select" && !isSwimlaneMode}
                elementsSelectable={tool === "select"}
                nodesConnectable={!isSwimlaneMode}
                nodes={nodes}
                edges={edges}
                  onInit={setFlowInstance}
                  onMove={(_, nextViewport) => setViewport(nextViewport)}
                  onNodeClick={(_, node) => {
                    setSelectedId(node.id);
                    setSelectedEdgeId(null);
                  }}
                  onEdgeClick={(_, edge) => {
                    setSelectedEdgeId(edge.id);
                    setSelectedId(null);
                  }}
                  onPaneClick={() => {
                    setSelectedId(null);
                    setSelectedEdgeId(null);
                  }}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={isSwimlaneMode ? undefined : handleConnect}
              >
                  <Background color="#ddd7d1" gap={24} />
                  <Controls showInteractive={false} position="bottom-left" />
                </ReactFlow>
              </section>
            </div>
          </div>
        </div>

        <aside className="w-72 shrink-0 border-l border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] p-4">
            <h3 className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
              <Settings className="h-4 w-4 text-[var(--muted)]" strokeWidth={2} />
              {t.nodeProperties}
            </h3>
          </div>

          {selected ? (
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    {t.typeLabel}
                  </label>
                  <span className="inline-flex items-center rounded-lg bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--ink)]">
                    {selected.data.type}
                  </span>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    {t.labelText}
                  </label>
                  <textarea
                    className="min-h-[88px] w-full resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    value={String(selected.data.label)}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          label: event.target.value
                        }
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    {t.owner}
                  </label>
                  <select
                    className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    value={
                      diagram.lanes.find((lane) => lane.actorName === selected.data.actorName)?.laneId ??
                      diagram.lanes[0]?.laneId
                    }
                    disabled={isSwimlaneMode}
                    onChange={(event) => {
                      const nextLane = diagram.lanes.find((lane) => lane.laneId === event.target.value);
                      if (!nextLane) return;

                      updateSelectedNode((node) => ({
                        ...node,
                        parentId: initialMode === "swimlane" ? nextLane.laneId : node.parentId,
                        extent: initialMode === "swimlane" ? "parent" : node.extent,
                        data: {
                          ...node.data,
                          actorName: nextLane.actorName
                        }
                      }));
                    }}
                  >
                    {diagram.lanes.map((lane) => (
                      <option key={lane.laneId} value={lane.laneId}>
                        {lane.actorName}
                      </option>
                    ))}
                  </select>
                  {isSwimlaneMode ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Swimlane ownership is derived from the process graph. Change owners in review to reflow the diagram.
                    </p>
                  ) : null}
                </div>

                <div className="border-t border-[var(--line)] pt-4">
                  <label className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    <FileText className="h-3 w-3" strokeWidth={2} />
                    {t.sourceReference}
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    value={String(selected.data.sourceRef)}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        data: {
                          ...node.data,
                          sourceRef: event.target.value
                        }
                      }))
                    }
                  />
                </div>

                <div className="border-t border-[var(--line)] pt-4">
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    {t.confidenceScore}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{ width: `${Math.round(getConfidenceRatio(String(selected.data.confidence)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {Math.round(getConfidenceRatio(String(selected.data.confidence)) * 100)}%
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={deleteSelectedNode}
                  disabled={isSwimlaneMode}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Delete node
                </button>
              </div>
            </div>
          ) : selectedEdge ? (
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    Edge label
                  </label>
                  <input
                    className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    value={typeof selectedEdge.label === "string" ? selectedEdge.label : ""}
                    onChange={(event) =>
                      updateSelectedEdge((edge) => ({
                        ...edge,
                        label: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] p-3 text-sm text-[var(--muted)]">
                  {selectedEdge.source} → {selectedEdge.target}
                </div>

                <button
                  type="button"
                  onClick={deleteSelectedEdge}
                  disabled={isSwimlaneMode}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Delete edge
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {saveError ? <p className="mb-4 text-sm text-rose-600">{saveError}</p> : null}
              <p className="text-sm leading-7 text-[var(--muted)]">{t.selectNodeHint}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
