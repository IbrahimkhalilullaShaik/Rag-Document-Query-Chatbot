// ============================================================
// DocQA - TypeScript Type Definitions
// ============================================================

export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface DocumentMetadata {
  doc_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  page_count?: number;
  chunk_count: number;
  status: DocumentStatus;
  uploaded_at: string;
  error?: string;
}

export interface SourceChunk {
  chunk_id: string;
  doc_id: string;
  filename: string;
  content: string;
  page_number?: number;
  chunk_index: number;
  similarity_score: number;
  start_char?: number;
  end_char?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: SourceChunk[];
  confidence_score?: number;
  is_out_of_scope?: boolean;
  processing_time_ms?: number;
  isStreaming?: boolean;
}

export interface ChatRequest {
  session_id: string;
  question: string;
  document_ids?: string[];
  conversation_history: Array<{ role: string; content: string; timestamp: string }>;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  confidence_score: number;
  is_out_of_scope: boolean;
  session_id: string;
  processing_time_ms: number;
}

export interface StreamChunk {
  type: "token" | "sources" | "done" | "error";
  content?: string;
  sources?: SourceChunk[];
  confidence_score?: number;
  is_out_of_scope?: boolean;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  doc_id: string;
  filename: string;
  message: string;
  chunk_count: number;
  page_count?: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  documents_loaded: number;
}
