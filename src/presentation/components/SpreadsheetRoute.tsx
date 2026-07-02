import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";

export function SpreadsheetRoute() {
  const user = useAuthStore((s) => s.user);
  const byEmail = useSpreadsheetStore((s) => s.byEmail);

  if (!user) return <Navigate to="/login" replace />;

  const spreadsheetId = byEmail[user.email];
  if (!spreadsheetId) return <Navigate to="/setup" replace />;

  return <Outlet />;
}
