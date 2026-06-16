import { Navigate, Outlet } from "react-router-dom";
import { getAccessToken } from "@/services/googleAuth";
import { useAuthStore } from "@/store/authStore";

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;
  if (!getAccessToken()) return <Navigate to="/login" replace />;

  return <Outlet />;
}
