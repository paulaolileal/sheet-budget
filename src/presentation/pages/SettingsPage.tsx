import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../components/PageHeader";
import { config } from "@/services/config";
import { signIn, getAccessToken, clearAccessToken } from "@/services/googleAuth";
import { resetRepository } from "@/application/repositoryProvider";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function SettingsPage() {
  const [connected, setConnected] = useState<boolean>(!!getAccessToken());
  const qc = useQueryClient();

  async function handleConnect() {
    try {
      await signIn();
      setConnected(true);
      resetRepository();
      qc.invalidateQueries();
      toast.success("Conectado ao Google Sheets");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function handleReset() {
    if (!confirm("Limpar dados locais e recarregar a partir dos CSVs seed?")) return;
    localStorage.removeItem("finapp:mock-state:v1");
    location.reload();
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader title="Configurações" description="Conexão com a fonte de dados." />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Fonte de dados</CardTitle>
          <CardDescription>
            {config.useMock
              ? "Modo local ativo. Os dados vêm dos CSVs seed e são salvos no localStorage."
              : "Configurado para usar Google Sheets como fonte de verdade."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">VITE_GOOGLE_CLIENT_ID</div>
              <div className="font-mono">{config.googleClientId ? "configurado" : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">VITE_SPREADSHEET_ID</div>
              <div className="font-mono">{config.spreadsheetId ? "configurado" : "—"}</div>
            </div>
          </div>
          {!config.useMock && (
            <div className="flex items-center gap-2">
              <Button onClick={handleConnect}>{connected ? "Reconectar Google" : "Conectar com Google"}</Button>
              {connected && (
                <Button
                  variant="outline"
                  onClick={() => {
                    clearAccessToken();
                    setConnected(false);
                  }}
                >
                  Desconectar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados locais</CardTitle>
          <CardDescription>Resetar mock para o estado inicial dos CSVs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleReset}>Recarregar seed</Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-6">
        Tokens de acesso nunca são gravados em localStorage. Veja o README para configurar OAuth e publicar.
      </p>
    </div>
  );
}
