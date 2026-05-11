import { useEffect, useMemo } from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarioPrintLayout } from "@/components/print/CalendarioPrintLayout";
import { filtersFromQueryString } from "@/lib/calendarFilters";
import "@/styles/print.css";

export default function CalendarioImprimir() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const filters = useMemo(() => filtersFromQueryString(location.search), [location.search]);

  useEffect(() => {
    if (loading || !session) return;
    const t = setTimeout(() => {
      try { window.print(); } catch { /* */ }
    }, 800);
    return () => clearTimeout(t);
  }, [loading, session]);

  if (loading) {
    return <div className="print-loading">Carregando...</div>;
  }
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="print-screen">
      <div className="print-toolbar">
        <h2>Calendário / Acompanhamento — Pré-visualização de impressão (A4 P&B, por pessoa)</h2>
        <button onClick={() => window.print()}>🖨 Imprimir</button>
        <Link to="/mapa?view=calendario">Voltar</Link>
      </div>
      <CalendarioPrintLayout filters={filters} />
    </div>
  );
}
