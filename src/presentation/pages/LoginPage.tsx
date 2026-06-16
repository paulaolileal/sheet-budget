import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { config } from "@/services/config";
import { signIn, getAccessToken } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (config.useMock) return <Navigate to="/" replace />;
  if (user && getAccessToken()) return <Navigate to="/" replace />;

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const info = await signIn();
      setUser(info);
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm px-8 py-12 space-y-8">
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            lealtek
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Budget</h1>
          <p className="text-sm text-muted-foreground">Gestão de finanças pessoais</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {user ? "Reconectando sua conta…" : "Entrando…"}
          </div>
        ) : (
          <div className="space-y-3">
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={handleSignIn} className="w-full gap-2" size="lg">
              <GoogleIcon />
              {user ? "Reconectar com Google" : "Entrar com Google"}
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">app.lealtek.com</p>
      </div>
    </div>
  );
}
