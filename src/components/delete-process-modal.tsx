"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

export function DeleteProcessModal({
  open,
  processTitle,
  description,
  cancelLabel,
  confirmLabel,
  processLabel,
  deletingLabel,
  onClose,
  onConfirm,
  isDeleting
}: {
  open: boolean;
  processTitle: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  processLabel: string;
  deletingLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-stone-950/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        <div className="border-b border-[var(--line)] px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" strokeWidth={2} />
            <h2 className="text-base font-semibold text-[var(--ink)]">{confirmLabel}</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-strong)]/45 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {processLabel}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--ink)]">{processTitle}</p>
          </div>

          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                <Trash2 className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">{confirmLabel}</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
                  This removes the process and its saved diagram draft from this workspace.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--line)] px-4 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--panel-strong)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDeleting ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {deletingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
