import { useState, useCallback } from "react";

const STORAGE_KEY = "pelove-collapse-state";

interface CollapseState {
  pillars: Record<string, boolean>; // true = expanded
  obstacles: Record<string, boolean>;
}

function loadState(): CollapseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pillars: {}, obstacles: {} };
}

function saveState(state: CollapseState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useCollapseState() {
  const [state, setState] = useState<CollapseState>(loadState);

  const isPillarExpanded = useCallback((id: string) => {
    return state.pillars[id] ?? false; // default collapsed
  }, [state.pillars]);

  const isObstacleExpanded = useCallback((id: string) => {
    return state.obstacles[id] ?? false; // default collapsed
  }, [state.obstacles]);

  const togglePillar = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, pillars: { ...prev.pillars, [id]: !prev.pillars[id] } };
      saveState(next);
      return next;
    });
  }, []);

  const toggleObstacle = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, obstacles: { ...prev.obstacles, [id]: !prev.obstacles[id] } };
      saveState(next);
      return next;
    });
  }, []);

  const expandAll = useCallback((pillarIds: string[], obstacleIds: string[]) => {
    setState(() => {
      const pillars: Record<string, boolean> = {};
      const obstacles: Record<string, boolean> = {};
      pillarIds.forEach(id => pillars[id] = true);
      obstacleIds.forEach(id => obstacles[id] = true);
      const next = { pillars, obstacles };
      saveState(next);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    const next: CollapseState = { pillars: {}, obstacles: {} };
    saveState(next);
    setState(next);
  }, []);

  return { isPillarExpanded, isObstacleExpanded, togglePillar, toggleObstacle, expandAll, collapseAll };
}
