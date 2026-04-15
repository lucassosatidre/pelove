import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStrategicMap, useVision } from "@/hooks/useStrategicData";
import { useCollapseState } from "@/hooks/useCollapseState";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent, type DragOverEvent, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { InlineText } from "./InlineText";
import { RichInlineText } from "./RichInlineText";
import { ActionBubbleChain } from "./ActionBubbleChain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, GripVertical, ChevronRight, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMapContextMenu } from "./MapContextMenu";
import type { Pillar, Obstacle } from "@/hooks/useStrategicData";
import { resolveColor } from "@/lib/darkModeColors";

// ─── Connector SVG ───
function Connectors({ refs }: { refs: React.RefObject<HTMLDivElement> }) {
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  useEffect(() => {
    const container = refs.current;
    if (!container) return;

    const compute = () => {
      const rect = container.getBoundingClientRect();
      const newLines: typeof lines = [];

      const visionEl = container.querySelector("[data-node='vision']");
      const pillarEls = container.querySelectorAll("[data-node='pillar']");
      if (visionEl) {
        const vr = visionEl.getBoundingClientRect();
        pillarEls.forEach((pe) => {
          const pr = pe.getBoundingClientRect();
          newLines.push({
            x1: vr.right - rect.left,
            y1: vr.top + vr.height / 2 - rect.top,
            x2: pr.left - rect.left,
            y2: pr.top + pr.height / 2 - rect.top,
          });
        });
      }

      pillarEls.forEach((pe) => {
        const pillarId = pe.getAttribute("data-id");
        const pr = pe.getBoundingClientRect();
        const obsEls = container.querySelectorAll(`[data-node='obstacle'][data-pillar='${pillarId}']`);
        obsEls.forEach((oe) => {
          const or = oe.getBoundingClientRect();
          newLines.push({
            x1: pr.right - rect.left,
            y1: pr.top + pr.height / 2 - rect.top,
            x2: or.left - rect.left,
            y2: or.top + or.height / 2 - rect.top,
          });
        });
      });

      const obsEls = container.querySelectorAll("[data-node='obstacle']");
      obsEls.forEach((oe) => {
        const obsId = oe.getAttribute("data-id");
        const or = oe.getBoundingClientRect();
        const actEls = container.querySelectorAll(`[data-node='action'][data-obstacle='${obsId}']`);
        actEls.forEach((ae) => {
          const ar = ae.getBoundingClientRect();
          newLines.push({
            x1: or.right - rect.left,
            y1: or.top + or.height / 2 - rect.top,
            x2: ar.left - rect.left,
            y2: ar.top + ar.height / 2 - rect.top,
          });
        });
      });

      setLines(newLines);
    };

    compute();
    const observer = new MutationObserver(compute);
    observer.observe(container, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", compute);
    const interval = setInterval(compute, 1000);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", compute);
      clearInterval(interval);
    };
  }, [refs]);

  return (
    <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: "100%", height: "100%" }}>
      {lines.map((l, i) => {
        const dx = (l.x2 - l.x1) * 0.5;
        return (
          <path
            key={i}
            d={`M${l.x1},${l.y1} C${l.x1 + dx},${l.y1} ${l.x2 - dx},${l.y2} ${l.x2},${l.y2}`}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

// ─── Auto-scroll hook ───
function useEdgeScroll(containerRef: React.RefObject<HTMLElement>) {
  const animFrameRef = useRef<number>(0);
  const scrollSpeed = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const EDGE_ZONE = 60;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const containerW = rect.width;
      const containerH = rect.height;

      let sx = 0, sy = 0;

      if (mouseX < EDGE_ZONE && mouseX >= 0) {
        sx = -Math.max(1, Math.floor((EDGE_ZONE - mouseX) / 7));
      }
      if (mouseX > containerW - EDGE_ZONE && mouseX <= containerW) {
        sx = Math.max(1, Math.floor((EDGE_ZONE - (containerW - mouseX)) / 7));
      }
      if (mouseY < EDGE_ZONE && mouseY >= 0) {
        sy = -Math.max(1, Math.floor((EDGE_ZONE - mouseY) / 7));
      }
      if (mouseY > containerH - EDGE_ZONE && mouseY <= containerH) {
        sy = Math.max(1, Math.floor((EDGE_ZONE - (containerH - mouseY)) / 7));
      }

      scrollSpeed.current = { x: sx, y: sy };
    };

    const handleMouseLeave = () => {
      scrollSpeed.current = { x: 0, y: 0 };
    };

    const tick = () => {
      const { x, y } = scrollSpeed.current;
      if (x !== 0 || y !== 0) {
        container.scrollLeft += x;
        container.scrollTop += y;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [containerRef]);
}

// ─── Droppable wrapper for cross-group drops ───
function DroppableZone({ id, type, children, isOver }: { id: string; type: string; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: over } = useDroppable({ id: `drop-${type}-${id}`, data: { type, id } });
  const active = isOver ?? over;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-all duration-150",
        active && "ring-2 ring-dashed ring-primary/60 bg-primary/5 rounded-lg"
      )}
    >
      {children}
    </div>
  );
}

// ─── Sortable Pillar Card ───
function SortablePillarCard({ pillar, idx, onUpdate, isExpanded, onToggle, obstacleCount, actionCount }: {
  pillar: Pillar; idx: number; onUpdate: (id: string, name: string) => Promise<void>;
  isExpanded: boolean; onToggle: () => void; obstacleCount: number; actionCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pillar.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  const customStyle: React.CSSProperties = {
    ...style,
    ...(pillar.bg_color ? { backgroundColor: resolveColor(pillar.bg_color, "bg")! } : {}),
    ...(pillar.text_color ? { color: resolveColor(pillar.text_color, "text")! } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={customStyle}
      className={cn(
        "bg-card rounded-xl shadow-sm border border-border p-3 min-w-[160px] max-w-[200px]",
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="pillar"
      data-id={pillar.id}
    >
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <RichInlineText value={pillar.name} onSave={(v) => onUpdate(pillar.id, v)} className={cn("text-xs font-semibold", pillar.is_bold && "font-black")} />
          {!isExpanded && (
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {obstacleCount} obst. · {actionCount} ações
            </span>
          )}
        </div>
        <button onClick={onToggle} className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-transform duration-200">
          <ChevronIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Sortable Obstacle Card ───
function SortableObstacleCard({ obstacle, onUpdate, isExpanded, onToggle }: {
  obstacle: Obstacle; onUpdate: (id: string, field: string, value: string) => Promise<void>;
  isExpanded: boolean; onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: obstacle.id,
    data: { type: "obstacle", pillarId: obstacle.pillar_id },
  });
  const baseStyle = { transform: CSS.Transform.toString(transform), transition };
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  const customStyle: React.CSSProperties = {
    ...baseStyle,
    ...(obstacle.bg_color ? { backgroundColor: resolveColor(obstacle.bg_color, "bg")! } : {}),
    ...(obstacle.text_color ? { color: resolveColor(obstacle.text_color, "text")! } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={customStyle}
      className={cn(
        "bg-card rounded-lg border border-border p-2.5 min-w-[180px] max-w-[220px]",
        isDragging && "opacity-50 shadow-lg z-20"
      )}
      data-node="obstacle"
      data-id={obstacle.id}
      data-pillar={obstacle.pillar_id}
    >
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none shrink-0 mt-0.5">
          <GripVertical className="h-3 w-3" />
        </button>
        <div className="flex-1 min-w-0">
          <RichInlineText
            value={obstacle.description ?? ""}
            onSave={(v) => onUpdate(obstacle.id, "description", v)}
            placeholder="Clique para definir"
            className={cn("text-xs", obstacle.is_bold && "font-black")}
          />
          {!isExpanded && obstacle.actions.length > 0 && (
            <span className="text-[10px] text-muted-foreground block mt-0.5">
              {obstacle.actions.length} {obstacle.actions.length === 1 ? "ação" : "ações"}
            </span>
          )}
        </div>
        {obstacle.actions.length > 0 && (
          <button onClick={onToggle} className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-transform duration-200">
            <ChevronIcon className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function MindMapLayout() {
  const { data: vision } = useVision();
  const { data: pillars, isLoading } = useStrategicMap();
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null!);
  const scrollRef = useRef<HTMLDivElement>(null!);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { isPillarExpanded, isObstacleExpanded, togglePillar, toggleObstacle, expandAll, collapseAll } = useCollapseState();
  const [isDragging, setIsDragging] = useState(false);
  const [overDropId, setOverDropId] = useState<string | null>(null);
  const [visionCollapsed, setVisionCollapsed] = useState(() => {
    try { return localStorage.getItem("pe-love-vision-collapsed") === "true"; } catch { return false; }
  });
  const toggleVision = () => setVisionCollapsed(prev => {
    const next = !prev;
    try { localStorage.setItem("pe-love-vision-collapsed", String(next)); } catch {}
    return next;
  });

  useEdgeScroll(scrollRef);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ["strategic-map"] }), [qc]);
  const invalidateVision = useCallback(() => qc.invalidateQueries({ queryKey: ["vision"] }), [qc]);

  // ─── Mutations ───
  const updateVisionText = useCallback(async (text: string) => {
    if (!vision) return;
    await supabase.from("vision").update({ text }).eq("id", vision.id);
    invalidateVision();
  }, [vision, invalidateVision]);

  const updateVisionYear = useCallback(async (val: string) => {
    if (!vision) return;
    const year = parseInt(val);
    if (isNaN(year)) return;
    await supabase.from("vision").update({ reference_year: year }).eq("id", vision.id);
    invalidateVision();
  }, [vision, invalidateVision]);

  const updatePillar = useCallback(async (id: string, name: string) => {
    await supabase.from("pillars").update({ name }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const updateObstacle = useCallback(async (id: string, field: string, value: string) => {
    await supabase.from("obstacles").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const updateAction = useCallback(async (id: string, field: string, value: any) => {
    await supabase.from("actions").update({ [field]: value }).eq("id", id);
    invalidate();
  }, [invalidate]);

  const addPillar = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const n = (pillars?.length ?? 0) + 1;
    await supabase.from("pillars").insert({ name: name.trim(), number: n, display_order: n });
    invalidate();
  }, [pillars, invalidate]);

  const addObstacle = useCallback(async (pillarId: string, desc: string) => {
    if (!desc.trim()) return;
    const pillar = pillars?.find(p => p.id === pillarId);
    const next = (pillar?.obstacles.length ?? 0) + 1;
    await supabase.from("obstacles").insert({ pillar_id: pillarId, code: "-", description: desc.trim(), display_order: next });
    invalidate();
  }, [pillars, invalidate]);

  const addAction = useCallback(async (obstacleId: string, desc: string) => {
    if (!desc.trim()) return;
    const obs = pillars?.flatMap(p => p.obstacles).find(o => o.id === obstacleId);
    const next = (obs?.actions.length ?? 0) + 1;
    await supabase.from("actions").insert({ obstacle_id: obstacleId, description: desc.trim(), execution_order: next });
    invalidate();
  }, [pillars, invalidate]);

  // ─── Delete handlers ───
  const deletePillar = useCallback(async (id: string) => {
    const pillar = pillars?.find(p => p.id === id);
    if (!pillar) return;
    const obsIds = pillar.obstacles.map(o => o.id);
    if (obsIds.length > 0) {
      await supabase.from("actions").delete().in("obstacle_id", obsIds);
      await supabase.from("obstacles").delete().eq("pillar_id", id);
    }
    await supabase.from("pillars").delete().eq("id", id);
    invalidate();
  }, [pillars, invalidate]);

  const deleteObstacle = useCallback(async (id: string) => {
    await supabase.from("actions").delete().eq("obstacle_id", id);
    await supabase.from("obstacles").delete().eq("id", id);
    invalidate();
  }, [invalidate]);

  const deleteAction = useCallback(async (id: string) => {
    await supabase.from("actions").delete().eq("id", id);
    invalidate();
  }, [invalidate]);

  // ─── Style update handler ───
  const updateStyle = useCallback(async (type: "pillar" | "obstacle" | "action", id: string, field: string, value: any) => {
    const table = type === "pillar" ? "pillars" : type === "obstacle" ? "obstacles" : "actions";
    if (field === "is_bold") {
      // Toggle: fetch current then flip
      const { data } = await supabase.from(table).select("is_bold").eq("id", id).single();
      const current = (data as any)?.is_bold ?? false;
      await supabase.from(table).update({ is_bold: !current }).eq("id", id);
    } else {
      await supabase.from(table).update({ [field]: value }).eq("id", id);
    }
    invalidate();
  }, [invalidate]);

  // ─── Context menu ───
  const { handleContextMenu, menuElement, confirmElement } = useMapContextMenu({
    onDeletePillar: deletePillar,
    onDeleteObstacle: deleteObstacle,
    onDeleteAction: deleteAction,
    onUpdateStyle: updateStyle,
  });

  // ─── Unified DnD handlers ───
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id?.toString() ?? null;
    setOverDropId(overId);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setIsDragging(false);
    setOverDropId(null);
    const { active, over } = event;
    if (!over || !pillars) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // Check if dropped on a droppable zone (cross-group move)
    if (overId.startsWith("drop-")) {
      const parts = overId.replace("drop-", "").split("-");
      const dropType = parts[0]; // "pillar" or "obstacle"
      const dropTargetId = parts.slice(1).join("-");

      // Moving obstacle to another pillar
      if (dropType === "pillar") {
        const allObs = pillars.flatMap(p => p.obstacles);
        const obs = allObs.find(o => o.id === activeId);
        if (obs && obs.pillar_id !== dropTargetId) {
          await supabase.from("obstacles").update({ pillar_id: dropTargetId }).eq("id", activeId);
          invalidate();
          return;
        }
      }

      // Moving action to another obstacle
      if (dropType === "obstacle") {
        const allActions = pillars.flatMap(p => p.obstacles.flatMap(o => o.actions));
        const act = allActions.find(a => a.id === activeId);
        if (act && act.obstacle_id !== dropTargetId) {
          await supabase.from("actions").update({ obstacle_id: dropTargetId }).eq("id", activeId);
          invalidate();
          return;
        }
      }
    }

    // Same-group reorder: Pillars
    if (activeId !== overId) {
      const pillarIdx = pillars.findIndex(p => p.id === activeId);
      const pillarOverIdx = pillars.findIndex(p => p.id === overId);
      if (pillarIdx !== -1 && pillarOverIdx !== -1) {
        const reordered = arrayMove(pillars, pillarIdx, pillarOverIdx);
        await Promise.all(reordered.map((p, i) => supabase.from("pillars").update({ display_order: i + 1, number: i + 1 }).eq("id", p.id)));
        invalidate();
        return;
      }

      // Same-group reorder: Obstacles within same pillar
      for (const pillar of pillars) {
        const visible = pillar.obstacles.filter(o => o.description || o.actions.length > 0);
        const oldIdx = visible.findIndex(o => o.id === activeId);
        const newIdx = visible.findIndex(o => o.id === overId);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(visible, oldIdx, newIdx);
          await Promise.all(reordered.map((o, i) => supabase.from("obstacles").update({ display_order: i + 1 }).eq("id", o.id)));
          invalidate();
          return;
        }
      }

      // Same-group reorder: Actions within same obstacle
      const allObs = pillars.flatMap(p => p.obstacles);
      for (const obs of allObs) {
        const oldIdx = obs.actions.findIndex(a => a.id === activeId);
        const newIdx = obs.actions.findIndex(a => a.id === overId);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(obs.actions, oldIdx, newIdx);
          await Promise.all(reordered.map((a, i) => supabase.from("actions").update({ execution_order: i + 1 }).eq("id", a.id)));
          invalidate();
          return;
        }
      }
    }
  }, [pillars, invalidate]);

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setOverDropId(null);
  }, []);

  // ─── New item states ───
  const [newPillar, setNewPillar] = useState(false);
  const [newObstacles, setNewObstacles] = useState<Record<string, boolean>>({});
  const [newActions, setNewActions] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><div className="h-8 w-8 rounded-md bg-primary animate-pulse" /></div>;
  }

  const visibleData = pillars?.map(p => ({
    ...p,
    visibleObstacles: p.obstacles.filter(o => o.description || o.actions.length > 0),
  })) ?? [];

  const allPillarIds = visibleData.map(p => p.id);
  const allObstacleIds = visibleData.flatMap(p => p.visibleObstacles.map(o => o.id));
  const allItemIds = [
    ...allPillarIds,
    ...allObstacleIds,
    ...visibleData.flatMap(p => p.visibleObstacles.flatMap(o => o.actions.map(a => a.id))),
  ];

  const handleExpandAll = () => expandAll(allPillarIds, allObstacleIds);
  const handleCollapseAll = () => collapseAll();

  return (
    <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 48px)" }}>
      {/* ─── Left: Vision (fixed, non-scrolling) ─── */}
      {vision && (
        <div className="w-[280px] min-w-[280px] border-r border-border p-4 overflow-y-auto shrink-0">
          <div className="bg-card rounded-xl shadow-md border border-primary/20 p-4 w-full" data-node="vision">
            <button onClick={toggleVision} className="flex items-center gap-1 cursor-pointer w-full">
              <Badge className="bg-primary text-primary-foreground pointer-events-none">
                Visão{" "}
                <InlineText
                  value={String(vision.reference_year)}
                  onSave={updateVisionYear}
                  className="text-primary-foreground font-bold"
                  inputClassName="w-16 text-foreground"
                />
              </Badge>
              {visionCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${visionCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"}`}>
              <RichInlineText
                value={vision.text}
                onSave={updateVisionText}
                multiline
                className="text-xs leading-relaxed text-foreground block mt-1"
                inputClassName="text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Right: Scrollable map area ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-8 pt-4 pb-2 shrink-0">
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleExpandAll}>
            <ChevronsUpDown className="h-3.5 w-3.5" /> Expandir todos
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleCollapseAll}>
            <ChevronsDownUp className="h-3.5 w-3.5" /> Colapsar todos
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto scrollbar-thin"
          onContextMenu={handleContextMenu}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div ref={containerRef} className="relative p-8 min-w-max">
              <Connectors refs={containerRef} />

              {/* ─── Rows: each pillar + its obstacles + actions ─── */}
              <div className="flex flex-col gap-3 z-10 relative">
                <SortableContext items={visibleData.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {visibleData.map((pillar, idx) => {
                    const expanded = isPillarExpanded(pillar.id);
                    return (
                      <div key={pillar.id} className="flex items-start gap-10">
                        {/* Pillar card */}
                        <div className="shrink-0">
                          <DroppableZone id={pillar.id} type="pillar" isOver={overDropId === `drop-pillar-${pillar.id}`}>
                            <SortablePillarCard
                              pillar={pillar}
                              idx={idx}
                              onUpdate={updatePillar}
                              isExpanded={expanded}
                              onToggle={() => togglePillar(pillar.id)}
                              obstacleCount={pillar.visibleObstacles.length}
                              actionCount={pillar.visibleObstacles.reduce((sum, o) => sum + o.actions.length, 0)}
                            />
                          </DroppableZone>
                        </div>

                        {/* Obstacles for this pillar */}
                        {expanded && (
                          <div className="flex flex-col gap-2 shrink-0">
                            <SortableContext items={pillar.visibleObstacles.map(o => o.id)} strategy={verticalListSortingStrategy}>
                              {pillar.visibleObstacles.map((obs) => {
                                const obsExpanded = isObstacleExpanded(obs.id);
                                return (
                                  <div key={obs.id} className="flex items-start gap-10">
                                    {/* Obstacle card */}
                                    <div className="shrink-0">
                                      <DroppableZone id={obs.id} type="obstacle" isOver={overDropId === `drop-obstacle-${obs.id}`}>
                                        <SortableObstacleCard
                                          obstacle={obs}
                                          onUpdate={updateObstacle}
                                          isExpanded={obsExpanded}
                                          onToggle={() => toggleObstacle(obs.id)}
                                        />
                                      </DroppableZone>
                                    </div>

                                    {/* Actions for this obstacle */}
                                    {obsExpanded && (
                                      <div className="flex flex-col gap-2 shrink-0">
                                        <SortableContext items={obs.actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
                                          {obs.actions.map((action) => (
                                            <ActionBubbleChain key={action.id} action={action} obstacleId={obs.id} onUpdate={updateAction} />
                                          ))}
                                        </SortableContext>
                                        {newActions[obs.id] ? (
                                          <div className="min-w-[260px]">
                                            <InlineText
                                              value=""
                                              onSave={async (v) => { await addAction(obs.id, v); setNewActions(p => ({ ...p, [obs.id]: false })); }}
                                              placeholder="Descrição da ação..."
                                              autoFocus
                                              className="text-xs"
                                            />
                                          </div>
                                        ) : (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-muted-foreground h-6 gap-1 self-start"
                                            onClick={() => setNewActions(p => ({ ...p, [obs.id]: true }))}
                                          >
                                            <Plus className="h-3 w-3" /> Ação
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </SortableContext>
                            {newObstacles[pillar.id] ? (
                              <div className="min-w-[180px]">
                                <InlineText
                                  value=""
                                  onSave={async (v) => { await addObstacle(pillar.id, v); setNewObstacles(p => ({ ...p, [pillar.id]: false })); }}
                                  placeholder="Descrição..."
                                  autoFocus
                                  className="text-xs"
                                />
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground h-6 gap-1 self-start"
                                onClick={() => setNewObstacles(p => ({ ...p, [pillar.id]: true }))}
                              >
                                <Plus className="h-3 w-3" /> Obstáculo
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </SortableContext>
                {newPillar ? (
                  <div className="min-w-[160px]">
                    <InlineText value="" onSave={async (v) => { await addPillar(v); setNewPillar(false); }} placeholder="Nome do pilar..." autoFocus className="text-xs font-semibold" />
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7 gap-1 self-start" onClick={() => setNewPillar(true)}>
                    <Plus className="h-3 w-3" /> Pilar
                  </Button>
                )}
              </div>
            </div>
          </DndContext>
        </div>
      </div>

      {menuElement}
      {confirmElement}
    </div>
  );
}
