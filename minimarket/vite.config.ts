import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"],
      manifest: {
        name: "Kasir Solo - Minimarket",
        short_name: "KasirMini",
        description: "POS Application for Minimarket",
        theme_color: "#F97316",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "logo.png", sizes: "192x192", type: "image/png" },
          { src: "logo.png", sizes: "512x512", type: "image/png" }
        ]
      },
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg}"] }
    })
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
});
