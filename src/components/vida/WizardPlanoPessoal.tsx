import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePersonalPlan,
  useUpsertProfile,
  useCreatePillar,
  useUpdatePillar,
  useCreateObstacle,
  useCreateAction,
  useCreatePerson,
  useCreateMilestone,
  PREDEFINED_PILLARS,
  TOTAL_WIZARD_STEPS,
  LifePillar,
} from "@/hooks/usePersonalPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { X, Plus, ArrowLeft, ArrowRight, SkipForward, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  startStep?: number;
}

export function WizardPlanoPessoal({ onClose, startStep = 1 }: Props) {
  const { user } = useAuth();
  const { profile, pillars } = usePersonalPlan();
  const upsertProfile = useUpsertProfile();
  const createPillar = useCreatePillar();
  const updatePillar = useUpdatePillar();
  const createObstacle = useCreateObstacle();
  const createAction = useCreateAction();
  const createPerson = useCreatePerson();
  const createMilestone = useCreateMilestone();

  const [step, setStep] = useState<number>(startStep);

  // step 1 state
  const p = profile.data;
  const [age, setAge] = useState<string>(p?.age?.toString() ?? "");
  const [values, setValues] = useState<string[]>(p?.values ?? []);
  const [newValue, setNewValue] = useState("");
  const [energizes, setEnergizes] = useState(p?.energizes ?? "");
  const [drains, setDrains] = useState(p?.drains ?? "");
  const [marker, setMarker] = useState(p?.life_marker ?? "");

  // step 2 state
  const existingNames = new Set((pillars.data ?? []).map((x) => x.name.toLowerCase()));
  const [selectedPredefined, setSelectedPredefined] = useState<string[]>(
    PREDEFINED_PILLARS.filter((pp) => existingNames.has(pp.name.toLowerCase())).map((pp) => pp.name),
  );
  const [customPillar, setCustomPillar] = useState("");
  const [customPillars, setCustomPillars] = useState<string[]>(
    (pillars.data ?? []).filter((x) => x.is_custom).map((x) => x.name),
  );

  // step 4 (light) state - obstáculos rápidos por pilar
  const [obstacleDrafts, setObstacleDrafts] = useState<Record<string, string>>({});
  const [actionDrafts, setActionDrafts] = useState<Record<string, string>>({});

  // step 5 state
  const [newPerson, setNewPerson] = useState({ name: "", role: "", importance: 3 });

  // step 6 state
  const [newMilestone, setNewMilestone] = useState({ label: "", horizon: 1 });

  const persistStep = async (next: number, completed = false) => {
    await upsertProfile.mutateAsync({
      wizard_step: next,
      wizard_completed: completed || (p?.wizard_completed ?? false),
    });
  };

  const saveStep1 = async () => {
    await upsertProfile.mutateAsync({
      age: age ? parseInt(age) : null,
      values,
      energizes: energizes || null,
      drains: drains || null,
      life_marker: marker || null,
      wizard_step: 2,
    });
  };

  const saveStep2 = async () => {
    const desiredNames = [...selectedPredefined, ...customPillars];
    const currentByName = new Map((pillars.data ?? []).map((x) => [x.name, x]));
    let order = (pillars.data?.length ?? 0);
    for (const name of desiredNames) {
      if (currentByName.has(name)) continue;
      const pre = PREDEFINED_PILLARS.find((pp) => pp.name === name);
      await createPillar.mutateAsync({
        name,
        icon: pre?.icon ?? "Star",
        is_custom: !pre,
        display_order: order++,
        horizon_years: 5,
      });
    }
    await persistStep(3);
  };

  const next = () => setStep((s) => Math.min(TOTAL_WIZARD_STEPS, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const handleNext = async () => {
    try {
      if (step === 1) await saveStep1();
      else if (step === 2) await saveStep2();
      else await persistStep(step + 1);
      next();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    }
  };

  const handleSkip = async () => {
    await persistStep(step + 1);
    next();
  };

  const finishLater = async () => {
    await persistStep(step);
    toast.success("Salvo. Você pode continuar quando quiser.");
    onClose();
  };

  const finishNow = async () => {
    await persistStep(step, true);
    toast.success("Planejamento iniciado! Você pode editar tudo a qualquer momento.");
    onClose();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Planejamento da Vida Pessoal</h2>
          <p className="text-sm text-muted-foreground">
            Passo {step} de {TOTAL_WIZARD_STEPS}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <Progress value={(step / TOTAL_WIZARD_STEPS) * 100} />

      <div className="bg-card border border-border rounded-lg p-6 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium mb-1">Quem sou hoje</h3>
              <p className="text-sm text-muted-foreground">
                Antes de planejar onde quer chegar, vamos olhar de onde você parte.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Idade</label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="35"
                className="max-w-[120px] mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Valores não-negociáveis (3 a 5)</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {values.map((v) => (
                  <Badge key={v} variant="secondary" className="gap-1">
                    {v}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setValues(values.filter((x) => x !== v))}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Ex: integridade, liberdade, família..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newValue.trim()) {
                      e.preventDefault();
                      setValues([...values, newValue.trim()]);
                      setNewValue("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (newValue.trim()) {
                      setValues([...values, newValue.trim()]);
                      setNewValue("");
                    }
                  }}
                >
                  Adicionar
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">O que te energiza?</label>
              <Textarea value={energizes} onChange={(e) => setEnergizes(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">O que te drena?</label>
              <Textarea value={drains} onChange={(e) => setDrains(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Um marco pessoal que importa pra você</label>
              <Textarea
                value={marker}
                onChange={(e) => setMarker(e.target.value)}
                placeholder='Ex: "quero estar viajando com a Maria aos 40"'
                className="mt-1"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium mb-1">Pilares de vida</h3>
              <p className="text-sm text-muted-foreground">
                Escolha só os que importam pra você hoje. Pode adicionar e remover depois.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PREDEFINED_PILLARS.map((pp) => {
                const checked = selectedPredefined.includes(pp.name);
                return (
                  <label
                    key={pp.name}
                    className="flex items-center gap-3 p-3 border border-border rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        if (c) setSelectedPredefined([...selectedPredefined, pp.name]);
                        else setSelectedPredefined(selectedPredefined.filter((n) => n !== pp.name));
                      }}
                    />
                    <span className="text-sm">{pp.name}</span>
                  </label>
                );
              })}
            </div>
            <div>
              <label className="text-sm font-medium">Adicionar pilar personalizado</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={customPillar}
                  onChange={(e) => setCustomPillar(e.target.value)}
                  placeholder="Ex: Espiritualidade, Sócios..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customPillar.trim()) {
                      e.preventDefault();
                      setCustomPillars([...customPillars, customPillar.trim()]);
                      setCustomPillar("");
                    }
                  }}
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (customPillar.trim()) {
                      setCustomPillars([...customPillars, customPillar.trim()]);
                      setCustomPillar("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {customPillars.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {customPillars.map((c) => (
                    <Badge key={c} variant="outline" className="gap-1">
                      {c}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setCustomPillars(customPillars.filter((x) => x !== c))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <Step3Vision pillars={pillars.data ?? []} updatePillar={updatePillar.mutateAsync} />
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium mb-1">Obstáculos e ações</h3>
              <p className="text-sm text-muted-foreground">
                Opcional. Pra cada pilar, adicione 1 obstáculo e 1 ação rápida. Você pode aprofundar depois no painel.
              </p>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {(pillars.data ?? []).map((pl) => (
                <div key={pl.id} className="border border-border rounded-md p-3 space-y-2">
                  <div className="font-medium text-sm">{pl.name}</div>
                  <Input
                    placeholder="Obstáculo (ex: pouco tempo)"
                    value={obstacleDrafts[pl.id] ?? ""}
                    onChange={(e) => setObstacleDrafts({ ...obstacleDrafts, [pl.id]: e.target.value })}
                  />
                  <Input
                    placeholder="Ação (ex: bloquear 1h às terças)"
                    value={actionDrafts[pl.id] ?? ""}
                    onChange={(e) => setActionDrafts({ ...actionDrafts, [pl.id]: e.target.value })}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      let obsId: string | undefined;
                      if (obstacleDrafts[pl.id]?.trim()) {
                        const o = await createObstacle.mutateAsync({
                          pillar_id: pl.id,
                          title: obstacleDrafts[pl.id].trim(),
                        });
                        obsId = o.id;
                      }
                      if (actionDrafts[pl.id]?.trim()) {
                        await createAction.mutateAsync({
                          pillar_id: pl.id,
                          obstacle_id: obsId ?? null,
                          title: actionDrafts[pl.id].trim(),
                        });
                      }
                      setObstacleDrafts({ ...obstacleDrafts, [pl.id]: "" });
                      setActionDrafts({ ...actionDrafts, [pl.id]: "" });
                      toast.success("Adicionado");
                    }}
                  >
                    Salvar neste pilar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium mb-1">Pessoas-chave</h3>
              <p className="text-sm text-muted-foreground">
                Quem precisa estar alinhado com seu plano de vida?
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Nome"
                value={newPerson.name}
                onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
              />
              <Input
                placeholder="Papel (cônjuge, sócio...)"
                value={newPerson.role}
                onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
              />
              <Button
                onClick={async () => {
                  if (!newPerson.name.trim()) return;
                  await createPerson.mutateAsync({
                    name: newPerson.name.trim(),
                    role: newPerson.role || null,
                    importance: newPerson.importance,
                  });
                  setNewPerson({ name: "", role: "", importance: 3 });
                  toast.success("Pessoa adicionada");
                }}
              >
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Dica: cônjuge, filhos, pais, mentor, sócios, coach/terapeuta, amigos íntimos.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-medium mb-1">Linha do tempo</h3>
              <p className="text-sm text-muted-foreground">
                Marcos visuais escalonados. Adicione um por horizonte (1, 3, 5, 10 anos).
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Marco (ex: tirar 30 dias sabático)"
                value={newMilestone.label}
                onChange={(e) => setNewMilestone({ ...newMilestone, label: e.target.value })}
              />
              <select
                className="border border-input rounded-md px-2 text-sm bg-background"
                value={newMilestone.horizon}
                onChange={(e) => setNewMilestone({ ...newMilestone, horizon: parseInt(e.target.value) })}
              >
                <option value={1}>1 ano</option>
                <option value={3}>3 anos</option>
                <option value={5}>5 anos</option>
                <option value={10}>10 anos</option>
              </select>
              <Button
                onClick={async () => {
                  if (!newMilestone.label.trim()) return;
                  await createMilestone.mutateAsync({
                    label: newMilestone.label.trim(),
                    horizon_years: newMilestone.horizon,
                  });
                  setNewMilestone({ label: "", horizon: 1 });
                  toast.success("Marco adicionado");
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" onClick={prev} disabled={step === 1}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={finishLater}>
            Concluir mais tarde
          </Button>
          <Button variant="outline" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-1" /> Pular
          </Button>
          {step < TOTAL_WIZARD_STEPS ? (
            <Button onClick={handleNext}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={finishNow}>
              <Check className="h-4 w-4 mr-1" /> Concluir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step3Vision({
  pillars,
  updatePillar,
}: {
  pillars: LifePillar[];
  updatePillar: (x: Partial<LifePillar> & { id: string }) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-medium mb-1">Visão por pilar</h3>
        <p className="text-sm text-muted-foreground">
          Pra cada pilar, descreva como você se vê e defina o nível de prioridade.
        </p>
      </div>
      {pillars.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Você não selecionou pilares ainda. Volte ao passo 2.
        </p>
      )}
      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
        {pillars.map((pl) => (
          <PillarVisionEditor key={pl.id} pillar={pl} onSave={updatePillar} />
        ))}
      </div>
    </div>
  );
}

function PillarVisionEditor({
  pillar,
  onSave,
}: {
  pillar: LifePillar;
  onSave: (x: Partial<LifePillar> & { id: string }) => Promise<void>;
}) {
  const [vision, setVision] = useState(pillar.vision_text ?? "");
  const [priority, setPriority] = useState<number>(pillar.priority ?? 3);
  const [horizon, setHorizon] = useState<number>(pillar.horizon_years ?? 5);

  const save = async () => {
    await onSave({ id: pillar.id, vision_text: vision, priority, horizon_years: horizon });
  };

  return (
    <div className="border border-border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{pillar.name}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Horizonte:</span>
          <select
            value={horizon}
            onChange={(e) => setHorizon(parseInt(e.target.value))}
            onBlur={save}
            className="border border-input rounded px-1 bg-background"
          >
            <option value={1}>1 ano</option>
            <option value={3}>3 anos</option>
            <option value={5}>5 anos</option>
            <option value={10}>10 anos</option>
          </select>
        </div>
      </div>
      <Textarea
        value={vision}
        onChange={(e) => setVision(e.target.value)}
        onBlur={save}
        placeholder={`Como você se vê em ${horizon} anos no pilar ${pillar.name}?`}
        rows={2}
      />
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-20">Prioridade</span>
        <Slider
          value={[priority]}
          min={1}
          max={5}
          step={1}
          onValueChange={(v) => setPriority(v[0])}
          onValueCommit={save}
          className="flex-1"
        />
        <span className="text-xs font-medium w-4">{priority}</span>
      </div>
    </div>
  );
}
