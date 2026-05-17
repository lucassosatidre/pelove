import { PersonalMilestone, useDeleteMilestone } from "@/hooks/usePersonalPlan";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const BUCKETS = [1, 3, 5, 10];

export function LifeTimeline({ milestones }: { milestones: PersonalMilestone[] }) {
  const deleteMs = useDeleteMilestone();
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h3 className="font-semibold mb-4">Linha do tempo</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {BUCKETS.map((years) => {
          const items = milestones.filter((m) => m.horizon_years === years);
          return (
            <div key={years} className="border-l-2 border-primary/40 pl-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {years} {years === 1 ? "ano" : "anos"}
              </div>
              <div className="space-y-2">
                {items.length === 0 && <p className="text-xs italic text-muted-foreground">Sem marcos</p>}
                {items.map((m) => (
                  <div
                    key={m.id}
                    className="text-sm p-2 bg-muted/40 rounded flex items-start justify-between gap-2"
                  >
                    <span className="flex-1">{m.label}</span>
                    <Button variant="ghost" size="sm" onClick={() => deleteMs.mutate(m.id)} className="h-6 w-6 p-0">
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
