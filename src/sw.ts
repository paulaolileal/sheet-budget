/// <reference lib="webworker" />

/**
 * Custom service worker (vite-plugin-pwa `injectManifest` strategy). We had to
 * move off the default `generateSW` mode to add one thing it can't produce
 * automatically: a `fetch` handler that intercepts the Android Web Share
 * Target `POST` (see `manifest.share_target` in `vite.config.ts`) and hands
 * the shared receipt image off to the app via IndexedDB — see
 * `src/lib/receiptStore.ts` and `src/presentation/pages/ShareTargetPage.tsx`.
 *
 * Everything else here reproduces what `generateSW` used to do for us:
 * precache the app shell and never let googleapis.com/api.lealtek.com
 * responses be served from cache (finance data has no offline mode by design,
 * and auth token calls must never be served stale).
 */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { registerRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";
import { putReceipt } from "./lib/receiptStore";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.hostname.endsWith("googleapis.com") || url.hostname === "api.lealtek.com",
  new NetworkOnly(),
);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(handleShareTarget(event.request, url));
  }
});

async function handleShareTarget(request: Request, url: URL): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("receipt");
  if (!(file instanceof Blob)) {
    return Response.redirect(
      `${url.origin}${url.pathname.replace(/share-target$/, "")}transactions`,
      303,
    );
  }
  const receiptId = crypto.randomUUID();
  await putReceipt(receiptId, file);
  const base = url.pathname.replace(/share-target$/, "");
  return Response.redirect(`${url.origin}${base}share-target?receiptId=${receiptId}`, 303);
}
