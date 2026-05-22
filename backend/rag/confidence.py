"""
Confidence Score Calculator
Computes retrieval confidence based on similarity scores and context quality.
"""

from models.schemas import SourceChunk
from utils.logger import get_logger

logger = get_logger(__name__)

OUT_OF_SCOPE_PHRASE = "I could not find relevant information in the uploaded documents"


def compute_confidence_score(
    sources: list[SourceChunk],
    answer: str,
    similarity_threshold: float = 0.35,
) -> tuple[float, bool]:
    """
    Compute confidence score and detect out-of-scope answers.

    Returns:
        (confidence_score [0.0-1.0], is_out_of_scope)
    """
    # Check if model indicated no relevant info found
    is_out_of_scope = OUT_OF_SCOPE_PHRASE.lower() in answer.lower()

    if is_out_of_scope or not sources:
        return 0.0, True

    scores = [s.similarity_score for s in sources]

    # Weighted average: top source counts more
    if len(scores) >= 2:
        weighted = scores[0] * 0.5 + scores[1] * 0.3 + sum(scores[2:]) * 0.2 / max(len(scores) - 2, 1)
    else:
        weighted = scores[0]

    # Bonus for multiple corroborating sources
    source_diversity_bonus = min(0.1, (len(scores) - 1) * 0.025)

    # Context coverage: ratio of top score vs threshold
    coverage = min(1.0, (weighted - similarity_threshold) / (1.0 - similarity_threshold))

    raw_confidence = coverage + source_diversity_bonus
    confidence = round(min(1.0, max(0.0, raw_confidence)), 3)

    return confidence, False
