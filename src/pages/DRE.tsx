import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info } from "lucide-react";
import {
  presetToRange,
  comparisonRange,
  useDataCoverage,
  type ComparisonMode,
} from "@/hooks/useSaiposDashboards";
import { useDREDataCoverage } from "@/hooks/useDRE";
import { PeriodPicker, type PeriodValue } from "@/components/dashboards/PeriodPicker";
import {
  DREKpiCards,
  DRECascade,
  DRERevenueByChannel,
  DREExpensesByGroup,
  DREMonthlyChart,
} from "@/components/dre/DREViews";

export default function DRE() {
  const initial = presetToRange("this_month");
  const [period, setPeriod] = useState<PeriodValue>({
    start: initial.start,
    end: initial.end,
    comparisonMode: "previous_period" as ComparisonMode,
  });

  const compareRange = useMemo(
    () => comparisonRange(period.start, period.end, period.comparisonMode),
    [period],
  );

  const salesCoverage = useDataCoverage();
  const finCoverage = useDREDataCoverage();

  const noSalesData = !salesCoverage.isLoading && (!salesCoverage.data || salesCoverage.data.total_sales === 0);
  const noFinancialData = !finCoverage.isLoading && (!finCoverage.data || finCoverage.data.total_financial_txns === 0);
  const noNegativeFinancial = !finCoverage.isLoading && finCoverage.data && finCoverage.data.total_financial_txns > 0 && finCoverage.data.total_negative_txns === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">DRE</h1>
        <p className="text-sm text-muted-foreground">
          Demonstrativo de Resultado do Exercício — vendas (Saipos) e movimentações financeiras consolidadas
        </p>
      </div>

      {noSalesData && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Sem dados de vendas ainda</p>
              <p className="text-xs text-muted-foreground">
                Vá em <strong>Integração Saipos</strong> e rode o backfill histórico. A DRE precisa das vendas pra calcular o faturamento.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!noSalesData && noFinancialData && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Sem movimentações financeiras sincronizadas</p>
              <p className="text-xs text-muted-foreground">
                A DRE está calculando só com vendas. Sincronize o módulo financeiro (endpoint <code className="text-xs bg-muted px-1 rounded">financial</code>) pra ver despesas por categoria e o resultado completo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!noSalesData && !noFinancialData && noNegativeFinancial && (
        <Card className="border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Movimentações financeiras todas com valor positivo</p>
              <p className="text-xs text-muted-foreground">
                A DRE assume despesas com <code className="text-xs bg-muted px-1 rounded">amount &lt; 0</code>. Se o sync da Saipos está mandando tudo positivo, ajuste o sync para inverter o sinal de despesas — caso contrário, nada vai aparecer em "Despesas por categoria".
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros globais */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <PeriodPicker value={period} onChange={setPeriod} />
          <Badge variant="outline" className="ml-auto text-xs">
            Período: {period.start.toLocaleDateString("pt-BR")} → {period.end.toLocaleDateString("pt-BR")}
          </Badge>
        </CardContent>
      </Card>

      {!noSalesData && (
        <>
          <DREKpiCards start={period.start} end={period.end} />
          <DRECascade start={period.start} end={period.end} />

          <DRERevenueByChannel start={period.start} end={period.end} />
          <DREExpensesByGroup start={period.start} end={period.end} />
          <DREMonthlyChart start={period.start} end={period.end} />
        </>
      )}
    </div>
  );
}
