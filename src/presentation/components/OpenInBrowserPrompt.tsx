import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Shown instead of the "Entrar com Google" button when isInAppBrowser()
// detects an embedded webview (Instagram/Facebook/LinkedIn/etc.) — Google
// rejects OAuth inside these regardless of any backend architecture, so the
// only real fix is steering the user to a real browser before they ever
// reach the sign-in button. Android gets a link that can force-open Chrome;
// iOS has no reliable API to force-open Safari from inside a webview, so it
// only gets copy-to-clipboard + manual instructions.
export function OpenInBrowserPrompt() {
  const url = window.location.href;
  const intentUrl = `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;package=com.android.chrome;end;`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado — cole no seu navegador");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <div className="rounded-xl border border-white/15 bg-white/5 p-6 text-center text-white">
      <p className="text-sm font-semibold mb-1">Abra em um navegador</p>
      <p className="text-xs text-white/65 mb-5">
        O login do Google não funciona dentro deste aplicativo. Abra este link no Chrome ou Safari.
      </p>
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <a href={intentUrl}>
            <ExternalLink />
            Abrir no Chrome
          </a>
        </Button>
        <Button
          variant="outline"
          className="w-full border-white/20 text-white hover:bg-white/10"
          onClick={copyLink}
        >
          <Copy />
          Copiar link
        </Button>
      </div>
    </div>
  );
}
