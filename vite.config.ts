import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      { find: /^@\/integrations\/supabase\/client(?:\.ts)?$/, replacement: path.resolve(__dirname, "./src/integrations/supabase/client-runtime.ts") },
      { find: /^src\/integrations\/supabase\/client(?:\.ts)?$/, replacement: path.resolve(__dirname, "./src/integrations/supabase/client-runtime.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
    dedupe: ["react", "react-dom"],
  },
}));
