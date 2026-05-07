import { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, FileText, ListPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useDRESnapshot,
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
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    let s = v.trim().replace("%", "").replace(/\s/g, "");
    s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return isPct ? n : n;
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
// Visualização
// ============================================================
function DRESnapshotView() {
  const periods = useDRESnapshotPeriods();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);

  // Default: primeiro período disponível
  useEffect(() => {
    if (year == null && periods.data && periods.data.length > 0) {
      setYear(periods.data[0].period_year);
      setMonth(periods.data[0].period_month);
    }
  }, [periods.data, year]);

  const snap = useDRESnapshot(year, month);

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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Label className="text-xs">Período</Label>
          <Select
            value={year && month ? `${year}-${month}` : undefined}
            onValueChange={(v) => {
              const [y, m] = v.split("-").map(Number);
              setYear(y);
              setMonth(m);
            }}
          >
            <SelectTrigger className="h-9 w-64 text-sm">
              <SelectValue placeholder="Escolha mês" />
            </SelectTrigger>
            <SelectContent>
              {periods.data.map((p) => (
                <SelectItem key={`${p.period_year}-${p.period_month}`} value={`${p.period_year}-${p.period_month}`}>
                  {MONTH_NAMES_PT[p.period_month - 1]} {p.period_year} ({p.rows_count} linhas)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {year && month && (
            <Badge variant="outline" className="ml-auto text-xs">
              {MONTH_NAMES_PT[month - 1]}/{year}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRE Gerencial — {year && month ? `${MONTH_NAMES_PT[month - 1]}/${year}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {snap.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : !snap.data || snap.data.length === 0 ? (
            <p className="p-8 text-sm text-muted-foreground text-center">Sem dados pra esse período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/3">Linha</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right w-24">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.data.map((r) => {
                  const isTotal = r.line_type === "total";
                  const isSection = r.line_type === "section";
                  const isDeduction = r.line_type === "deduction";

                  let rowClass = "";
                  if (isTotal && r.level === 0) rowClass = "bg-primary/10 border-y border-primary/30 font-bold";
                  else if (isTotal) rowClass = "bg-muted/50 font-semibold";
                  else if (isSection) rowClass = "font-semibold text-emerald-600 dark:text-emerald-400";
                  else if (isDeduction && r.level === 0) rowClass = "font-semibold text-destructive";

                  const indent = r.level * 16;
                  const valueColor =
                    isTotal ? (r.amount != null && r.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive") :
                    r.amount != null && r.amount < 0 ? "text-destructive/80" :
                    "";

                  return (
                    <TableRow key={r.ord} className={rowClass}>
                      <TableCell className="py-1.5">
                        <span style={{ paddingLeft: `${indent}px` }}>{r.line_label_clean}</span>
                      </TableCell>
                      <TableCell className={`text-right tabular-nums py-1.5 ${valueColor}`}>
                        {fmtBRL(r.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-1.5">
                        {fmtPct(r.pct)}
                      </TableCell>
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
