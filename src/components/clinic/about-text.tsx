"use client";

import { useState } from "react";

interface AboutTextProps {
  text: string;
}

export function AboutText({ text }: AboutTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 200;

  return (
    <div>
      <p
        className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line transition-all duration-300 ${
          !expanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="cursor-pointer mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}