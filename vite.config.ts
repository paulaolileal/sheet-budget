import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_BASE_PATH ?? "/",
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "spa-404",
        closeBundle() {
          const outDir = "dist";
          const src = path.join(outDir, "index.html");
          const dest = path.join(outDir, "404.html");
          if (fs.existsSync(src)) fs.copyFileSync(src, dest);
        },
      },
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
      allowedHosts: true,
    },
    preview: {
      host: "::",
      port: 8080,
      strictPort: true,
      allowedHosts: true,
    },
  };
});
