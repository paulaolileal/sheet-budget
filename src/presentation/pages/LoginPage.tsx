import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, HardDrive, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn, silentSignIn, getAccessToken } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function redirectAfterLogin(email: string) {
    const hasSpreadsheet = !!useSpreadsheetStore.getState().byEmail[email];
    navigate(hasSpreadsheet ? "/" : "/setup", { replace: true });
  }

  useEffect(() => {
    if (!user || getAccessToken()) return;
    setLoading(true);
    silentSignIn().then((info) => {
      if (info) {
        setUser(info);
        redirectAfterLogin(info.email);
      } else {
        setLoading(false);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (user && getAccessToken()) {
    const hasSpreadsheet = !!useSpreadsheetStore.getState().byEmail[user.email];
    return <Navigate to={hasSpreadsheet ? "/" : "/setup"} replace />;
  }

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const info = await signIn();
      setUser(info);
      redirectAfterLogin(info.email);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Painel esquerdo — visível apenas lg+ */}
      <div
        className="hidden lg:flex lg:w-[55%] flex-col justify-between p-12 relative overflow-hidden text-white"
        style={{
          background:
            "linear-gradient(145deg, oklch(0.12 0.005 260) 0%, oklch(0.19 0.01 260) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, oklch(0.62 0.12 85 / 45%) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/logo-bs.png"
            alt="Budget"
            className="h-10 w-10 object-contain rounded-lg opacity-95"
          />
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-white/55 uppercase">
              lealtek
            </p>
            <p className="text-lg font-bold tracking-tight">Budget</p>
          </div>
        </div>

        <div className="relative z-10 space-y-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Suas finanças,
              <br />
              organizadas.
            </h2>
            <p className="mt-4 text-base text-white/65 max-w-xs leading-relaxed">
              Gestão de finanças pessoais com os dados sempre no seu Google Drive.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { Icon: CheckCircle2, text: "Conectado ao Google Sheets" },
              { Icon: HardDrive, text: "Dados no seu Drive, sempre" },
              { Icon: BarChart3, text: "Gráficos e relatórios mensais" },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-white/60 shrink-0" />
                <span className="text-sm text-white/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <a
            href="https://lealtek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/35 hover:text-white/55 transition-colors"
          >
            lealtek.com
          </a>
        </div>
      </div>

      {/* Painel direito / form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-14">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo — só mobile/tablet */}
          <div className="text-center space-y-2 lg:hidden">
            <div className="flex items-center justify-center gap-3">
              <img src="/logo-bs.png" alt="Budget" className="h-12 w-12 object-contain" />
              <div className="text-left">
                <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  lealtek
                </p>
                <h1 className="text-3xl font-bold tracking-tight">Budget</h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Gestão de finanças pessoais</p>
          </div>

          {/* Heading — lg+ */}
          <div className="hidden lg:block">
            <h2 className="text-2xl font-semibold tracking-tight">Bem-vindo</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Entre com sua conta Google para continuar.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{user ? "Reconectando sua conta…" : "Entrando…"}</span>
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button onClick={handleSignIn} className="w-full gap-2.5 h-11" size="lg">
                <GoogleIcon />
                {user ? "Reconectar com Google" : "Entrar com Google"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Seus dados ficam no seu Google Drive
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
