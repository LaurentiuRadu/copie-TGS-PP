console.log('[MAIN] Starting app initialization...');
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
console.log('[MAIN] Imports loaded successfully');
import App from "./App.tsx";
console.log('[MAIN] App component imported');
import "./index.css";
console.log('[MAIN] CSS imported');
import { registerServiceWorker, isStandalone } from "./lib/registerServiceWorker";
import { STALE_TIME } from "./lib/queryConfig";
console.log('[MAIN] All imports complete');

// Register Service Worker pentru PWA
console.log('[MAIN] Registering service worker...');
registerServiceWorker();

// Log dacă aplicația rulează în standalone mode (PWA instalată)
if (import.meta.env.DEV && isStandalone()) {
  console.info('🚀 PWA mode: standalone');
}
console.log('[MAIN] Service worker registered');

console.log('[MAIN] Creating QueryClient...');
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME.ADMIN_DATA,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
console.log('[MAIN] QueryClient created');

console.log('[MAIN] Getting root element...');
const rootElement = document.getElementById("root");
console.log('[MAIN] Root element:', rootElement);

if (!rootElement) {
  console.error('[MAIN] ERROR: Root element not found!');
  document.body.innerHTML = '<div style="padding: 20px; color: red;">ERROR: Root element #root not found in HTML!</div>';
  throw new Error('Root element not found');
}

console.log('[MAIN] Creating React root...');
const root = createRoot(rootElement);
console.log('[MAIN] Rendering app...');

root.render(
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
