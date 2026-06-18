import { config } from "./config";

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
}

let accessToken: string | null = null;
let expiresAt = 0;
let scriptPromise: Promise<void> | null = null;

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

function setToken(token: string, expiresIn: number) {
  const expiry = Date.now() + expiresIn * 1000 - 30_000;
  accessToken = token;
  expiresAt = expiry;
  saveTokenToSession(token, expiry);
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
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function silentSignIn(): Promise<UserInfo | null> {
  if (!config.googleClientId) return null;
  try {
    await loadGsi();
    const token = await new Promise<string>((resolve, reject) => {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: config.googleClientId!,
        scope: `${config.scopes} openid email profile`,
        callback: (resp) => {
          if (resp.error || !resp.access_token) {
            return reject(new Error(resp.error ?? "silent_failed"));
          }
          setToken(resp.access_token, resp.expires_in ?? 3600);
          resolve(resp.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: "none" });
    });
    return fetchUserInfo(token);
  } catch {
    return null;
  }
}

export async function signIn(): Promise<UserInfo> {
  if (!config.googleClientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID não configurado.");
  }
  await loadGsi();
  const token = await new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId!,
      scope: `${config.scopes} openid email profile`,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          return reject(new Error(resp.error ?? "Login cancelado"));
        }
        setToken(resp.access_token, resp.expires_in ?? 3600);
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: "" });
  });
  return fetchUserInfo(token);
}
