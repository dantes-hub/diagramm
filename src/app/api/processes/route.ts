import { NextResponse } from "next/server";

import { parsePastedDocument, parseUploadedDocument } from "@/lib/document-ingestion";
import { errorResponse } from "@/lib/api-errors";
import { createDraftProcess, getDashboardProcesses } from "@/lib/process-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const processes = await getDashboardProcesses();
    return NextResponse.json(processes);
  } catch (error) {
    return errorResponse(error, "Failed to load processes.", 500);
  }
}

const MAX_TITLE_LEN = 300;
const MAX_DOC_TEXT_LEN = 400_000; // ~400 KB of plain text

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const title = String(formData.get("title") ?? "Untitled process").slice(0, MAX_TITLE_LEN);
      const description = String(formData.get("description") ?? "").slice(0, 1000);
      const diagramKind = String(formData.get("diagramKind") ?? "");
      const pastedText = String(formData.get("documentText") ?? "");
      const documentName = String(formData.get("documentName") ?? "policy.txt").slice(0, 500);
      const file = formData.get("file");

      if (!diagramKind) {
        return NextResponse.json({ error: "Diagram kind is required." }, { status: 400 });
      }

      if (pastedText.length > MAX_DOC_TEXT_LEN) {
        return NextResponse.json({ error: "Document text is too large." }, { status: 413 });
      }

      const parsed =
        file instanceof File && file.size > 0
          ? await parseUploadedDocument(file)
          : parsePastedDocument(documentName, pastedText);

      const process = await createDraftProcess({
        title,
        description,
        documentName: parsed.documentName,
        documentText: parsed.documentText,
        documentType: parsed.documentType,
        diagramKind: diagramKind === "flowchart" ? "flowchart" : "swimlane",
        sourceFragments: parsed.sourceFragments,
        storageUrl: parsed.storageUrl
      });

      return NextResponse.json(process, { status: 201 });
    }

    const body = await request.json();

    if (!body.documentText || !body.documentName || !body.diagramKind) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (String(body.documentText).length > MAX_DOC_TEXT_LEN) {
      return NextResponse.json({ error: "Document text is too large." }, { status: 413 });
    }

    const parsed = parsePastedDocument(
      String(body.documentName).slice(0, 500),
      String(body.documentText)
    );
    const process = await createDraftProcess({
      title: String(body.title ?? "Untitled process").slice(0, MAX_TITLE_LEN),
      description: String(body.description ?? "").slice(0, 1000),
      documentName: parsed.documentName,
      documentText: parsed.documentText,
      documentType: parsed.documentType,
      diagramKind: body.diagramKind,
      sourceFragments: parsed.sourceFragments,
      storageUrl: parsed.storageUrl
    });

    return NextResponse.json(process, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Failed to ingest document.", 400);
  }
}
