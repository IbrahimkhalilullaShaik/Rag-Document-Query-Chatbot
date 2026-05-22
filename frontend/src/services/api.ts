// ============================================================
// API Service - All backend communication
// ============================================================

import type {
  ChatRequest,
  ChatResponse,
  DocumentMetadata,
  StreamChunk,
  UploadResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, body.detail || "Request failed");
  }
  return response.json();
}

// ── Documents ──────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function listDocuments(): Promise<DocumentMetadata[]> {
  const response = await fetch(`${API_BASE}/documents/`);
  const data = await handleResponse<{ documents: DocumentMetadata[]; total: number }>(response);
  return data.documents;
}

export async function deleteDocument(docId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/documents/${docId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, body.detail || "Delete failed");
  }
}

// ── Chat ───────────────────────────────────────────────────

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<ChatResponse>(response);
}

export async function* streamChatMessage(
  request: ChatRequest
): AsyncGenerator<StreamChunk> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Stream failed" }));
    throw new ApiError(response.status, body.detail);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const chunk: StreamChunk = JSON.parse(line.slice(6));
          yield chunk;
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }
}

export { ApiError };
