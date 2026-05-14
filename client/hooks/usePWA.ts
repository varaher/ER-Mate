import { useState, useEffect } from "react";
import { Platform } from "react-native";

export type PWAState = {
  canInstall: boolean;
  updateAvailable: boolean;
  install: () => Promise<void>;
  update: () => void;
  dismissed: boolean;
  dismiss: () => void;
};

export function usePWA(): PWAState {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [updateReg, setUpdateReg] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDismissed(false);
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.waiting) {
          setUpdateReg(reg);
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setUpdateReg(reg);
            }
          });
        });
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Poll for updates every 60s while the tab is open
      const interval = setInterval(() => {
        navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
      }, 60 * 1000);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        clearInterval(interval);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } catch {}
  };

  const update = () => {
    if (!updateReg?.waiting) return;
    updateReg.waiting.postMessage({ type: "SKIP_WAITING" });
    setUpdateReg(null);
  };

  const dismiss = () => setDismissed(true);

  return {
    canInstall: !!installPrompt && !dismissed,
    updateAvailable: !!updateReg,
    install,
    update,
    dismissed,
    dismiss,
  };
}
