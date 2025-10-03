import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import App from "./App";
import "./index.css";
import { registerServiceWorker, isStandalone } from "./lib/registerServiceWorker";


if (import.meta.env.PROD) {
  registerServiceWorker();
} else {
  // In dev, unregister any existing service workers to avoid caching dev bundles
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    // Clear caches that might contain old Vite deps
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }
}
if (import.meta.env.DEV && isStandalone()) {
  console.info('🚀 PWA mode: standalone');
}

// Diagnostics for React instance
if (import.meta.env.DEV) {
  console.log('🔍 React version:', React.version);
  import('react-dom').then((ReactDOM) => {
    console.log('🔍 ReactDOM version:', ReactDOM.version);
  });
  const renderersCount = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size;
  console.log('🔍 React renderers count:', renderersCount || 0, '(should be 1)');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
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
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
