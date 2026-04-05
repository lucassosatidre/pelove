import { useVision } from "@/hooks/useStrategicData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { InlineText } from "./InlineText";
import { Badge } from "@/components/ui/badge";

export function VisionHeader() {
  const { data: vision } = useVision();
  const qc = useQueryClient();

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

  return (
    <div className="w-full px-6 py-4 bg-gradient-to-r from-primary/10 to-background border-b border-border shrink-0">
      <div className="flex items-start gap-3">
        <Badge className="bg-primary text-primary-foreground shrink-0 mt-0.5">
          Visão{" "}
          <InlineText
            value={String(vision.reference_year)}
            onSave={saveYear}
            className="text-primary-foreground font-bold"
            inputClassName="w-16 text-foreground"
          />
        </Badge>
        <div className="flex-1">
          <InlineText
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
