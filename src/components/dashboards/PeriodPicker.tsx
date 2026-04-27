import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "lucide-react";
import { presetToRange, type PeriodPreset, type ComparisonMode } from "@/hooks/useSaiposDashboards";

export interface PeriodValue {
  start: Date;
  end: Date;
  comparisonMode: ComparisonMode;
}

interface Props {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Mês atual" },
  { value: "last_month", label: "Mês passado" },
  { value: "ytd", label: "Ano até hoje" },
  { value: "custom", label: "Personalizado" },
];

function toIsoInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromIsoInput(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function PeriodPicker({ value, onChange }: Props) {
  const [preset, setPreset] = useState<PeriodPreset>("last_7d");
  const [customStart, setCustomStart] = useState<string>(toIsoInput(value.start));
  const [customEnd, setCustomEnd] = useState<string>(toIsoInput(value.end));
  const [open, setOpen] = useState(false);

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== "custom") {
      const r = presetToRange(p);
      onChange({ ...value, start: r.start, end: r.end });
      setCustomStart(toIsoInput(r.start));
      setCustomEnd(toIsoInput(r.end));
    }
  };

  const applyCustom = () => {
    const s = fromIsoInput(customStart);
    const e = fromIsoInput(customEnd);
    if (e < s) return;
    onChange({ ...value, start: s, end: e });
    setOpen(false);
  };

  const labelOfRange = `${value.start.toLocaleDateString("pt-BR")} → ${value.end.toLocaleDateString("pt-BR")}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="w-4 h-4" />
            {labelOfRange}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3" align="start">
          <div className="space-y-1">
            <Label className="text-xs">Período</Label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as PeriodPreset)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setPreset("custom"); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setPreset("custom"); }} />
            </div>
          </div>

          <Button size="sm" className="w-full" onClick={applyCustom}>Aplicar</Button>
        </PopoverContent>
      </Popover>

      <span className="text-xs text-muted-foreground">vs.</span>

      <Select
        value={value.comparisonMode}
        onValueChange={(v) => onChange({ ...value, comparisonMode: v as ComparisonMode })}
      >
        <SelectTrigger className="h-9 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="previous_period">Período anterior</SelectItem>
          <SelectItem value="previous_year">Ano anterior</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
