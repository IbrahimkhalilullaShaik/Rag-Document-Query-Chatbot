"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ChevronDown, ChevronRight, FileText, User, Bot, AlertTriangle } from "lucide-react";
import type { ChatMessage, SourceChunk } from "@/types";
import { ConfidenceBadge } from "@/components/chat/confidence-badge";
import { TypingIndicator } from "@/components/chat/typing-indicator";

interface ChatMessageCardProps {
  message: ChatMessage;
}

export function ChatMessageCard({ message }: ChatMessageCardProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} max-w-4xl ${isUser ? "ml-auto" : "mr-auto"} w-full`}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser ? "bg-primary/20 text-primary" : "bg-secondary text-foreground"}
        `}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Message bubble */}
        <div
          className={`
            rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border rounded-tl-sm"
            }
          `}
        >
          {message.isStreaming && message.content === "" ? (
            <TypingIndicator />
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={`prose-docqa ${message.isStreaming ? "cursor-blink" : ""}`}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata row */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center gap-2 flex-wrap">
            {message.is_out_of_scope && (
              <div className="flex items-center gap-1 text-xs text-amber-500/80">
                <AlertTriangle className="w-3 h-3" />
                Out of scope
              </div>
            )}
            {message.confidence_score !== undefined && !message.is_out_of_scope && (
              <ConfidenceBadge score={message.confidence_score} />
            )}
            {message.processing_time_ms && (
              <span className="text-xs text-muted-foreground/50">
                {message.processing_time_ms.toFixed(0)}ms
              </span>
            )}
          </div>
        )}

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
          <SourceCards sources={message.sources} />
        )}
      </div>
    </motion.div>
  );
}

function SourceCards({ sources }: { sources: SourceChunk[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const toggleChunk = (id: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full space-y-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <FileText className="w-3 h-3" />
        {sources.length} source{sources.length !== 1 ? "s" : ""} referenced
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-1.5"
        >
          {sources.map((src) => (
            <SourceChunkCard
              key={src.chunk_id}
              source={src}
              isExpanded={expandedChunks.has(src.chunk_id)}
              onToggle={() => toggleChunk(src.chunk_id)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function SourceChunkCard({
  source,
  isExpanded,
  onToggle,
}: {
  source: SourceChunk;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const scorePercent = Math.round(source.similarity_score * 100);
  const scoreColor =
    scorePercent >= 75 ? "text-emerald-400" : scorePercent >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
          )}
          <span className="text-xs text-foreground truncate font-medium">{source.filename}</span>
          {source.page_number && (
            <span className="text-xs text-muted-foreground flex-shrink-0">p.{source.page_number}</span>
          )}
        </div>
        <span className={`text-xs font-mono font-bold flex-shrink-0 ml-2 ${scoreColor}`}>
          {scorePercent}%
        </span>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "auto" }}
          className="overflow-hidden"
        >
          <div className="px-3 pb-3 pt-1">
            {/* Similarity bar */}
            <div className="w-full h-1 bg-border rounded-full mb-2 overflow-hidden">
              <div
                className="h-full confidence-bar rounded-full transition-all"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap">
              {source.content}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
