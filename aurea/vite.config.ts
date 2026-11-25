import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5179 },
  build: { rollupOptions: { input: { main: "index.html", atelier: "atelier.html" } } },
});
