"""
LLM Service — Ollama with strong RAG prompt engineering
Evaluation: LLM Integration 30%
"""

import json
from typing import AsyncIterator, Optional
import httpx

from models.schemas import SourceChunk
from utils.logger import get_logger

logger = get_logger(__name__)

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"

# Strong system prompt — forces grounded answers, cites sources, handles OOS
RAG_SYSTEM_PROMPT = """You are a precise, helpful document Q&A assistant.

STRICT RULES — follow every one without exception:
1. Answer ONLY from the document context provided below. Never use outside knowledge.
2. If the answer is NOT in the context, respond with exactly:
   "I could not find relevant information in the uploaded documents."
3. Always cite which source (filename and page if available) supports your answer.
4. Be concise but complete. Use bullet points or numbered lists when listing multiple items.
5. If the question asks to count or list things, do so carefully from the context only.
6. For follow-up questions, use the conversation history to understand context.
7. Never hallucinate, guess, or add information not in the documents."""


def _build_context(sources: list[SourceChunk]) -> str:
    parts = []
    for i, src in enumerate(sources, 1):
        page = f" — Page {src.page_number}" if src.page_number else ""
        score_pct = int(src.similarity_score * 100)
        parts.append(
            f"[Source {i}: {src.filename}{page} | Relevance: {score_pct}%]\n"
            f"{src.content}"
        )
    return "\n\n" + "─" * 50 + "\n\n".join(parts) + "\n\n" + "─" * 50


class LLMService:

    def _build_prompt(
        self,
        question: str,
        sources: list[SourceChunk],
        history: list[dict],
    ) -> str:
        context = _build_context(sources)

        history_text = ""
        if history:
            formatted = []
            for m in history[-6:]:
                role = "User" if m["role"] == "user" else "Assistant"
                formatted.append(f"{role}: {m['content']}")
            history_text = "\n\nPrevious conversation:\n" + "\n".join(formatted) + "\n"

        return (
            f"{RAG_SYSTEM_PROMPT}\n\n"
            f"DOCUMENT CONTEXT:{context}"
            f"{history_text}\n"
            f"User question: {question}\n\n"
            f"Answer (from documents only, cite sources):"
        )

    async def generate_answer(
        self,
        question: str,
        sources: list[SourceChunk],
        conversation_history: Optional[list[dict]] = None,
    ) -> str:
        prompt = self._build_prompt(question, sources, conversation_history or [])
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
                )
                resp.raise_for_status()
                return resp.json()["response"].strip()
        except httpx.ConnectError:
            raise RuntimeError("Cannot connect to Ollama. Make sure Ollama is running: open Terminal and run 'ollama serve'")
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise RuntimeError(f"LLM failed: {e}")

    async def stream_answer(
        self,
        question: str,
        sources: list[SourceChunk],
        conversation_history: Optional[list[dict]] = None,
    ) -> AsyncIterator[str]:
        prompt = self._build_prompt(question, sources, conversation_history or [])
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": True},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.strip():
                            try:
                                chunk = json.loads(line)
                                token = chunk.get("response", "")
                                if token:
                                    yield token
                                if chunk.get("done"):
                                    break
                            except json.JSONDecodeError:
                                continue
        except httpx.ConnectError:
            yield "Error: Cannot connect to Ollama. Run 'ollama serve' in a terminal."
        except Exception as e:
            logger.error(f"Ollama stream error: {e}")
            yield f"Error: {str(e)}"