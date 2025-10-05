import React, { StrictMode, Component, ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import App from "./App";
import "./index.css";
import { registerServiceWorker, isStandalone } from "./lib/registerServiceWorker";

// Error Boundary for React initialization errors
class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 React Error Boundary caught error:', error, errorInfo);
    
    // Check if it's the specific "dispatcher is null" error
    if (error.message?.includes('dispatcher is null') || 
        error.message?.includes('Invalid hook call')) {
      console.error('⚠️ CRITICAL: Multiple React instances detected!');
      console.error('Attempting automatic recovery...');
      
      // Clear all caches and reload
      if ('caches' in window) {
        caches.keys().then(keys => {
          Promise.all(keys.map(key => caches.delete(key))).then(() => {
            console.log('✅ All caches cleared, reloading...');
            (window as Window).location.reload();
          });
        });
      }
    }
  }

  handleReload = () => {
    // Hard reload with cache clear
    if ('caches' in window) {
      caches.keys().then(keys => {
        Promise.all(keys.map(key => caches.delete(key))).then(() => {
          (window as Window).location.reload();
        });
      });
    } else {
      (window as Window).location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">⚠️</div>
              <h1 className="text-xl font-bold text-foreground">Eroare de Inițializare</h1>
              <p className="text-sm text-muted-foreground">
                Aplicația a întâmpinat o eroare la pornire. Vă rugăm să reîncărcați pagina.
              </p>
            </div>
            
            {this.state.error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3">
                <p className="text-xs font-mono text-destructive">
                  {this.state.error.message}
                </p>
              </div>
            )}
            
            <button
              onClick={this.handleReload}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 px-4 rounded-md transition-colors"
            >
              Reîncarcă Aplicația
            </button>
            
            <p className="text-xs text-center text-muted-foreground">
              Dacă problema persistă, folosiți butonul "Clear All Data" din Settings.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


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

// CRITICAL: Enhanced diagnostics for React instance
console.log('🔍 React version:', React.version);

// Log Vite module information to detect duplicate React modules
if (import.meta.env.DEV) {
  try {
    const reactModule = (window as any)['__vite_react_module'];
    console.log('🔍 React module ID:', reactModule?.id || 'not available');
    console.log('🔍 Vite React chunks:', Object.keys((window as any).__vite_modules || {}).filter(k => k.includes('react')).slice(0, 5));
  } catch (e) {
    console.log('⚠️ Could not inspect Vite modules:', e);
  }
}

// Check for multiple React instances (CRITICAL ERROR)
const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
if (hook) {
  const renderersCount = hook.renderers?.size || 0;
  console.log('🔍 React renderers count:', renderersCount, '(should be 1)');
  
  if (renderersCount > 1) {
    console.error('🚨 CRITICAL: Multiple React instances detected!');
    console.error('This will cause "Invalid hook call" errors.');
    console.error('Attempting cache clear...');
    
    // Auto-recovery: Clear caches
    if ('caches' in window) {
      caches.keys().then(keys => {
        Promise.all(keys.map(key => caches.delete(key))).then(() => {
          console.log('✅ Caches cleared. Please reload manually.');
        });
      });
    }
  } else {
    console.log('✅ Single React instance confirmed');
  }
}

// Pre-render verification
console.log('✅ Pre-render checks passed, initializing AuthProvider...');

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
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  </StrictMode>,
);
