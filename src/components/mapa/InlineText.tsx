import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InlineTextProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  const lineH = 20;
  const minH = lineH * 2;
  const maxH = lineH * 8;
  el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), maxH)}px`;
  el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
}

export function InlineText({
  value,
  onSave,
  placeholder = "Clique para definir",
  className,
  inputClassName,
  multiline = false,
  autoFocus = false,
}: InlineTextProps) {
  const [editing, setEditing] = useState(autoFocus);
  const [text, setText] = useState(value);
  const [flash, setFlash] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setText(value); }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
      autoResize(ref.current);
    }
  }, [editing]);

  const save = useCallback(async () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed !== value) {
      await onSave(trimmed);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    }
  }, [text, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") {
      setText(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          autoResize(e.target);
        }}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full bg-transparent border border-primary/30 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none",
          inputClassName
        )}
        rows={2}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-pointer rounded px-1.5 py-0.5 transition-colors duration-300 hover:bg-accent",
        flash && "bg-green-100",
        !value && "text-muted-foreground italic",
        className
      )}
    >
      {value || placeholder}
    </span>
  );
}
