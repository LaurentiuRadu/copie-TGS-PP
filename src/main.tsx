import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, isStandalone } from "./lib/registerServiceWorker";

// Register Service Worker pentru PWA
registerServiceWorker();

// Log dacă aplicația rulează în standalone mode (PWA instalată)
if (isStandalone()) {
  console.log('🚀 Aplicația rulează în modul standalone (PWA instalată)');
}

// Force rebuild to apply React deduplication
createRoot(document.getElementById("root")!).render(<App />);
