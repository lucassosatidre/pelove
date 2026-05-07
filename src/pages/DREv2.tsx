import { useState, useRef, useMemo, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, FileText, ListPlus, ChevronRight, ChevronDown, Calendar } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useDRESnapshotMulti,
  useDRESnapshotPeriods,
  useDRESnapshotImportsLog,
} from "@/hooks/useDRESnapshot";

const SUPA = supabase as any;

const MONTH_NAMES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];
const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmtBRL = (n: number | null) =>
  n == null
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)}%`);

// ===== Parser =====
interface ParsedRow {
  period_year: number;
  period_month: number;
  line_label: string;
  line_label_clean: string;
  level: number;
  parent_label: string | null;
  line_type: "section" | "deduction" | "total" | "item";
  amount: number | null;
  pct: number | null;
  ord: number;
}

interface ParsedFile {
  filename: string;
  period: PeriodRange;
  periods: Array<{ year: number; month: number }>;
  rows: ParsedRow[];
  rowsByPeriod: Map<string, ParsedRow[]>;
}

function detectLineType(label: string): ParsedRow["line_type"] {
  const trimmed = label.trim();
  if (trimmed.startsWith("(+)")) return "section";
  if (trimmed.startsWith("(-)") || trimmed.startsWith("(−)")) return "deduction";
  if (trimmed.startsWith("(=)")) return "total";
  return "item";
}

function getLevel(label: string): number {
  let leading = 0;
  for (const ch of label) {
    if (ch === " ") leading++;
    else break;
  }
  return Math.floor(leading / 4);
}

interface PeriodRange {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
}

function extractPeriodFromFilename(filename: string): PeriodRange | null {
  // Casos: "DRE - 01-02-2026 à 28-02-2026", "DRE - 01-11-2024 à 31-10-2025"
  const matches = Array.from(filename.matchAll(/(\d{2})-(\d{2})-(\d{4})/g));
  if (matches.length === 0) return null;
  const first = matches[0];
  const last = matches[matches.length - 1];
  return {
    startMonth: parseInt(first[2], 10),
    startYear: parseInt(first[3], 10),
    endMonth: parseInt(last[2], 10),
    endYear: parseInt(last[3], 10),
  };
}

// Dado um mês (1-12) detectado no header e o período do arquivo,
// retorna o ano correto. Funciona com períodos que cruzam ano.
function yearForMonth(month: number, period: PeriodRange): number {
  // Se start e end são o mesmo ano, fácil
  if (period.startYear === period.endYear) return period.startYear;
  // Período cruza ano: meses ≥ startMonth pertencem ao startYear,
  // meses < startMonth pertencem ao endYear
  return month >= period.startMonth ? period.startYear : period.endYear;
}

async function parseDRExlsx(file: File): Promise<ParsedFile | null> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // header: false pra preservar espaços iniciais; raw: true pra ter números
  const json = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  if (json.length < 2) return null;

  const period = extractPeriodFromFilename(file.name);
  if (!period) {
    throw new Error(
      "Não consegui detectar o período no nome do arquivo. Renomeia pra incluir DD-MM-AAAA à DD-MM-AAAA (ex: DRE - 01-02-2026 à 28-02-2026.xlsx).",
    );
  }

  // Header row: ['', 'JANEIRO', '%', 'FEVEREIRO', '%', ..., 'Total', '%']
  const header = (json[0] ?? []) as unknown[];
  const monthCols: Array<{ month: number; year: number; valueCol: number; pctCol: number }> = [];
  for (let c = 1; c < header.length; c++) {
    const cellRaw = header[c];
    const cell = cellRaw == null ? "" : String(cellRaw).trim().toUpperCase();
    const monthIdx = MONTH_NAMES.indexOf(cell);
    if (monthIdx >= 0) {
      const month = monthIdx + 1;
      monthCols.push({
        month,
        year: yearForMonth(month, period),
        valueCol: c,
        pctCol: c + 1, // assume % logo depois
      });
    }
  }
  if (monthCols.length === 0) {
    throw new Error(
      "Não encontrei colunas de mês (JANEIRO, FEVEREIRO, etc) no cabeçalho.",
    );
  }

  const rows: ParsedRow[] = [];
  // Stack de pais por nível: [{level, label}]
  const parentStack: Array<{ level: number; label: string }> = [];
  let ord = 0;

  for (let i = 1; i < json.length; i++) {
    const row = (json[i] ?? []) as unknown[];
    const labelRaw = row[0];
    if (labelRaw == null || String(labelRaw).trim() === "") continue;
    const label = String(labelRaw);
    const labelClean = label.trim();
    const level = getLevel(label);
    const lineType = detectLineType(label);

    // Atualiza stack de pais
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop();
    }
    const parent = parentStack.length > 0 ? parentStack[parentStack.length - 1].label : null;
    parentStack.push({ level, label: labelClean });

    ord++;

    for (const mc of monthCols) {
      const valueRaw = row[mc.valueCol];
      const pctRaw = row[mc.pctCol];

      const amount = parseNum(valueRaw);
      const pct = parseNum(pctRaw, true);

      rows.push({
        period_year: mc.year,
        period_month: mc.month,
        line_label: label,
        line_label_clean: labelClean,
        level,
        parent_label: parent,
        line_type: lineType,
        amount,
        pct,
        ord,
      });
    }
  }

  const periods = monthCols.map((mc) => ({ year: mc.year, month: mc.month }));
  const rowsByPeriod = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const key = `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;
    if (!rowsByPeriod.has(key)) rowsByPeriod.set(key, []);
    rowsByPeriod.get(key)!.push(r);
  }

  return { filename: file.name, period, periods, rows, rowsByPeriod };
}

function parseNum(v: unknown, isPct = false): number | null {
  if (v == null || v === "") return null;

  // Número JS: usa direto. Se for % e estiver como fração (0.1083), converte pra %.
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    if (isPct && Math.abs(v) > 0 && Math.abs(v) < 1) return v * 100;
    return v;
  }

  // String: detecta formato pelo separador.
  if (typeof v === "string") {
    let s = v.trim().replace("%", "").replace(/\s/g, "");
    if (s === "" || s === "-") return null;
    // Formato BR (1.234,56): tem vírgula → vírgula é decimal, ponto é milhar
    // Formato US/cru (109.21 ou 1234.56): ponto é decimal (mantém)
    if (s.includes(",")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  return null;
}

// ============================================================
// Página
// ============================================================
export default function DREv2() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">DRE v2 — espelho do Saipos</h1>
        <p className="text-sm text-muted-foreground">
          Cópia idêntica do "DRE Gerencial" do Saipos. Sem cálculos próprios — você importa o XLSX
          e o app exibe linha por linha como o Saipos exibe.
        </p>
      </div>

      <Tabs defaultValue="view" className="space-y-4">
        <TabsList>
          <TabsTrigger value="view" className="gap-2">
            <FileText className="w-4 h-4" /> Visualizar
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <ListPlus className="w-4 h-4" /> Importar XLSX
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="space-y-4 mt-0">
          <DRESnapshotView />
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-0">
          <DRESnapshotImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Visualização — multi-período + linhas colapsáveis
// ============================================================
interface PivotRow {
  ord: number;
  line_label: string;
  line_label_clean: string;
  level: number;
  parent_label: string | null;
  line_type: "section" | "deduction" | "total" | "item";
  byPeriod: Map<string, { amount: number | null; pct: number | null }>;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function DRESnapshotView() {
  const periods = useDRESnapshotPeriods();
  const [selected, setSelected] = useState<Array<{ year: number; month: number }>>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Default: último período disponível (mais recente)
  useEffect(() => {
    if (selected.length === 0 && periods.data && periods.data.length > 0) {
      const p = periods.data[0];
      setSelected([{ year: p.period_year, month: p.period_month }]);
    }
  }, [periods.data, selected.length]);

  const snap = useDRESnapshotMulti(selected);

  // Pivot: agrupa por ord e cada período vira uma coluna
  const pivoted = useMemo<PivotRow[]>(() => {
    if (!snap.data) return [];
    const byOrd = new Map<number, PivotRow>();
    for (const r of snap.data) {
      let row = byOrd.get(r.ord);
      if (!row) {
        row = {
          ord: r.ord,
          line_label: r.line_label,
          line_label_clean: r.line_label_clean,
          level: r.level,
          parent_label: r.parent_label,
          line_type: r.line_type,
          byPeriod: new Map(),
        };
        byOrd.set(r.ord, row);
      }
      row.byPeriod.set(periodKey(r.period_year, r.period_month), {
        amount: r.amount,
        pct: r.pct,
      });
    }
    return Array.from(byOrd.values()).sort((a, b) => a.ord - b.ord);
  }, [snap.data]);

  // Map label → row (pra resolver ancestrais rapidinho)
  const labelToRow = useMemo(() => {
    const m = new Map<string, PivotRow>();
    for (const r of pivoted) m.set(r.line_label_clean, r);
    return m;
  }, [pivoted]);

  // Map label → tem filho? (pra mostrar caret)
  const hasChildren = useMemo(() => {
    const m = new Set<string>();
    for (const r of pivoted) {
      if (r.parent_label) m.add(r.parent_label);
    }
    return m;
  }, [pivoted]);

  // Visibilidade: linha visível se TODOS ancestrais estão expanded
  const isVisible = (row: PivotRow): boolean => {
    let parent = row.parent_label;
    while (parent) {
      if (!expanded.has(parent)) return false;
      const parentRow = labelToRow.get(parent);
      parent = parentRow?.parent_label ?? null;
    }
    return true;
  };

  const toggleExpand = (label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(Array.from(hasChildren)));
  };
  const collapseAll = () => setExpanded(new Set());

  // Ordena selected pra header consistente (mais antigo → mais novo)
  const orderedPeriods = useMemo(() => {
    return [...selected].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [selected]);

  if (periods.isLoading) return <Skeleton className="h-96 w-full" />;
  if (!periods.data || periods.data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Nenhum DRE importado ainda</p>
          <p className="text-xs text-muted-foreground">
            Vai na aba "Importar XLSX" e sobe o "DRE Gerencial" do Saipos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const togglePeriod = (year: number, month: number) => {
    setSelected((prev) => {
      const exists = prev.some((p) => p.year === year && p.month === month);
      if (exists) return prev.filter((p) => !(p.year === year && p.month === month));
      return [...prev, { year, month }];
    });
  };

  const visibleRows = pivoted.filter(isVisible);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 min-w-48">
                <Calendar className="w-4 h-4" />
                {selected.length === 0
                  ? "Escolher meses"
                  : selected.length === 1
                  ? `${MONTH_NAMES_PT[selected[0].month - 1]}/${selected[0].year}`
                  : `${selected.length} meses selecionados`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-2 border-b flex items-center justify-between">
                <span className="text-xs font-medium">Períodos disponíveis</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelected(periods.data!.map((p) => ({ year: p.period_year, month: p.period_month })))}>
                    Todos
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelected([])}>
                    Limpar
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {periods.data!.map((p) => {
                  const checked = selected.some((s) => s.year === p.period_year && s.month === p.period_month);
                  return (
                    <label
                      key={`${p.period_year}-${p.period_month}`}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePeriod(p.period_year, p.period_month)}
                      />
                      <span className="flex-1">{MONTH_NAMES_PT[p.period_month - 1]} {p.period_year}</span>
                      <span className="text-xs text-muted-foreground">{p.rows_count} linhas</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex gap-1 ml-auto">
            <Button variant="ghost" size="sm" className="text-xs" onClick={expandAll}>
              Expandir tudo
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={collapseAll}>
              Colapsar tudo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRE Gerencial</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {snap.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : visibleRows.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">
              {selected.length === 0 ? "Selecione ao menos um mês" : "Sem dados nos períodos escolhidos"}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-72 sticky left-0 bg-background z-10">Linha</TableHead>
                  {orderedPeriods.map((p) => (
                    <Fragment key={periodKey(p.year, p.month)}>
                      <TableHead className="text-right min-w-28 pr-1">
                        <div className="font-medium">{MONTH_NAMES_PT[p.month - 1].slice(0, 3)}/{String(p.year).slice(-2)}</div>
                      </TableHead>
                      <TableHead className="text-right w-16 pl-1 text-muted-foreground">%</TableHead>
                    </Fragment>
                  ))}
                  {orderedPeriods.length >= 2 && (
                    <>
                      <TableHead className="text-right min-w-28 pr-1 border-l">
                        <div className="font-medium">Δ R$</div>
                        <div className="text-[10px] text-muted-foreground font-normal">
                          {MONTH_NAMES_PT[orderedPeriods[orderedPeriods.length - 1].month - 1].slice(0, 3)}/{String(orderedPeriods[orderedPeriods.length - 1].year).slice(-2)}
                          {" − "}
                          {MONTH_NAMES_PT[orderedPeriods[0].month - 1].slice(0, 3)}/{String(orderedPeriods[0].year).slice(-2)}
                        </div>
                      </TableHead>
                      <TableHead className="text-right w-20 pl-1">Δ %</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((r) => {
                  const isTotal = r.line_type === "total";
                  const isSection = r.line_type === "section";
                  const isDeduction = r.line_type === "deduction";
                  const canExpand = hasChildren.has(r.line_label_clean);
                  const isExpanded = expanded.has(r.line_label_clean);

                  let rowClass = "";
                  if (isTotal && r.level === 0) rowClass = "bg-primary/10 border-y border-primary/30 font-bold";
                  else if (isTotal) rowClass = "bg-muted/50 font-semibold";
                  else if (isSection) rowClass = "font-semibold text-emerald-600 dark:text-emerald-400";
                  else if (isDeduction && r.level === 0) rowClass = "font-semibold text-destructive";

                  const indent = r.level * 16;
                  const cursor = canExpand ? "cursor-pointer" : "cursor-default";

                  // Δ: último período − primeiro período (na ordem cronológica)
                  let deltaCells: React.ReactNode = null;
                  if (orderedPeriods.length >= 2) {
                    const firstP = orderedPeriods[0];
                    const lastP = orderedPeriods[orderedPeriods.length - 1];
                    const firstCell = r.byPeriod.get(periodKey(firstP.year, firstP.month));
                    const lastCell = r.byPeriod.get(periodKey(lastP.year, lastP.month));
                    const a = firstCell?.amount ?? null;
                    const b = lastCell?.amount ?? null;
                    const haveBoth = a != null && b != null;
                    const delta = haveBoth ? b - a : null;
                    // Variação % usa o valor absoluto do primeiro pra não bagunçar com sinal negativo
                    const deltaPct = haveBoth && a !== 0 ? (delta! / Math.abs(a)) * 100 : null;
                    const deltaColor =
                      delta == null ? "text-muted-foreground" :
                      // Pra deduções/despesas (valor negativo), uma redução em magnitude é melhoria → verde
                      isDeduction || (a != null && a < 0)
                        ? (delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                        : (delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
                    deltaCells = (
                      <>
                        <TableCell className={`text-right tabular-nums py-1.5 pr-1 border-l ${deltaColor}`}>
                          {delta == null ? "—" : `${delta > 0 ? "+" : ""}${fmtBRL(delta)}`}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums text-xs py-1.5 pl-1 ${deltaColor}`}>
                          {deltaPct == null ? "—" : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
                        </TableCell>
                      </>
                    );
                  }

                  return (
                    <TableRow
                      key={r.ord}
                      className={`${rowClass} ${cursor}`}
                      onClick={() => canExpand && toggleExpand(r.line_label_clean)}
                    >
                      <TableCell className="py-1.5 sticky left-0 bg-inherit z-10">
                        <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
                          {canExpand ? (
                            isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 mr-1 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 mr-1 shrink-0" />
                            )
                          ) : (
                            <span className="w-3.5 mr-1" />
                          )}
                          <span>{r.line_label_clean}</span>
                        </div>
                      </TableCell>
                      {orderedPeriods.map((p) => {
                        const cell = r.byPeriod.get(periodKey(p.year, p.month));
                        const amt = cell?.amount ?? null;
                        const pct = cell?.pct ?? null;
                        const valueColor =
                          isTotal ? (amt != null && amt >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive") :
                          amt != null && amt < 0 ? "text-destructive/80" :
                          "";
                        return (
                          <Fragment key={periodKey(p.year, p.month)}>
                            <TableCell className={`text-right tabular-nums py-1.5 pr-1 ${valueColor}`}>
                              {fmtBRL(amt)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5 pl-1">
                              {fmtPct(pct)}
                            </TableCell>
                          </Fragment>
                        );
                      })}
                      {deltaCells}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Import
// ============================================================
function DRESnapshotImport() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ rows_inserted: number; rows_replaced: number; periods: string[] } | null>(null);
  const log = useDRESnapshotImportsLog();

  const handleFile = async (file: File) => {
    setResult(null);
    setParsed(null);
    setParsing(true);
    try {
      const out = await parseDRExlsx(file);
      if (!out) {
        toast.error("XLSX vazio ou inválido");
        return;
      }
      if (out.rows.length === 0) {
        toast.error("Nenhuma linha encontrada no XLSX");
        return;
      }
      toast.success(`Pronto: ${out.periods.length} mês(es) detectado(s), ${out.rows.length} linhas`);
      setParsed(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao ler XLSX: ${msg}`);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setResult(null);
    try {
      const { data, error } = await SUPA.functions.invoke("import-dre-gerencial", {
        body: {
          filename: parsed.filename,
          periods: parsed.periods,
          rows: parsed.rows,
        },
      });
      if (error) throw error;
      setResult({
        rows_inserted: data.rows_inserted,
        rows_replaced: data.rows_replaced,
        periods: data.periods,
      });
      toast.success(`Import concluído: ${data.rows_inserted} linhas inseridas`);
      qc.invalidateQueries({ queryKey: ["dre-snapshot"] });
      log.refetch();
      setParsed(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao importar: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const previewByPeriod = useMemo(() => {
    if (!parsed) return [];
    return Array.from(parsed.rowsByPeriod.entries()).map(([key, rows]) => {
      const [y, m] = key.split("-").map(Number);
      // Linha do "Lucro Líquido do Exercício" se existir
      const final = rows.find((r) => /Lucro\s*L[íi]quido\s*do\s*Exerc[íi]cio/i.test(r.line_label_clean));
      return {
        key,
        year: y,
        month: m,
        rows_count: rows.length,
        final_amount: final?.amount ?? null,
      };
    });
  }, [parsed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Sobe o "DRE Gerencial" do Saipos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-md p-8 text-center hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Arrasta o XLSX aqui ou clica pra escolher
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Aceita 1 mês ou ano inteiro. Ex: "DRE - 01-02-2026 à 28-02-2026.xlsx" ou "DRE - 01-01-2025 à 31-12-2025.xlsx"
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {parsing && <Skeleton className="h-20 w-full" />}

          {parsed && !parsing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{parsed.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    Período {MONTH_NAMES_PT[parsed.period.startMonth - 1]}/{parsed.period.startYear} → {MONTH_NAMES_PT[parsed.period.endMonth - 1]}/{parsed.period.endYear}
                    {" · "}{parsed.periods.length} mês(es) · {parsed.rows.length} linhas total
                  </p>
                </div>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importando..." : `Importar ${parsed.periods.length} mês(es)`}
                </Button>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead className="text-right">Lucro Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewByPeriod.map((p) => (
                      <TableRow key={p.key}>
                        <TableCell className="font-medium">
                          {MONTH_NAMES_PT[p.month - 1]} {p.year}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.rows_count}</TableCell>
                        <TableCell className={`text-right tabular-nums ${p.final_amount != null && p.final_amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {fmtBRL(p.final_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Import concluído</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {result.rows_inserted} linhas inseridas em {result.periods.length} período(s).
                  {result.rows_replaced > 0 && ` ${result.rows_replaced} linhas antigas substituídas.`}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de imports</CardTitle>
        </CardHeader>
        <CardContent>
          {log.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !log.data || log.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum import ainda</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Períodos</TableHead>
                  <TableHead className="text-right">Inseridas</TableHead>
                  <TableHead className="text-right">Substituídas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.imported_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{r.filename}</TableCell>
                    <TableCell className="text-xs">
                      {r.periods_imported.slice(0, 3).join(", ")}
                      {r.periods_imported.length > 3 ? ` +${r.periods_imported.length - 3}` : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.rows_inserted}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.rows_replaced}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Como funciona
        </p>
        <p>
          O parser detecta automaticamente os meses pelas colunas do cabeçalho (JANEIRO, FEVEREIRO, etc) e o ano pelo nome do arquivo.
        </p>
        <p>
          Re-importar o mesmo período é seguro — o app <strong>substitui</strong> as linhas antigas pelas novas (não duplica).
        </p>
      </div>
    </div>
  );
}
