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
        // `injectManifest` (a hand-written src/sw.ts) instead of the default
        // `generateSW` — required to intercept the Android Web Share Target
        // POST below with a custom `fetch` handler; see src/sw.ts for the
        // precache + NetworkOnly rules that generateSW used to add for us.
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        },
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
          // Lets Android list the app in the image-sharing menu; the POST it
          // sends to `share-target` is caught by the fetch handler in src/sw.ts.
          share_target: {
            action: "share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              files: [{ name: "receipt", accept: ["image/*"] }],
            },
          },
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
