// Google refuses to render its OAuth consent screen inside user agents it
// recognizes as embedded/in-app browsers (error "disallowed_useragent").
// lealtek-api enforces this authoritatively server-side too (see its
// api/_lib/inAppBrowser.ts) — this client-side copy exists only to skip the
// pointless sign-in → lealtek-api → "open in browser" round-trip and show
// the same guidance immediately.
const IN_APP_BROWSER_PATTERNS: RegExp[] = [
  /FBAN|FBAV|FB_IAB/i, // Facebook
  /Instagram/i,
  /Line\//i, // LINE
  /MicroMessenger/i, // WeChat
  /TikTok|musical_ly/i,
  /LinkedInApp/i,
  /Twitter/i,
  /; ?wv\)/i, // generic Android WebView marker
];

export function isInAppBrowser(userAgent: string = navigator.userAgent): boolean {
  return IN_APP_BROWSER_PATTERNS.some((pattern) => pattern.test(userAgent));
}
