import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
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
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "Finanças — Gestão Pessoal",
          short_name: "Finanças",
          lang: "pt-BR",
          description: "Gestão financeira pessoal com Google Sheets como base de dados.",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0f172a",
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "icons/icon-512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Google Sheets/Drive data must never be served stale from cache —
          // this app has no offline mode by design.
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith("googleapis.com") || url.hostname === "accounts.google.com",
              handler: "NetworkOnly",
            },
          ],
        },
      }),
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
