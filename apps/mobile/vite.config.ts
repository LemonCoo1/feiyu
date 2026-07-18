import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = parseInt(process.env.VITE_PORT || "1421", 10);
const apiBase = process.env.VITE_API_BASE_URL || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: apiBase,
        changeOrigin: true,
      },
    },
  },
});
