import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../components/PageHeader";
import { config } from "@/services/config";

export function SettingsPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader title="Configurações" description="Configurações do aplicativo." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fonte de dados</CardTitle>
          <CardDescription>Google Sheets como fonte de verdade.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
