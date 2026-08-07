import { ensureFreshToken } from "@/services/googleAuth";

/**
 * Thrown when a Google API call cannot get a usable access token, even after
 * a silent-refresh retry — i.e. the user's Google session is genuinely gone
 * (revoked consent, blocked third-party cookies, logged out elsewhere). The
 * UI layer catches this specifically to offer a non-destructive "reconnect"
 * action instead of a generic error toast.
 */
export class GoogleAuthError extends Error {
  constructor(message = "Sessão do Google expirada. Reconecte para continuar.") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/**
 * Shared fetch wrapper for the Sheets/Drive REST APIs. Ensures a fresh token
 * before every call (silently renewing in the background if needed), and on
 * an HTTP 401 attempts one forced silent refresh + retry before giving up.
 */
export async function googleApiFetch<T>(
  url: string,
  init?: RequestInit & { apiLabel?: string },
): Promise<T> {
  const apiLabel = init?.apiLabel ?? "Google API";
  return doFetch<T>(url, init, apiLabel, false);
}

async function doFetch<T>(
  url: string,
  init: (RequestInit & { apiLabel?: string }) | undefined,
  apiLabel: string,
  isRetry: boolean,
): Promise<T> {
  const token = await ensureFreshToken(isRetry ? { forceRefresh: true } : undefined);
  if (!token) throw new GoogleAuthError();

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401 && !isRetry) {
    return doFetch<T>(url, init, apiLabel, true);
  }

  if (!res.ok) {
    if (res.status === 401) throw new GoogleAuthError();
    const body = await res.text();
    throw new Error(`${apiLabel} ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}
