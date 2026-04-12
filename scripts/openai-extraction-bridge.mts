import OpenAI from "openai";

import { buildSourceFragments } from "../src/lib/document-ingestion.ts";
import { extractionJsonSchema, extractionSchema } from "../src/lib/extraction-schema.ts";
import { validateExtraction } from "../src/lib/extraction-validator.ts";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function buildPrompt(record) {
  const sourceFragments = buildSourceFragments(record.documentName, record.documentText);

  return [
    "Extract a company process from the provided internal policy or SOP.",
    "Return only structured workflow data.",
    "Use only evidence from the source fragments.",
    "Every step must include sourceRef matching one of the fragment refs.",
    "Add warnings for ambiguity, missing approvals, unclear actors, contradictory wording, or uncertain sequencing.",
    "Prefer a conservative first draft over invented steps.",
    "Do not describe the software implementation of this application.",
    "Do not mention APIs, OpenAI, Prisma, JSON, upload endpoints, frontend, backend, or databases unless the source document itself is explicitly a software-operating procedure.",
    "Prefer business actors and approvals from the source document.",
    "Process steps should read like actions a company role performs, not engineering tasks.",
    "",
    `Document: ${record.documentName}`,
    `Diagram kind: ${record.diagramKind}`,
    "",
    "Source fragments:",
    ...sourceFragments.map((fragment) => `[${fragment.ref}] ${fragment.text}`)
  ].join("\n");
}

export async function extractProcessWithOpenAIBridge(record) {
  if (!client) {
    return null;
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You convert company SOPs and policy excerpts into structured process maps. Be conservative and do not invent missing approvals or actors."
          }
        ]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: buildPrompt(record) }]
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

  const parsed = extractionSchema.parse(JSON.parse(response.output_text));
  const extraction = {
    ...parsed,
    sourceFragments: buildSourceFragments(record.documentName, record.documentText)
  };
  const validation = validateExtraction(extraction);

  if (validation.issues.length > 0) {
    throw new Error(validation.issues.join(" "));
  }

  return {
    ...extraction,
    warnings: [...validation.warnings, ...extraction.warnings]
  };
}
