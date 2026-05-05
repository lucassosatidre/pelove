import { MindMapLayout } from "@/components/mapa/MindMapLayout";
import { OfflineBadge } from "@/components/mapa/OfflineBadge";

export default function MapaEstrategico() {
  return (
    <div className="flex flex-col h-full relative">
      <div className="absolute right-4 top-3 z-50">
        <OfflineBadge />
      </div>
      <MindMapLayout />
    </div>
  );
}
