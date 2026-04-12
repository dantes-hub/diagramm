import { errorResponse } from "@/lib/api-errors";
import { buildBpmnFileName, exportCanonicalProcessToBpmnXml } from "@/lib/bpmn-export";
import { getProcessOrThrow } from "@/lib/process-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const process = await getProcessOrThrow(id);

    if (!process.model) {
      return new Response("Process model not available for BPMN export.", { status: 400 });
    }

    const xml = exportCanonicalProcessToBpmnXml(process.model);
    const filename = buildBpmnFileName(process.title);

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return errorResponse(error, "Failed to export BPMN.", 400);
  }
}
