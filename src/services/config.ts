const apiUrl = import.meta.env.VITE_LEALTEK_API_URL as string | undefined;
if (!apiUrl) throw new Error("VITE_LEALTEK_API_URL is required");

export const config = {
  // No trailing slash, so callers can safely do `${config.apiBaseUrl}/api/...`.
  apiBaseUrl: apiUrl.replace(/\/$/, ""),
};
