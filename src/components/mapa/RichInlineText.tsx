import { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
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

const TEXT_COLORS = [
  { label: "Preto", value: "#000000" },
  { label: "Branco", value: "#FFFFFF" },
  { label: "Laranja", value: "#F97316" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Verde", value: "#22C55E" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Amarelo", value: "#EAB308" },
  { label: "Roxo", value: "#8B5CF6" },
];

const HIGHLIGHT_COLORS = [
  { label: "Amarelo", value: "#FEF9C3" },
  { label: "Verde", value: "#DCFCE7" },
  { label: "Azul", value: "#DBEAFE" },
  { label: "Rosa", value: "#FCE7F3" },
  { label: "Laranja", value: "#FED7AA" },
  { label: "Sem destaque", value: null },
];

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
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const savedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: isHtml(initialContent) ? initialContent : `<p>${initialContent}</p>`,
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
    // Convert empty content to empty string
    const isEmpty = html === "<p></p>" || html === "";
    onSave(isEmpty ? "" : html);
  }, [editor, onSave]);

  // Save on blur
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      // Small delay to allow bubble menu clicks
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
        tippyOptions={{ duration: 100, placement: "top" }}
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

        {/* Text color */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setColorMenuOpen(!colorMenuOpen); setHighlightMenuOpen(false); }}
            className="px-1.5 py-0.5 rounded text-xs text-white hover:bg-white/20 flex flex-col items-center leading-none"
          >
            <span>A</span>
            <span className="w-3 h-0.5 rounded-full bg-[#F97316] mt-px" />
          </button>
          {colorMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 bg-[#1A1A1A] border border-[#333] rounded-lg shadow-lg p-1.5 grid grid-cols-4 gap-1 z-50">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  title={c.label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    editor.chain().focus().setColor(c.value).run();
                    setColorMenuOpen(false);
                  }}
                  className="h-5 w-5 rounded border border-[#444] hover:ring-2 hover:ring-primary"
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setHighlightMenuOpen(!highlightMenuOpen); setColorMenuOpen(false); }}
            className="px-1.5 py-0.5 rounded text-xs text-white hover:bg-white/20"
            title="Highlight"
          >
            <span className="bg-yellow-200/40 px-0.5 rounded">H</span>
          </button>
          {highlightMenuOpen && (
            <div className="absolute bottom-full left-0 mb-1 bg-[#1A1A1A] border border-[#333] rounded-lg shadow-lg p-1.5 grid grid-cols-3 gap-1 z-50">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.label}
                  title={c.label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (c.value) {
                      editor.chain().focus().setHighlight({ color: c.value }).run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                    setHighlightMenuOpen(false);
                  }}
                  className="h-5 w-5 rounded border border-[#444] hover:ring-2 hover:ring-primary"
                  style={{ backgroundColor: c.value ?? "transparent" }}
                />
              ))}
            </div>
          )}
        </div>
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
        <span dangerouslySetInnerHTML={{ __html: value }} className="prose prose-sm max-w-none [&_p]:m-0" />
      ) : (
        hasContent ? value : placeholder
      )}
    </span>
  );
}
