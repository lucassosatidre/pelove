import { useState } from "react";
import {
  LifePillar,
  LifeObstacle,
  LifeAction,
  useCreateObstacle,
  useCreateAction,
  useUpdateAction,
  useDeleteAction,
  useDeleteObstacle,
  useDeletePillar,
  useUpdatePillar,
} from "@/hooks/usePersonalPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Calendar } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  pillar: LifePillar;
  obstacles: LifeObstacle[];
  actions: LifeAction[];
}

export function LifePillarCard({ pillar, obstacles, actions }: Props) {
  const createObstacle = useCreateObstacle();
  const createAction = useCreateAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();
  const deleteObstacle = useDeleteObstacle();
  const deletePillar = useDeletePillar();
  const updatePillar = useUpdatePillar();

  const [newObstacle, setNewObstacle] = useState("");
  const [newAction, setNewAction] = useState("");
  const [editVision, setEditVision] = useState(false);
  const [visionDraft, setVisionDraft] = useState(pillar.vision_text ?? "");

  const pillarObstacles = obstacles.filter((o) => o.pillar_id === pillar.id);
  const pillarActions = actions.filter((a) => a.pillar_id === pillar.id);

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{pillar.name}</h3>
          {pillar.priority && (
            <Badge variant="secondary" className="text-xs">
              Prioridade {pillar.priority}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {pillar.horizon_years} anos
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Excluir pilar "${pillar.name}" e tudo dentro dele?`)) deletePillar.mutate(pillar.id);
          }}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="text-sm">
        {editVision ? (
          <div className="space-y-2">
            <textarea
              className="w-full text-sm border border-input rounded p-2 bg-background"
              rows={3}
              value={visionDraft}
              onChange={(e) => setVisionDraft(e.target.value)}
              onBlur={async () => {
                await updatePillar.mutateAsync({ id: pillar.id, vision_text: visionDraft });
                setEditVision(false);
              }}
              autoFocus
            />
          </div>
        ) : (
          <p
            className="text-muted-foreground italic cursor-text hover:bg-muted/30 rounded px-1 py-0.5"
            onClick={() => setEditVision(true)}
          >
            {pillar.vision_text || "Clique para descrever como você se vê neste pilar..."}
          </p>
        )}
      </div>

      {pillarObstacles.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Obstáculos</div>
          {pillarObstacles.map((o) => (
            <div key={o.id} className="flex items-center justify-between text-sm">
              <span>• {o.title}</span>
              <Button variant="ghost" size="sm" onClick={() => deleteObstacle.mutate(o.id)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Adicionar obstáculo..."
          value={newObstacle}
          onChange={(e) => setNewObstacle(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && newObstacle.trim()) {
              await createObstacle.mutateAsync({ pillar_id: pillar.id, title: newObstacle.trim() });
              setNewObstacle("");
            }
          }}
          className="h-8 text-sm"
        />
      </div>

      {pillarActions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ações</div>
          {pillarActions.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={a.status === "concluido"}
                onCheckedChange={(c) =>
                  updateAction.mutate({ id: a.id, status: c ? "concluido" : "nao_iniciado" })
                }
              />
              <span className={a.status === "concluido" ? "line-through text-muted-foreground flex-1" : "flex-1"}>
                {a.title}
              </span>
              {a.deadline && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(a.deadline).toLocaleDateString("pt-BR")}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => deleteAction.mutate(a.id)}>
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Adicionar ação..."
          value={newAction}
          onChange={(e) => setNewAction(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && newAction.trim()) {
              await createAction.mutateAsync({ pillar_id: pillar.id, title: newAction.trim() });
              setNewAction("");
            }
          }}
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (newAction.trim()) {
              await createAction.mutateAsync({ pillar_id: pillar.id, title: newAction.trim() });
              setNewAction("");
            }
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
