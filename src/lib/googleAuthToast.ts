import { toast } from "sonner";
import { signIn } from "@/services/googleAuth";

const RECONNECT_TOAST_ID = "google-reconnect";

/**
 * Shows a persistent toast asking the user to reconnect their Google
 * account. Used whenever a `GoogleAuthError` bubbles up (silent token
 * refresh genuinely failed) — clicking "Reconectar" navigates the whole tab
 * to lealtek-api's login endpoint (full-page redirect, not a popup); the
 * user lands back on this same page afterwards to retry their action.
 */
export function showReconnectToast(): void {
  toast.error("Sessão do Google expirada.", {
    id: RECONNECT_TOAST_ID,
    duration: Infinity,
    description: "Reconecte para continuar de onde parou.",
    action: {
      label: "Reconectar",
      onClick: () => signIn(),
    },
  });
}
