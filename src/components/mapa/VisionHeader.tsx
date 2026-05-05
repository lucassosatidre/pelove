import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useVision } from "@/hooks/useStrategicData";
import { supabaseOffline as supabase } from "@/lib/offline/supabaseOffline";
import { useQueryClient } from "@tanstack/react-query";
import { InlineText } from "./InlineText";
import { RichInlineText } from "./RichInlineText";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "pe-love-vision-collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function VisionHeader() {
  const { data: vision } = useVision();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  };

  if (!vision) return null;

  const saveText = async (text: string) => {
    await supabase.from("vision").update({ text }).eq("id", vision.id);
    qc.invalidateQueries({ queryKey: ["vision"] });
  };

  const saveYear = async (val: string) => {
    const year = parseInt(val);
    if (isNaN(year)) return;
    await supabase.from("vision").update({ reference_year: year }).eq("id", vision.id);
    qc.invalidateQueries({ queryKey: ["vision"] });
  };

  const ChevronIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <div className="w-full px-6 py-4 bg-gradient-to-r from-primary/10 to-background border-b border-border shrink-0">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          className="flex items-center gap-1 shrink-0 mt-0.5 cursor-pointer"
        >
          <Badge className="bg-primary text-primary-foreground pointer-events-none">
            Visão{" "}
            <InlineText
              value={String(vision.reference_year)}
              onSave={saveYear}
              className="text-primary-foreground font-bold"
              inputClassName="w-16 text-foreground"
            />
          </Badge>
          <ChevronIcon className="h-4 w-4 text-muted-foreground" />
        </button>

        <div
          className={`flex-1 transition-all duration-300 ease-in-out overflow-hidden ${
            collapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
          }`}
        >
          <RichInlineText
            value={vision.text}
            onSave={saveText}
            multiline
            className="text-sm leading-relaxed text-foreground"
            inputClassName="text-sm"
          />
        </div>
      </div>
    </div>
  );
}
