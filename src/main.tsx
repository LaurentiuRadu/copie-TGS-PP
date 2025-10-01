import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force rebuild to apply React deduplication
createRoot(document.getElementById("root")!).render(<App />);
