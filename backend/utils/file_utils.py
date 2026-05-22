"""
File Validation Utilities
Handles upload validation, sanitization, and security checks
"""

import hashlib
import re
from pathlib import Path

from config.settings import get_settings
from utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


def validate_file_extension(filename: str) -> bool:
    """Validate file has an allowed extension."""
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext in settings.allowed_extensions_list


def validate_file_size(size: int) -> bool:
    """Validate file size is within limits."""
    return size <= settings.max_file_size_bytes


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and injection."""
    # Remove path components
    filename = Path(filename).name
    # Replace unsafe characters
    filename = re.sub(r"[^\w\-_\. ]", "_", filename)
    # Limit length
    name, ext = Path(filename).stem, Path(filename).suffix
    if len(name) > 100:
        name = name[:100]
    return f"{name}{ext}"


def generate_doc_id(filename: str, content: bytes) -> str:
    """Generate a unique document ID based on content hash."""
    content_hash = hashlib.sha256(content[:4096]).hexdigest()[:12]
    safe_name = re.sub(r"[^\w]", "_", Path(filename).stem)[:20]
    return f"{safe_name}_{content_hash}"
