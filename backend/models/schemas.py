"""
Data Models - Pydantic schemas for request/response validation
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class DocumentMetadata(BaseModel):
    doc_id: str
    filename: str
    file_type: str
    file_size: int
    page_count: Optional[int] = None
    chunk_count: int = 0
    status: DocumentStatus = DocumentStatus.PENDING
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    success: bool
    doc_id: str
    filename: str
    message: str
    chunk_count: int = 0
    page_count: Optional[int] = None


class DocumentListResponse(BaseModel):
    documents: list[DocumentMetadata]
    total: int


class SourceChunk(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    content: str
    page_number: Optional[int] = None
    chunk_index: int
    similarity_score: float
    start_char: Optional[int] = None
    end_char: Optional[int] = None


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    session_id: str
    question: str = Field(..., min_length=1, max_length=2000)
    document_ids: Optional[list[str]] = None  # Filter to specific docs
    conversation_history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    is_out_of_scope: bool = False
    session_id: str
    processing_time_ms: float


class StreamChunk(BaseModel):
    type: str  # "token" | "sources" | "done" | "error"
    content: Optional[str] = None
    sources: Optional[list[SourceChunk]] = None
    confidence_score: Optional[float] = None
    is_out_of_scope: Optional[bool] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    documents_loaded: int
