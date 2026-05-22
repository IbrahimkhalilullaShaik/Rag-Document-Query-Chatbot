"""
Chat API Routes
"""

import json
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.dependencies import get_document_service, get_rag_pipeline
from models.schemas import ChatRequest, ChatResponse
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Generate a complete answer (non-streaming)."""
    doc_service = get_document_service()
    pipeline = get_rag_pipeline()

    if doc_service.total_documents == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded. Please upload at least one document first.",
        )

    try:
        response = await pipeline.answer(
            session_id=request.session_id or str(uuid.uuid4()),
            question=request.question,
            conversation_history=request.conversation_history,
            doc_ids=request.document_ids,
        )
        return response
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate answer")


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """Stream answer tokens as Server-Sent Events."""
    doc_service = get_document_service()
    pipeline = get_rag_pipeline()

    if doc_service.total_documents == 0:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded. Please upload at least one document first.",
        )

    session_id = request.session_id or str(uuid.uuid4())

    async def event_generator():
        try:
            async for chunk in pipeline.stream(
                session_id=session_id,
                question=request.question,
                conversation_history=request.conversation_history,
                doc_ids=request.document_ids,
            ):
                data = chunk.model_dump(exclude_none=True)
                yield f"data: {json.dumps(data)}\n\n"
        except Exception as e:
            logger.error(f"Stream error: {e}", exc_info=True)
            error_chunk = {"type": "error", "error": "Stream failed. Please try again."}
            yield f"data: {json.dumps(error_chunk)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )