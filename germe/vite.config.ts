import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5412 },
  // three.js pèse à lui seul plus de 500 ko : on relève le seuil d'alerte.
  build: { chunkSizeWarningLimit: 1000 },
});
