import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { toCanonicalProcessModel, extractProcess } from "../src/lib/extraction.ts";
import { validateCanonicalProcessModel } from "../src/lib/bpmn.ts";
import type { CanonicalProcessModel } from "../src/types/process.ts";

type DiagramKind = "flowchart" | "swimlane";

interface SampleDefinition {
  id: string;
  title: string;
  documentName: string;
  diagramKind: DiagramKind;
  documentText: string;
}

const samplesDir = path.join(process.cwd(), "samples", "extraction");

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlId(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function exportCanonicalProcessToBpmnXml(model: CanonicalProcessModel) {
  const validation = validateCanonicalProcessModel(model);
  if (validation.issues.length > 0) {
    throw new Error(validation.issues.join(" | "));
  }

  const processId = xmlId(model.process.id);
  const participant = model.participants[0];

  const laneSet = `    <bpmn:laneSet id="${processId}_laneSet">
${model.lanes
  .map((lane) => {
    const refs = model.nodes
      .filter((node) => node.laneId === lane.id)
      .map((node) => `        <bpmn:flowNodeRef>${xmlId(node.id)}</bpmn:flowNodeRef>`)
      .join("\n");
    return `      <bpmn:lane id="${xmlId(lane.id)}" name="${escapeXml(lane.name)}">
${refs}
      </bpmn:lane>`;
  })
  .join("\n")}
    </bpmn:laneSet>`;

  const nodes = model.nodes
    .map((node) => {
      const incoming = model.flows
        .filter((flow) => flow.targetId === node.id)
        .map((flow) => `      <bpmn:incoming>${xmlId(flow.id)}</bpmn:incoming>`)
        .join("\n");
      const outgoing = model.flows
        .filter((flow) => flow.sourceId === node.id)
        .map((flow) => `      <bpmn:outgoing>${xmlId(flow.id)}</bpmn:outgoing>`)
        .join("\n");
      const body = [incoming, outgoing].filter(Boolean).join("\n");
      const attrs = `id="${xmlId(node.id)}" name="${escapeXml(node.label)}"`;

      if (node.type === "start_event") {
        return `    <bpmn:startEvent ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:startEvent>`;
      }
      if (node.type === "task") {
        return `    <bpmn:task ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:task>`;
      }
      if (node.type === "exclusive_gateway") {
        return `    <bpmn:exclusiveGateway ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:exclusiveGateway>`;
      }
      return `    <bpmn:endEvent ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:endEvent>`;
    })
    .join("\n");

  const flows = model.flows
    .map((flow) => {
      const label = flow.label.trim() ? ` name="${escapeXml(flow.label)}"` : "";
      return `    <bpmn:sequenceFlow id="${xmlId(flow.id)}" sourceRef="${xmlId(flow.sourceId)}" targetRef="${xmlId(flow.targetId)}"${label} />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="${processId}_definitions" targetNamespace="https://diagramm.app/bpmn/v1">
  <bpmn:process id="${processId}" name="${escapeXml(model.process.name)}" isExecutable="false">
${laneSet}
${nodes}
${flows}
  </bpmn:process>
  <bpmn:collaboration id="${processId}_collaboration">
    <bpmn:participant id="${xmlId(participant.id)}" name="${escapeXml(participant.name)}" processRef="${processId}" />
  </bpmn:collaboration>
</bpmn:definitions>`;
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

async function main() {
  const files = (await readdir(samplesDir)).filter((file) => file.endsWith(".json")).sort();

  let passed = 0;
  console.log("BPMN export validation");
  console.log(`Samples: ${files.length}`);
  console.log("");

  for (const file of files) {
    const sample = JSON.parse(
      await readFile(path.join(samplesDir, file), "utf8")
    ) as SampleDefinition;

    const record = buildRecord(sample);
    const extraction = extractProcess(record);
    const model = toCanonicalProcessModel(record, extraction);
    const validation = validateCanonicalProcessModel(model);

    if (validation.issues.length > 0) {
      console.log(`FAIL ${sample.id} ${sample.title}`);
      console.log(`  invalid canonical model: ${validation.issues.join(" | ")}`);
      console.log("");
      continue;
    }

    const xml = exportCanonicalProcessToBpmnXml(model);

    const checks = [
      xml.includes("<bpmn:definitions"),
      xml.includes("<bpmn:process"),
      xml.includes("<bpmn:collaboration"),
      xml.includes("<bpmn:participant"),
      xml.includes("<bpmn:laneSet"),
      model.nodes.every((node) => xml.includes(`id="${node.id}"`) || xml.includes(`id="${node.id.replace(/[^A-Za-z0-9_.-]/g, "_")}"`)),
      model.flows.every((flow) => xml.includes(`id="${flow.id}"`) || xml.includes(`id="${flow.id.replace(/[^A-Za-z0-9_.-]/g, "_")}"`))
    ];

    const ok = checks.every(Boolean);
    console.log(`${ok ? "PASS" : "FAIL"} ${sample.id} ${sample.title}`);
    console.log(`  warnings: ${validation.warnings.length}`);
    console.log(`  xml bytes: ${xml.length}`);
    console.log("");

    if (ok) {
      passed += 1;
    }
  }

  console.log(`Summary`);
  console.log(`  Samples passed: ${passed}/${files.length}`);
  process.exitCode = passed === files.length ? 0 : 1;
}

await main();
