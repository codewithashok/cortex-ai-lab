export type DocumentChunk = {
  chunk_index: number;
  content: string;
  source_filename: string;
  page_number: number | null;
};

export type ProcessDocumentResponse = {
  filename: string;
  chunk_count: number;
  chunks: DocumentChunk[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function processDocument(file: File): Promise<ProcessDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/documents/process`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Upload failed: ${response.status}`);
  }

  return response.json();
}
