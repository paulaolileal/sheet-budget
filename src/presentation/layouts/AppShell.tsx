import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Repeat,
  Settings,
  TrendingUp,
  Moon,
  Sun,
  CloudCheck,
  CloudOff,
  RefreshCw,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "../theme/ThemeProvider";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { clearAccessToken } from "@/services/googleAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Lançamentos", icon: Receipt },
  { to: "/incomes", label: "Receitas", icon: TrendingUp },
  { to: "/cards", label: "Cartões", icon: CreditCard },
  { to: "/recurrences", label: "Recorrências", icon: Repeat },
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
  const navigate = useNavigate();
  const { user, clearUser } = useAuthStore();

  function handleLogout() {
    clearAccessToken();
    clearUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="fixed inset-0 flex bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-5 border-b flex items-center gap-3">
          <img src="/logo-bs.png" alt="Budget" className="h-10 w-10 object-contain shrink-0 rounded-md" />
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              lealtek
            </div>
            <div className="text-sm font-bold tracking-tight mt-0.5">Budget</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Google Sheets</div>
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
        <div className="border-t">
          {user && (
            <div className="flex items-center gap-2 px-3 py-3 border-b">
              <img
                src={user.picture}
                alt={user.name}
                className="h-7 w-7 rounded-full flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user.name}</div>
              </div>
              <button
                onClick={() => navigate("/settings")}
                className="h-7 w-7 grid place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Configurações"
                title="Configurações"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggle}
                className="h-7 w-7 grid place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Alternar tema"
                title="Alternar tema"
              >
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={handleLogout}
                className="h-7 w-7 grid place-items-center rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                aria-label="Sair"
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-5">
            <SyncIndicator />
            <a
              href="https://lealtek.com"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-40 hover:opacity-70 transition-opacity"
              title="Desenvolvido por LealTEK"
            >
              <img src="/lealtek-full.png" alt="LealTEK" className="h-8 object-contain" />
            </a>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-x-hidden">
        {/* Mobile header — shrink-0 keeps it fixed-height at the top of the flex column */}
        <header className="shrink-0 md:hidden flex items-center justify-between px-4 h-14 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <img src="/logo-bs.png" alt="Budget" className="h-8 w-8 object-contain shrink-0 rounded-md" />
            <div>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase leading-none">
                lealtek
              </div>
              <div className="text-sm font-bold tracking-tight leading-tight">Budget</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncIndicator />
            <button
              onClick={toggle}
              className="h-8 w-8 grid place-items-center rounded-md hover:bg-accent transition-colors"
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <img src={user.picture} alt={user.name} className="h-7 w-7 rounded-full" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <DropdownMenuItem
                    className="text-xs gap-2 cursor-pointer"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </header>

        {/* Page content — min-w-0 prevents flex children from overflowing horizontally */}
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav — shrink-0 keeps it fixed-height at the bottom of the flex column */}
        <nav className="shrink-0 md:hidden h-16 bg-background/95 backdrop-blur-sm border-t z-50">
          <div className="grid grid-cols-5 h-full">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
