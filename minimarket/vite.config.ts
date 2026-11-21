import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

/**
 * Injeksi Content-Security-Policy HANYA saat build produksi.
 * Dev sengaja tanpa CSP — toolchain HMR (inline module refresh) dan overlay
 * error butuh kebebasan yang tidak perlu di produksi.
 * script-src 'self' = pemblokir utama script injeksi (XSS).
 */
function cspPlugin(): Plugin {
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml(html) {
      const csp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'", // gaya inline konten struk (jendela cetak) & style props Preact
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self' https: wss: ws:", // Supabase (REST + realtime) & HMR
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; ");
      const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}" />`;
      return html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    ' + meta);
    },
  };
}

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 8087,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8087,
    strictPort: true,
  },
  plugins: [
    cspPlugin(),
    preact(),
    VitePWA({
      // "prompt" (bukan autoUpdate): versi baru TIDAK mengambil alih aplikasi
      // otomatis — pasang hanya lewat overlay OKE (pola kaki5). autoUpdate
      // membuat SW reload aplikasi di tengah transaksi kasir.
      registerType: "prompt",
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
