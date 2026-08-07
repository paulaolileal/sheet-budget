import { config } from "./config";

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

let accessToken: string | null = null;
let expiresAt = 0;
let scriptPromise: Promise<void> | null = null;

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

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

function loadGsi(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google Identity Services"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function fetchUserInfo(token: string): Promise<UserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Falha ao obter dados do usuário Google");
  return res.json() as Promise<UserInfo>;
}

/**
 * Runs the GIS token client with the given prompt mode, resolving with a fresh
 * access token (and persisting it via setToken) or rejecting with the GIS error.
 * `prompt: "none"` never opens a popup or requires a user gesture — on failure
 * it just rejects (e.g. "user_logged_out", "immediate_failed").
 */
async function runTokenClient(prompt: "" | "none"): Promise<string> {
  if (!config.googleClientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID não configurado.");
  }
  await loadGsi();
  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId!,
      scope: `${config.scopes} openid email profile`,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          return reject(
            new Error(resp.error ?? (prompt === "none" ? "silent_failed" : "Login cancelado")),
          );
        }
        setToken(resp.access_token, resp.expires_in ?? 3600);
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt });
  });
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

export function clearAccessToken() {
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
}

/**
 * Returns a token guaranteed to be fresh for at least FRESH_ENOUGH_MARGIN_MS,
 * silently renewing it in the background if needed. Never throws — returns
 * null when renewal genuinely fails (dead Google session, blocked cookies,
 * revoked consent), leaving the decision of what to do to the caller.
 * Concurrent calls share a single in-flight renewal.
 */
export async function ensureFreshToken(opts?: { forceRefresh?: boolean }): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  if (!opts?.forceRefresh) {
    const token = getAccessToken();
    if (token && expiresAt - Date.now() > FRESH_ENOUGH_MARGIN_MS) return token;
  }

  inFlightRefresh = runTokenClient("none")
    .catch(() => null)
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
}

/**
 * Starts the background session-keepalive: schedules a proactive silent
 * refresh ahead of the current token's expiry (if any), and revalidates
 * whenever the tab regains visibility/focus — covering timers suspended by a
 * backgrounded tab or a sleeping laptop. Call once on app boot.
 */
export function initAuthScheduler(): void {
  if (schedulerInitialized || typeof window === "undefined") return;
  schedulerInitialized = true;

  const revalidate = () => {
    if (document.visibilityState === "visible") void ensureFreshToken();
  };
  document.addEventListener("visibilitychange", revalidate);
  window.addEventListener("focus", revalidate);

  if (getAccessToken()) scheduleProactiveRefresh();
}

export async function silentSignIn(): Promise<UserInfo | null> {
  if (!config.googleClientId) return null;
  try {
    const token = await runTokenClient("none");
    return await fetchUserInfo(token);
  } catch {
    return null;
  }
}

export async function signIn(): Promise<UserInfo> {
  const token = await runTokenClient("");
  return fetchUserInfo(token);
}
