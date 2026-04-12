import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { extractProcess } from "../src/lib/extraction.ts";
import { validateExtraction } from "../src/lib/extraction-validator.ts";

type DiagramKind = "flowchart" | "swimlane";

interface SampleDefinition {
  id: string;
  title: string;
  documentName: string;
  diagramKind: DiagramKind;
  documentText: string;
  expected: {
    actors: string[];
    stepPhrases: string[];
    minSteps: number;
    decisionCountAtLeast: number;
    warningIncludes?: string[];
  };
}

interface CheckResult {
  label: string;
  passed: boolean;
  details: string;
}

const samplesDir = path.join(process.cwd(), "samples", "extraction");
const useOpenAI = process.argv.includes("--with-openai");

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function buildRecord(sample: SampleDefinition) {
  return {
    id: sample.id,
    title: sample.title,
    description: "",
    documentName: sample.documentName,
    documentText: sample.documentText,
    documentType: sample.documentName.endsWith(".pdf") ? "pdf" : "text",
    diagramKind: sample.diagramKind,
    status: "draft",
    extraction: null,
    model: null,
    diagram: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as const;
}

function evaluateSample(sample: SampleDefinition, extraction: Awaited<ReturnType<typeof extractProcessWithOpenAI>> | ReturnType<typeof extractProcess>) {
  const checks: CheckResult[] = [];
  const validation = validateExtraction(extraction);

  const actorNames = new Set(extraction.actors.map((actor) => normalize(actor.name)));
  const matchedActors = sample.expected.actors.filter((actor) => actorNames.has(normalize(actor)));
  checks.push({
    label: "actors",
    passed: matchedActors.length === sample.expected.actors.length,
    details: `${matchedActors.length}/${sample.expected.actors.length} matched`
  });

  const stepTexts = extraction.steps.map((step) => normalize(step.action));
  const matchedPhrases = sample.expected.stepPhrases.filter((phrase) =>
    stepTexts.some((step) => step.includes(normalize(phrase)))
  );
  checks.push({
    label: "step phrases",
    passed: matchedPhrases.length === sample.expected.stepPhrases.length,
    details: `${matchedPhrases.length}/${sample.expected.stepPhrases.length} matched`
  });

  checks.push({
    label: "min steps",
    passed: extraction.steps.length >= sample.expected.minSteps,
    details: `${extraction.steps.length} >= ${sample.expected.minSteps}`
  });

  const decisionCount = extraction.steps.filter((step) => step.type === "decision").length;
  checks.push({
    label: "decision count",
    passed: decisionCount >= sample.expected.decisionCountAtLeast,
    details: `${decisionCount} >= ${sample.expected.decisionCountAtLeast}`
  });

  const warningIncludes = sample.expected.warningIncludes ?? [];
  const warningsText = extraction.warnings.join(" ").toLowerCase();
  const matchedWarnings = warningIncludes.filter((warning) => warningsText.includes(normalize(warning)));
  checks.push({
    label: "warning hints",
    passed: matchedWarnings.length === warningIncludes.length,
    details:
      warningIncludes.length === 0
        ? "not required"
        : `${matchedWarnings.length}/${warningIncludes.length} matched`
  });

  checks.push({
    label: "structural issues",
    passed: validation.issues.length === 0,
    details: validation.issues.length === 0 ? "none" : validation.issues.join(" | ")
  });

  return {
    checks,
    validation,
    passed: checks.every((check) => check.passed)
  };
}

async function main() {
  const files = (await readdir(samplesDir)).filter((file) => file.endsWith(".json")).sort();
  const extractWithOpenAI = useOpenAI
    ? (await import("./openai-extraction-bridge.mts")).extractProcessWithOpenAIBridge
    : null;

  let passedSamples = 0;
  let totalChecks = 0;
  let passedChecks = 0;

  console.log(`Extraction evaluation`);
  console.log(`Mode: ${useOpenAI ? "openai" : "heuristic"}`);
  console.log(`Samples: ${files.length}`);
  console.log("");

  for (const file of files) {
    const fullPath = path.join(samplesDir, file);
    const sample = JSON.parse(await readFile(fullPath, "utf8")) as SampleDefinition;
    const record = buildRecord(sample);

    const extraction = useOpenAI
      ? await extractWithOpenAI?.(record) ?? extractProcess(record)
      : extractProcess(record);

    const result = evaluateSample(sample, extraction);
    const sampleChecksPassed = result.checks.filter((check) => check.passed).length;

    totalChecks += result.checks.length;
    passedChecks += sampleChecksPassed;
    if (result.passed) {
      passedSamples += 1;
    }

    console.log(`${result.passed ? "PASS" : "FAIL"} ${sample.id} ${sample.title}`);
    for (const check of result.checks) {
      console.log(`  ${check.passed ? "[ok]" : "[x]"} ${check.label}: ${check.details}`);
    }
    if (result.validation.warnings.length > 0) {
      console.log(`  [warn] ${result.validation.warnings.join(" | ")}`);
    }
    console.log("");
  }

  console.log(`Summary`);
  console.log(`  Samples passed: ${passedSamples}/${files.length}`);
  console.log(`  Checks passed: ${passedChecks}/${totalChecks}`);

  process.exitCode = passedSamples === files.length ? 0 : 1;
}

await main();
