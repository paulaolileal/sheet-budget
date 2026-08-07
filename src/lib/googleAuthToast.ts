import { toast } from "sonner";
import { signIn } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";

const RECONNECT_TOAST_ID = "google-reconnect";

/**
 * Shows a persistent, non-navigating toast asking the user to reconnect their
 * Google account. Used whenever a `GoogleAuthError` bubbles up (silent token
 * refresh genuinely failed) — never redirects, so whatever the user was doing
 * (an open dialog, unsaved form) stays intact; they just click "Reconectar",
 * grant consent again in the popup, and retry their action manually.
 */
export function showReconnectToast(): void {
  toast.error("Sessão do Google expirada.", {
    id: RECONNECT_TOAST_ID,
    duration: Infinity,
    description: "Reconecte para continuar de onde parou.",
    action: {
      label: "Reconectar",
      onClick: handleReconnectClick,
    },
  });
}

function handleReconnectClick(): void {
  toast.loading("Reconectando…", { id: RECONNECT_TOAST_ID });
  signIn()
    .then((info) => {
      useAuthStore.getState().setUser(info);
      toast.success("Conta reconectada. Tente novamente.", { id: RECONNECT_TOAST_ID });
    })
    .catch((e: Error) => {
      toast.error(`Não foi possível reconectar: ${e.message}`, { id: RECONNECT_TOAST_ID });
    });
}
