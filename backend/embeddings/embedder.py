"""
Embeddings Service - uses FastEmbed (lightweight, no PyTorch)
Uses ONNX runtime instead of PyTorch — uses ~100MB RAM vs ~800MB
"""

import numpy as np
from typing import Optional
from utils.logger import get_logger

logger = get_logger(__name__)


class EmbeddingsService:
    """
    FastEmbed-based embedder. No PyTorch, no GPU needed.
    Model: BAAI/bge-small-en-v1.5 (384-dim, ~130MB, excellent quality)
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = "BAAI/bge-small-en-v1.5"
        self._model = None

    @property
    def model(self):
        if self._model is None:
            logger.info(f"Loading FastEmbed model: {self.model_name}")
            from fastembed import TextEmbedding
            self._model = TextEmbedding(model_name=self.model_name)
            logger.info("FastEmbed model loaded successfully")
        return self._model

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.array([])
        texts = [t.strip() if t.strip() else " " for t in texts]
        embeddings = list(self.model.embed(texts))
        arr = np.array(embeddings, dtype=np.float32)
        # L2 normalize for cosine similarity
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        return arr / norms

    def embed_query(self, query: str) -> np.ndarray:
        return self.embed_texts([query.strip()])[0]

    @property
    def embedding_dimension(self) -> int:
        return 384