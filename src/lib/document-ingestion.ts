import type { DocumentType, SourceFragment } from "@/types/process";
import { getUploadStorage } from "@/lib/file-storage";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const allowedUploadTypes = {
  ".pdf": {
    documentType: "pdf" as const,
    mimeTypes: new Set(["application/pdf"])
  },
  ".txt": {
    documentType: "text" as const,
    mimeTypes: new Set(["text/plain"])
  },
  ".md": {
    documentType: "text" as const,
    mimeTypes: new Set(["text/markdown", "text/plain"])
  }
} as const;

export interface ParsedDocumentInput {
  documentName: string;
  documentText: string;
  documentType: DocumentType;
  sourceFragments: SourceFragment[];
  storageUrl: string | null;
}

function extensionOf(name: string) {
  const match = /\.[a-z0-9]+$/i.exec(name.trim());
  return match ? match[0].toLowerCase() : "";
}

export function buildSourceFragments(documentName: string, rawText: string) {
  return rawText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map(
      (text, index): SourceFragment => ({
        ref: `doc1:p${index + 1}`,
        fileName: documentName,
        text
      })
    );
}

function normalizeText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateUploadedFile(file: File) {
  if (!file.name.trim()) {
    throw new Error("Uploaded file must include a file name.");
  }

  if (file.size === 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds the 10MB upload limit.");
  }

  const fileExtension = extensionOf(file.name);
  const config = allowedUploadTypes[fileExtension as keyof typeof allowedUploadTypes];

  if (!config) {
    throw new Error("Only PDF, TXT, and MD files are supported.");
  }

  if (file.type && !config.mimeTypes.has(file.type)) {
    throw new Error(`Unsupported file type '${file.type}' for ${fileExtension} uploads.`);
  }

  return config.documentType;
}

export async function parseUploadedDocument(file: File): Promise<ParsedDocumentInput> {
  const documentType = validateUploadedFile(file);

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getUploadStorage();
  const stored = await storage.put({
    originalName: file.name,
    contentType: file.type,
    buffer
  });

  const rawText =
    documentType === "pdf"
      ? await extractPdfText(buffer)
      : buffer.toString("utf8");

  const documentText = normalizeText(rawText);

  if (!documentText) {
    throw new Error("No readable text could be extracted from the uploaded file.");
  }

  return {
    documentName: file.name,
    documentText,
    documentType,
    sourceFragments: buildSourceFragments(file.name, documentText),
    storageUrl: stored.storageUrl
  };
}

async function extractPdfText(buffer: Buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

export function parsePastedDocument(documentName: string, rawText: string): ParsedDocumentInput {
  const normalizedName = documentName.trim() || "policy.txt";
  const documentText = normalizeText(rawText);

  if (!documentText) {
    throw new Error("Please provide policy or SOP text.");
  }

  return {
    documentName: normalizedName,
    documentText,
    documentType: "text",
    sourceFragments: buildSourceFragments(normalizedName, documentText),
    storageUrl: null
  };
}
