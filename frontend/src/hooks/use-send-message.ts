// ============================================================
// useSendMessage - Chat message hook with streaming support
// ============================================================

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { streamChatMessage, ApiError } from "@/services/api";
import { useAppStore } from "@/store/app-store";
import type { ChatMessage } from "@/types";

export function useSendMessage() {
  const {
    sessionId,
    messages,
    selectedDocIds,
    documents,
    addMessage,
    appendToLastMessage,
    updateLastMessage,
    setStreaming,
    isStreaming,
  } = useAppStore();

  const sendMessage = useCallback(
    async (question: string) => {
      if (isStreaming || !question.trim()) return;

      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content: question.trim(),
        timestamp: new Date().toISOString(),
      };
      addMessage(userMessage);

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };
      addMessage(assistantMessage);
      setStreaming(true);

      try {
        // Build conversation history (exclude current exchange)
        const history = messages
          .filter((m) => !m.isStreaming)
          .slice(-10)
          .map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          }));

        const docIds =
          selectedDocIds.length > 0
            ? selectedDocIds
            : documents.filter((d) => d.status === "ready").map((d) => d.doc_id);

        const stream = streamChatMessage({
          session_id: sessionId,
          question: question.trim(),
          document_ids: docIds.length > 0 ? docIds : undefined,
          conversation_history: history,
        });

        for await (const chunk of stream) {
          if (chunk.type === "token" && chunk.content) {
            appendToLastMessage(chunk.content);
          } else if (chunk.type === "done") {
            updateLastMessage({
              isStreaming: false,
              sources: chunk.sources,
              confidence_score: chunk.confidence_score,
              is_out_of_scope: chunk.is_out_of_scope,
            });
          } else if (chunk.type === "error") {
            updateLastMessage({
              content: chunk.error || "An error occurred. Please try again.",
              isStreaming: false,
              is_out_of_scope: true,
            });
          }
        }
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Connection failed. Please check your network and try again.";
        updateLastMessage({
          content: msg,
          isStreaming: false,
          is_out_of_scope: true,
        });
      } finally {
        setStreaming(false);
      }
    },
    [
      isStreaming,
      sessionId,
      messages,
      selectedDocIds,
      documents,
      addMessage,
      appendToLastMessage,
      updateLastMessage,
      setStreaming,
    ]
  );

  return { sendMessage, isStreaming };
}
