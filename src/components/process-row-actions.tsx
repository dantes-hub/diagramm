"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { DeleteProcessModal } from "@/components/delete-process-modal";

export function ProcessRowActions({
  processId,
  processTitle,
  label = "Delete",
  cancelLabel = "Cancel",
  processLabel = "Process",
  deletingLabel = "Deleting...",
  description = "Remove this process from your workspace."
}: {
  processId: string;
  processTitle: string;
  label?: string;
  cancelLabel?: string;
  processLabel?: string;
  deletingLabel?: string;
  description?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  }

  async function confirmDelete() {
    setIsDeleting(true);

    const response = await fetch(`/api/processes/${processId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(payload?.error ?? "Failed to delete process.");
      setIsDeleting(false);
      return;
    }

    setOpen(false);
    setIsDeleting(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </button>
      <DeleteProcessModal
        open={open}
        processTitle={processTitle}
        description={description}
        cancelLabel={cancelLabel}
        confirmLabel={label}
        processLabel={processLabel}
        deletingLabel={deletingLabel}
        onClose={() => {
          if (!isDeleting) setOpen(false);
        }}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}
