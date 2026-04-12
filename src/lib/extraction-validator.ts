import type { Locale } from "@/lib/i18n";
import type { ExtractionResult } from "@/types/process";

const technicalTerms = [
  /\bopenai\b/i,
  /\bprisma\b/i,
  /\bjson\b/i,
  /\bmultipart\b/i,
  /\bupload endpoint\b/i,
  /\bapi route\b/i,
  /\bbackend\b/i,
  /\bfrontend\b/i,
  /\bpostgres\b/i,
  /\bdatabase\b/i
];

export interface ExtractionValidationResult {
  issues: string[];
  warnings: string[];
}

function msg(locale: Locale, en: string, mn: string) {
  return locale === "mn" ? mn : en;
}

export function validateExtraction(extraction: ExtractionResult, locale: Locale = "en"): ExtractionValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  const actorIds = new Set(extraction.actors.map((actor) => actor.id));
  const stepIds = new Set(extraction.steps.map((step) => step.id));
  const sourceRefs = new Set(extraction.sourceFragments.map((fragment) => fragment.ref));

  extraction.steps.forEach((step) => {
    if (!actorIds.has(step.actorId)) {
      issues.push(msg(locale,
        `Step ${step.id} references missing actor ${step.actorId}.`,
        `${step.id} алхам нь тодорхойгүй оролцогч (${step.actorId})-д хамааралтай байна.`
      ));
    }

    if (!sourceRefs.has(step.sourceRef)) {
      warnings.push(msg(locale,
        `Step ${step.id} references unknown source ${step.sourceRef}.`,
        `${step.id} алхамын эх сурвалж (${step.sourceRef}) олдсонгүй.`
      ));
    }

    if (technicalTerms.some((term) => term.test(step.action))) {
      issues.push(msg(locale,
        `Step ${step.id} appears technical/meta rather than business-facing.`,
        `${step.id} алхам нь бизнесийн үйлдлийн оронд техникийн агуулгатай байна.`
      ));
    }

    if (step.branchLabel && step.branchParentId.trim().length === 0) {
      warnings.push(msg(locale,
        `Branch step ${step.id} is missing a parent decision reference.`,
        `${step.id} салаа алхамд эцэг шийдвэрийн лавлагаа байхгүй байна.`
      ));
    }
  });

  extraction.edges.forEach((edge, index) => {
    if (!stepIds.has(edge.from) || !stepIds.has(edge.to)) {
      issues.push(msg(locale,
        `Edge ${index + 1} connects invalid step ids.`,
        `${index + 1}-р холболт нь буруу алхамуудыг холбосон байна.`
      ));
    }
  });

  extraction.steps
    .filter((step) => step.type === "decision")
    .forEach((step) => {
      const outgoing = extraction.edges.filter((edge) => edge.from === step.id);
      const branchChildren = extraction.steps.filter((candidate) => candidate.branchParentId === step.id);

      if (outgoing.length === 0 && branchChildren.length === 0) {
        warnings.push(msg(locale,
          `Decision ${step.id} has no outgoing edges.`,
          `"${step.id}" шийдвэрт гарах холболт байхгүй байна.`
        ));
        return;
      }

      if (branchChildren.length >= 2 && outgoing.length < 2) {
        warnings.push(msg(locale,
          `Decision ${step.id} should expose each branch as an outgoing edge.`,
          `"${step.id}" шийдвэрийн салаа бүр тусдаа гарах холболттой байх хэрэгтэй.`
        ));
      }

      if (outgoing.some((edge) => edge.label.trim().length === 0) && branchChildren.length > 0) {
        warnings.push(msg(locale,
          `Decision ${step.id} has unlabeled outgoing flow.`,
          `"${step.id}" шийдвэрийн зарим гарах холболт шошгогүй байна.`
        ));
      }
    });

  return { issues, warnings };
}
