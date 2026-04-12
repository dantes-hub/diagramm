import { Prisma } from "@prisma/client";

import { requireProcessMutationAccess, requireViewer, type AppViewer } from "@/lib/auth";
import { buildDiagram, normalizeExtraction, toCanonicalProcessModel } from "@/lib/extraction";
import {
  diagramPayloadSchema,
  extractionSchema,
  processAnalysisSchema
} from "@/lib/extraction-schema";
import { prisma } from "@/lib/prisma";
import type {
  CanonicalProcessModel,
  CreateProcessInput,
  DiagramPayload,
  ExtractionResult,
  ProcessAnalysis,
  ProcessRecord
} from "@/types/process";

type ProcessWithLatestVersion = Prisma.ProcessGetPayload<{
  include: {
    versions: {
      orderBy: { versionNumber: "desc" };
      take: 1;
    };
  };
}>;

type PrismaClientLike = Pick<
  typeof prisma,
  "document" | "process" | "processVersion"
>;

function jsonValueOrNull<T>(value: Prisma.JsonValue | null): T | null {
  if (value === null) {
    return null;
  }

  return value as T;
}

function sourceDocumentIds(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toInputJson(value: Prisma.JsonValue | null) {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function scopedProcessWhere(viewer: AppViewer, id?: string): Prisma.ProcessWhereInput {
  return {
    organizationId: viewer.organizationId,
    ...(id ? { id } : {})
  };
}

async function requireScopedProcess(
  viewer: AppViewer,
  client: Pick<typeof prisma, "process">,
  id: string
) {
  return client.process.findFirst({
    where: scopedProcessWhere(viewer, id),
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });
}

async function resolvePrimaryDocument(
  client: PrismaClientLike,
  viewer: AppViewer,
  version: { sourceDocumentIds: Prisma.JsonValue }
) {
  const [documentId] = sourceDocumentIds(version.sourceDocumentIds);

  if (!documentId) {
    return null;
  }

  return client.document.findFirst({
    where: {
      id: documentId,
      organizationId: viewer.organizationId
    }
  });
}

async function requireLatestScopedVersion(
  client: Pick<typeof prisma, "processVersion">,
  viewer: AppViewer,
  processId: string
) {
  return client.processVersion.findFirst({
    where: {
      processId,
      process: {
        organizationId: viewer.organizationId
      }
    },
    orderBy: { versionNumber: "desc" }
  });
}

function parseStoredAnalysis(
  value: Prisma.JsonValue | null,
  fallback: Pick<ProcessRecord, "id" | "diagramKind"> & {
    title: string;
    description: string;
  }
): {
  extraction: ExtractionResult | null;
  model: CanonicalProcessModel | null;
  diagram: DiagramPayload | null;
} {
  if (value === null) {
    return { extraction: null, model: null, diagram: null };
  }

  const parsedAnalysis = processAnalysisSchema.safeParse(value);
  if (parsedAnalysis.success) {
    const normalizedExtraction = normalizeExtraction(parsedAnalysis.data.extraction);
    const model = toCanonicalProcessModel(fallback, normalizedExtraction);
    return {
      extraction: normalizedExtraction,
      model,
      diagram: buildDiagram(model, normalizedExtraction.sourceFragments)
    };
  }

  const parsedExtraction = extractionSchema.safeParse(value);
  if (parsedExtraction.success) {
    const normalizedExtraction = normalizeExtraction(parsedExtraction.data);
    const model = toCanonicalProcessModel(fallback, normalizedExtraction);
    return {
      extraction: normalizedExtraction,
      model,
      diagram: buildDiagram(model, normalizedExtraction.sourceFragments)
    };
  }

  return { extraction: null, model: null, diagram: null };
}

function mergeSwimlaneDiagram(
  generated: DiagramPayload | null,
  saved: DiagramPayload | null
): DiagramPayload | null {
  if (!generated) {
    return saved;
  }

  if (!saved) {
    return generated;
  }

  const savedLabelByKey = new Map(
    saved.edges.map((edge) => [`${edge.source}->${edge.target}`, edge.label ?? ""] as const)
  );
  const savedNodeById = new Map(
    saved.nodes
      .filter((node) => !node.id.startsWith("lane-"))
      .map((node) => [node.id, node] as const)
  );

  return {
    ...generated,
    nodes: generated.nodes.map((node) => {
      if (node.id.startsWith("lane-")) {
        return node;
      }

      const savedNode = savedNodeById.get(node.id);
      if (!savedNode) {
        return node;
      }

      return {
        ...node,
        data: {
          ...node.data,
          label: savedNode.data.label ?? node.data.label,
          sourceRef: savedNode.data.sourceRef ?? node.data.sourceRef,
          sourceText: savedNode.data.sourceText ?? node.data.sourceText,
          confidence: savedNode.data.confidence ?? node.data.confidence
        }
      };
    }),
    edges: generated.edges.map((edge) => ({
      ...edge,
      label: savedLabelByKey.get(`${edge.source}->${edge.target}`) ?? edge.label
    }))
  };
}

async function mapProcessRecord(
  viewer: AppViewer,
  process: ProcessWithLatestVersion
): Promise<ProcessRecord> {
  const version = process.versions[0];
  const document = version ? await resolvePrimaryDocument(prisma, viewer, version) : null;
  const analysis = parseStoredAnalysis(version?.extractedJson ?? null, {
    id: process.id,
    diagramKind: process.diagramKind as ProcessRecord["diagramKind"],
    title: process.name,
    description: process.description ?? ""
  });
  const savedDiagram = version
    ? (() => {
        const raw = jsonValueOrNull<DiagramPayload>(version.diagramJson);
        const parsed = diagramPayloadSchema.safeParse(raw);
        return parsed.success ? (parsed.data as DiagramPayload) : null;
      })()
    : null;

  return {
    id: process.id,
    createdBy: process.createdBy,
    title: process.name,
    description: process.description ?? "",
    documentName: document?.fileName ?? "unknown.txt",
    documentText: document?.extractedText ?? "",
    documentType: document?.fileType === "pdf" ? "pdf" : "text",
    diagramKind: process.diagramKind as ProcessRecord["diagramKind"],
    status: process.status as ProcessRecord["status"],
    extraction: analysis.extraction,
    model: analysis.model,
    diagram:
      process.diagramKind === "swimlane"
        ? mergeSwimlaneDiagram(analysis.diagram, savedDiagram)
        : savedDiagram ?? analysis.diagram ?? (version ? jsonValueOrNull<DiagramPayload>(version.diagramJson) : null),
    createdAt: process.createdAt.toISOString(),
    updatedAt: process.updatedAt.toISOString()
  };
}

export async function listProcesses() {
  const viewer = await requireViewer();
  const processes = await prisma.process.findMany({
    where: scopedProcessWhere(viewer),
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1
      }
    }
  });

  return Promise.all(processes.map((process) => mapProcessRecord(viewer, process)));
}

export async function getProcess(id: string) {
  const viewer = await requireViewer();
  const process = await requireScopedProcess(viewer, prisma, id);

  if (!process) {
    return null;
  }

  return mapProcessRecord(viewer, process);
}

export async function createProcess(input: CreateProcessInput) {
  const viewer = await requireViewer();

  const created = await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        organizationId: viewer.organizationId,
        fileName: input.documentName,
        fileType: input.documentType,
        storageUrl: input.storageUrl ?? null,
        extractedText: input.documentText,
        sourceFragments: toInputJson((input.sourceFragments ?? []) as unknown as Prisma.JsonValue)
      }
    });

    const process = await tx.process.create({
      data: {
        organizationId: viewer.organizationId,
        createdBy: viewer.appUserId,
        name: input.title || "Untitled process",
        description: input.description,
        diagramKind: input.diagramKind,
        status: "draft"
      }
    });

    await tx.processVersion.create({
      data: {
        processId: process.id,
        versionNumber: 1,
        sourceDocumentIds: [document.id],
        extractedJson: Prisma.JsonNull,
        diagramJson: Prisma.JsonNull
      }
    });

    const scoped = await requireScopedProcess(viewer, tx, process.id);
    if (!scoped) {
      throw new Error("Created process not found in organization scope");
    }

    return scoped;
  });

  return mapProcessRecord(viewer, created);
}

export async function updateProcess(
  id: string,
  updater: (current: ProcessRecord) => ProcessRecord
) {
  const viewer = await requireViewer();
  const current = await getProcess(id);

  if (!current) {
    return null;
  }

  const updated = updater(current);

  const persisted = await prisma.$transaction(async (tx) => {
    requireProcessMutationAccess(viewer, current.createdBy);

    await tx.process.updateMany({
      where: scopedProcessWhere(viewer, id),
      data: {
        name: updated.title,
        description: updated.description,
        diagramKind: updated.diagramKind,
        status: updated.status
      }
    });

    const latestVersion = await requireLatestScopedVersion(tx, viewer, id);

    if (!latestVersion) {
      throw new Error("Latest process version not found");
    }

    await tx.processVersion.update({
      where: { id: latestVersion.id },
      data: {
        extractedJson: toInputJson(
          updated.extraction && updated.model
            ? ({
                version: "1.0",
                extraction: updated.extraction,
                model: updated.model
              } satisfies ProcessAnalysis as unknown as Prisma.JsonValue)
            : null
        ),
        diagramJson: toInputJson((updated.diagram ?? null) as Prisma.JsonValue | null)
      }
    });

    const scoped = await requireScopedProcess(viewer, tx, id);
    if (!scoped) {
      throw new Error("Updated process not found in organization scope");
    }

    return scoped;
  });

  return mapProcessRecord(viewer, persisted);
}

export async function deleteProcess(id: string) {
  const viewer = await requireViewer();
  const existing = await requireScopedProcess(viewer, prisma, id);

  if (!existing) {
    return false;
  }

  requireProcessMutationAccess(viewer, existing.createdBy);

  await prisma.process.delete({
    where: { id }
  });

  return true;
}
