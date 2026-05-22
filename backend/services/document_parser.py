"""
Document Parser - handles PDF and TXT, with better scanned PDF support
"""

import io
import re
from dataclasses import dataclass, field
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class ParsedDocument:
    text: str
    page_texts: list[str]
    page_count: int
    metadata: dict = field(default_factory=dict)


class DocumentParser:

    def parse(self, content: bytes, filename: str) -> ParsedDocument:
        ext = filename.lower().split(".")[-1]
        if ext == "pdf":
            return self._parse_pdf(content, filename)
        elif ext == "txt":
            return self._parse_txt(content, filename)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    def _parse_pdf(self, content: bytes, filename: str) -> ParsedDocument:
        # Try pdfplumber first
        try:
            import pdfplumber
            page_texts = []
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    page_texts.append(self._clean_text(text))

            full_text = "\n\n".join(t for t in page_texts if t.strip())

            if full_text.strip():
                logger.info(f"Parsed PDF {filename}: {len(page_texts)} pages, {len(full_text)} chars")
                return ParsedDocument(
                    text=full_text,
                    page_texts=page_texts,
                    page_count=len(page_texts),
                    metadata={"parser": "pdfplumber"},
                )
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")

        # Try PyPDF2
        try:
            import PyPDF2
            page_texts = []
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                text = page.extract_text() or ""
                page_texts.append(self._clean_text(text))

            full_text = "\n\n".join(t for t in page_texts if t.strip())

            if full_text.strip():
                logger.info(f"PyPDF2 parsed {filename}: {len(page_texts)} pages, {len(full_text)} chars")
                return ParsedDocument(
                    text=full_text,
                    page_texts=page_texts,
                    page_count=len(page_texts),
                    metadata={"parser": "PyPDF2"},
                )
            else:
                # Scanned PDF - return metadata as content so it's not empty
                logger.warning(f"{filename} appears to be a scanned PDF (image-based). Text extraction not possible.")
                fallback = (
                    f"This document '{filename}' appears to be a scanned/image-based PDF. "
                    f"It has {len(reader.pages)} pages but no extractable text was found. "
                    "Please upload a text-based PDF or a TXT file for best results."
                )
                return ParsedDocument(
                    text=fallback,
                    page_texts=[fallback],
                    page_count=len(reader.pages),
                    metadata={"parser": "PyPDF2", "scanned": True},
                )
        except Exception as e:
            logger.error(f"PyPDF2 failed: {e}")
            raise ValueError(f"Could not parse PDF {filename}: {e}")

    def _parse_txt(self, content: bytes, filename: str) -> ParsedDocument:
        for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                text = content.decode(encoding)
                cleaned = self._clean_text(text)
                page_texts = self._split_txt_pages(cleaned)
                logger.info(f"Parsed TXT {filename}: {len(cleaned)} chars")
                return ParsedDocument(
                    text=cleaned,
                    page_texts=page_texts,
                    page_count=len(page_texts),
                    metadata={"parser": "txt", "encoding": encoding},
                )
            except UnicodeDecodeError:
                continue
        raise ValueError(f"Could not decode {filename}")

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        text = re.sub(r"(?<=[a-z])- \n(?=[a-z])", "", text)
        text = re.sub(r"(?<=[a-zA-Z])\n(?=[a-zA-Z])", " ", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _split_txt_pages(self, text: str, chars_per_page: int = 3000) -> list[str]:
        paragraphs = text.split("\n\n")
        pages, current_page, current_len = [], [], 0
        for para in paragraphs:
            if current_len + len(para) > chars_per_page and current_page:
                pages.append("\n\n".join(current_page))
                current_page, current_len = [para], len(para)
            else:
                current_page.append(para)
                current_len += len(para)
        if current_page:
            pages.append("\n\n".join(current_page))
        return pages if pages else [text]