# DocQA — Context-Aware Document Q&A Bot

> Upload documents. Ask questions. Get precise, source-grounded answers — no hallucinations, no guessing.

A production-grade RAG (Retrieval-Augmented Generation) chatbot built with FastAPI, Next.js 15, FAISS, sentence-transformers, and Anthropic Claude (or OpenAI GPT-4).

---

## Screenshots

```
┌─────────────────────────────────────────────────────────────┐
│  SIDEBAR                    │  CHAT PANEL                   │
│  ─────────────              │  ─────────────────────────    │
│  ⚡ DocQA  [🌙] [+]         │  [≡]  Document Q&A           │
│  RAG-Powered Q&A            │       3 documents ready       │
│  ┌──────────────────────┐   │                               │
│  │ + New Conversation   │   │                               │
│  └──────────────────────┘   │                               │
│                             │  ┌─────────────────────────┐  │
│  DOCUMENTS (3)  [☐] [↑]     │  │ 👤 What is AlphaFold2?  │  │
│  ┌──────────────────────┐   │  └─────────────────────────┘  │
│  │ PDF  report.pdf      │   │                               │
│  │      1.2 MB · 12p    │   │  ┌─────────────────────────┐  │
│  │      47 chunks       │   │  │ 🤖 AlphaFold2 is...     │  │
│  └──────────────────────┘   │  │                           │  │
│  ┌──────────────────────┐   │  │  ● High confidence · 87% │  │
│  │ TXT  notes.txt  [✓]  │   │  │  ▶ 2 sources referenced  │  │
│  │      45 KB           │   │  └─────────────────────────┘  │
│  └──────────────────────┘   │                               │
│                             │  ┌─────────────────────────┐  │
│  1 doc selected for Q&A     │  │ Ask a question...    [→] │  │
└─────────────────────────────┴─────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Next.js 15)                      │
│  Zustand Store ← hooks → SSE Stream / REST API                  │
│  Components: ChatPanel | Sidebar | DropZone | MessageCard       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / SSE
┌──────────────────────────────▼──────────────────────────────────┐
│                       FastAPI Backend                            │
│                                                                  │
│  POST /documents/upload   POST /chat/   POST /chat/stream        │
│         │                      │               │                 │
│         ▼                      ▼               ▼                 │
│  ┌─────────────┐     ┌─────────────────────────────────┐        │
│  │ Document    │     │         RAG Pipeline              │        │
│  │ Service     │     │                                   │        │
│  │             │     │  Query → Embed → FAISS Search →  │        │
│  │ Parse PDF   │     │  Rerank → LLM Generate → Score   │        │
│  │ Clean text  │     │                                   │        │
│  │ Chunk text  │     └───────────────────────────────────┘        │
│  │ Embed       │               │           │                      │
│  │ Store FAISS │               │           │                      │
│  └─────────────┘               ▼           ▼                      │
│         │              ┌───────────┐  ┌──────────┐               │
│         ▼              │  FAISS    │  │ Anthropic │               │
│  ┌────────────┐        │  Vector   │  │ Claude /  │               │
│  │ sentence-  │        │  Store    │  │ OpenAI    │               │
│  │ transformers│       │ (disk     │  │ GPT-4     │               │
│  │ all-mpnet  │        │  persist) │  └──────────┘               │
│  └────────────┘        └───────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.1 | React framework with App Router |
| TypeScript | 5.7 | Type safety |
| Tailwind CSS | 3.4 | Utility-first styling |
| Framer Motion | 11 | Animations & transitions |
| Zustand | 5 | Global state management |
| react-dropzone | 14 | Drag-and-drop uploads |
| react-markdown | 9 | Markdown rendering |
| Lucide React | 0.468 | Icons |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.115 | High-performance async API |
| Python | 3.11 | Language |
| sentence-transformers | 3.3 | Text embeddings |
| FAISS | 1.9 | Vector similarity search |
| pdfplumber + PyPDF2 | latest | PDF parsing |
| Anthropic SDK | 0.40 | Claude LLM |
| OpenAI SDK | 1.57 | GPT-4 LLM (alternative) |
| pydantic-settings | 2.6 | Configuration management |
| uvicorn | 0.32 | ASGI server |

---

## How RAG Works in DocQA

### 1. Document Ingestion Pipeline

```
Upload → Validate → Parse → Clean → Chunk → Embed → Store
```

**Parsing:** pdfplumber extracts text page-by-page (PyPDF2 as fallback).
Text normalization removes PDF artifacts like hyphenated line breaks,
control characters, and excessive whitespace.

**Chunking:** Custom `RecursiveCharacterTextSplitter` splits text using a
priority separator hierarchy: `\n\n` → `\n` → `. ` → ` ` → character.
This preserves semantic meaning by respecting natural language boundaries.

- Default chunk size: **800 characters**
- Default overlap: **150 characters** (ensures context continuity)
- Each chunk stores: doc_id, filename, page number, char offsets

**Embedding:** `sentence-transformers/all-mpnet-base-v2` (768-dim) converts
chunks to vectors, then L2-normalizes them. This makes inner product search
equivalent to cosine similarity.

**Storage:** FAISS `IndexFlatIP` stores all vectors. Metadata (chunks) is
stored in memory with pickle persistence to disk.

### 2. Retrieval Pipeline

```
Question → Embed → FAISS Search → Threshold Filter → Top-K
```

1. Embed the user's question using the same model
2. Search FAISS with `IndexFlatIP` (exact cosine similarity)
3. Filter results below similarity threshold (default: 0.35)
4. Return top-5 chunks sorted by relevance
5. Optionally filter by selected document IDs

### 3. Answer Generation

The LLM receives a carefully engineered prompt:

```
SYSTEM: You are a precise document Q&A assistant.
        Answer ONLY from the provided context.
        NEVER use outside knowledge.
        Say "I could not find..." if not in context.

USER:   [Document chunks as context]
        [Last 3 conversation turns]
        Current question: ...
```

Streaming responses are sent via Server-Sent Events for real-time UX.

### 4. Confidence Scoring

```
score = weighted_avg(similarity_scores)
      + source_diversity_bonus
      × coverage_ratio
```

- High (≥70%): Multiple high-similarity sources found
- Medium (40–69%): Partial matches or fewer sources
- Low (<40%): Weak matches (answer may be unreliable)

---

## Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 20+
- Anthropic API key (or OpenAI API key)

### Local Development

**1. Clone the repository:**
```bash
git clone https://github.com/your-org/docqa.git
cd docqa
```

**2. Backend setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: add ANTHROPIC_API_KEY or OPENAI_API_KEY

python main.py
# → API running at http://localhost:8000
# → Swagger UI at http://localhost:8000/docs
```

**3. Frontend setup:**
```bash
cd frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

npm run dev
# → App running at http://localhost:3000
```

### Docker Compose (Recommended)

```bash
# Create root .env file
cat > .env << EOF
ANTHROPIC_API_KEY=sk-ant-your-key-here
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
EOF

# Build and run
docker compose up --build

# → Frontend: http://localhost:3000
# → Backend: http://localhost:8000
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Server
ENV=development
PORT=8000
ALLOWED_ORIGINS=http://localhost:3000

# AI Provider — choose one
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514

# Or OpenAI:
# OPENAI_API_KEY=sk-...
# LLM_PROVIDER=openai
# LLM_MODEL=gpt-4.1

# Embeddings (runs locally, no API key needed)
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2

# RAG Tuning
CHUNK_SIZE=800
CHUNK_OVERLAP=150
TOP_K_RETRIEVAL=5
SIMILARITY_THRESHOLD=0.35
MAX_CONTEXT_TOKENS=3000

# File Upload
MAX_FILE_SIZE_MB=50
ALLOWED_EXTENSIONS=pdf,txt

# Persistence
VECTOR_STORE_PATH=./data/vector_stores
PERSIST_VECTOR_STORE=true
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## Deployment

### Backend → Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your GitHub repository, select the `backend/` directory
3. Set environment variables in Railway dashboard
4. Railway auto-detects Python and builds from `requirements.txt`
5. Note your deployment URL (e.g., `https://docqa-backend.up.railway.app`)

### Frontend → Vercel

```bash
cd frontend
npx vercel

# Set environment variable:
# NEXT_PUBLIC_API_URL=https://docqa-backend.up.railway.app/api/v1
```

Or connect your GitHub repo in the [Vercel dashboard](https://vercel.com).

### Backend → Render

1. New Web Service → connect repository
2. Root directory: `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables in Render dashboard

**Note on cold starts:** Free-tier Render instances sleep after inactivity.
The first request after sleep may take 30–60 seconds as the embedding model loads.
Use a paid instance or add a warm-up ping for production.

---

## Testing

### Quick Test with Sample Document

```bash
# 1. Start backend
cd backend && python main.py

# 2. Upload sample document
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -F "file=@../sample_document.txt"

# 3. Ask a question
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-001",
    "question": "What is the projected market size of healthcare AI by 2030?",
    "conversation_history": []
  }'

# Expected: Answer citing "$188 billion" with high confidence

# 4. Test out-of-scope rejection
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-001",
    "question": "What is the capital of France?",
    "conversation_history": []
  }'

# Expected: is_out_of_scope: true, confidence_score: 0.0
```

### Sample Questions for `sample_document.txt`

| Question | Expected Confidence |
|----------|-------------------|
| "What is the projected market size of healthcare AI by 2030?" | High |
| "How accurate is AI in detecting pneumonia?" | High |
| "What did DeepMind's AlphaFold2 achieve?" | High |
| "What bias was found in the healthcare cost algorithm?" | High |
| "What privacy techniques are used in healthcare AI?" | Medium-High |
| "What is the capital of France?" | Out-of-scope |
| "How do I make pasta?" | Out-of-scope |

---

## Project Structure

```
docqa/
├── backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   ├── config/
│   │   └── settings.py          # Pydantic settings (env var management)
│   ├── api/
│   │   ├── dependencies.py      # DI: singleton service instances
│   │   └── routes/
│   │       ├── health.py        # GET /health
│   │       ├── documents.py     # POST/GET/DELETE /documents
│   │       └── chat.py          # POST /chat, POST /chat/stream
│   ├── services/
│   │   ├── document_service.py  # Upload/delete orchestration
│   │   ├── document_parser.py   # PDF + TXT parsing
│   │   └── llm_service.py       # Anthropic + OpenAI clients
│   ├── rag/
│   │   ├── chunker.py           # RecursiveCharacterTextSplitter
│   │   ├── pipeline.py          # Full RAG flow
│   │   └── confidence.py        # Confidence scoring
│   ├── embeddings/
│   │   └── embedder.py          # sentence-transformers wrapper
│   ├── retrieval/
│   │   └── vector_store.py      # FAISS index management
│   ├── models/
│   │   └── schemas.py           # All Pydantic models
│   └── utils/
│       ├── logger.py
│       └── file_utils.py
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── layout.tsx        # Root layout (Syne font, ThemeProvider)
│       │   ├── page.tsx          # Main app page
│       │   └── globals.css       # CSS variables, Tailwind, glass effects
│       ├── types/index.ts        # All TypeScript types
│       ├── services/api.ts       # Backend API client + SSE streaming
│       ├── store/app-store.ts    # Zustand global state
│       ├── hooks/
│       │   ├── use-send-message.ts
│       │   └── use-documents.ts
│       ├── lib/utils.ts
│       └── components/
│           ├── layout/
│           │   ├── theme-provider.tsx
│           │   └── sidebar.tsx   # Doc management panel
│           ├── chat/
│           │   ├── chat-panel.tsx
│           │   ├── chat-message-card.tsx
│           │   ├── chat-input.tsx
│           │   └── confidence-badge.tsx
│           └── upload/
│               └── drop-zone.tsx
│
├── docker-compose.yml
├── sample_document.txt          # Test document (Healthcare AI)
├── API_DOCS.md                  # Full API reference
└── README.md
```

---

## RAG Tuning Guide

### Improving Retrieval Accuracy

| Parameter | Lower Value | Higher Value | Recommendation |
|-----------|------------|-------------|----------------|
| `CHUNK_SIZE` | More chunks, precise retrieval | Fewer chunks, more context per chunk | 600–1000 |
| `CHUNK_OVERLAP` | Less redundancy | More context continuity | 15–20% of chunk size |
| `TOP_K_RETRIEVAL` | Faster, focused | More context, possible noise | 3–7 |
| `SIMILARITY_THRESHOLD` | More results, possibly irrelevant | Fewer, more precise results | 0.30–0.45 |

### Embedding Model Options

| Model | Dimensions | Speed | Quality |
|-------|-----------|-------|---------|
| `all-mpnet-base-v2` (default) | 768 | Medium | Excellent |
| `all-MiniLM-L6-v2` | 384 | Fast | Good |
| `all-MiniLM-L12-v2` | 384 | Medium | Very good |
| `multi-qa-mpnet-base-dot-v1` | 768 | Medium | Best for Q&A |

---

## Security Considerations

- **File validation:** Extension whitelist (PDF, TXT only), size limits, MIME type checking
- **Filename sanitization:** Path traversal prevention, special character removal
- **Content sanitization:** Control character removal from parsed text
- **CORS:** Explicit allowed origins list (not `*`)
- **No PII storage:** No user accounts or session data persisted
- **API key security:** Never exposed to frontend; backend-only

---

## Future Improvements

- [ ] **Hybrid search:** BM25 + dense retrieval (combine keyword and semantic)
- [ ] **Cross-encoder reranking:** Use a cross-encoder model for precise reranking of top-50 candidates
- [ ] **Multi-modal support:** Image extraction and analysis from PDFs
- [ ] **OCR support:** Scanned PDF support via Tesseract/AWS Textract
- [ ] **Conversation memory:** Persistent session storage across page reloads
- [ ] **Document collections:** Organize documents into named collections
- [ ] **Citation highlighting:** Highlight exact passages in a PDF viewer
- [ ] **Evaluation suite:** Automated RAG quality metrics (RAGAS framework)
- [ ] **Authentication:** User accounts with per-user document isolation
- [ ] **Rate limiting:** Per-IP request limiting for API protection
- [ ] **Webhook support:** Async processing with status callbacks for large files
- [ ] **DOCX support:** Microsoft Word document parsing

---

## License

MIT License — see LICENSE file for details.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes with tests
4. Submit a pull request with a clear description

---

*Built with ❤️ as a production-grade RAG system demonstration.*
