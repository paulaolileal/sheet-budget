/**
 * Wrapper sobre Google Identity Services (gsi/client).
 *
 * Carrega o script sob demanda e expõe `requestAccessToken()`.
 * O token NUNCA é persistido em localStorage — vive em memória nesta closure.
 */

import { config } from "./config";

let accessToken: string | null = null;
let expiresAt = 0;
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
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

export function getAccessToken(): string | null {
  if (!accessToken) return null;
  if (Date.now() >= expiresAt) {
    accessToken = null;
    return null;
  }
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
  expiresAt = 0;
}

export async function signIn(): Promise<string> {
  if (!config.googleClientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID não configurado.");
  }
  await loadGsi();
  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: config.googleClientId!,
      scope: config.scopes,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          return reject(new Error(resp.error ?? "Login cancelado"));
        }
        accessToken = resp.access_token;
        expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000 - 30_000;
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: "" });
  });
}
