"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Moon,
  Sun,
  Trash2,
  Upload,
  X,
  MessageSquare,
  CheckSquare,
  Square,
  Layers,
  Zap,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useDocuments } from "@/hooks/use-documents";
import { DropZone } from "@/components/upload/drop-zone";
import { formatBytes } from "@/lib/utils";
import type { DocumentMetadata } from "@/types";

export function Sidebar() {
  const { theme, toggleTheme, selectedDocIds, toggleDocSelection, selectAllDocs, clearDocSelection, clearMessages } =
    useAppStore();
  const { documents, deleteDoc } = useDocuments();
  const [showUpload, setShowUpload] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const readyDocs = documents.filter((d) => d.status === "ready");
  const allSelected = readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.includes(d.doc_id));

  const handleDelete = async (doc: DocumentMetadata) => {
    setDeletingId(doc.doc_id);
    try {
      await deleteDoc(doc.doc_id);
    } catch {
      // show toast in production
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display font-bold text-base gradient-text">DocQA</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-mono">RAG-Powered Q&amp;A</p>
      </div>

      {/* New Chat */}
      <div className="px-3 pt-3">
        <button
          onClick={clearMessages}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      {/* Documents */}
      <div className="flex-1 overflow-hidden flex flex-col px-3 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Documents ({readyDocs.length})
          </span>
          <div className="flex items-center gap-1">
            {readyDocs.length > 0 && (
              <button
                onClick={allSelected ? clearDocSelection : selectAllDocs}
                className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                title={allSelected ? "Deselect all" : "Select all"}
              >
                {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Upload document"
            >
              {showUpload ? <X className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Upload area */}
        {showUpload && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-3 overflow-hidden"
          >
            <DropZone onSuccess={() => setShowUpload(false)} compact />
          </motion.div>
        )}

        {/* Document list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pb-4">
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No documents yet</p>
              <p className="text-xs text-muted-foreground/60">Upload PDF or TXT files</p>
            </div>
          ) : (
            documents.map((doc) => (
              <DocumentCard
                key={doc.doc_id}
                doc={doc}
                isSelected={selectedDocIds.includes(doc.doc_id)}
                onToggle={() => doc.status === "ready" && toggleDocSelection(doc.doc_id)}
                onDelete={() => handleDelete(doc)}
                isDeleting={deletingId === doc.doc_id}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      {selectedDocIds.length > 0 && (
        <div className="px-3 pb-3">
          <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
            <span className="font-medium">{selectedDocIds.length}</span> doc
            {selectedDocIds.length !== 1 ? "s" : ""} selected for Q&amp;A
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentCard({
  doc,
  isSelected,
  onToggle,
  onDelete,
  isDeleting,
}: {
  doc: DocumentMetadata;
  isSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const ext = doc.filename.split(".").pop()?.toUpperCase() || "FILE";
  const isReady = doc.status === "ready";
  const isProcessing = doc.status === "processing";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className={`
        group relative flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer
        ${isSelected ? "bg-primary/10 border-primary/30" : "bg-secondary/50 border-transparent hover:border-border"}
        ${!isReady ? "opacity-60 cursor-default" : ""}
      `}
      onClick={onToggle}
    >
      {/* File type badge */}
      <div
        className={`
          flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold font-mono
          ${ext === "PDF" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"}
        `}
      >
        {ext}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{doc.filename}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
          {doc.page_count && (
            <span className="text-xs text-muted-foreground">{doc.page_count}p</span>
          )}
          {isProcessing && (
            <span className="text-xs text-amber-400 animate-pulse">Processing…</span>
          )}
          {doc.status === "failed" && (
            <span className="text-xs text-destructive">Failed</span>
          )}
        </div>
        {isReady && (
          <span className="text-xs text-muted-foreground/60">{doc.chunk_count} chunks</span>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        disabled={isDeleting}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </motion.div>
  );
}
