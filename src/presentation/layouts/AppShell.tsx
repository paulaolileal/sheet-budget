import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Repeat,
  Settings,
  Moon,
  Sun,
  CloudCheck,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "../theme/ThemeProvider";
import { useUiStore } from "@/store/uiStore";
import { config } from "@/services/config";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/lancamentos", label: "Lançamentos", icon: Receipt },
  { to: "/cartoes", label: "Cartões & Faturas", icon: CreditCard },
  { to: "/recorrencias", label: "Recorrências", icon: Repeat },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function SyncIndicator() {
  const sync = useUiStore((s) => s.sync);
  if (sync === "syncing")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin" /> sincronizando
      </span>
    );
  if (sync === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-success)]">
        <CloudCheck className="h-3 w-3" /> salvo
      </span>
    );
  if (sync === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="h-3 w-3" /> erro ao salvar
      </span>
    );
  return null;
}

export function AppShell() {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5 border-b">
          <div className="text-sm font-semibold tracking-tight">Finanças</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {config.useMock ? "Modo local (mock)" : "Google Sheets"}
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t flex items-center justify-between">
          <SyncIndicator />
          <button
            onClick={toggle}
            className="h-8 w-8 grid place-items-center rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
