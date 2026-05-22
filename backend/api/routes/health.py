"""Health check routes."""

from fastapi import APIRouter
from models.schemas import HealthResponse
from api.dependencies import get_document_service

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    doc_service = get_document_service()
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        documents_loaded=doc_service.total_documents,
    )