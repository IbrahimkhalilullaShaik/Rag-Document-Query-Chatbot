"""
Text Chunking Service
Implements intelligent chunking strategies for optimal RAG retrieval
Uses RecursiveCharacterTextSplitter with semantic-aware boundaries
"""

from dataclasses import dataclass, field
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class TextChunk:
    """A single text chunk with full metadata for retrieval."""
    chunk_id: str
    doc_id: str
    filename: str
    content: str
    chunk_index: int
    page_number: Optional[int] = None
    start_char: int = 0
    end_char: int = 0
    metadata: dict = field(default_factory=dict)


class TextChunker:
    """
    Intelligent text chunker using recursive character splitting.
    Preserves semantic meaning by respecting natural language boundaries.
    """

    # Priority order: paragraphs > sentences > words > characters
    SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""]

    def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_document(
        self,
        text: str,
        doc_id: str,
        filename: str,
        page_texts: Optional[list[str]] = None,
    ) -> list[TextChunk]:
        """
        Chunk a full document text into overlapping segments.
        If page_texts provided, tracks page numbers per chunk.
        """
        if not text.strip():
            logger.warning(f"Empty text for document {doc_id}")
            return []

        if page_texts:
            chunks = self._chunk_with_pages(text, doc_id, filename, page_texts)
        else:
            chunks = self._chunk_text(text, doc_id, filename)

        logger.info(f"Chunked document {filename}: {len(chunks)} chunks from {len(text)} chars")
        return chunks

    def _chunk_text(
        self, text: str, doc_id: str, filename: str
    ) -> list[TextChunk]:
        """Recursively chunk text respecting semantic boundaries."""
        raw_chunks = self._recursive_split(text, self.SEPARATORS)

        chunks = []
        char_offset = 0

        for i, chunk_text in enumerate(raw_chunks):
            if not chunk_text.strip():
                continue

            # Find actual position in original text
            start = text.find(chunk_text, char_offset)
            if start == -1:
                start = char_offset
            end = start + len(chunk_text)

            chunk = TextChunk(
                chunk_id=f"{doc_id}_chunk_{i}",
                doc_id=doc_id,
                filename=filename,
                content=chunk_text.strip(),
                chunk_index=i,
                start_char=start,
                end_char=end,
            )
            chunks.append(chunk)
            char_offset = max(0, end - self.chunk_overlap)

        return chunks

    def _chunk_with_pages(
        self, text: str, doc_id: str, filename: str, page_texts: list[str]
    ) -> list[TextChunk]:
        """Chunk while preserving page number metadata."""
        all_chunks: list[TextChunk] = []
        char_offset = 0

        for page_num, page_text in enumerate(page_texts, start=1):
            if not page_text.strip():
                continue

            page_chunks = self._recursive_split(page_text, self.SEPARATORS)

            for chunk_text in page_chunks:
                if not chunk_text.strip():
                    continue

                start = text.find(chunk_text, char_offset)
                if start == -1:
                    start = char_offset
                end = start + len(chunk_text)

                chunk = TextChunk(
                    chunk_id=f"{doc_id}_p{page_num}_chunk_{len(all_chunks)}",
                    doc_id=doc_id,
                    filename=filename,
                    content=chunk_text.strip(),
                    chunk_index=len(all_chunks),
                    page_number=page_num,
                    start_char=start,
                    end_char=end,
                )
                all_chunks.append(chunk)
                char_offset = max(0, end - self.chunk_overlap)

        return all_chunks

    def _recursive_split(self, text: str, separators: list[str]) -> list[str]:
        """
        Recursively split text using a priority list of separators.
        Falls back to next separator when chunks exceed chunk_size.
        """
        if not separators:
            return self._split_by_length(text)

        separator = separators[0]
        remaining_seps = separators[1:]

        if separator == "":
            return self._split_by_length(text)

        splits = text.split(separator)
        merged = self._merge_splits(splits, separator)

        final_chunks = []
        for chunk in merged:
            if len(chunk) <= self.chunk_size:
                final_chunks.append(chunk)
            else:
                # Recurse with next separator
                sub_chunks = self._recursive_split(chunk, remaining_seps)
                final_chunks.extend(sub_chunks)

        return final_chunks

    def _merge_splits(self, splits: list[str], separator: str) -> list[str]:
        """
        Merge small splits into chunks respecting size limits.
        Implements overlap by re-adding last few tokens of previous chunk.
        """
        merged = []
        current_parts: list[str] = []
        current_len = 0

        for part in splits:
            part_len = len(part)

            if current_len + part_len + len(separator) > self.chunk_size and current_parts:
                # Flush current chunk
                chunk = separator.join(current_parts)
                if chunk.strip():
                    merged.append(chunk)

                # Add overlap: keep last N chars of current
                overlap_text = chunk[-self.chunk_overlap:] if len(chunk) > self.chunk_overlap else chunk
                # Find last separator in overlap
                last_sep = overlap_text.rfind(separator)
                if last_sep != -1 and last_sep < len(overlap_text) - 1:
                    overlap_text = overlap_text[last_sep + len(separator):]

                current_parts = [overlap_text, part] if overlap_text.strip() else [part]
                current_len = sum(len(p) for p in current_parts) + len(separator) * (len(current_parts) - 1)
            else:
                current_parts.append(part)
                current_len += part_len + len(separator)

        if current_parts:
            chunk = separator.join(current_parts)
            if chunk.strip():
                merged.append(chunk)

        return merged

    def _split_by_length(self, text: str) -> list[str]:
        """Hard split by character count as last resort."""
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunks.append(text[start:end])
            start = end - self.chunk_overlap
        return chunks
