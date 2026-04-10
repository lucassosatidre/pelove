import { useState, useEffect, useCallback } from "react";
import { Trash2, Paintbrush, Bold, Type } from "lucide-react";
import { resolveColor } from "@/lib/darkModeColors";
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

interface MenuPosition { x: number; y: number; }

interface ContextTarget {
  type: "pillar" | "obstacle" | "action";
  id: string;
  name: string;
}

const BG_COLORS = [
  { label: "Padrão", value: null },
  { label: "Cinza", value: "#E5E7EB", dark: "#374151" },
  { label: "Laranja", value: "#FED7AA", dark: "#7C2D12" },
  { label: "Verde", value: "#BBF7D0", dark: "#14532D" },
  { label: "Azul", value: "#BFDBFE", dark: "#1E3A5F" },
  { label: "Amarelo", value: "#FEF08A", dark: "#713F12" },
  { label: "Vermelho", value: "#FECACA", dark: "#7F1D1D" },
  { label: "Roxo", value: "#DDD6FE", dark: "#4C1D95" },
];

const TEXT_COLORS = [
  { label: "Padrão", value: null },
  { label: "Preto", value: "#000000" },
  { label: "Branco", value: "#FFFFFF" },
  { label: "Laranja", value: "#F97316" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Verde", value: "#22C55E" },
];

interface MapContextMenuProps {
  onDeletePillar: (id: string) => Promise<void>;
  onDeleteObstacle: (id: string) => Promise<void>;
  onDeleteAction: (id: string) => Promise<void>;
  onUpdateStyle: (type: "pillar" | "obstacle" | "action", id: string, field: string, value: any) => Promise<void>;
}

export function useMapContextMenu({ onDeletePillar, onDeleteObstacle, onDeleteAction, onUpdateStyle }: MapContextMenuProps) {
  const [menu, setMenu] = useState<{ pos: MenuPosition; target: ContextTarget } | null>(null);
  const [confirm, setConfirm] = useState<ContextTarget | null>(null);
  const [subMenu, setSubMenu] = useState<"bg" | "text" | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement;

    let node = el.closest("[data-node='action']") as HTMLElement | null;
    if (node) {
      e.preventDefault();
      const name = node.querySelector(".text-xs")?.textContent || "esta ação";
      setMenu({ pos: { x: e.clientX, y: e.clientY }, target: { type: "action", id: node.getAttribute("data-id")!, name } });
      setSubMenu(null);
      return;
    }

    node = el.closest("[data-node='obstacle']") as HTMLElement | null;
    if (node) {
      e.preventDefault();
      const name = node.querySelector(".text-xs")?.textContent || "este obstáculo";
      setMenu({ pos: { x: e.clientX, y: e.clientY }, target: { type: "obstacle", id: node.getAttribute("data-id")!, name } });
      setSubMenu(null);
      return;
    }

    node = el.closest("[data-node='pillar']") as HTMLElement | null;
    if (node) {
      e.preventDefault();
      const name = node.querySelector(".text-xs")?.textContent || "este pilar";
      setMenu({ pos: { x: e.clientX, y: e.clientY }, target: { type: "pillar", id: node.getAttribute("data-id")!, name } });
      setSubMenu(null);
      return;
    }
  }, []);

  const close = useCallback(() => { setMenu(null); setSubMenu(null); }, []);

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

  const isDark = document.documentElement.classList.contains("dark");

  const menuElement = menu ? (
    <div
      className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[200px]"
      style={{ left: menu.pos.x, top: menu.pos.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Delete */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
        onClick={() => { setConfirm(menu.target); close(); }}
      >
        <Trash2 className="h-4 w-4" />
        Excluir {labels[menu.target.type]}
      </button>

      <div className="h-px bg-border mx-1 my-1" />

      {/* Background color */}
      <div className="relative">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
          onClick={(e) => { e.stopPropagation(); setSubMenu(subMenu === "bg" ? null : "bg"); }}
        >
          <Paintbrush className="h-4 w-4" />
          Cor do balão
        </button>
        {subMenu === "bg" && (
          <div className="absolute left-full top-0 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px] grid grid-cols-4 gap-1" onClick={(e) => e.stopPropagation()}>
            {BG_COLORS.map((c) => (
              <button
                key={c.label}
                title={c.label}
                className="h-6 w-6 rounded border border-border hover:ring-2 hover:ring-primary"
                style={{ backgroundColor: getSwatchBg(c) }}
                onClick={() => { onUpdateStyle(menu.target.type, menu.target.id, "bg_color", c.value); close(); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Text color */}
      <div className="relative">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
          onClick={(e) => { e.stopPropagation(); setSubMenu(subMenu === "text" ? null : "text"); }}
        >
          <Type className="h-4 w-4" />
          Cor do texto
        </button>
        {subMenu === "text" && (
          <div className="absolute left-full top-0 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px] grid grid-cols-4 gap-1" onClick={(e) => e.stopPropagation()}>
            {TEXT_COLORS.map((c) => (
              <button
                key={c.label}
                title={c.label}
                className="h-6 w-6 rounded border border-border hover:ring-2 hover:ring-primary"
                style={{ backgroundColor: c.value ?? "transparent" }}
                onClick={() => { onUpdateStyle(menu.target.type, menu.target.id, "text_color", c.value); close(); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bold */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
        onClick={() => { onUpdateStyle(menu.target.type, menu.target.id, "is_bold", "toggle"); close(); }}
      >
        <Bold className="h-4 w-4" />
        Negrito (alternar)
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
