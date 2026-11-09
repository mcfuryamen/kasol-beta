import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Dikunci ke WIB agar tes zona waktu benar-benar menguji skenario produksi:
    // bug "hari ini" muncul justru karena toko berada di UTC+7.
    env: { TZ: "Asia/Jakarta" },
  },
});
