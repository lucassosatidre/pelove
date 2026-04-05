import { VisionHeader } from "@/components/mapa/VisionHeader";
import { MapTable } from "@/components/mapa/MapTable";

export default function MapaEstrategico() {
  return (
    <div className="flex flex-col h-full">
      <VisionHeader />
      <MapTable />
    </div>
  );
}
