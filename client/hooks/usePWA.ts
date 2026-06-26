import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";

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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const seenVersionRef = useRef<string | null>(null);

  // ── Update trigger ───────────────────────────────────────────────────
  const handleWaitingWorker = useCallback((worker: ServiceWorker) => {
    waitingWorkerRef.current = worker;
    setUpdateAvailable(true);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    // ── Install prompt (Android / desktop Chrome) ────────────────────
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if (!("serviceWorker" in navigator)) {
      return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    }

    // ── When new SW takes control → reload immediately ────────────────
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // ── Register SW and check for update RIGHT NOW on every page load ─
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Already a waiting worker? Show banner immediately
        if (reg.waiting) {
          handleWaitingWorker(reg.waiting);
        }

        // New SW installing while we're watching
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              handleWaitingWorker(newWorker);
            }
          });
        });

        // Force-check immediately on page load (critical for installed PWAs)
        return reg.update();
      })
      .catch(() => {});

    // ── Also check every 3 minutes while tab is open ─────────────────
    const interval = setInterval(() => {
      navigator.serviceWorker.ready
        .then((reg) => reg.update())
        .catch(() => {});
    }, 3 * 60 * 1000);

    // ── Re-check on tab focus (user switches back to the app) ─────────
    const onFocus = () => {
      navigator.serviceWorker.ready
        .then((reg) => reg.update())
        .catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [handleWaitingWorker]);

  // ── Secondary check: poll /version.json every 5 min ──────────────────
  // Catches cases where SW update detection doesn't fire (e.g. Safari quirks)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    if (updateAvailable) return;

    let cancelled = false;

    const checkVersion = async () => {
      try {
        const url = new URL("/version.json", getApiUrl()).href;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const v = String(data?.build ?? "");
        if (!v) return;
        if (seenVersionRef.current === null) {
          seenVersionRef.current = v;
        } else if (seenVersionRef.current !== v) {
          setUpdateAvailable(true);
        }
      } catch { /* network unavailable — skip */ }
    };

    checkVersion();
    const id = setInterval(checkVersion, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [updateAvailable]);

  // ── Actions ───────────────────────────────────────────────────────────
  const install = async () => {
    if (!installPrompt) return;
    try {
      installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {}
    setInstallPrompt(null);
  };

  const update = () => {
    if (waitingWorkerRef.current) {
      // Tell waiting SW to skip waiting → triggers controllerchange → page reloads
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
    } else {
      // Fallback: hard reload clears the SW cache for this navigation
      window.location.reload();
    }
  };

  const dismiss = () => setDismissed(true);

  return {
    canInstall: !!installPrompt && !dismissed,
    updateAvailable,
    install,
    update,
    dismissed,
    dismiss,
  };
}
