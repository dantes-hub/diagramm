import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api-errors";
import { requireViewer } from "@/lib/auth";
import { getLocaleFromCookies } from "@/lib/i18n";
import { checkRateLimit } from "@/lib/rate-limit";
import { runExtraction } from "@/lib/process-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const viewer = await requireViewer();
    const { allowed, remaining } = checkRateLimit(viewer.appUserId);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many extraction requests. Try again in an hour." },
        { status: 429, headers: { "Retry-After": "3600", "X-RateLimit-Remaining": "0" } }
      );
    }

    const locale = await getLocaleFromCookies();
    const updated = await runExtraction(id, locale);

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated, {
      headers: { "X-RateLimit-Remaining": String(remaining) }
    });
  } catch (error) {
    return errorResponse(error, "Extraction failed.", 500);
  }
}
