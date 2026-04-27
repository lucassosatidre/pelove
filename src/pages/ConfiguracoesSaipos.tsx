import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Play, RefreshCw, Calendar, Activity, Database, Clock,
  CheckCircle2, XCircle, AlertTriangle, Settings, Zap, Pause, FastForward,
} from "lucide-react";

interface SaiposConfig {
  id: string;
  store_id: number | null;
  is_enabled: boolean;
  backfill_start_date: string | null;
  backfill_completed_at: string | null;
  old_data_check_enabled: boolean;
  old_data_check_window_days: number;
  last_incremental_sync_at: string | null;
  last_daily_sync_at: string | null;
  last_old_data_check_at: string | null;
}

interface SyncRun {
  id: number;
  run_type: string;
  endpoint: string;
  status: string;
  records_received: number | null;
  records_upserted: number | null;
  http_status: number | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

interface BackfillStats {
  total: number;
  success: number;
  pending: number;
  errors: number;
}

interface BackfillError {
  id: number;
  endpoint: string;
  window_start: string;
  window_end: string;
  error_message: string | null;
  attempted_at: string | null;
}

interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  jobid: number;
}

const ENDPOINTS_LABEL: Record<string, string> = {
  sales: "Vendas",
  sales_items: "Itens",
  sales_status_histories: "Status",
  financial: "Financeiro",
};

export default function ConfiguracoesSaipos() {
  const { toast } = useToast();

  const [config, setConfig] = useState<SaiposConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [backfillStats, setBackfillStats] = useState<BackfillStats | null>(null);
  const [backfillErrors, setBackfillErrors] = useState<BackfillError[]>([]);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [autoRunActive, setAutoRunActive] = useState(false);
  const [autoRunInfo, setAutoRunInfo] = useState<string>("");
  const autoRunStop = useRef(false);

  const [crons, setCrons] = useState<CronJob[]>([]);
  const [cronSetupRunning, setCronSetupRunning] = useState(false);

  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [manualSyncRunning, setManualSyncRunning] = useState(false);

  const [storeIdInput, setStoreIdInput] = useState("");
  const [backfillStartInput, setBackfillStartInput] = useState("");
  const [oldCheckDaysInput, setOldCheckDaysInput] = useState("90");

  const loadConfig = useCallback(async () => {
    const { data } = await (supabase as any).from("saipos_config").select("*").limit(1).single();
    if (data) {
      setConfig(data);
      setStoreIdInput(String(data.store_id ?? ""));
      setBackfillStartInput(data.backfill_start_date ?? "2024-09-01");
      setOldCheckDaysInput(String(data.old_data_check_window_days ?? 90));
    }
  }, []);

  const loadBackfillStats = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("saipos_backfill_progress")
      .select("status");
    if (!data) { setBackfillStats(null); setBackfillErrors([]); return; }
    const total = data.length;
    const success = data.filter((r: any) => r.status === "success").length;
    const pending = data.filter((r: any) => r.status === "pending" || r.status === "running").length;
    const errors = data.filter((r: any) => r.status === "error").length;
    setBackfillStats({ total, success, pending, errors });

    if (errors > 0) {
      const { data: errs } = await (supabase as any)
        .from("saipos_backfill_progress")
        .select("id, endpoint, window_start, window_end, error_message, attempted_at")
        .eq("status", "error")
        .order("attempted_at", { ascending: false })
        .limit(20);
      setBackfillErrors(errs ?? []);
    } else {
      setBackfillErrors([]);
    }
  }, []);

  const retryFailedBackfill = async () => {
    await (supabase as any)
      .from("saipos_backfill_progress")
      .update({ status: "pending", error_message: null })
      .eq("status", "error");
    toast({ title: "Janelas com erro voltaram para pendente" });
    await loadBackfillStats();
  };

  const loadCrons = useCallback(async () => {
    const { data } = await (supabase as any).rpc("list_saipos_crons");
    setCrons(data ?? []);
  }, []);

  const loadRuns = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("saipos_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setRuns(data ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadConfig(), loadBackfillStats(), loadCrons(), loadRuns()]);
    setLoading(false);
  }, [loadConfig, loadBackfillStats, loadCrons, loadRuns]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // --- Save config ---
  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("saipos_config")
      .update({
        store_id: storeIdInput ? Number(storeIdInput) : null,
        backfill_start_date: backfillStartInput || null,
        old_data_check_window_days: Number(oldCheckDaysInput) || 90,
      })
      .eq("id", config.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Configuração salva" }); await loadConfig(); }
    setSaving(false);
  };

  const toggleEnabled = async (value: boolean) => {
    if (!config) return;
    const { error } = await (supabase as any)
      .from("saipos_config")
      .update({ is_enabled: value })
      .eq("id", config.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { setConfig({ ...config, is_enabled: value }); toast({ title: value ? "Integração ativada" : "Integração desativada" }); }
  };

  const toggleOldCheck = async (value: boolean) => {
    if (!config) return;
    const { error } = await (supabase as any)
      .from("saipos_config")
      .update({ old_data_check_enabled: value })
      .eq("id", config.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setConfig({ ...config, old_data_check_enabled: value });
  };

  // --- Backfill ---
  const runBackfillBatch = async () => {
    setBackfillRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("saipos-historical-backfill", {
        body: { maxWindows: 4, throttleMs: 1500 },
      });
      if (error) throw error;
      console.log("[backfill] response:", data);
      if ((data as any)?.done) {
        toast({ title: "Backfill concluído!", description: "Toda a base histórica foi importada." });
      } else {
        const p = (data as any)?.progress;
        toast({
          title: "Lote processado",
          description: p ? `${p.success}/${p.total} janelas concluídas (${p.errors} erros)` : "OK",
        });
      }
      await Promise.all([loadBackfillStats(), loadConfig(), loadRuns()]);
    } catch (e: any) {
      toast({ title: "Erro no backfill", description: e.message, variant: "destructive" });
    }
    setBackfillRunning(false);
  };

  // Run backfill batches in a loop until done, stopped, or 3 errors in a row.
  // Each batch processes 6 windows (the function's hard cap) with 2s pause between batches.
  const runBackfillUntilDone = async () => {
    setAutoRunActive(true);
    autoRunStop.current = false;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    while (!autoRunStop.current) {
      try {
        setAutoRunInfo("Processando lote...");
        const { data, error } = await supabase.functions.invoke("saipos-historical-backfill", {
          body: { maxWindows: 6, throttleMs: 1500 },
        });
        if (error) throw error;

        if ((data as any)?.done) {
          toast({ title: "Backfill concluído!", description: "Toda a base histórica foi importada." });
          await Promise.all([loadBackfillStats(), loadConfig(), loadRuns()]);
          break;
        }

        const p = (data as any)?.progress;
        if (p) {
          setAutoRunInfo(`${p.success}/${p.total} janelas (${p.errors} erros, ${p.pending} pendentes)`);
        }
        await loadBackfillStats();
        consecutiveErrors = 0;

        // Pause between batches so the UI updates and to avoid overwhelming the API
        if (!autoRunStop.current) {
          await new Promise((res) => setTimeout(res, 2000));
        }
      } catch (e: any) {
        consecutiveErrors++;
        setAutoRunInfo(`Erro (tentativa ${consecutiveErrors}/${maxConsecutiveErrors}): ${e.message}`);
        if (consecutiveErrors >= maxConsecutiveErrors) {
          toast({
            title: "Auto-run pausado",
            description: `${consecutiveErrors} erros consecutivos. Verifique o card de erros e tente continuar manualmente.`,
            variant: "destructive",
          });
          break;
        }
        // Wait longer on error before next attempt
        await new Promise((res) => setTimeout(res, 5000));
      }
    }

    setAutoRunActive(false);
    setAutoRunInfo("");
    await Promise.all([loadBackfillStats(), loadConfig(), loadRuns()]);
  };

  const stopAutoRun = () => {
    autoRunStop.current = true;
    setAutoRunInfo("Parando após o lote atual...");
  };

  // --- Cron jobs setup ---
  const setupCrons = async () => {
    setCronSetupRunning(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const functionsUrl = `${supabaseUrl}/functions/v1`;
      const { data, error } = await (supabase as any).rpc("schedule_saipos_crons", {
        p_functions_url: functionsUrl,
        p_auth_key: anonKey,
      });
      if (error) throw error;
      console.log("[crons] setup:", data);
      toast({ title: "Crons agendados", description: "3 jobs criados (incremental, daily, semanal)" });
      await loadCrons();
    } catch (e: any) {
      toast({ title: "Erro ao agendar crons", description: e.message, variant: "destructive" });
    }
    setCronSetupRunning(false);
  };

  const removeCrons = async () => {
    if (!confirm("Remover todos os cron jobs do Saipos? A sincronização automática vai parar.")) return;
    setCronSetupRunning(true);
    try {
      const { error } = await (supabase as any).rpc("unschedule_saipos_crons");
      if (error) throw error;
      toast({ title: "Crons removidos" });
      await loadCrons();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setCronSetupRunning(false);
  };

  // --- Manual sync (last 2h) ---
  const manualSync = async () => {
    setManualSyncRunning(true);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
      const { data, error } = await supabase.functions.invoke("saipos-sync-window", {
        body: { start: start.toISOString(), end: end.toISOString(), runType: "manual" },
      });
      if (error) throw error;
      console.log("[manual sync]", data);
      toast({ title: "Sincronização manual concluída", description: "Últimas 2 horas atualizadas" });
      await loadRuns();
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    }
    setManualSyncRunning(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p>Tabela <code>saipos_config</code> não encontrada. Verifique se a migration foi aplicada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backfillProgress = backfillStats && backfillStats.total > 0
    ? Math.round((backfillStats.success / backfillStats.total) * 100)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" /> Integração Saipos
          </h1>
          <p className="text-sm text-muted-foreground">Sincroniza vendas, itens, status e financeiro da Saipos com o Pe Love</p>
        </div>
        <Badge variant={config.is_enabled ? "default" : "secondary"}>
          {config.is_enabled ? "Ativa" : "Desativada"}
        </Badge>
      </div>

      {/* Card 1: Configurações básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações</CardTitle>
          <CardDescription>Token Saipos é configurado como secret no Supabase (SAIPOS_API_TOKEN)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Integração ativa</p>
              <p className="text-xs text-muted-foreground">Quando desativada, os crons param de sincronizar</p>
            </div>
            <Switch checked={config.is_enabled} onCheckedChange={toggleEnabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>ID da loja (Saipos)</Label>
              <Input value={storeIdInput} onChange={(e) => setStoreIdInput(e.target.value)} placeholder="42566" />
            </div>
            <div className="space-y-1.5">
              <Label>Início do histórico</Label>
              <Input type="date" value={backfillStartInput} onChange={(e) => setBackfillStartInput(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Janela de revisão (dias)</Label>
              <Input type="number" min={7} max={365} value={oldCheckDaysInput} onChange={(e) => setOldCheckDaysInput(e.target.value)} />
            </div>
          </div>

          <Button onClick={saveConfig} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar configuração
          </Button>
        </CardContent>
      </Card>

      {/* Card 2: Backfill histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5" /> Carga histórica</CardTitle>
          <CardDescription>
            Importa toda a base desde {config.backfill_start_date ?? "—"}.
            Pode levar vários minutos. Roda em lotes; clique de novo até concluir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.backfill_completed_at ? (
            <div className="flex items-center gap-2 p-3 bg-primary/10 text-primary rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium">Backfill concluído</p>
                <p className="text-xs">em {new Date(config.backfill_completed_at).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          ) : (
            <>
              {backfillStats && backfillStats.total > 0 && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Progresso</span>
                      <span className="font-medium">{backfillStats.success}/{backfillStats.total} janelas</span>
                    </div>
                    <Progress value={backfillProgress} />
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span>✅ {backfillStats.success}</span>
                    <span>⏳ {backfillStats.pending}</span>
                    <span className="text-destructive">❌ {backfillStats.errors}</span>
                  </div>
                </>
              )}
              <div className="flex gap-2 flex-wrap">
                {!autoRunActive ? (
                  <>
                    <Button onClick={runBackfillUntilDone} disabled={backfillRunning}>
                      <FastForward className="w-4 h-4 mr-2" />
                      Rodar até concluir
                    </Button>
                    <Button variant="outline" onClick={runBackfillBatch} disabled={backfillRunning}>
                      {backfillRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      {backfillStats && backfillStats.total > 0 ? "Continuar (1 lote)" : "Iniciar (1 lote)"}
                    </Button>
                  </>
                ) : (
                  <Button variant="destructive" onClick={stopAutoRun}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pausar auto-run
                  </Button>
                )}
                {backfillStats && backfillStats.errors > 0 && !autoRunActive && (
                  <Button variant="outline" onClick={retryFailedBackfill} disabled={backfillRunning}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar erros novamente ({backfillStats.errors})
                  </Button>
                )}
              </div>
              {autoRunActive && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 text-primary rounded-lg text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{autoRunInfo || "Iniciando..."}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Errors section — only renders when there are backfill errors */}
      {backfillErrors.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Erros do backfill ({backfillErrors.length})
            </CardTitle>
            <CardDescription>
              Mensagens de erro retornadas pela API ou pelo Postgres. Mostra as últimas 20.
              Após corrigir a causa, clique em "Tentar erros novamente" no card acima.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {backfillErrors.map((e) => (
              <div key={e.id} className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{e.endpoint}</Badge>
                  <span className="text-muted-foreground">
                    {e.window_start} → {e.window_end}
                  </span>
                  {e.attempted_at && (
                    <span className="text-muted-foreground ml-auto">
                      {new Date(e.attempted_at).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>
                <pre className="text-xs whitespace-pre-wrap break-all bg-background/50 p-2 rounded text-destructive">
                  {e.error_message ?? "(sem mensagem)"}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Card 3: Sincronização automática (cron) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Zap className="w-5 h-5" /> Sincronização automática</CardTitle>
          <CardDescription>
            3 jobs agendados via pg_cron: incremental (30min), diária (04h, últimos 7 dias) e semanal (domingo 05h, últimos N dias)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Verificar dados antigos semanalmente</p>
              <p className="text-xs text-muted-foreground">Janela atual: {config.old_data_check_window_days} dias</p>
            </div>
            <Switch checked={config.old_data_check_enabled} onCheckedChange={toggleOldCheck} />
          </div>

          {crons.length === 0 ? (
            <div className="p-3 bg-amber-500/10 text-amber-700 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Nenhum cron job configurado. Clique em "Agendar crons" para ativar a sincronização automática.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {crons.map((c) => (
                <div key={c.jobid} className="flex items-center justify-between p-2 border border-border rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={c.active ? "default" : "secondary"} className="text-xs">{c.active ? "ON" : "OFF"}</Badge>
                    <code className="text-xs">{c.jobname}</code>
                  </div>
                  <code className="text-xs text-muted-foreground">{c.schedule}</code>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={setupCrons} disabled={cronSetupRunning}>
              {cronSetupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
              {crons.length > 0 ? "Reagendar crons" : "Agendar crons"}
            </Button>
            {crons.length > 0 && (
              <Button variant="outline" onClick={removeCrons} disabled={cronSetupRunning}>
                Remover crons
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Sync manual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Sincronizar agora</CardTitle>
          <CardDescription>Puxa as últimas 2 horas — útil quando precisa atualizar antes do próximo cron</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Stat label="Última incremental" value={config.last_incremental_sync_at} />
            <Stat label="Última diária" value={config.last_daily_sync_at} />
            <Stat label="Última semanal" value={config.last_old_data_check_at} />
            <Stat label="Backfill" value={config.backfill_completed_at} />
          </div>
          <Button onClick={manualSync} disabled={manualSyncRunning || !config.is_enabled}>
            {manualSyncRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar agora (últimas 2h)
          </Button>
        </CardContent>
      </Card>

      {/* Card 5: Histórico de execuções */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2"><Activity className="w-5 h-5" /> Histórico de execuções</CardTitle>
            <CardDescription>Últimas 20 sincronizações</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadRuns}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma execução ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recebidos</TableHead>
                  <TableHead className="text-right">Salvos</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline" className="text-xs">{r.run_type}</Badge></TableCell>
                    <TableCell className="text-xs">{ENDPOINTS_LABEL[r.endpoint] ?? r.endpoint}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right text-xs">{r.records_received ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{r.records_upserted ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs">{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(r.started_at).toLocaleString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="p-2 bg-muted rounded">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value ? new Date(value).toLocaleString("pt-BR") : "—"}</p>
    </div>
  );
}

function statusBadge(s: string) {
  switch (s) {
    case "success": return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> OK</Badge>;
    case "error": return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Erro</Badge>;
    case "running": return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Em execução</Badge>;
    default: return <Badge variant="outline">{s}</Badge>;
  }
}
