"use client";

import { KeyboardEvent, useRef, useState } from "react";
import { SendHorizonal, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="relative flex items-end gap-2 rounded-xl border border-border bg-input focus-within:border-ring/60 focus-within:ring-1 focus-within:ring-ring/20 transition-all">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        disabled={disabled}
        placeholder={placeholder || "Ask a question…"}
        rows={1}
        className="flex-1 resize-none bg-transparent px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 max-h-40 overflow-y-auto"
      />

      <div className="flex-shrink-0 p-2">
        <motion.button
          whileHover={canSend ? { scale: 1.05 } : {}}
          whileTap={canSend ? { scale: 0.95 } : {}}
          onClick={handleSend}
          disabled={!canSend}
          className={`
            w-8 h-8 rounded-lg flex items-center justify-center transition-all
            ${canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/25"
              : "bg-secondary text-muted-foreground cursor-not-allowed"
            }
          `}
        >
          {disabled && value === "" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <SendHorizonal className="w-4 h-4" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
