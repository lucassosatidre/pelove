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
import Advisor from "./pages/Advisor";
import ConfiguracoesSaipos from "./pages/ConfiguracoesSaipos";
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
            <Route element={<AppLayout />}>
              <Route path="/mapa" element={<MapaEstrategico />} />
              <Route path="/dashboards" element={<Dashboards />} />
              <Route path="/advisor" element={<Advisor />} />
              <Route path="/configuracoes/saipos" element={<ConfiguracoesSaipos />} />
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
