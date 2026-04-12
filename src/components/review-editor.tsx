"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  User,
  X
} from "lucide-react";

import type { Translations } from "@/lib/i18n";
import type { ExtractionResult, ProcessStep, StepType } from "@/types/process";

export function ReviewEditor({
  processId,
  initialExtraction,
  t
}: {
  processId: string;
  initialExtraction: ExtractionResult;
  t: Translations;
}) {
  const router = useRouter();
  const [extraction, setExtraction] = useState(initialExtraction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(initialExtraction.steps[0]?.id ?? null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [draftStep, setDraftStep] = useState<ProcessStep | null>(null);

  async function saveReview() {
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/processes/${processId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraction })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to save review changes.");
      setSaving(false);
      return false;
    }

    setSaving(false);
    router.refresh();
    return true;
  }

  async function continueToEditor() {
    const saved = await saveReview();
    if (saved) {
      router.push(`/processes/${processId}/editor`);
    }
  }

  const selectedStep =
    extraction.steps.find((step) => step.id === selectedStepId) ?? extraction.steps[0] ?? null;

  const warnings = extraction.warnings;
  const actorOptions = extraction.actors;

  function getConfidenceRatio(level: string) {
    if (level === "high") return 0.95;
    if (level === "medium") return 0.78;
    return 0.55;
  }

  function getStepTypeLabel(type: string) {
    if (type === "task") return "action";
    return type;
  }

  function updateActors(
    updater: (actors: ExtractionResult["actors"]) => ExtractionResult["actors"]
  ) {
    setExtraction((current) => ({
      ...current,
      actors: updater(current.actors)
    }));
  }

  function updateSteps(
    updater: (steps: ExtractionResult["steps"]) => ExtractionResult["steps"]
  ) {
    setExtraction((current) => ({
      ...current,
      steps: updater(current.steps)
    }));
  }

  function updateSelectedStep(
    updater: (step: ProcessStep) => ProcessStep
  ) {
    if (!selectedStepId) return;
    updateSteps((steps) =>
      steps.map((step) => (step.id === selectedStepId ? updater(step) : step))
    );
  }

  function moveStep(stepId: string, direction: -1 | 1) {
    updateSteps((steps) => {
      const index = steps.findIndex((step) => step.id === stepId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= steps.length) {
        return steps;
      }

      const next = [...steps];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function deleteStep(stepId: string) {
    updateSteps((steps) => {
      const next = steps.filter((step) => step.id !== stepId);
      const nextSelected = next[0]?.id ?? null;
      setSelectedStepId((current) => (current === stepId ? nextSelected : current));
      return next;
    });
  }

  function addStep() {
    const fallbackActorId = extraction.actors[0]?.id ?? "a1";
    const nextStep: ProcessStep = {
      id: `s${Date.now()}`,
      actorId: selectedStep?.actorId ?? fallbackActorId,
      action: t.newStepAction,
      type: "task",
      sourceRef: selectedStep?.sourceRef ?? extraction.sourceFragments[0]?.ref ?? "doc1:p1",
      confidence: "medium",
      branchLabel: "",
      branchParentId: "",
      branchTerminal: false,
      mergeTargetId: ""
    };

    updateSteps((steps) => {
      const index = selectedStepId ? steps.findIndex((step) => step.id === selectedStepId) : -1;
      if (index === -1) {
        return [...steps, nextStep];
      }

      const next = [...steps];
      next.splice(index + 1, 0, nextStep);
      return next;
    });
    setSelectedStepId(nextStep.id);
  }

  function addActor() {
    const nextActor = {
      id: `a${Date.now()}`,
      name: t.newActorName,
      type: "unknown" as const
    };

    updateActors((actors) => [...actors, nextActor]);
  }

  function deleteActor(actorId: string) {
    const fallbackActorId = extraction.actors.find((actor) => actor.id !== actorId)?.id;

    updateActors((actors) => actors.filter((actor) => actor.id !== actorId));
    if (!fallbackActorId) {
      return;
    }

    updateSteps((steps) =>
      steps.map((step) => (step.actorId === actorId ? { ...step, actorId: fallbackActorId } : step))
    );
  }

  function openStepEditor(step: ProcessStep) {
    setSelectedStepId(step.id);
    setEditingStepId(step.id);
    setDraftStep({ ...step });
  }

  function cancelStepEdit() {
    setEditingStepId(null);
    setDraftStep(null);
  }

  function saveStepEdit() {
    if (!editingStepId || !draftStep) return;

    updateSteps((steps) =>
      steps.map((step) => (step.id === editingStepId ? draftStep : step))
    );
    setEditingStepId(null);
    setDraftStep(null);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-[var(--ink)]">{t.reviewAndRefine}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-medium text-white">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-[var(--muted)]">{t.uploadStepUpload}</span>
              <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-medium text-white">
                2
              </span>
              <span className="font-medium text-[var(--ink)]">{t.uploadStepReview}</span>
              <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--panel-strong)] text-xs font-medium text-[var(--muted)]">
                3
              </span>
              <span className="text-[var(--muted)]">{t.uploadStepEdit}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={continueToEditor}
            disabled={saving}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            {saving ? t.saving : t.continueToEditor}
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </header>

      <div className="flex">
        <div className="flex-1 p-6">
          <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                {t.processTitle}
              </label>
              <input
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-lg font-medium outline-none focus:border-[var(--accent)]"
                value={extraction.processName}
                onChange={(event) =>
                  setExtraction((current) => ({
                    ...current,
                    processName: event.target.value
                  }))
                }
              />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                {t.draftSummary}
              </label>
              <textarea
                className="min-h-[96px] w-full resize-none rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)]"
                value={extraction.summary}
                onChange={(event) =>
                  setExtraction((current) => ({
                    ...current,
                    summary: event.target.value
                  }))
                }
              />
            </div>
          </div>

          {warnings.length > 0 ? (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-700" strokeWidth={2} />
                {warnings.length} {t.issuesFound}
              </div>
              <div className="mt-3 space-y-2">
                {warnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm text-amber-900"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-medium text-amber-900">
                      !
                    </span>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 text-sm text-[var(--muted)]">
              {t.noWarnings}
            </div>
          )}

          <div className="mb-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2 text-[var(--ink)]">
                <User className="h-4 w-4 text-[var(--muted)]" strokeWidth={2} />
                {t.detectedActors}
              </span>
              <button
                type="button"
                onClick={addActor}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                {t.addActor}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {extraction.actors.map((actor) => (
                <div
                  key={actor.id}
                  className="group flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5"
                >
                  <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  <input
                    className="w-28 border-0 bg-transparent p-0 text-sm font-medium text-[var(--ink)] outline-none"
                    value={actor.name}
                    onChange={(event) =>
                      setExtraction((current) => ({
                        ...current,
                        actors: current.actors.map((item) =>
                          item.id === actor.id ? { ...item, name: event.target.value } : item
                        )
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => deleteActor(actor.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-[var(--muted)]" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="mb-3 flex items-center justify-between text-sm font-medium">
              <span className="text-[var(--ink)]">{t.extractedSteps}</span>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                {t.addStep}
              </button>
            </div>
            <div className="space-y-2">
              {extraction.steps.map((step, index) => {
                const actorName =
                  extraction.actors.find((actor) => actor.id === step.actorId)?.name ?? step.actorId;
                const isEditing = editingStepId === step.id;
                const rowStep = isEditing && draftStep ? draftStep : step;

                return (
                  <div
                    key={step.id}
                    onClick={() => setSelectedStepId(step.id)}
                    className={`group flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                      selectedStepId === step.id
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]/60"
                        : "border-[var(--line)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <button
                      type="button"
                      className="mt-1 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <GripVertical className="h-4 w-4 text-[var(--muted)]" strokeWidth={2} />
                    </button>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--panel-strong)] text-xs font-medium text-[var(--muted)]">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={rowStep.actorId}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                setDraftStep((current) =>
                                  current ? { ...current, actorId: event.target.value } : current
                                )
                              }
                              className="h-7 rounded-lg border border-[var(--line)] bg-white px-2 text-xs font-medium text-[var(--accent)] outline-none focus:border-[var(--accent)]"
                            >
                              {actorOptions.map((actor) => (
                                <option key={actor.id} value={actor.id}>
                                  {actor.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={rowStep.type}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                setDraftStep((current) =>
                                  current ? { ...current, type: event.target.value as StepType } : current
                                )
                              }
                              className="h-7 rounded-lg border border-[var(--line)] bg-white px-2 text-xs capitalize text-[var(--muted)] outline-none focus:border-[var(--accent)]"
                            >
                              <option value="task">task</option>
                              <option value="decision">decision</option>
                            </select>
                          </div>
                          <textarea
                            value={rowStep.action}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              setDraftStep((current) =>
                                current ? { ...current, action: event.target.value } : current
                              )
                            }
                            className="min-h-[68px] w-full resize-none rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                saveStepEdit();
                              }}
                              className="inline-flex h-8 items-center rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelStepEdit();
                              }}
                              className="inline-flex h-8 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--muted)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[var(--accent)]">{actorName}</span>
                            <span className="text-xs text-[var(--muted)] capitalize">{getStepTypeLabel(step.type)}</span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--ink)]">{step.action}</p>
                        </>
                      )}
                      <p className="mt-1 text-xs text-[var(--muted)]">Source: {step.sourceRef}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          moveStep(step.id, -1);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
                      >
                        <ArrowUp className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          moveStep(step.id, 1);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
                      >
                        <ArrowDown className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (editingStepId === step.id) {
                            cancelStepEdit();
                          } else {
                            openStepEditor(step);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel-strong)] hover:text-[var(--ink)]"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteStep(step.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="w-[420px] shrink-0 border-l border-[var(--line)] bg-[var(--panel)] p-6">
          {selectedStep ? (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  {t.node}
                </label>
                <p className="text-sm text-[var(--ink)]">{selectedStep.action}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    {t.actors}
                  </label>
                  <p className="text-sm text-[var(--ink)]">
                    {actorOptions.find((actor) => actor.id === selectedStep.actorId)?.name ?? selectedStep.actorId}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    {t.typeLabel}
                  </label>
                  <p className="text-sm capitalize text-[var(--ink)]">{selectedStep.type}</p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  {t.sourceReference}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    value={selectedStep.sourceRef}
                    onChange={(event) =>
                      updateSelectedStep((step) => ({ ...step, sourceRef: event.target.value }))
                    }
                  />
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--accent)]">
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  {t.confidenceScore}
                </label>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-strong)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all"
                      style={{ width: `${Math.round(getConfidenceRatio(selectedStep.confidence) * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {Math.round(getConfidenceRatio(selectedStep.confidence) * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveStep(selectedStep.id, -1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
                >
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(selectedStep.id, 1)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-3 text-sm text-[var(--ink)]"
                >
                  <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => deleteStep(selectedStep.id)}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Delete
                </button>
              </div>

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveReview}
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-xl bg-[var(--accent)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                >
                  {saving ? t.saving : t.saveChanges}
                </button>
                <Link
                  href={`/processes/${processId}/editor`}
                  className="inline-flex rounded-lg bg-[var(--panel-strong)] px-4 py-2.5 text-[14px] font-medium text-[var(--ink)]"
                >
                  {t.openEditor}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">{t.selectStepHint}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
