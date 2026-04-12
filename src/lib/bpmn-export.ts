import { validateCanonicalProcessModel } from "./bpmn";
import type { CanonicalProcessModel } from "../types/process";

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

export function buildBpmnFileName(processName: string) {
  const slug =
    processName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${date}.bpmn`;
}

export function exportCanonicalProcessToBpmnXml(model: CanonicalProcessModel) {
  const validation = validateCanonicalProcessModel(model);

  if (validation.issues.length > 0) {
    throw new Error(`BPMN export blocked: ${validation.issues.join(" | ")}`);
  }

  const processId = xmlId(model.process.id);
  const participant = model.participants[0];
  const laneFlowRefs = new Map<string, string[]>();

  model.lanes.forEach((lane) => {
    laneFlowRefs.set(
      lane.id,
      model.nodes
        .filter((node) => node.laneId === lane.id)
        .map((node) => xmlId(node.id))
    );
  });

  const flowElements = model.nodes
    .map((node) => {
      const id = xmlId(node.id);
      const incoming = model.flows
        .filter((flow) => flow.targetId === node.id)
        .map((flow) => `      <bpmn:incoming>${xmlId(flow.id)}</bpmn:incoming>`)
        .join("\n");
      const outgoing = model.flows
        .filter((flow) => flow.sourceId === node.id)
        .map((flow) => `      <bpmn:outgoing>${xmlId(flow.id)}</bpmn:outgoing>`)
        .join("\n");
      const body = [incoming, outgoing].filter(Boolean).join("\n");
      const attrs = `id="${id}" name="${escapeXml(node.label)}"`;

      switch (node.type) {
        case "start_event":
          return `    <bpmn:startEvent ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:startEvent>`;
        case "task":
          return `    <bpmn:task ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:task>`;
        case "exclusive_gateway":
          return `    <bpmn:exclusiveGateway ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:exclusiveGateway>`;
        case "end_event":
          return `    <bpmn:endEvent ${attrs}>${body ? `\n${body}\n    ` : ""}</bpmn:endEvent>`;
      }
    })
    .join("\n");

  const sequenceFlows = model.flows
    .map((flow) => {
      const label = flow.label.trim() ? ` name="${escapeXml(flow.label)}"` : "";
      return `    <bpmn:sequenceFlow id="${xmlId(flow.id)}" sourceRef="${xmlId(flow.sourceId)}" targetRef="${xmlId(flow.targetId)}"${label} />`;
    })
    .join("\n");

  const laneSet = `    <bpmn:laneSet id="${processId}_laneSet">
${model.lanes
  .map((lane) => {
    const refs = laneFlowRefs
      .get(lane.id)!
      .map((ref) => `        <bpmn:flowNodeRef>${ref}</bpmn:flowNodeRef>`)
      .join("\n");
    return `      <bpmn:lane id="${xmlId(lane.id)}" name="${escapeXml(lane.name)}">
${refs}
      </bpmn:lane>`;
  })
  .join("\n")}
    </bpmn:laneSet>`;

  const textAnnotations = model.artifacts
    .filter((artifact) => artifact.type === "text_annotation")
    .map((artifact) => {
      const textAnnotationId = xmlId(artifact.id);
      const annotation = `    <bpmn:textAnnotation id="${textAnnotationId}">
      <bpmn:text>${escapeXml(artifact.text)}</bpmn:text>
    </bpmn:textAnnotation>`;

      if (!artifact.attachedToNodeId) {
        return annotation;
      }

      const associationId = `${textAnnotationId}_association`;
      const association = `    <bpmn:association id="${associationId}" sourceRef="${xmlId(
        artifact.attachedToNodeId
      )}" targetRef="${textAnnotationId}" />`;

      return `${annotation}\n${association}`;
    })
    .join("\n");

  const processBody = [laneSet, flowElements, sequenceFlows, textAnnotations]
    .filter(Boolean)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="${processId}_definitions"
  targetNamespace="https://diagramm.app/bpmn/v1">
  <bpmn:process id="${processId}" name="${escapeXml(model.process.name)}" isExecutable="false">
${processBody}
  </bpmn:process>
  <bpmn:collaboration id="${processId}_collaboration">
    <bpmn:participant id="${xmlId(participant.id)}" name="${escapeXml(
      participant.name
    )}" processRef="${processId}" />
  </bpmn:collaboration>
</bpmn:definitions>
`;
}
