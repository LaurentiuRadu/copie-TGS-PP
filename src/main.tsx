import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, isStandalone } from "./lib/registerServiceWorker";
import { STALE_TIME } from "./lib/queryConfig";

// Register Service Worker pentru PWA
registerServiceWorker();

// Log dacă aplicația rulează în standalone mode (PWA instalată)
if (import.meta.env.DEV && isStandalone()) {
  console.info('🚀 PWA mode: standalone');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME.ADMIN_DATA,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="app-theme">
            <App />
            <Toaster />
            <Sonner />
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
