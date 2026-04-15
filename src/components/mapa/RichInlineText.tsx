import { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { cn } from "@/lib/utils";

interface RichInlineTextProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}

function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

function stripInlineColors(html: string): string {
  // Remove color and background-color inline styles from saved HTML
  return html.replace(/\s*(color|background-color)\s*:\s*[^;"]+;?/gi, "");
}

function TiptapEditor({
  initialContent,
  onSave,
  onCancel,
  inputClassName,
}: {
  initialContent: string;
  onSave: (html: string) => void;
  onCancel: () => void;
  inputClassName?: string;
}) {
  const savedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
    ],
    content: isHtml(initialContent) ? stripInlineColors(initialContent) : `<p>${initialContent}</p>`,
    editorProps: {
      attributes: {
        class: cn(
          "w-full bg-transparent border border-primary/30 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[40px] max-h-[160px] overflow-y-auto prose prose-sm max-w-none",
          inputClassName
        ),
      },
      handleKeyDown(_view, event) {
        if (event.key === "Enter" && event.ctrlKey) {
          event.preventDefault();
          doSave();
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
          return true;
        }
        return false;
      },
    },
    autofocus: "end",
  });

  const doSave = useCallback(() => {
    if (savedRef.current || !editor) return;
    savedRef.current = true;
    const html = editor.getHTML();
    const isEmpty = html === "<p></p>" || html === "";
    onSave(isEmpty ? "" : html);
  }, [editor, onSave]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      setTimeout(() => {
        if (editor.isFocused) return;
        doSave();
      }, 200);
    };
    editor.on("blur", handler);
    return () => { editor.off("blur", handler); };
  }, [editor, doSave]);

  if (!editor) return null;

  return (
    <div className="relative">
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        className="flex items-center gap-0.5 bg-[#1A1A1A] border border-[#333] rounded-lg shadow-lg px-1.5 py-1"
      >
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={cn("px-1.5 py-0.5 rounded text-xs font-bold text-white hover:bg-white/20", editor.isActive("bold") && "bg-white/30")}
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={cn("px-1.5 py-0.5 rounded text-xs italic text-white hover:bg-white/20", editor.isActive("italic") && "bg-white/30")}
        >
          I
        </button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichInlineText({
  value,
  onSave,
  placeholder = "Clique para definir",
  className,
  inputClassName,
  multiline: _multiline = false,
  autoFocus = false,
}: RichInlineTextProps) {
  const [editing, setEditing] = useState(autoFocus);
  const [flash, setFlash] = useState(false);
  const originalValue = useRef(value);

  useEffect(() => { originalValue.current = value; }, [value]);

  const handleSave = useCallback(async (html: string) => {
    setEditing(false);
    if (html !== originalValue.current) {
      await onSave(html);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    }
  }, [onSave]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  if (editing) {
    return (
      <TiptapEditor
        initialContent={value}
        onSave={handleSave}
        onCancel={handleCancel}
        inputClassName={inputClassName}
      />
    );
  }

  const hasContent = value && value !== "<p></p>";
  const displayHtml = hasContent && isHtml(value);

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        "cursor-pointer rounded px-1.5 py-0.5 transition-colors duration-300 hover:bg-accent",
        flash && "bg-green-100",
        !hasContent && "text-muted-foreground italic",
        className
      )}
    >
      {displayHtml ? (
        <span dangerouslySetInnerHTML={{ __html: stripInlineColors(value) }} className="prose prose-sm max-w-none [&_p]:m-0" />
      ) : (
        hasContent ? value : placeholder
      )}
    </span>
  );
}
