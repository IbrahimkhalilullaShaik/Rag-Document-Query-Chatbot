"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeft, Sparkles, Upload } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useDocuments } from "@/hooks/use-documents";
import { ChatMessageCard } from "@/components/chat/chat-message-card";
import { ChatInput } from "@/components/chat/chat-input";
import { DropZone } from "@/components/upload/drop-zone";
import { useSendMessage } from "@/hooks/use-send-message";

export function ChatPanel() {
  const { messages, setSidebarOpen, sidebarOpen, documents } = useAppStore();
  const { sendMessage, isStreaming } = useSendMessage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { upload } = useDocuments();

  const readyDocs = documents.filter((d) => d.status === "ready");
  const hasDocuments = readyDocs.length > 0;

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50 glass">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-semibold text-sm text-foreground">
            Document Q&amp;A
          </h1>
          <p className="text-xs text-muted-foreground">
            {hasDocuments
              ? `${readyDocs.length} document${readyDocs.length !== 1 ? "s" : ""} ready`
              : "Upload documents to begin"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${hasDocuments ? "bg-emerald-400" : "bg-amber-400"} animate-pulse-slow`} />
          <span className="text-xs text-muted-foreground">{hasDocuments ? "Ready" : "No docs"}</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <EmptyState hasDocuments={hasDocuments} onUpload={upload} />
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <ChatMessageCard key={msg.id} message={msg} />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card/50 glass px-4 py-4">
        <ChatInput
          onSend={sendMessage}
          disabled={!hasDocuments || isStreaming}
          placeholder={
            !hasDocuments
              ? "Upload documents first to ask questions…"
              : isStreaming
              ? "Generating answer…"
              : "Ask a question about your documents…"
          }
        />
        <p className="text-xs text-center text-muted-foreground/50 mt-2">
          Answers sourced exclusively from uploaded documents
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  hasDocuments,
  onUpload,
}: {
  hasDocuments: boolean;
  onUpload: (file: File) => Promise<boolean>;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md w-full"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="font-display font-bold text-2xl text-foreground mb-2">
          Ask your documents anything
        </h2>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          Upload PDFs or text files, then ask questions. Every answer is grounded in your
          documents — no hallucinations, no guessing.
        </p>

        {!hasDocuments && (
          <div className="w-full">
            <DropZone onSuccess={() => {}} />
          </div>
        )}

        {hasDocuments && (
          <div className="grid grid-cols-1 gap-2 text-left">
            {[
              "What are the main topics covered?",
              "Summarize the key findings",
              "What does the document say about…?",
            ].map((q) => (
              <div
                key={q}
                className="px-4 py-2.5 rounded-lg bg-secondary/60 border border-border text-sm text-muted-foreground cursor-default"
              >
                &ldquo;{q}&rdquo;
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
