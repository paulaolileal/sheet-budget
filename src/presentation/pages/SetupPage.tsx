import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, TableProperties, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DriveApiClient, type DriveFile } from "@/infrastructure/google/DriveApiClient";
import { SheetsInitializer } from "@/infrastructure/google/SheetsInitializer";
import { getAccessToken } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { clearSheetProvider } from "@/application/repositoryProvider";

const FOLDER_NAME = "LealTEK";
const SPREADSHEET_TITLE = "Sheet Budget";

export function SetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user)!;
  const setSpreadsheetId = useSpreadsheetStore((s) => s.setSpreadsheetId);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState<DriveFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new DriveApiClient(getAccessToken);
    client
      .listSpreadsheets()
      .then(setSpreadsheets)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSelect(id: string) {
    setSpreadsheetId(user.email, id);
    clearSheetProvider();
    qc.clear();
    navigate("/", { replace: true });
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const initializer = new SheetsInitializer(getAccessToken);
      const drive = new DriveApiClient(getAccessToken);

      const spreadsheetId = await initializer.createSpreadsheet(SPREADSHEET_TITLE);

      try {
        const folderId = await drive.getOrCreateFolder(FOLDER_NAME);
        await drive.moveToFolder(spreadsheetId, folderId);
      } catch {
        // Non-fatal: folder organization is cosmetic
      }

      handleSelect(spreadsheetId);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <img src="/logo-bs.png" alt="Budget" className="h-12 w-12 object-contain rounded-md" />
            <div className="text-left">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                lealtek
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Conecte ou crie sua planilha no Google Drive
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </>
          ) : spreadsheets.length > 0 ? (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Planilhas encontradas
              </p>
              {spreadsheets.map((sheet) => (
                <Card
                  key={sheet.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => handleSelect(sheet.id)}
                >
                  <CardContent className="flex items-center gap-3 py-3 px-4">
                    <TableProperties className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{sheet.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(sheet.modifiedTime).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Selecionar
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <div className="relative flex items-center py-1">
                <div className="flex-1 border-t" />
                <span className="px-3 text-xs text-muted-foreground">ou</span>
                <div className="flex-1 border-t" />
              </div>
            </>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-sm">Nenhuma planilha encontrada</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Crie uma nova planilha para começar a usar o Budget.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Button className="w-full gap-2" onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {creating ? "Criando planilha…" : "Criar nova planilha"}
          </Button>
        </div>
      </div>
    </div>
  );
}
