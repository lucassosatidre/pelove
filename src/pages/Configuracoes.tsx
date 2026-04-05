import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVision, useStrategicMap, AREA_OPTIONS } from "@/hooks/useStrategicData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

export default function Configuracoes() {
  const { data: vision } = useVision();
  const { data: pillars } = useStrategicMap();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Vision state
  const [visionText, setVisionText] = useState("");
  const [visionYear, setVisionYear] = useState(2027);

  useEffect(() => {
    if (vision) {
      setVisionText(vision.text);
      setVisionYear(vision.reference_year);
    }
  }, [vision]);

  const saveVision = async () => {
    if (!vision) return;
    const { error } = await supabase.from("vision").update({ text: visionText, reference_year: visionYear }).eq("id", vision.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Visão atualizada!" });
      queryClient.invalidateQueries({ queryKey: ["vision"] });
    }
  };

  // Pillar CRUD
  const [newPillarName, setNewPillarName] = useState("");
  const addPillar = async () => {
    if (!newPillarName.trim()) return;
    const maxOrder = pillars ? Math.max(...pillars.map((p) => p.display_order), 0) : 0;
    const maxNumber = pillars ? Math.max(...pillars.map((p) => p.number), 0) : 0;
    const { error } = await supabase.from("pillars").insert({ name: newPillarName, number: maxNumber + 1, display_order: maxOrder + 1 });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Pilar adicionado!" });
      setNewPillarName("");
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
    }
  };

  const deletePillar = async (id: string) => {
    const { error } = await supabase.from("pillars").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Pilar removido!" });
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
    }
  };

  // Obstacle CRUD
  const [newObstacle, setNewObstacle] = useState<{ pillarId: string; code: string; description: string } | null>(null);
  const addObstacle = async () => {
    if (!newObstacle || !newObstacle.code.trim()) return;
    const pillar = pillars?.find((p) => p.id === newObstacle.pillarId);
    const maxOrder = pillar ? Math.max(...pillar.obstacles.map((o) => o.display_order), 0) : 0;
    const { error } = await supabase.from("obstacles").insert({
      pillar_id: newObstacle.pillarId,
      code: newObstacle.code,
      description: newObstacle.description || null,
      display_order: maxOrder + 1,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Obstáculo adicionado!" });
      setNewObstacle(null);
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
    }
  };

  const deleteObstacle = async (id: string) => {
    const { error } = await supabase.from("obstacles").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Obstáculo removido!" });
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
    }
  };

  // Action CRUD
  const [newAction, setNewAction] = useState<{
    obstacleId: string;
    description: string;
    area: string;
    responsible: string;
    deadline: string;
    status: string;
    importance: string;
    urgency: string;
    reliability: string;
  } | null>(null);

  const addAction = async () => {
    if (!newAction || !newAction.description.trim()) return;
    const { error } = await supabase.from("actions").insert({
      obstacle_id: newAction.obstacleId,
      description: newAction.description,
      area: newAction.area || null,
      responsible: newAction.responsible || null,
      deadline: newAction.deadline || null,
      status: newAction.status || "nao_iniciado",
      importance: newAction.importance ? Number(newAction.importance) : null,
      urgency: newAction.urgency ? Number(newAction.urgency) : null,
      reliability: newAction.reliability ? Number(newAction.reliability) : null,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Ação adicionada!" });
      setNewAction(null);
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
    }
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from("actions").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Ação removida!" });
      queryClient.invalidateQueries({ queryKey: ["strategic-map"] });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      {/* Vision */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Visão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Texto da Visão</Label>
            <Textarea value={visionText} onChange={(e) => setVisionText(e.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Ano de Referência</Label>
            <Input type="number" value={visionYear} onChange={(e) => setVisionYear(Number(e.target.value))} className="w-32" />
          </div>
          <Button onClick={saveVision}>Salvar Visão</Button>
        </CardContent>
      </Card>

      {/* Pillars */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Pilares</CardTitle>
          <div className="flex items-center gap-2">
            <Input placeholder="Nome do pilar" value={newPillarName} onChange={(e) => setNewPillarName(e.target.value)} className="w-60" />
            <Button size="sm" onClick={addPillar}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pillars?.map((pillar) => (
            <div key={pillar.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Pilar {pillar.number} — {pillar.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deletePillar(pillar.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Obstacles */}
              <div className="pl-6 space-y-2">
                {pillar.obstacles.map((obs) => (
                  <div key={obs.id} className="flex items-center justify-between border border-border rounded p-2">
                    <div className="flex-1">
                      <span className="font-medium text-sm text-foreground">{obs.code}</span>
                      {obs.description && <span className="text-sm text-muted-foreground ml-2">— {obs.description}</span>}
                      <span className="text-xs text-muted-foreground ml-2">({obs.actions.length} ações)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setNewAction({
                            obstacleId: obs.id, description: "", area: "", responsible: "",
                            deadline: "", status: "nao_iniciado", importance: "", urgency: "", reliability: "",
                          })}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Nova Ação para {obs.code}</DialogTitle></DialogHeader>
                          {newAction && newAction.obstacleId === obs.id && (
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label>Descrição *</Label>
                                <Textarea value={newAction.description} onChange={(e) => setNewAction({ ...newAction, description: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <Label>Área</Label>
                                <Select value={newAction.area} onValueChange={(v) => setNewAction({ ...newAction, area: v })}>
                                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent>
                                    {AREA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label>Responsável</Label>
                                  <Input value={newAction.responsible} onChange={(e) => setNewAction({ ...newAction, responsible: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Prazo</Label>
                                  <Input type="date" value={newAction.deadline} onChange={(e) => setNewAction({ ...newAction, deadline: e.target.value })} />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <Label>Importância</Label>
                                  <Input type="number" min={1} max={5} value={newAction.importance} onChange={(e) => setNewAction({ ...newAction, importance: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Urgência</Label>
                                  <Input type="number" min={1} max={5} value={newAction.urgency} onChange={(e) => setNewAction({ ...newAction, urgency: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Confiabilidade</Label>
                                  <Input type="number" min={1} max={5} value={newAction.reliability} onChange={(e) => setNewAction({ ...newAction, reliability: e.target.value })} />
                                </div>
                              </div>
                              <Button className="w-full" onClick={addAction}>Adicionar Ação</Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm" onClick={() => deleteObstacle(obs.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Código (ex: 1.5)"
                    className="w-28"
                    value={newObstacle?.pillarId === pillar.id ? newObstacle.code : ""}
                    onChange={(e) => setNewObstacle({ pillarId: pillar.id, code: e.target.value, description: newObstacle?.description ?? "" })}
                  />
                  <Input
                    placeholder="Descrição (opcional)"
                    className="flex-1"
                    value={newObstacle?.pillarId === pillar.id ? newObstacle.description : ""}
                    onChange={(e) => setNewObstacle({ pillarId: pillar.id, code: newObstacle?.code ?? "", description: e.target.value })}
                  />
                  <Button size="sm" variant="outline" onClick={addObstacle} disabled={!newObstacle || newObstacle.pillarId !== pillar.id}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
