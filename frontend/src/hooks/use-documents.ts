// ============================================================
// useDocuments - Document management hook
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument as apiDelete,
  listDocuments,
  uploadDocument,
} from "@/services/api";
import { useAppStore } from "@/store/app-store";

export function useDocuments() {
  const { documents, addDocument, removeDocument, setDocuments } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Load documents on mount
  useEffect(() => {
    const load = async () => {
      try {
        const docs = await listDocuments();
        setDocuments(docs);
      } catch {
        // Backend might not be running yet
      }
    };
    load();
  }, [setDocuments]);

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      setIsLoading(true);
      setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: Math.min((prev[file.name] || 0) + 10, 90),
        }));
      }, 300);

      try {
        const result = await uploadDocument(file);

        clearInterval(progressInterval);
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));

        addDocument({
          doc_id: result.doc_id,
          filename: result.filename,
          file_type: file.name.split(".").pop() || "unknown",
          file_size: file.size,
          page_count: result.page_count,
          chunk_count: result.chunk_count,
          status: "ready",
          uploaded_at: new Date().toISOString(),
        });

        setTimeout(() => {
          setUploadProgress((prev) => {
            const next = { ...prev };
            delete next[file.name];
            return next;
          });
        }, 2000);

        return true;
      } catch (err) {
        clearInterval(progressInterval);
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[file.name];
          return next;
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [addDocument]
  );

  const deleteDoc = useCallback(
    async (docId: string) => {
      await apiDelete(docId);
      removeDocument(docId);
    },
    [removeDocument]
  );

  return { documents, upload, deleteDoc, isLoading, uploadProgress };
}
