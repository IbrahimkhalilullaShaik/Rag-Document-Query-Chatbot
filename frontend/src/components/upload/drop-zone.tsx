"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useDocuments } from "@/hooks/use-documents";
import { formatBytes } from "@/lib/utils";

interface DropZoneProps {
  onSuccess?: () => void;
  compact?: boolean;
}

type FileUploadState = {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
};

export function DropZone({ onSuccess, compact }: DropZoneProps) {
  const { upload } = useDocuments();
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);

  const processFiles = useCallback(
    async (files: File[]) => {
      const states: FileUploadState[] = files.map((f) => ({
        file: f,
        status: "pending",
      }));
      setUploadStates(states);

      for (let i = 0; i < files.length; i++) {
        setUploadStates((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "uploading" } : s))
        );

        try {
          await upload(files[i]);
          setUploadStates((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, status: "success" } : s))
          );
        } catch (err: any) {
          setUploadStates((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: "error", error: err.message || "Upload failed" } : s
            )
          );
        }
      }

      // Clear success states after delay
      setTimeout(() => {
        setUploadStates([]);
        onSuccess?.();
      }, 2000);
    },
    [upload, onSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    maxFiles: 10,
  });

  if (compact) {
    return (
      <div className="space-y-2">
        <div
          {...getRootProps()}
          className={`
            flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed
            transition-all cursor-pointer text-sm
            ${isDragActive
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload className="w-3.5 h-3.5" />
          <span className="text-xs">{isDragActive ? "Drop to upload" : "Drop or click to upload"}</span>
        </div>
        <UploadList states={uploadStates} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          transition-all cursor-pointer py-10 px-6
          ${isDragActive
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/40 hover:bg-secondary/50"
          }
        `}
      >
        <input {...getInputProps()} />

        <motion.div
          animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isDragActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          }`}
        >
          <Upload className="w-6 h-6" />
        </motion.div>

        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? "Release to upload" : "Drag & drop documents here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">PDF or TXT · up to 50MB each</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-px w-12 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px w-12 bg-border" />
        </div>

        <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-md">
          Browse files
        </span>
      </div>

      <UploadList states={uploadStates} />
    </div>
  );
}

function UploadList({ states }: { states: FileUploadState[] }) {
  if (states.length === 0) return null;

  return (
    <AnimatePresence>
      {states.map((s) => (
        <motion.div
          key={s.file.name}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/50 border border-border"
        >
          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{s.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(s.file.size)}</p>
          </div>
          <div className="flex-shrink-0">
            {s.status === "uploading" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {s.status === "success" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {s.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
