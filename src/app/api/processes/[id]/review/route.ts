import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-errors";
import { updateExtractionReview } from "@/lib/process-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const updated = await updateExtractionReview(id, body.extraction);

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, "Failed to save review.", 400);
  }
}
