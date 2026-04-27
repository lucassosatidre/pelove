import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SALE_TYPE_LABELS, type SaleType } from "@/hooks/useSaiposDashboards";
import { Bike, Store, Utensils, Ticket } from "lucide-react";

interface Props {
  value: SaleType[];
  onChange: (value: SaleType[]) => void;
}

const ALL_TYPES: SaleType[] = [1, 2, 3, 4];

const ICONS: Record<SaleType, React.ReactNode> = {
  1: <Bike className="w-3 h-3" />,
  2: <Store className="w-3 h-3" />,
  3: <Utensils className="w-3 h-3" />,
  4: <Ticket className="w-3 h-3" />,
};

export function SaleTypeFilter({ value, onChange }: Props) {
  const selected = value.length === 0 ? new Set<SaleType>(ALL_TYPES) : new Set(value);

  const toggle = (t: SaleType) => {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    // If user deselects all, treat as "all selected"
    if (next.size === 0 || next.size === ALL_TYPES.length) {
      onChange([]);
    } else {
      onChange(Array.from(next).sort());
    }
  };

  const allSelected = value.length === 0;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-muted-foreground mr-1">Canais:</span>
      <Button
        size="sm"
        variant={allSelected ? "default" : "outline"}
        className="h-7 px-2 text-xs"
        onClick={() => onChange([])}
      >
        Todos
      </Button>
      {ALL_TYPES.map((t) => {
        const active = !allSelected && selected.has(t);
        return (
          <Button
            key={t}
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-7 px-2 text-xs gap-1"
            onClick={() => toggle(t)}
          >
            {ICONS[t]}
            {SALE_TYPE_LABELS[t]}
          </Button>
        );
      })}
      {!allSelected && (
        <Badge variant="secondary" className="h-7 ml-1">{value.length} selecionados</Badge>
      )}
    </div>
  );
}
