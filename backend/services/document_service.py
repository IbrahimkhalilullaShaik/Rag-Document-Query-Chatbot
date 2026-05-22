"""
Document Service — full ingestion pipeline
Parse → Chunk → Embed → Store
"""

import asyncio
from typing import Optional

from config.settings import get_settings
from embeddings.embedder import EmbeddingsService
from models.schemas import DocumentMetadata, DocumentStatus, DocumentUploadResponse
from rag.chunker import TextChunker
from retrieval.vector_store import VectorStore
from services.document_parser import DocumentParser
from utils.file_utils import generate_doc_id, sanitize_filename, validate_file_extension, validate_file_size
from utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


class DocumentService:

    def __init__(self):
        self._embedder = EmbeddingsService()
        self._vector_store = VectorStore(embedder=self._embedder)
        self._parser = DocumentParser()
        self._chunker = TextChunker(chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
        self._documents: dict[str, DocumentMetadata] = {}

    async def upload_document(self, content: bytes, filename: str) -> DocumentUploadResponse:
        filename = sanitize_filename(filename)

        if not validate_file_extension(filename):
            raise ValueError(f"Unsupported file type. Allowed: pdf, txt")
        if not validate_file_size(len(content)):
            raise ValueError(f"File too large. Max: {settings.max_file_size_mb}MB")

        doc_id = generate_doc_id(filename, content)

        # Already indexed
        if self._vector_store.has_document(doc_id):
            meta = self._documents.get(doc_id)
            logger.info(f"Document {filename} already indexed")
            return DocumentUploadResponse(
                success=True, doc_id=doc_id, filename=filename,
                message="Document already indexed",
                chunk_count=meta.chunk_count if meta else 0,
                page_count=meta.page_count if meta else None,
            )

        meta = DocumentMetadata(
            doc_id=doc_id, filename=filename,
            file_type=filename.split(".")[-1].lower(),
            file_size=len(content), status=DocumentStatus.PROCESSING,
        )
        self._documents[doc_id] = meta

        try:
            # All heavy work in thread pool (parse + chunk + embed)
            parsed, chunks, embeddings = await asyncio.get_event_loop().run_in_executor(
                None, self._process_document, content, filename, doc_id
            )

            meta.page_count = parsed.page_count
            meta.chunk_count = len(chunks)
            meta.status = DocumentStatus.READY

            if chunks:
                self._vector_store.add_chunks_with_embeddings(chunks, embeddings)
            else:
                logger.warning(f"No chunks extracted from {filename} — may be scanned/image PDF")

            logger.info(f"✅ Indexed {filename}: {len(chunks)} chunks, {parsed.page_count} pages")

            return DocumentUploadResponse(
                success=True, doc_id=doc_id, filename=filename,
                message="Document processed successfully" if chunks else "Uploaded but no text extracted (scanned PDF?)",
                chunk_count=len(chunks),
                page_count=parsed.page_count,
            )

        except Exception as e:
            meta.status = DocumentStatus.FAILED
            meta.error = str(e)
            logger.error(f"Failed to process {filename}: {e}", exc_info=True)
            raise

    def _process_document(self, content: bytes, filename: str, doc_id: str):
        parsed = self._parser.parse(content, filename)
        chunks = self._chunker.chunk_document(
            text=parsed.text, doc_id=doc_id,
            filename=filename, page_texts=parsed.page_texts,
        )
        embeddings = self._embedder.embed_texts([c.content for c in chunks]) if chunks else []
        return parsed, chunks, embeddings

    def get_documents(self) -> list[DocumentMetadata]:
        return list(self._documents.values())

    def get_document(self, doc_id: str) -> Optional[DocumentMetadata]:
        return self._documents.get(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        if doc_id not in self._documents:
            return False
        self._vector_store.remove_document(doc_id)
        del self._documents[doc_id]
        return True

    @property
    def vector_store(self) -> VectorStore:
        return self._vector_store

    @property
    def total_documents(self) -> int:
        return len([d for d in self._documents.values() if d.status == DocumentStatus.READY])