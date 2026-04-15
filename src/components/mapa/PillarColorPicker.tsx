import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PILLAR_PALETTE = [
  { label: "Vermelho", value: "#EF4444" },
  { label: "Laranja", value: "#F97316" },
  { label: "Amarelo", value: "#EAB308" },
  { label: "Verde", value: "#22C55E" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Roxo", value: "#8B5CF6" },
  { label: "Rosa", value: "#EC4899" },
  { label: "Marrom", value: "#92400E" },
  { label: "Cinza", value: "#6B7280" },
];

interface PillarColorPickerProps {
  currentColor: string | null;
  onSelect: (color: string | null) => Promise<void>;
}

export function PillarColorPicker({ currentColor, onSelect }: PillarColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-4 w-4 rounded-full border border-border shrink-0 hover:scale-125 transition-transform"
          style={{ backgroundColor: currentColor ?? "hsl(var(--muted))" }}
          title="Cor do pilar"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="bottom" align="start">
        <div className="grid grid-cols-5 gap-1.5">
          {PILLAR_PALETTE.map((c) => (
            <button
              key={c.value}
              title={c.label}
              className={cn(
                "h-7 w-7 rounded-md border border-border transition-transform hover:scale-110",
                currentColor === c.value && "ring-2 ring-primary"
              )}
              style={{ backgroundColor: c.value }}
              onClick={async () => { await onSelect(c.value); setOpen(false); }}
            />
          ))}
          <button
            title="Sem cor"
            className={cn(
              "h-7 w-7 rounded-md border border-border transition-transform hover:scale-110 flex items-center justify-center text-xs font-bold text-muted-foreground",
              !currentColor && "ring-2 ring-primary"
            )}
            onClick={async () => { await onSelect(null); setOpen(false); }}
          >
            ✕
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
