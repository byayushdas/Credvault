import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": process.env.CREDVAULT_API_URL || "http://127.0.0.1:8000",
      "/health": process.env.CREDVAULT_API_URL || "http://127.0.0.1:8000",
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": process.env.CREDVAULT_API_URL || "http://127.0.0.1:8000",
      "/health": process.env.CREDVAULT_API_URL || "http://127.0.0.1:8000",
    },
  },
});
