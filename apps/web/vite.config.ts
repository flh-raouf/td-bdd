import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("@codemirror") ||
            id.includes("@uiw/react-codemirror")
          ) {
            return "vendor-codemirror";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname ?? ".", "src"),
    },
  },
  server: {
    proxy: {
      "/trpc": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (url) => url.replace(/^\/trpc/, ""),
      },
    },
  },
});
