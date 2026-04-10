import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MenuPosition {
  x: number;
  y: number;
}

interface ContextTarget {
  type: "pillar" | "obstacle" | "action";
  id: string;
  name: string;
}

interface MapContextMenuProps {
  onDeletePillar: (id: string) => Promise<void>;
  onDeleteObstacle: (id: string) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
}

export function useMapContextMenu({ onDeletePillar, onDeleteObstacle, onDeleteAction }: MapContextMenuProps) {
  const [menu, setMenu] = useState<{ pos: MenuPosition; target: ContextTarget } | null>(null);
  const [confirm, setConfirm] = useState<ContextTarget | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement;

    // Walk up from target to find a data-node element
    let node = el.closest("[data-node='action']") as HTMLElement | null;
    if (node) {
      e.preventDefault();
      const name = node.querySelector(".text-xs")?.textContent || "esta ação";
      setMenu({ pos: { x: e.clientX, y: e.clientY }, target: { type: "action", id: node.getAttribute("data-id")!, name } });
      return;
    }

    node = el.closest("[data-node='obstacle']") as HTMLElement | null;
    if (node) {
      e.preventDefault();
      const name = node.querySelector(".text-xs")?.textContent || "este obstáculo";
      setMenu({ pos: { x: e.clientX, y: e.clientY }, target: { type: "obstacle", id: node.getAttribute("data-id")!, name } });
      return;
    }

    node = el.closest("[data-node='pillar']") as HTMLElement | null;
    if (node) {
      e.preventDefault();
      const name = node.querySelector(".text-xs")?.textContent || "este pilar";
      setMenu({ pos: { x: e.clientX, y: e.clientY }, target: { type: "pillar", id: node.getAttribute("data-id")!, name } });
      return;
    }
  }, []);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const handler = () => close();
    const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", handler);
    window.addEventListener("keydown", escHandler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", escHandler);
    };
  }, [menu, close]);

  const handleDelete = useCallback(async () => {
    if (!confirm) return;
    if (confirm.type === "pillar") await onDeletePillar(confirm.id);
    else if (confirm.type === "obstacle") await onDeleteObstacle(confirm.id);
    else await onDeleteAction(confirm.id);
    setConfirm(null);
  }, [confirm, onDeletePillar, onDeleteObstacle, onDeleteAction]);

  const labels: Record<string, string> = {
    pillar: "pilar",
    obstacle: "obstáculo",
    action: "ação",
  };

  const confirmMessages: Record<string, (name: string) => string> = {
    pillar: (n) => `Excluir o pilar '${n}' e todos os seus obstáculos e ações? Esta ação não pode ser desfeita.`,
    obstacle: (n) => `Excluir o obstáculo '${n}' e todas as suas ações?`,
    action: (n) => `Excluir a ação '${n}'?`,
  };

  const menuElement = menu ? (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ left: menu.pos.x, top: menu.pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
        onClick={() => {
          setConfirm(menu.target);
          close();
        }}
      >
        <Trash2 className="h-4 w-4" />
        Excluir {labels[menu.target.type]}
      </button>
    </div>
  ) : null;

  const confirmElement = (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm ? confirmMessages[confirm.type](confirm.name) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { handleContextMenu, menuElement, confirmElement };
}
