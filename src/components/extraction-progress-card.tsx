"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  GitBranch,
  ScanText,
  Sparkles,
  Upload,
  Users
} from "lucide-react";

import type { Translations } from "@/lib/i18n";

type ProgressStage = "idle" | "upload" | "extract" | "review";
type StepStatus = "pending" | "active" | "complete";

interface ProgressStep {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export function ExtractionProgressCard({
  stage,
  documentName,
  t
}: {
  stage: ProgressStage;
  documentName: string;
  t: Translations;
}) {
  const [extractSubstep, setExtractSubstep] = useState(0);

  useEffect(() => {
    if (stage !== "extract") {
      setExtractSubstep(0);
      return;
    }

    const interval = window.setInterval(() => {
      setExtractSubstep((current) => (current + 1) % 3);
    }, 1100);

    return () => window.clearInterval(interval);
  }, [stage]);

  const steps = useMemo<ProgressStep[]>(
    () => [
      {
        key: "uploading",
        label: t.progressUpload,
        description: t.progressUploadDescription,
        icon: Upload
      },
      {
        key: "reading",
        label: t.progressRead,
        description: t.progressReadDescription,
        icon: ScanText
      },
      {
        key: "actors",
        label: t.progressActors,
        description: t.progressActorsDescription,
        icon: Users
      },
      {
        key: "decisions",
        label: t.progressDecisions,
        description: t.progressDecisionsDescription,
        icon: GitBranch
      },
      {
        key: "building",
        label: t.progressBuild,
        description: t.progressBuildDescription,
        icon: Sparkles
      },
      {
        key: "review",
        label: t.progressReview,
        description: t.progressReviewDescription,
        icon: FileText
      }
    ],
    [t]
  );

  const activeIndex =
    stage === "upload" ? 0 : stage === "extract" ? 2 + extractSubstep : stage === "review" ? 5 : -1;

  function statusFor(index: number): StepStatus {
    if (stage === "review") return "complete";
    if (stage === "idle") return "pending";
    if (index < activeIndex) return "complete";
    if (index === activeIndex) return "active";
    return "pending";
  }

  const completedSteps = stage === "review" ? steps.length : Math.max(activeIndex, 0);
  const progressPercent =
    stage === "idle" ? 0 : stage === "review" ? 100 : Math.max(18, ((completedSteps + 1) / steps.length) * 100);

  const headerTitle =
    stage === "upload"
      ? t.creatingDraft
      : stage === "extract"
        ? t.extractingWorkflow
        : stage === "review"
          ? t.preparingReview
          : t.analyzeDocument;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-[var(--ink)]">{headerTitle}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{documentName}</p>
      </div>

      <div className="space-y-1">
        {steps.map((step, index) => {
          const status = statusFor(index);
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-all ${
                status === "active"
                  ? "bg-[var(--panel-strong)]"
                  : status === "complete"
                    ? "opacity-100"
                    : "opacity-45"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  status === "complete"
                    ? "bg-emerald-100 text-emerald-700"
                    : status === "active"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--panel-strong)] text-[var(--muted)]"
                }`}
              >
                {status === "complete" ? (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Icon className="h-4 w-4" strokeWidth={2} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--ink)]">{step.label}</p>
                {(status === "active" || status === "complete") && (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{step.description}</p>
                )}
              </div>

              {status === "active" ? (
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-strong)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              stage === "review" ? "bg-emerald-500" : "bg-[var(--accent)]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
          <span>
            {stage === "review"
              ? t.progressReady
              : `${t.progressStepLabel} ${Math.min(completedSteps + 1, steps.length)} ${t.progressOfLabel} ${steps.length}`}
          </span>
          <span>
            {stage === "review" ? t.progressReview : steps[Math.max(activeIndex, 0)]?.label ?? t.progressUpload}
          </span>
        </div>
      </div>
    </div>
  );
}
