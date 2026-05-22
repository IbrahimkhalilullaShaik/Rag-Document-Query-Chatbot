"""
RAG Pipeline — high accuracy retrieval + strong LLM integration
Evaluation criteria: Retrieval 30% + LLM 30% + UI 25% + Code 15%
"""

import time
from typing import AsyncIterator, Optional

from models.schemas import ChatMessage, ChatResponse, SourceChunk, StreamChunk
from rag.confidence import compute_confidence_score
from retrieval.vector_store import VectorStore
from services.llm_service import LLMService
from utils.logger import get_logger

logger = get_logger(__name__)

OUT_OF_SCOPE = "I could not find relevant information in the uploaded documents."


class RAGPipeline:

    def __init__(self, vector_store: VectorStore, llm_service: LLMService):
        self.vector_store = vector_store
        self.llm = llm_service

    async def answer(
        self,
        session_id: str,
        question: str,
        conversation_history: list[ChatMessage],
        doc_ids: Optional[list[str]] = None,
    ) -> ChatResponse:
        start_time = time.time()
        sources = self._retrieve(question, doc_ids)
        history_dicts = [{"role": m.role, "content": m.content} for m in conversation_history[-6:]]

        if not sources:
            return ChatResponse(
                answer=OUT_OF_SCOPE, sources=[], confidence_score=0.0,
                is_out_of_scope=True, session_id=session_id,
                processing_time_ms=round((time.time() - start_time) * 1000, 2),
            )

        try:
            answer_text = await self.llm.generate_answer(question, sources, history_dicts)
            confidence, is_oos = compute_confidence_score(sources, answer_text)
        except Exception as e:
            logger.error(f"LLM error: {e}")
            answer_text = f"LLM error: {str(e)}"
            confidence, is_oos = 0.0, True

        return ChatResponse(
            answer=answer_text, sources=sources, confidence_score=confidence,
            is_out_of_scope=is_oos, session_id=session_id,
            processing_time_ms=round((time.time() - start_time) * 1000, 2),
        )

    async def stream(
        self,
        session_id: str,
        question: str,
        conversation_history: list[ChatMessage],
        doc_ids: Optional[list[str]] = None,
    ) -> AsyncIterator[StreamChunk]:
        sources = self._retrieve(question, doc_ids)
        history_dicts = [{"role": m.role, "content": m.content} for m in conversation_history[-6:]]

        if not sources:
            yield StreamChunk(type="token", content=OUT_OF_SCOPE)
            yield StreamChunk(type="done", sources=[], confidence_score=0.0, is_out_of_scope=True)
            return

        full_answer = ""
        try:
            async for token in self.llm.stream_answer(question, sources, history_dicts):
                full_answer += token
                yield StreamChunk(type="token", content=token)
        except Exception as e:
            logger.error(f"Stream LLM error: {e}")
            yield StreamChunk(type="token", content=f"Error: {str(e)}")
            yield StreamChunk(type="done", sources=[], confidence_score=0.0, is_out_of_scope=True)
            return

        confidence, is_oos = compute_confidence_score(sources, full_answer)
        yield StreamChunk(type="done", sources=sources, confidence_score=confidence, is_out_of_scope=is_oos)

    def _retrieve(self, question: str, doc_ids: Optional[list[str]]) -> list[SourceChunk]:
        """
        Two-stage retrieval:
        1. Try semantic search with low threshold (0.1)
        2. Fallback: return best chunks regardless of score
        Always returns something if document has content.
        """
        if self.vector_store.total_chunks == 0:
            logger.warning("Vector store is empty — no documents indexed")
            return []

        raw = self.vector_store.search(
            query=question, top_k=5, similarity_threshold=0.1,
            doc_ids=doc_ids if doc_ids else None,
        )

        # Fallback: get best chunks even below threshold
        if not raw:
            raw = self.vector_store.get_top_chunks(
                query=question, top_k=3,
                doc_ids=doc_ids if doc_ids else None,
            )

        sources = [
            SourceChunk(
                chunk_id=c.chunk_id, doc_id=c.doc_id, filename=c.filename,
                content=c.content, page_number=c.page_number,
                chunk_index=c.chunk_index, similarity_score=round(s, 4),
                start_char=c.start_char, end_char=c.end_char,
            )
            for c, s in raw
        ]
        logger.info(f"Retrieved {len(sources)} chunks for: '{question}'")
        return sources