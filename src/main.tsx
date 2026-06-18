import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { App } from "./presentation/App";
import { ThemeProvider } from "./presentation/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

const TEN_MINUTES = 10 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: TEN_MINUTES,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "sheet-budget-query-cache",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: TEN_MINUTES, buster: "v1" }}
    >
      <ThemeProvider>
        <BrowserRouter basename={import.meta.env.VITE_BASE_PATH ?? "/"}>
          <App />
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </ThemeProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
