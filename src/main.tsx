import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, isStandalone } from "./lib/registerServiceWorker";

// Register Service Worker pentru PWA
registerServiceWorker();

// Log dacă aplicația rulează în standalone mode (PWA instalată)
if (import.meta.env.DEV && isStandalone()) {
  console.info('🚀 PWA mode: standalone');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <App />
          <Toaster />
          <Sonner />
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
