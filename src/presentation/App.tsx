import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppShell } from "./layouts/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SpreadsheetRoute } from "./components/SpreadsheetRoute";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { CardsPage } from "./pages/CardsPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { IncomePage } from "./pages/IncomePage";
import { DebtorsPage } from "./pages/DebtorsPage";
import { PlanningPage } from "./pages/PlanningPage";
import { PurchasePlanDetailPage } from "./pages/PurchasePlanDetailPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Lazy-loaded: pulls in tesseract.js (OCR engine), which is too heavy to ship
// in the main bundle for every visitor when only the share-target flow uses it.
const ShareTargetPage = lazy(() =>
  import("./pages/ShareTargetPage").then((m) => ({ default: m.ShareTargetPage })),
);

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="setup" element={<SetupPage />} />
        <Route element={<SpreadsheetRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="incomes" element={<IncomePage />} />
            <Route path="debtors" element={<DebtorsPage />} />
            <Route path="cards" element={<CardsPage />} />
            <Route path="recurrences" element={<TemplatesPage />} />
            <Route path="planning" element={<PlanningPage />} />
            <Route path="planning/:planId" element={<PurchasePlanDetailPage />} />
            <Route
              path="share-target"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ShareTargetPage />
                </Suspense>
              }
            />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
