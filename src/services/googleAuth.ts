import { config } from "./config";

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

let accessToken: string | null = null;
let expiresAt = 0;

// Proactive refresh: renew the token in the background well before it expires,
// so the user never hits an expired-token error mid-action.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightRefresh: Promise<string | null> | null = null;
let schedulerInitialized = false;

const PROACTIVE_LEAD_MS = 5 * 60_000; // schedule a silent refresh 5min before expiry
const FRESH_ENOUGH_MARGIN_MS = 60_000; // ensureFreshToken only refreshes if <60s remain

const SESSION_KEY = "gauth_token";

interface StoredToken {
  token: string;
  expiresAt: number;
}

function saveTokenToSession(token: string, expiry: number) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt: expiry }));
  } catch {
    // sessionStorage unavailable (private mode edge cases) — token stays in memory only
  }
}

function loadTokenFromSession(): StoredToken | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredToken;
    if (Date.now() >= stored.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function scheduleProactiveRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(0, expiresAt - PROACTIVE_LEAD_MS - Date.now());
  refreshTimer = setTimeout(() => {
    void ensureFreshToken();
  }, delay);
}

function setToken(token: string, expiresIn: number) {
  const expiry = Date.now() + expiresIn * 1000 - 30_000;
  accessToken = token;
  expiresAt = expiry;
  saveTokenToSession(token, expiry);
  scheduleProactiveRefresh();
}

async function fetchUserInfo(token: string): Promise<UserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Falha ao obter dados do usuário Google");
  return res.json() as Promise<UserInfo>;
}

// Reads #access_token=...&expires_in=... left in the URL by lealtek-api's
// /api/auth/callback redirect, applies it, and strips the fragment so the
// token doesn't linger in the address bar/history. Called once from
// initAuthScheduler() on app boot.
function consumeRedirectResult(): void {
  if (typeof window === "undefined" || !window.location.hash) return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("access_token");
  const expiresIn = params.get("expires_in");
  if (!token || !expiresIn) return;
  setToken(token, Number(expiresIn));
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState({}, "", url.toString());
}

async function refreshFromServer(): Promise<string | null> {
  try {
    const res = await fetch(`${config.apiBaseUrl}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token || !data.expires_in) return null;

    setToken(data.access_token, data.expires_in);
    return data.access_token;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (accessToken && Date.now() < expiresAt) return accessToken;

  const stored = loadTokenFromSession();
  if (stored) {
    accessToken = stored.token;
    expiresAt = stored.expiresAt;
    return accessToken;
  }

  accessToken = null;
  return null;
}

// Clears local state and revokes the session server-side (best-effort — the
// local state is already cleared regardless of whether the network call
// succeeds). Fire-and-forget, matching the original synchronous call sites.
export function signOut(): void {
  accessToken = null;
  expiresAt = 0;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  inFlightRefresh = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  void fetch(`${config.apiBaseUrl}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

/**
 * Returns a token guaranteed to be fresh for at least FRESH_ENOUGH_MARGIN_MS,
 * silently renewing it in the background if needed. Never throws — returns
 * null when renewal genuinely fails (expired/revoked refresh_token cookie,
 * network error), leaving the decision of what to do to the caller.
 * Concurrent calls share a single in-flight renewal.
 */
export async function ensureFreshToken(opts?: { forceRefresh?: boolean }): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  if (!opts?.forceRefresh) {
    const token = getAccessToken();
    if (token && expiresAt - Date.now() > FRESH_ENOUGH_MARGIN_MS) return token;
  }

  inFlightRefresh = refreshFromServer().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

/**
 * Starts the background session-keepalive: consumes a fresh token left in
 * the URL by a just-completed redirect sign-in (if any), schedules a
 * proactive silent refresh ahead of the current token's expiry, and
 * revalidates whenever the tab regains visibility/focus — covering timers
 * suspended by a backgrounded tab or a sleeping laptop. Call once on app boot.
 */
export function initAuthScheduler(): void {
  if (schedulerInitialized || typeof window === "undefined") return;
  schedulerInitialized = true;

  consumeRedirectResult();

  const revalidate = () => {
    if (document.visibilityState === "visible") void ensureFreshToken();
  };
  document.addEventListener("visibilitychange", revalidate);
  window.addEventListener("focus", revalidate);

  if (getAccessToken()) scheduleProactiveRefresh();
}

export async function silentSignIn(): Promise<UserInfo | null> {
  const token = await ensureFreshToken();
  if (!token) return null;
  try {
    return await fetchUserInfo(token);
  } catch {
    return null;
  }
}

// Reads the profile for whatever token is already held locally (e.g. right
// after consumeRedirectResult() picked one up from the URL) — unlike
// silentSignIn(), this never attempts a network refresh.
export async function getCurrentUserInfo(): Promise<UserInfo | null> {
  const token = getAccessToken();
  if (!token) return null;
  try {
    return await fetchUserInfo(token);
  } catch {
    return null;
  }
}

// Interactive sign-in navigates the whole tab to lealtek-api's login
// endpoint (full-page redirect, not a popup) — more robust in the installed
// PWA and mobile browsers than window.open(), and it's what lets
// lealtek-api detect and block in-app browsers before ever reaching Google.
// Control returns to this app only when the browser lands back here with
// #access_token=... in the URL, picked up by consumeRedirectResult() on the
// next boot.
export function signIn(): void {
  const returnTo = window.location.href;
  window.location.href = `${config.apiBaseUrl}/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
}
