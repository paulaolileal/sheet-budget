import { registerSW } from "virtual:pwa-register";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // re-check for a new service worker hourly

/**
 * Registers the service worker and keeps an installed Android/desktop PWA current on its
 * own, with no manual reinstall or cache-clear required.
 *
 * `registerType: "autoUpdate"` (vite.config.ts) plus `self.skipWaiting()`/`clientsClaim()`
 * (src/sw.ts) already make a newly found service worker activate and take control without
 * asking the user — but two gaps remain:
 *   1. Browsers only check the service worker script for changes on navigation, roughly
 *      once a day. An installed PWA can stay open far longer than that, so we also poll
 *      `registration.update()` on an interval and whenever the app regains focus.
 *   2. Activating a new service worker doesn't refresh the JS/CSS already loaded in the
 *      open tab. We reload once a new worker takes control so the update actually applies
 *      — immediately if the app is already in the background, or on the next time it goes
 *      there otherwise, so an active edit is never interrupted mid-flow.
 */
export function initServiceWorkerAutoUpdate(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkForUpdate = () => void registration.update().catch(() => {});
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
    },
  });

  reloadOnNewServiceWorker();
}

function reloadOnNewServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  let hasReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloaded) return;

    const reload = () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    };

    if (document.visibilityState === "hidden") {
      reload();
      return;
    }
    document.addEventListener("visibilitychange", function onHidden() {
      if (document.visibilityState !== "hidden") return;
      document.removeEventListener("visibilitychange", onHidden);
      reload();
    });
  });
}
