import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import MapaEstrategico from "./pages/MapaEstrategico";
import Dashboards from "./pages/Dashboards";
import DRE from "./pages/DRE";
import DREImport from "./pages/DREImport";
import DREv2 from "./pages/DREv2";
import Advisor from "./pages/Advisor";
import ConfiguracoesSaipos from "./pages/ConfiguracoesSaipos";
import Configuracoes from "./pages/Configuracoes";
import { RoleGuard } from "./components/RoleGuard";
import PlanejamentoPessoal from "./pages/PlanejamentoPessoal";
import MapaImprimir from "./pages/MapaImprimir";
import CalendarioImprimir from "./pages/CalendarioImprimir";
import NotFound from "./pages/NotFound";
import { startSyncEngine, onMutationChange } from "@/lib/offline/sync";

const queryClient = new QueryClient();

function OfflineSyncBoot() {
  useEffect(() => {
    const stop = startSyncEngine();
    const off = onMutationChange(() => {
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
      queryClient.invalidateQueries({ queryKey: ["vision"] });
    });
    return () => {
      stop();
      off();
    };
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <OfflineSyncBoot />
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Rotas de impressão fora do AppLayout pra não puxar sidebar/floating advisor */}
            <Route path="/mapa/imprimir" element={<MapaImprimir />} />
            <Route path="/mapa/calendario/imprimir" element={<CalendarioImprimir />} />
            <Route element={<AppLayout />}>
              <Route path="/mapa" element={<MapaEstrategico />} />
              <Route path="/advisor" element={<Advisor />} />
              <Route path="/dashboards" element={<RoleGuard allowedRoles={["admin"]}><Dashboards /></RoleGuard>} />
              <Route path="/dre" element={<RoleGuard allowedRoles={["admin"]}><DRE /></RoleGuard>} />
              <Route path="/dre/import" element={<RoleGuard allowedRoles={["admin"]}><DREImport /></RoleGuard>} />
              <Route path="/dre-v2" element={<RoleGuard allowedRoles={["admin"]}><DREv2 /></RoleGuard>} />
              <Route path="/configuracoes/saipos" element={<RoleGuard allowedRoles={["admin"]}><ConfiguracoesSaipos /></RoleGuard>} />
              <Route path="/configuracoes" element={<RoleGuard allowedRoles={["admin"]}><Configuracoes /></RoleGuard>} />
            </Route>
            <Route path="/" element={<Navigate to="/mapa" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
