// ============================================================
// Global State Store - Zustand
// ============================================================

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, DocumentMetadata, SourceChunk } from "@/types";

interface AppState {
  // Session
  sessionId: string;

  // Documents
  documents: DocumentMetadata[];
  selectedDocIds: string[];
  setDocuments: (docs: DocumentMetadata[]) => void;
  addDocument: (doc: DocumentMetadata) => void;
  removeDocument: (docId: string) => void;
  toggleDocSelection: (docId: string) => void;
  selectAllDocs: () => void;
  clearDocSelection: () => void;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;
  addMessage: (msg: ChatMessage) => void;
  updateLastMessage: (partial: Partial<ChatMessage>) => void;
  appendToLastMessage: (token: string) => void;
  clearMessages: () => void;
  setStreaming: (v: boolean) => void;

  // UI
  theme: "light" | "dark";
  toggleTheme: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  sessionId: uuidv4(),

  // Documents
  documents: [],
  selectedDocIds: [],

  setDocuments: (docs) => set({ documents: docs }),

  addDocument: (doc) =>
    set((s) => ({
      documents: [doc, ...s.documents.filter((d) => d.doc_id !== doc.doc_id)],
    })),

  removeDocument: (docId) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.doc_id !== docId),
      selectedDocIds: s.selectedDocIds.filter((id) => id !== docId),
    })),

  toggleDocSelection: (docId) =>
    set((s) => ({
      selectedDocIds: s.selectedDocIds.includes(docId)
        ? s.selectedDocIds.filter((id) => id !== docId)
        : [...s.selectedDocIds, docId],
    })),

  selectAllDocs: () =>
    set((s) => ({
      selectedDocIds: s.documents
        .filter((d) => d.status === "ready")
        .map((d) => d.doc_id),
    })),

  clearDocSelection: () => set({ selectedDocIds: [] }),

  // Chat
  messages: [],
  isStreaming: false,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  updateLastMessage: (partial) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length === 0) return s;
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], ...partial };
      return { messages: msgs };
    }),

  appendToLastMessage: (token) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length === 0) return s;
      const last = msgs[msgs.length - 1];
      msgs[msgs.length - 1] = { ...last, content: last.content + token };
      return { messages: msgs };
    }),

  clearMessages: () => set({ messages: [], sessionId: uuidv4() }),

  setStreaming: (v) => set({ isStreaming: v }),

  // UI
  theme: "dark",
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}));
