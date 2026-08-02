import { Check, Download, Share } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export function InstallAppCard() {
  const { installed, canInstall, isIos, promptInstall } = useInstallPrompt();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Instalar aplicativo</CardTitle>
        <CardDescription>
          Instale o app na tela inicial para acesso rápido, como um aplicativo nativo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {installed ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-primary" />
            App instalado
          </div>
        ) : canInstall ? (
          <Button size="sm" className="gap-2" onClick={promptInstall}>
            <Download className="h-3.5 w-3.5" />
            Instalar app
          </Button>
        ) : isIos ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Instalar no iPhone/iPad</p>
            <p className="mt-1">
              Toque em <Share className="inline h-3.5 w-3.5 align-text-bottom" /> e depois em
              &quot;Adicionar à Tela de Início&quot;.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Use o menu do navegador e procure por &quot;Instalar app&quot; ou &quot;Adicionar à tela
            inicial&quot;.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
