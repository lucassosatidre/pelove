import { useMemo } from "react";
import {
  useStrategicMap, useVision, getComputedStatus, STATUS_CONFIG, type Action, type Pillar,
} from "@/hooks/useStrategicData";
import { stripHtml, fmtDateBR } from "@/lib/text";

type FlatAction = Action & {
  pillar_name: string;
  pillar_number: number;
  obstacle_code: string;
  responsibles: string[];
  computed_status: string;
};

function flatten(pillars: Pillar[]): FlatAction[] {
  const out: FlatAction[] = [];
  for (const p of pillars) {
    for (const o of p.obstacles) {
      for (const a of o.actions) {
        const responsibles = (a.responsible ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        out.push({
          ...a,
          description: stripHtml(a.description),
          expected_result: a.expected_result ? stripHtml(a.expected_result) : null,
          deliverable: a.deliverable ? stripHtml(a.deliverable) : null,
          pillar_name: stripHtml(p.name),
          pillar_number: p.number,
          obstacle_code: stripHtml(o.code),
          responsibles,
          computed_status: getComputedStatus(a),
        });
      }
    }
  }
  return out;
}

function deliverableOrAction(a: FlatAction): string {
  return (a.deliverable && a.deliverable.trim()) ? a.deliverable : a.description;
}

function deadlineCell(a: FlatAction): string {
  if (a.status === "agendado" && a.start_date) {
    return `${fmtDateBR(a.start_date)} → ${fmtDateBR(a.deadline)}`;
  }
  return fmtDateBR(a.deadline);
}

function statusLabel(s: string): string {
  return STATUS_CONFIG[s]?.label ?? s;
}

function statusOrder(s: string): number {
  switch (s) {
    case "atrasado": return 0;
    case "em_andamento": return 1;
    case "agendado": return 2;
    case "nao_iniciado": return 3;
    case "concluido": return 4;
    default: return 5;
  }
}

export function CalendarioPrintLayout() {
  const { data: vision } = useVision();
  const { data: pillars, isLoading } = useStrategicMap();

  const allActions = useMemo(() => (pillars ? flatten(pillars) : []), [pillars]);

  // Subcategorias = pessoas. Cada pessoa vira uma seção com suas ações.
  // Ações sem responsável vão pra uma seção "Sem responsável" no final.
  const sections = useMemo(() => {
    const m = new Map<string, FlatAction[]>();
    const unassigned: FlatAction[] = [];
    for (const a of allActions) {
      if (a.responsibles.length === 0) {
        unassigned.push(a);
        continue;
      }
      for (const p of a.responsibles) {
        if (!m.has(p)) m.set(p, []);
        m.get(p)!.push(a);
      }
    }
    const arr = Array.from(m.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, list]) => ({ name, actions: list }));
    if (unassigned.length > 0) arr.push({ name: "Sem responsável", actions: unassigned });
    return arr;
  }, [allActions]);

  // Resumo geral no topo
  const summary = useMemo(() => {
    const s = { total: 0, atrasadas: 0, em_andamento: 0, agendadas: 0, nao_iniciadas: 0, concluidas: 0 };
    for (const a of allActions) {
      s.total++;
      if (a.computed_status === "atrasado") s.atrasadas++;
      else if (a.computed_status === "em_andamento") s.em_andamento++;
      else if (a.computed_status === "agendado") s.agendadas++;
      else if (a.computed_status === "nao_iniciado") s.nao_iniciadas++;
      else if (a.computed_status === "concluido") s.concluidas++;
    }
    return s;
  }, [allActions]);

  if (isLoading) return <div className="print-loading">Carregando calendário...</div>;

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="print-doc">
      <header className="print-header">
        <h1>Calendário / Acompanhamento — Pizzaria Estrela da Ilha</h1>
        <p className="print-subtitle">
          Visão {vision?.reference_year ?? ""} · Impresso em {today}
        </p>

        <table className="print-summary-table">
          <thead>
            <tr>
              <th>Total</th>
              <th>Atrasadas</th>
              <th>Em andamento</th>
              <th>Agendadas</th>
              <th>Não iniciadas</th>
              <th>Concluídas</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{summary.total}</td>
              <td>{summary.atrasadas}</td>
              <td>{summary.em_andamento}</td>
              <td>{summary.agendadas}</td>
              <td>{summary.nao_iniciadas}</td>
              <td>{summary.concluidas}</td>
            </tr>
          </tbody>
        </table>
      </header>

      {sections.map((sec) => {
        const counts = sec.actions.reduce<Record<string, number>>((acc, a) => {
          acc[a.computed_status] = (acc[a.computed_status] ?? 0) + 1;
          return acc;
        }, {});
        const sorted = sec.actions
          .slice()
          .sort((a, b) => {
            const sa = statusOrder(a.computed_status);
            const sb = statusOrder(b.computed_status);
            if (sa !== sb) return sa - sb;
            return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
          });

        return (
          <section key={sec.name} className="print-person-section">
            <h2 className="print-person-title">
              {sec.name}
              <span className="print-person-count"> · {sec.actions.length} {sec.actions.length === 1 ? "ação" : "ações"}</span>
            </h2>
            <p className="print-person-counts">
              {counts.atrasado ? `${counts.atrasado} atrasada${counts.atrasado > 1 ? "s" : ""} · ` : ""}
              {counts.em_andamento ? `${counts.em_andamento} em andamento · ` : ""}
              {counts.agendado ? `${counts.agendado} agendada${counts.agendado > 1 ? "s" : ""} · ` : ""}
              {counts.nao_iniciado ? `${counts.nao_iniciado} não iniciada${counts.nao_iniciado > 1 ? "s" : ""} · ` : ""}
              {counts.concluido ? `${counts.concluido} concluída${counts.concluido > 1 ? "s" : ""}` : ""}
            </p>

            <table className="print-actions-table">
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ width: "38%" }}>Entregável</th>
                  <th style={{ width: "18%" }}>Pilar / Obstáculo</th>
                  <th style={{ width: "17%" }}>Início / Prazo</th>
                  <th style={{ width: "22%" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a, i) => (
                  <tr key={a.id} className={`print-row-${a.computed_status}`}>
                    <td>{i + 1}</td>
                    <td>{deliverableOrAction(a)}</td>
                    <td>{a.pillar_number}. {a.pillar_name} — {a.obstacle_code}</td>
                    <td>{deadlineCell(a)}</td>
                    <td className={`print-status print-status-${a.computed_status}`}>{statusLabel(a.computed_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <footer className="print-footer">
        <p>Pizzaria Estrela da Ilha — pelove · {today}</p>
      </footer>
    </div>
  );
}
