import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { usePersonalPlan, useUpsertProfile, TOTAL_WIZARD_STEPS } from "@/hooks/usePersonalPlan";
import { WizardPlanoPessoal } from "@/components/vida/WizardPlanoPessoal";
import { LifePillarCard } from "@/components/vida/LifePillarCard";
import { LifeTimeline } from "@/components/vida/LifeTimeline";
import { PeopleSection } from "@/components/vida/PeopleSection";
import { Button } from "@/components/ui/button";

export default function PlanejamentoPessoal() {
  const { profile, pillars, obstacles, actions, people, milestones } = usePersonalPlan();
  const upsertProfile = useUpsertProfile();
  const [forceWizard, setForceWizard] = useState(false);

  const loading = profile.isLoading || pillars.isLoading;
  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }

  const p = profile.data;
  const completed = !!p?.wizard_completed;
  const currentStep = Math.min(p?.wizard_step ?? 1, TOTAL_WIZARD_STEPS);

  // First-time or forced wizard
  if (!p || (!completed && !forceWizard && (pillars.data?.length ?? 0) === 0)) {
    return (
      <WizardPlanoPessoal
        startStep={p?.wizard_step ?? 1}
        onClose={() => {
          profile.refetch();
        }}
      />
    );
  }

  if (forceWizard) {
    return (
      <WizardPlanoPessoal
        startStep={currentStep}
        onClose={() => {
          setForceWizard(false);
          profile.refetch();
        }}
      />
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Planejamento da Vida Pessoal</h1>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <Lock className="h-3 w-3" />
              Só você vê esta página
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Atrás de um CNPJ tem um CPF. A empresa é instrumento da sua vida.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setForceWizard(true)}>
          <Sparkles className="h-4 w-4 mr-1" />
          {completed ? "Refazer wizard" : "Continuar wizard"}
        </Button>
      </div>

      {!completed && (
        <div className="border border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200 rounded-md p-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm">
            Complete seu Planejamento Pessoal ({currentStep - 1}/{TOTAL_WIZARD_STEPS} passos)
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setForceWizard(true)}>
              Continuar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => upsertProfile.mutate({ wizard_completed: true })}
            >
              Marcar como concluído
            </Button>
          </div>
        </div>
      )}

      {(pillars.data?.length ?? 0) === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          Nenhum pilar de vida ainda. Use o wizard para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(pillars.data ?? []).map((pl) => (
            <LifePillarCard
              key={pl.id}
              pillar={pl}
              obstacles={obstacles.data ?? []}
              actions={actions.data ?? []}
            />
          ))}
        </div>
      )}

      <LifeTimeline milestones={milestones.data ?? []} />
      <PeopleSection people={people.data ?? []} />
    </div>
  );
}
