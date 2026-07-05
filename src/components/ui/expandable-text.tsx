"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ExpandableTextProps {
  children: string;
  maxLines?: number;
}

export function ExpandableText({ children, maxLines = 3 }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight) || 24;
      const maxHeight = lineHeight * maxLines;
      setNeedsToggle(textRef.current.scrollHeight > maxHeight + 2);
    }
  }, [children, maxLines]);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div>
      <p
        ref={textRef}
        className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: expanded ? undefined : maxLines,
          WebkitBoxOrient: "vertical",
          overflow: expanded ? "visible" : "hidden",
          transition: expanded ? "none" : undefined,
        }}
      >
        {children}
      </p>
      {needsToggle && (
        <button
          type="button"
          onClick={toggle}
          className="cursor-pointer mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}