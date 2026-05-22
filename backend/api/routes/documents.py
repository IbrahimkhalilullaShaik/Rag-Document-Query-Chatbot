"""
Documents API Routes
"""

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from api.dependencies import get_document_service
from models.schemas import DocumentListResponse, DocumentUploadResponse
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a PDF or TXT document."""
    doc_service = get_document_service()

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        result = await doc_service.upload_document(content=content, filename=file.filename)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process document")


@router.get("/", response_model=DocumentListResponse)
async def list_documents():
    """List all uploaded documents."""
    doc_service = get_document_service()
    docs = doc_service.get_documents()
    return DocumentListResponse(documents=docs, total=len(docs))


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str):
    """Delete a document and its vector store entries."""
    doc_service = get_document_service()
    success = doc_service.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")