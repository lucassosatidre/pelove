import { useEffect, useState } from "react";
import { db } from "@/lib/offline/db";
import { getSyncStatus, onMutationChange, onStatusChange } from "@/lib/offline/sync";

export function useOfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    const updatePending = async () => setPending(await db.mutations.count());
    void updatePending();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const offMut = onMutationChange(() => void updatePending());
    const offStatus = onStatusChange(() => setStatus(getSyncStatus()));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      offMut();
      offStatus();
    };
  }, []);

  return { online, pending, status };
}
