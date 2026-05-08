import { useStrategicMap, useVision, getComputedStatus, STATUS_CONFIG } from "@/hooks/useStrategicData";
import { stripHtml, fmtDateBR } from "@/lib/text";

// Layout pra impressão A4 portrait, preto e branco.
// CSS @media print global em src/styles/print.css cuida da página/margens.

function statusLabel(s: string): string {
  return STATUS_CONFIG[s]?.label ?? s;
}

function deadlineCell(a: { start_date: string | null; deadline: string | null; status: string }) {
  if (a.status === "agendado" && a.start_date) {
    return `${fmtDateBR(a.start_date)} → ${fmtDateBR(a.deadline)}`;
  }
  return fmtDateBR(a.deadline);
}

export function MapaPrintLayout() {
  const { data: vision } = useVision();
  const { data: pillars, isLoading } = useStrategicMap();

  if (isLoading) {
    return <div className="print-loading">Carregando mapa...</div>;
  }

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="print-doc">
      <header className="print-header">
        <h1>Mapa Estratégico — Pizzaria Estrela da Ilha</h1>
        <p className="print-subtitle">
          Visão {vision?.reference_year ?? ""} · Impresso em {today}
        </p>
        {vision?.text && (
          <div className="print-vision">
            <p className="print-vision-label">Visão</p>
            <p className="print-vision-text">{stripHtml(vision.text)}</p>
          </div>
        )}
      </header>

      {pillars?.map((p) => (
        <section key={p.id} className="print-pillar">
          <h2 className="print-pillar-title">
            {p.number}. {stripHtml(p.name)}
          </h2>

          {p.obstacles.length === 0 && (
            <p className="print-empty">— sem obstáculos cadastrados —</p>
          )}

          {p.obstacles.map((o) => (
            <div key={o.id} className="print-obstacle">
              <h3 className="print-obstacle-title">
                <span className="print-obstacle-code">Obstáculo {stripHtml(o.code)}</span>
                {o.description && (
                  <span className="print-obstacle-desc">: {stripHtml(o.description)}</span>
                )}
              </h3>

              {o.actions.length === 0 ? (
                <p className="print-empty">— sem ações cadastradas —</p>
              ) : (
                <table className="print-actions-table">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>Ação</th>
                      <th style={{ width: "20%" }}>Resultado esperado</th>
                      <th style={{ width: "22%" }}>Entregável</th>
                      <th style={{ width: "13%" }}>Responsável</th>
                      <th style={{ width: "13%" }}>Início / Prazo</th>
                      <th style={{ width: "12%" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.actions.map((a) => {
                      const cs = getComputedStatus(a);
                      return (
                        <tr key={a.id}>
                          <td>{stripHtml(a.description)}</td>
                          <td>{stripHtml(a.expected_result)}</td>
                          <td>{stripHtml(a.deliverable)}</td>
                          <td>{a.responsible || "—"}</td>
                          <td>{deadlineCell(a)}</td>
                          <td className={`print-status print-status-${cs}`}>{statusLabel(cs)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
      ))}

      <footer className="print-footer">
        <p>Pizzaria Estrela da Ilha — pelove · {today}</p>
      </footer>
    </div>
  );
}
