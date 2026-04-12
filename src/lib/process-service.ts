import { validateCanonicalProcessModel } from "@/lib/bpmn";
import { buildDiagram, extractProcess, normalizeExtraction, toCanonicalProcessModel } from "@/lib/extraction";
import { diagramPayloadSchema, extractionSchema } from "@/lib/extraction-schema";
import { extractProcessWithOpenAI } from "@/lib/openai-extraction";
import { validateExtraction } from "@/lib/extraction-validator";
import type { Locale } from "@/lib/i18n";
import {
  createProcess,
  deleteProcess,
  getProcess,
  listProcesses,
  updateProcess
} from "@/lib/process-repository";
import type { CreateProcessInput, DiagramPayload, ExtractionResult } from "@/types/process";

export async function getDashboardProcesses() {
  return listProcesses();
}

export async function createDraftProcess(input: CreateProcessInput) {
  return createProcess(input);
}

export async function getProcessOrThrow(id: string) {
  const process = await getProcess(id);
  if (!process) {
    throw new Error("Process not found");
  }

  return process;
}

export async function runExtraction(id: string, locale: Locale = "en") {
  const process = await getProcessOrThrow(id);
  let extraction = extractProcess(process, locale);
  const fallbackValidation = validateExtraction(extraction, locale);
  if (fallbackValidation.warnings.length > 0) {
    extraction = {
      ...extraction,
      warnings: [...fallbackValidation.warnings, ...extraction.warnings]
    };
  }

  const fallbackWarning =
    locale === "mn"
      ? "OpenAI шинжилгээ боломжгүй байна; эвристик аргаар гаргасан."
      : "OpenAI extraction unavailable; heuristic extraction used.";

  try {
    const modelExtraction = await extractProcessWithOpenAI(process, locale);
    if (modelExtraction) {
      extraction = normalizeExtraction(modelExtraction);
    }
  } catch (error) {
    extraction = {
      ...extraction,
      warnings: [fallbackWarning, ...extraction.warnings]
    };
  }

  const model = toCanonicalProcessModel(process, extraction);
  const modelValidation = validateCanonicalProcessModel(model, locale);
  const diagram = buildDiagram(model, extraction.sourceFragments);

  return updateProcess(id, (current) => ({
    ...current,
    status: "review",
    model,
    extraction: {
      ...extraction,
      warnings: [...modelValidation.issues, ...modelValidation.warnings, ...extraction.warnings]
    },
    diagram
  }));
}

export async function finalizeDiagram(id: string) {
  return updateProcess(id, (current) => ({
    ...current,
    status: "ready"
  }));
}

export async function updateExtractionReview(id: string, extraction: ExtractionResult) {
  const parsed = normalizeExtraction(extractionSchema.parse(extraction));
  const current = await getProcessOrThrow(id);
  const validation = validateExtraction(parsed);
  const model = toCanonicalProcessModel(current, parsed);
  const modelValidation = validateCanonicalProcessModel(model);
  const diagram = buildDiagram(model, parsed.sourceFragments);
  const warnings = [
    ...validation.warnings,
    ...modelValidation.issues,
    ...modelValidation.warnings,
    ...parsed.warnings
  ];

  return updateProcess(id, (current) => ({
    ...current,
    title: parsed.processName,
    status: "review",
    extraction: {
      ...parsed,
      warnings
    },
    model,
    diagram: {
      ...diagram
    }
  }));
}

export async function updateDiagramDraft(id: string, diagram: DiagramPayload) {
  const parsed = diagramPayloadSchema.parse(diagram) as DiagramPayload;

  return updateProcess(id, (current) => ({
    ...current,
    diagram: parsed
  }));
}

export async function deleteProcessDraft(id: string) {
  return deleteProcess(id);
}
