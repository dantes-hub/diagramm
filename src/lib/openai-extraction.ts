import OpenAI from "openai";

import { buildSourceFragments } from "./document-ingestion";
import { extractionJsonSchema, extractionSchema } from "./extraction-schema";
import type { Locale } from "./i18n";
import type { ExtractionResult, ProcessRecord } from "../types/process";
import { validateExtraction } from "./extraction-validator";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function buildPrompt(record: ProcessRecord, locale: Locale) {
  const sourceFragments = buildSourceFragments(record.documentName, record.documentText);

  const languageInstruction =
    locale === "mn"
      ? [
          "Output language: Mongolian (Монгол хэл).",
          "ALL text fields in the response must be written in natural, professional Mongolian — including processName, summary, step actions, actor names, branchLabel, and warnings.",
          "Use standard Mongolian business and compliance terminology.",
          "Do not mix English into the output unless it is a proper noun or internationally accepted abbreviation (e.g. PDF, SOP, ISO)."
        ]
      : [];

  return [
    "Extract a company process from the provided internal policy or SOP.",
    "Return only structured workflow data.",
    "Use only evidence from the source fragments.",
    "Every step must include sourceRef matching one of the fragment refs.",
    "Every step must include branchLabel, branchParentId, and mergeTargetId as strings. Use an empty string when not applicable.",
    "Every step must include branchTerminal as a boolean. Use false when not applicable.",
    "Add warnings for ambiguity, missing approvals, unclear actors, contradictory wording, or uncertain sequencing.",
    "Prefer a conservative first draft over invented steps.",
    "Do not describe the software implementation of this application.",
    "Do not mention APIs, OpenAI, Prisma, JSON, upload endpoints, frontend, backend, or databases unless the source document itself is explicitly a software-operating procedure.",
    "Prefer business actors and approvals from the source document.",
    "Process steps should read like actions a company role performs, not engineering tasks.",
    ...languageInstruction,
    "",
    `Document: ${record.documentName}`,
    `Diagram kind: ${record.diagramKind}`,
    "",
    "Source fragments:",
    ...sourceFragments.map((fragment) => `[${fragment.ref}] ${fragment.text}`)
  ].join("\n");
}

function validateBusinessExtraction(extraction: ExtractionResult) {
  const validation = validateExtraction(extraction);

  if (validation.issues.length > 0) {
    throw new Error(validation.issues.join(" "));
  }

  return {
    ...extraction,
    warnings: [...validation.warnings, ...extraction.warnings]
  };
}

export async function extractProcessWithOpenAI(record: ProcessRecord, locale: Locale = "en") {
  if (!client) {
    return null;
  }

  const systemPrompt =
    locale === "mn"
      ? "You convert company SOPs and policy excerpts into structured process maps. Be conservative and do not invent missing approvals or actors. Respond entirely in Mongolian (Монгол хэл)."
      : "You convert company SOPs and policy excerpts into structured process maps. Be conservative and do not invent missing approvals or actors.";

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt
          }
        ]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: buildPrompt(record, locale) }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "process_extraction",
        schema: extractionJsonSchema,
        strict: true
      }
    }
  });

  const parsed = extractionSchema.parse(JSON.parse(response.output_text)) as ExtractionResult;
  return validateBusinessExtraction({
    ...parsed,
    sourceFragments: buildSourceFragments(record.documentName, record.documentText)
  });
}
