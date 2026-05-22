"""
FastAPI Dependencies
Singleton service instances for dependency injection
"""

from functools import lru_cache

from services.document_service import DocumentService
from services.llm_service import LLMService
from rag.pipeline import RAGPipeline


@lru_cache()
def get_document_service() -> DocumentService:
    return DocumentService()


@lru_cache()
def get_llm_service() -> LLMService:
    return LLMService()


def get_rag_pipeline(
    doc_service: DocumentService = None,
    llm_service: LLMService = None,
) -> RAGPipeline:
    ds = doc_service or get_document_service()
    ls = llm_service or get_llm_service()
    return RAGPipeline(vector_store=ds.vector_store, llm_service=ls)
