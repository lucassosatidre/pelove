import { useRegisterSW } from "virtual:pwa-register/react";

// Re-check for new SW every 60s to satisfy "update aparece em até 1min".
const INTERVAL_MS = 60 * 1000;

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(async () => {
        try {
          if (registration.installing || !navigator) return;
          if ("connection" in navigator && !(navigator as Navigator & { onLine: boolean }).onLine) return;
          await registration.update();
        } catch {
          // ignore
        }
      }, INTERVAL_MS);
    },
  });

  return {
    needRefresh,
    dismiss: () => setNeedRefresh(false),
    updateServiceWorker,
  };
}
