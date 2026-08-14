import { Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "../theme/ThemeProvider";

export function AppearanceCard() {
  const { theme, toggle } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aparência</CardTitle>
        <CardDescription>Escolha entre tema claro e escuro.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" size="sm" className="gap-2" onClick={toggle}>
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        </Button>
      </CardContent>
    </Card>
  );
}
