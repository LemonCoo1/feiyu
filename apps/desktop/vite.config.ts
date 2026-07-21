import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;
const port = parseInt(process.env.VITE_PORT || "1420", 10);
const apiBase = process.env.VITE_API_BASE_URL || "http://localhost:3000";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: port,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
    proxy: {
      "/api": {
        target: apiBase,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-icons": ["lucide-react"],
          "vendor-i18n": [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
          ],
          "vendor-tauri": [
            "@tauri-apps/api",
            "@tauri-apps/plugin-fs",
            "@tauri-apps/plugin-shell",
            "@tauri-apps/plugin-sql",
          ],
        },
      },
    },
  },
}));
