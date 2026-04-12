"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronRight, FileType, Sparkles, Upload, X } from "lucide-react";

import { ExtractionProgressCard } from "@/components/extraction-progress-card";
import type { Translations } from "@/lib/i18n";
import type { DiagramKind } from "@/types/process";

export function NewProcessForm({ t }: { t: Translations }) {
  const router = useRouter();
  const [progressStage, setProgressStage] = useState<"idle" | "upload" | "extract" | "review">("idle");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentName, setDocumentName] = useState("policy.txt");
  const [documentText, setDocumentText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [diagramKind, setDiagramKind] = useState<DiagramKind>("swimlane");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setProgressStage("upload");

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("documentName", file?.name ?? documentName);
    formData.append("documentText", documentText);
    formData.append("diagramKind", diagramKind);

    if (file) {
      formData.append("file", file);
    }

    const response = await fetch("/api/processes", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      setSubmitting(false);
      setProgressStage("idle");
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? t.generateProcessMap);
      return;
    }

    const created = (await response.json()) as { id: string };
    setProgressStage("extract");
    const extractResponse = await fetch(`/api/processes/${created.id}/extract`, { method: "POST" });

    if (!extractResponse.ok) {
      const payload = (await extractResponse.json().catch(() => null)) as { error?: string } | null;
      setSubmitting(false);
      setProgressStage("idle");
      setError(payload?.error ?? t.reviewTitle);
      return;
    }

    setProgressStage("review");
    router.push(`/processes/${created.id}/review`);
  }

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0] ?? null;

    if (droppedFile) {
      setFile(droppedFile);
      setDocumentName(droppedFile.name);
      setDocumentText("");
    }
  }, []);

  const canSubmit = title.trim().length > 0 && (Boolean(file) || documentText.trim().length > 0);

  function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  const progressTitle =
    progressStage === "upload"
      ? t.creatingDraft
      : progressStage === "extract"
        ? t.extractingWorkflow
        : progressStage === "review"
          ? t.preparingReview
          : t.analyzeDocument;

  return (
    <>
    <form className="mx-auto max-w-2xl" onSubmit={onSubmit}>
      <header className="sticky top-0 z-10 -mx-5 -mt-6 mb-8 border-b border-[var(--line)] bg-[var(--bg)]/95 px-5 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex h-6 items-center">
          <h1 className="text-lg font-semibold text-[var(--ink)]">{t.uploadTitle}</h1>
        </div>
      </header>

      <div className="mb-8 flex items-center gap-2 text-sm">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-medium text-white">
          1
        </span>
        <span className="font-medium text-[var(--ink)]">{t.uploadStepUpload}</span>
        <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--panel-strong)] text-xs font-medium text-[var(--muted)]">
          2
        </span>
        <span className="text-[var(--muted)]">{t.uploadStepReview}</span>
        <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--panel-strong)] text-xs font-medium text-[var(--muted)]">
          3
        </span>
        <span className="text-[var(--muted)]">{t.uploadStepEdit}</span>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6">
          <label className="mb-3 block text-sm font-medium text-[var(--ink)]">{t.uploadFile}</label>

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-[var(--panel-strong)]/60"
              }`}
            >
              <input
                type="file"
                accept=".pdf,.txt,.md,text/plain,application/pdf"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setFile(nextFile);
                  if (nextFile) {
                    setDocumentName(nextFile.name);
                    setDocumentText("");
                  }
                }}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--panel-strong)]">
                <Upload className="h-6 w-6 text-[var(--muted)]" strokeWidth={2} />
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--ink)]">{t.dropDocument}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t.browseFiles}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">PDF</span>
                <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">TXT</span>
                <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">MD</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--accent-soft)]">
                  <FileType className="h-5 w-5 text-[var(--accent)]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">{file.name}</p>
                  <p className="text-xs text-[var(--muted)]">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--panel)]"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          )}

          {!file ? (
            <div className="mt-4">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--line)]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[var(--panel)] px-2 text-[var(--muted)]">{t.pastePolicy}</span>
                </div>
              </div>
              <textarea
                className="min-h-[120px] w-full resize-none rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] leading-7 outline-none transition focus:border-[var(--accent)]"
                value={documentText}
                onChange={(event) => setDocumentText(event.target.value)}
                placeholder={t.pastePolicyPlaceholder}
                required={!file}
              />
              {documentText.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--muted)]">{documentText.length} {t.charactersCount}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">{t.processTitleField}</label>
              <input
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition focus:border-[var(--accent)]"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.processTitlePlaceholder}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">
                {t.contextNotes} <span className="font-normal text-[var(--muted)]">(optional)</span>
              </label>
              <textarea
                className="min-h-[80px] w-full resize-none rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition focus:border-[var(--accent)]"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t.contextNotesPlaceholder}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ink)]">{t.documentName}</label>
              <input
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition focus:border-[var(--accent)]"
                value={documentName}
                onChange={(event) => setDocumentName(event.target.value)}
                placeholder="procurement_policy_v2.pdf"
                disabled={Boolean(file)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6">
          <label className="mb-3 block text-sm font-medium text-[var(--ink)]">{t.diagramType}</label>
          <div className="grid grid-cols-2 gap-3">
            {(["swimlane", "flowchart"] as DiagramKind[]).map((kind) => (
              <button
                type="button"
                key={kind}
                onClick={() => setDiagramKind(kind)}
                className={`flex flex-col items-center rounded-lg border-2 p-4 text-left transition-all ${
                  kind === diagramKind
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] hover:border-[var(--line-strong)]"
                }`}
              >
                <div className="mb-3 flex h-12 w-full items-center justify-center">
                  {kind === "swimlane" ? (
                    <div className="flex gap-1">
                      <div className="h-8 w-8 rounded border border-current opacity-60" />
                      <div className="h-8 w-8 rounded border border-current opacity-60" />
                      <div className="h-8 w-8 rounded border border-current opacity-60" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-4 w-8 rounded border border-current opacity-60" />
                      <div className="h-2 w-px bg-current opacity-60" />
                      <div className="h-4 w-8 rounded border border-current opacity-60" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-[var(--ink)]">
                  {kind === "swimlane" ? t.swimlaneDiagram : t.flowchart}
                </span>
                <span className="mt-1 text-center text-xs text-[var(--muted)]">
                  {kind === "swimlane"
                    ? t.swimlaneHelp
                    : t.flowchartHelp}
                </span>
              </button>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--deep)] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {progressTitle}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={2} />
              {t.generateProcessDiagram}
            </>
          )}
        </button>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {!canSubmit ? <p className="text-center text-xs text-[var(--muted)]">{t.uploadContinueHint}</p> : null}
      </div>
    </form>

    {submitting ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-[var(--bg)]/70 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-lg">
          <ExtractionProgressCard
            stage={progressStage}
            documentName={file?.name ?? documentName}
            t={t}
          />
        </div>
      </div>
    ) : null}
    </>
  );
}
