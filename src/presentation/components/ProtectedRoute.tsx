import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ensureFreshToken, getAccessToken } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";

type TokenStatus = "checking" | "ok" | "missing";

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);
  // Fast path: token already valid in-memory/sessionStorage — render immediately,
  // no extra latency. Only the edge case (token missing/near-expiry, e.g. a hard
  // refresh right as it's expiring) falls through to an async silent-refresh check
  // below, instead of redirecting to /login outright and losing the current URL.
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>(() =>
    getAccessToken() ? "ok" : "checking",
  );

  useEffect(() => {
    if (!user || tokenStatus !== "checking") return;
    let cancelled = false;
    ensureFreshToken().then((token) => {
      if (!cancelled) setTokenStatus(token ? "ok" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, [user, tokenStatus]);

  if (!user) return <Navigate to="/login" replace />;
  if (tokenStatus === "missing") return <Navigate to="/login" replace />;
  if (tokenStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return <Outlet />;
}
