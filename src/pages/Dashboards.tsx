import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Pizza, Activity, Users, AlertCircle } from "lucide-react";
import {
  presetToRange,
  comparisonRange,
  useDataCoverage,
  type SaleType,
  type ComparisonMode,
} from "@/hooks/useSaiposDashboards";
import { PeriodPicker, type PeriodValue } from "@/components/dashboards/PeriodPicker";
import { SaleTypeFilter } from "@/components/dashboards/SaleTypeFilter";
import { KpiCards } from "@/components/dashboards/KpiCards";
import { ComparativeChart } from "@/components/dashboards/ComparativeChart";
import { ShiftBreakdown } from "@/components/dashboards/ShiftBreakdown";
import { HourHeatmap } from "@/components/dashboards/HourHeatmap";
import { ProductRanking } from "@/components/dashboards/ProductRanking";
import { ProductsByHour, ProductsByDow } from "@/components/dashboards/ProductsByTime";
import { AddonsMix } from "@/components/dashboards/AddonsMix";
import { StatusAvgTimes, SlowestOrders, CancellationsBreakdown } from "@/components/dashboards/OperationsViews";
import {
  WaiterRanking, TableMetricsCards, ServiceChargeCard, DeliveryTimeCard, TopCustomers,
} from "@/components/dashboards/PeopleViews";

export default function Dashboards() {
  const initial = presetToRange("last_7d");
  const [period, setPeriod] = useState<PeriodValue>({
    start: initial.start,
    end: initial.end,
    comparisonMode: "previous_period" as ComparisonMode,
  });
  const [saleTypes, setSaleTypes] = useState<SaleType[]>([]);

  const compareRange = useMemo(
    () => comparisonRange(period.start, period.end, period.comparisonMode),
    [period],
  );

  const coverage = useDataCoverage();
  const noData = !coverage.isLoading && (!coverage.data || coverage.data.total_sales === 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboards</h1>
        <p className="text-sm text-muted-foreground">Análise de vendas, produtos, operação e clientes da Pizzaria Estrela da Ilha</p>
      </div>

      {noData && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Sem dados de vendas ainda</p>
              <p className="text-xs text-muted-foreground">
                Vá em <strong>Integração Saipos</strong> e rode o backfill histórico (botão "Rodar até concluir").
                Os dashboards aparecem aqui assim que houver dados na tabela.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros globais */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
          <PeriodPicker value={period} onChange={setPeriod} />
          <div className="hidden sm:block w-px h-6 bg-border" />
          <SaleTypeFilter value={saleTypes} onChange={setSaleTypes} />
          <Badge variant="outline" className="ml-auto text-xs">
            Comparando com {compareRange.start.toLocaleDateString("pt-BR")} → {compareRange.end.toLocaleDateString("pt-BR")}
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendas" className="gap-2"><BarChart3 className="w-4 h-4" /> Vendas</TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2"><Pizza className="w-4 h-4" /> Produtos</TabsTrigger>
          <TabsTrigger value="operacao" className="gap-2"><Activity className="w-4 h-4" /> Operação</TabsTrigger>
          <TabsTrigger value="pessoas" className="gap-2"><Users className="w-4 h-4" /> Pessoas</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-4 mt-0">
          <KpiCards
            start={period.start}
            end={period.end}
            compareStart={compareRange.start}
            compareEnd={compareRange.end}
            saleTypes={saleTypes}
          />
          <ComparativeChart
            start={period.start}
            end={period.end}
            compareStart={compareRange.start}
            compareEnd={compareRange.end}
            saleTypes={saleTypes}
          />
          <ShiftBreakdown
            start={period.start}
            end={period.end}
            saleTypes={saleTypes}
          />
          <HourHeatmap
            start={period.start}
            end={period.end}
            saleTypes={saleTypes}
          />
        </TabsContent>

        <TabsContent value="produtos" className="space-y-4 mt-0">
          <ProductRanking start={period.start} end={period.end} saleTypes={saleTypes} />
          <ProductsByHour start={period.start} end={period.end} saleTypes={saleTypes} />
          <ProductsByDow start={period.start} end={period.end} saleTypes={saleTypes} />
          <AddonsMix start={period.start} end={period.end} saleTypes={saleTypes} />
        </TabsContent>

        <TabsContent value="operacao" className="space-y-4 mt-0">
          <StatusAvgTimes start={period.start} end={period.end} saleTypes={saleTypes} />
          <CancellationsBreakdown start={period.start} end={period.end} saleTypes={saleTypes} />
          <SlowestOrders start={period.start} end={period.end} saleTypes={saleTypes} />
        </TabsContent>

        <TabsContent value="pessoas" className="space-y-4 mt-0">
          <TableMetricsCards start={period.start} end={period.end} />
          <ServiceChargeCard start={period.start} end={period.end} />
          <DeliveryTimeCard start={period.start} end={period.end} />
          <WaiterRanking start={period.start} end={period.end} />
          <TopCustomers start={period.start} end={period.end} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
