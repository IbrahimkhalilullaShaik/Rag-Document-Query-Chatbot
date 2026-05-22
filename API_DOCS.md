# DocQA API Documentation

Base URL: `http://localhost:8000/api/v1`

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

---

## Authentication

No authentication required for local development.
For production, add API key middleware or use Vercel/Railway environment-based access control.

---

## Endpoints

### Health

#### `GET /health`
Check API health and document count.

**Response 200:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "documents_loaded": 3
}
```

---

### Documents

#### `POST /documents/upload`
Upload and process a PDF or TXT document.

**Request:** `multipart/form-data`
- `file` (required): PDF or TXT file, max 50MB

**Response 201:**
```json
{
  "success": true,
  "doc_id": "my_report_abc123def456",
  "filename": "my_report.pdf",
  "message": "Document processed successfully",
  "chunk_count": 47,
  "page_count": 12
}
```

**Errors:**
- `400` – Unsupported file type, file too large, or empty file
- `500` – Parsing or embedding failure

---

#### `GET /documents/`
List all uploaded documents.

**Response 200:**
```json
{
  "documents": [
    {
      "doc_id": "my_report_abc123def456",
      "filename": "my_report.pdf",
      "file_type": "pdf",
      "file_size": 1048576,
      "page_count": 12,
      "chunk_count": 47,
      "status": "ready",
      "uploaded_at": "2025-01-15T10:30:00Z",
      "error": null
    }
  ],
  "total": 1
}
```

**Document statuses:**
| Status | Meaning |
|--------|---------|
| `pending` | Queued for processing |
| `processing` | Being parsed and embedded |
| `ready` | Indexed and available for Q&A |
| `failed` | Processing failed (see `error` field) |

---

#### `DELETE /documents/{doc_id}`
Remove a document and its vector store entries.

**Response 204:** No content

**Errors:**
- `404` – Document not found

---

### Chat

#### `POST /chat/`
Ask a question and receive a complete answer.

**Request body:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "question": "What are the main findings about AI in radiology?",
  "document_ids": ["doc_abc123", "doc_def456"],
  "conversation_history": [
    {
      "role": "user",
      "content": "What is AlphaFold2?",
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "AlphaFold2 is a DeepMind model that predicts protein structures...",
      "timestamp": "2025-01-15T10:30:05Z"
    }
  ]
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string | Yes | UUID for session tracking |
| `question` | string | Yes | User's question (1–2000 chars) |
| `document_ids` | string[] | No | Filter to specific docs; omit for all |
| `conversation_history` | Message[] | No | Last N exchanges for context |

**Response 200:**
```json
{
  "answer": "AI has demonstrated remarkable accuracy in radiology...",
  "sources": [
    {
      "chunk_id": "my_report_abc123_p3_chunk_12",
      "doc_id": "my_report_abc123def456",
      "filename": "my_report.pdf",
      "content": "AI systems trained on millions of chest X-rays can now detect...",
      "page_number": 3,
      "chunk_index": 12,
      "similarity_score": 0.8734,
      "start_char": 4521,
      "end_char": 5319
    }
  ],
  "confidence_score": 0.812,
  "is_out_of_scope": false,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "processing_time_ms": 1243.5
}
```

**Out-of-scope response** (when answer not in documents):
```json
{
  "answer": "I could not find relevant information in the uploaded documents.",
  "sources": [],
  "confidence_score": 0.0,
  "is_out_of_scope": true,
  "session_id": "...",
  "processing_time_ms": 312.1
}
```

---

#### `POST /chat/stream`
Ask a question and receive a streaming response via Server-Sent Events.

**Request body:** Same as `POST /chat/`

**Response:** `text/event-stream`

The stream emits three event types:

**1. Token chunks** (during generation):
```
data: {"type": "token", "content": "AI "}
data: {"type": "token", "content": "has "}
data: {"type": "token", "content": "demonstrated "}
```

**2. Done event** (when complete):
```
data: {
  "type": "done",
  "sources": [...],
  "confidence_score": 0.812,
  "is_out_of_scope": false
}
```

**3. Error event** (on failure):
```
data: {"type": "error", "error": "Stream failed. Please try again."}
```

**JavaScript client example:**
```javascript
const response = await fetch('/api/v1/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id, question, conversation_history })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      const chunk = JSON.parse(line.slice(6));
      if (chunk.type === 'token') console.log(chunk.content);
      if (chunk.type === 'done') console.log('Sources:', chunk.sources);
    }
  }
}
```

---

## RAG Pipeline Flow

```
User Question
     │
     ▼
┌─────────────────────────────────────────────┐
│  1. Embed Query                             │
│     sentence-transformers/all-mpnet-base-v2  │
│     → 768-dim L2-normalized vector          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  2. FAISS Similarity Search                 │
│     IndexFlatIP (inner product = cosine)    │
│     top_k=5, threshold=0.35                 │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  3. Context Assembly                        │
│     Retrieved chunks + metadata            │
│     Conversation history (last 3 turns)    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  4. LLM Generation (Anthropic/OpenAI)       │
│     Strict system prompt: context-only      │
│     Streaming token output                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  5. Confidence Scoring                      │
│     Weighted similarity + source count      │
│     Out-of-scope detection                  │
└─────────────────────────────────────────────┘
```

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `CHUNK_SIZE` | `800` | Target characters per chunk |
| `CHUNK_OVERLAP` | `150` | Overlap between adjacent chunks |
| `TOP_K_RETRIEVAL` | `5` | Number of chunks to retrieve |
| `SIMILARITY_THRESHOLD` | `0.35` | Minimum cosine similarity to include |
| `MAX_CONTEXT_TOKENS` | `3000` | Token budget for LLM context |
| `MAX_FILE_SIZE_MB` | `50` | Maximum upload file size |

---

## Error Codes

| Code | Meaning |
|------|---------|
| `400` | Bad request (validation error, unsupported file, etc.) |
| `404` | Resource not found |
| `500` | Internal server error |

All errors return: `{"detail": "Error message"}`
