import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5410 },
  build: { chunkSizeWarningLimit: 1200 },
});
