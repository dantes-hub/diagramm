import { redirect } from "next/navigation";

import { finalizeDiagram } from "@/lib/process-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await finalizeDiagram(id);
  redirect(`/processes/${id}/editor`);
}
