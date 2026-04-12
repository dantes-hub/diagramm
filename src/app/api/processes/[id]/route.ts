import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-errors";
import { deleteProcessDraft, getProcessOrThrow, updateDiagramDraft } from "@/lib/process-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const process = await getProcessOrThrow(id);
    return NextResponse.json(process);
  } catch (error) {
    return errorResponse(error, "Not found", 404);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = (await request.json()) as { diagram?: unknown };

    if (!body.diagram) {
      return NextResponse.json({ error: "Diagram payload is required." }, { status: 400 });
    }

    const updated = await updateDiagramDraft(id, body.diagram as never);
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, "Failed to update diagram.", 400);
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const deleted = await deleteProcessDraft(id);

    if (!deleted) {
      return NextResponse.json({ error: "Process not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Failed to delete process.", 400);
  }
}
