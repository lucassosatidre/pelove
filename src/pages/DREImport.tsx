import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPA = supabase as any;

interface ImportRow {
  category: string;
  description: string | null;
  amount: number;
  date: string; // YYYY-MM-DD
  payment_date: string | null;
  issuance_date: string | null;
  paid: boolean;
  payment_method: string | null;
  fornecedor: string | null;
  raw_row: Record<string, unknown>;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function toIsoDate(d: unknown): string | null {
  if (d == null || d === "") return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (typeof d === "string") {
    const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return null;
}

async function parseFinanceiroXlsx(file: File): Promise<{
  filename: string;
  rows: ImportRow[];
  totalRows: number;
  skippedRows: number;
}> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  // Header expected: Vencimento | Emissão | Pagamento | Conta | Método | Categoria | Valor | Pago | Fornecedor | Descrição
  const rows: ImportRow[] = [];
  let lastMotherDate: string | null = null;
  let skipped = 0;

  for (let i = 1; i < json.length; i++) {
    const row = (json[i] ?? []) as unknown[];
    const venc = row[0];
    const emis = row[1];
    const pgto = row[2];
    const metodo = row[4];
    const cat = row[5];
    const valor = row[6];
    const pago = row[7];
    const forn = row[8];
    const desc = row[9];

    if (!cat) {
      skipped++;
      continue;
    }
    if (valor === undefined || valor === null || valor === "") {
      skipped++;
      continue;
    }

    const valorNum = typeof valor === "number" ? valor : parseFloat(String(valor).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(valorNum)) {
      skipped++;
      continue;
    }

    const vencIso = toIsoDate(venc);
    const isMotherRow = vencIso !== null;

    let effectiveDate: string;
    if (isMotherRow) {
      effectiveDate = vencIso!;
      lastMotherDate = vencIso;
      // Pula a linha-mãe — a API do Saipos já traz ela (com amount=0 quando agregadora).
      // Importar de novo causaria dupla contagem com lançamentos individuais.
      skipped++;
      continue;
    } else {
      // Linha-filha: herda data da última mãe acima
      if (!lastMotherDate) {
        skipped++;
        continue;
      }
      effectiveDate = lastMotherDate;
    }

    rows.push({
      category: String(cat).trim(),
      description: desc != null ? String(desc).trim() : null,
      amount: valorNum,
      date: effectiveDate,
      issuance_date: toIsoDate(emis),
      payment_date: toIsoDate(pgto),
      paid: pago === "Sim" || pago === true,
      payment_method: metodo != null ? String(metodo).trim() : null,
      fornecedor: forn != null ? String(forn).trim() : null,
      raw_row: { venc, emis, pgto, metodo, cat, valor, pago, forn, desc },
    });
  }

  return {
    filename: file.name,
    rows,
    totalRows: json.length - 1,
    skippedRows: skipped,
  };
}

interface ImportSummary {
  filename: string;
  rows_total: number;
  rows_inserted: number;
  rows_skipped_duplicate: number;
  total_amount: number;
}

interface ImportLogRow {
  id: string;
  filename: string;
  period_start: string | null;
  period_end: string | null;
  rows_total: number;
  rows_inserted: number;
  rows_skipped_duplicate: number;
  total_amount: number | null;
  imported_at: string;
}

export default function DREImport() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ filename: string; rows: ImportRow[]; totalRows: number; skippedRows: number } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const log = useQuery<ImportLogRow[]>({
    queryKey: ["dre", "imports-log"],
    queryFn: async () => {
      const { data, error } = await SUPA.rpc("get_dre_imports_log", { p_limit: 20 });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        filename: r.filename,
        period_start: r.period_start,
        period_end: r.period_end,
        rows_total: Number(r.rows_total),
        rows_inserted: Number(r.rows_inserted),
        rows_skipped_duplicate: Number(r.rows_skipped_duplicate),
        total_amount: r.total_amount != null ? Number(r.total_amount) : null,
        imported_at: r.imported_at,
      }));
    },
    staleTime: 30_000,
  });

  const handleFile = async (file: File) => {
    setResult(null);
    setParsed(null);
    setParsing(true);
    try {
      const out = await parseFinanceiroXlsx(file);
      if (out.rows.length === 0) {
        toast.error("Nenhuma linha-filha encontrada no XLSX. Confira se é o arquivo certo (Financeiro do Saipos).");
      } else {
        toast.success(`Pronto pra importar: ${out.rows.length} linhas-filha`);
      }
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
      const dates = parsed.rows.map((r) => r.date).sort();
      const periodStart = dates[0];
      const periodEnd = dates[dates.length - 1];
      const { data, error } = await SUPA.functions.invoke("import-financeiro-xlsx", {
        body: {
          filename: parsed.filename,
          period_start: periodStart,
          period_end: periodEnd,
          rows: parsed.rows,
        },
      });
      if (error) throw error;
      const summary: ImportSummary = {
        filename: parsed.filename,
        rows_total: data.rows_total,
        rows_inserted: data.rows_inserted,
        rows_skipped_duplicate: data.rows_skipped_duplicate,
        total_amount: data.total_amount,
      };
      setResult(summary);
      toast.success(`Importado: ${summary.rows_inserted} novas, ${summary.rows_skipped_duplicate} duplicadas`);
      qc.invalidateQueries({ queryKey: ["dre"] });
      log.refetch();
      setParsed(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao importar: ${msg}`);
    } finally {
      setImporting(false);
    }
  };

  const previewByCategory = (() => {
    if (!parsed) return [] as Array<{ category: string; qtd: number; total: number }>;
    const map = new Map<string, { qtd: number; total: number }>();
    for (const r of parsed.rows) {
      const cur = map.get(r.category) ?? { qtd: 0, total: 0 };
      cur.qtd += 1;
      cur.total += r.amount;
      map.set(r.category, cur);
    }
    return Array.from(map.entries())
      .map(([category, info]) => ({ category, ...info }))
      .sort((a, b) => a.total - b.total);
  })();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dre")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Importar Financeiro do Saipos</h1>
          <p className="text-sm text-muted-foreground">
            Sobe o XLSX exportado em "Lançamentos Financeiros" do Saipos pra completar dados que a API não entrega (acertos individuais com entregadores etc).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Selecionar arquivo
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
              Formato esperado: "Financeiro 01XXX-31XXX.xlsx" exportado do Saipos
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
                    {parsed.rows.length} linhas-filha pra importar · {parsed.skippedRows} linhas puladas (mães + sem categoria)
                  </p>
                </div>
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? "Importando..." : `Importar ${parsed.rows.length} linhas`}
                </Button>
              </div>

              {previewByCategory.length > 0 && (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Linhas</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewByCategory.map((g) => (
                        <TableRow key={g.category}>
                          <TableCell className="font-medium">{g.category}</TableCell>
                          <TableCell className="text-right tabular-nums">{g.qtd}</TableCell>
                          <TableCell className={`text-right tabular-nums ${g.total < 0 ? "text-destructive" : ""}`}>
                            {fmtBRL(g.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Import concluído</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {result.rows_inserted} novas linhas · {result.rows_skipped_duplicate} duplicadas (puladas) ·
                  total {fmtBRL(result.total_amount)}
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
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Inseridas</TableHead>
                  <TableHead className="text-right">Duplicadas</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.imported_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium text-xs">{r.filename}</TableCell>
                    <TableCell className="text-xs">
                      {r.period_start && r.period_end
                        ? `${fmtDateBR(r.period_start)} → ${fmtDateBR(r.period_end)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.rows_inserted}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.rows_skipped_duplicate}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.total_amount != null ? fmtBRL(r.total_amount) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> Como funciona
        </p>
        <p>
          O XLSX do Saipos tem 2 tipos de linha por acerto: <strong>linha-mãe</strong> (com Vencimento, descrição "Acerto com entregadores") e <strong>linha-filha</strong> (sem Vencimento, descrição "Acerto - Nome - data"). A API do Saipos entrega só as mães (com valor zero). Esta import pega as filhas e atribui a data da mãe imediatamente acima.
        </p>
        <p>
          Re-importar o mesmo arquivo é seguro — duplicatas são detectadas via hash <code className="text-[10px] bg-muted px-1 rounded">SHA-256(categoria|descrição|valor|data)</code> e puladas.
        </p>
      </div>
    </div>
  );
}
