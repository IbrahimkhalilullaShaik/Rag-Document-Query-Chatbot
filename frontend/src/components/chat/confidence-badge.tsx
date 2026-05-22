"use client";

import { motion } from "framer-motion";

export function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : pct >= 40
      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
      : "bg-red-500/15 text-red-400 border-red-500/20";

  const label = pct >= 70 ? "High" : pct >= 40 ? "Medium" : "Low";

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label} confidence · {pct}%
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-current opacity-60"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
