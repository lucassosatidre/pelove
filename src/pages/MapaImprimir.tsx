import { useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MapaPrintLayout } from "@/components/print/MapaPrintLayout";
import "@/styles/print.css";

export default function MapaImprimir() {
  const { session, loading } = useAuth();

  // Auto-dispara o diálogo de impressão depois que o conteúdo renderiza
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
        <h2>Mapa Estratégico — Pré-visualização de impressão (A4 P&B)</h2>
        <button onClick={() => window.print()}>🖨 Imprimir</button>
        <Link to="/mapa">Voltar</Link>
      </div>
      <MapaPrintLayout />
    </div>
  );
}
