#!/usr/bin/env bash
# =========================================================================
#  sync-to-mirror.sh — Salin file APLIKASI dari produksi -> folder mirror.
#
#  JALANKAN DARI FOLDER PRODUKSI KAKI5:
#     cd C:\Users\Admin\Documents\kasol\kaki5
#     bash sync-to-mirror.sh
#
#  Yang dilakukan:
#    1. Menghapus isi lama folder mirror kaki5.
#    2. Menyalin WHITE-LIST (hanya file aplikasi yang benar).
#    3. Sampah development (node_modules, tes, screenshot, report, dsb)
#       TIDAK PERNAH disalin => folder mirror pasti bersih.
#
#  Skrip ini hanya MENYALIN. Push ke GitHub dilakukan manual dari
#  folder mirror (C:\Users\Admin\Documents\GitHub\kasol).
# =========================================================================
set -euo pipefail

# Lokasi
PROD="$(cd "$(dirname "$0")" && pwd)"                                   # folder produksi kaki5
ROOT_REPO="$(cygpath -u "$USERPROFILE/Documents/GitHub/kasol" 2>/dev/null || echo "$HOME/Documents/GitHub/kasol")"
MIRROR="$ROOT_REPO/kaki5"

echo "▸ Produksi : $PROD"
echo "▸ Mirror   : $MIRROR"

# Sanity check: folder produksi harus modular (ada js/, css/, index.html)
[ -d "$PROD/js" ] || { echo "✗ Folder produksi bukan modular (tidak ada js/): $PROD"; exit 1; }
[ -d "$ROOT_REPO/.git" ] || { echo "✗ Root monorepo bukan repo git: $ROOT_REPO"; exit 1; }

# Bersihkan folder mirror kaki5 lalu buat ulang
echo "▸ Menghapus isi lama folder mirror kaki5..."
rm -rf "$MIRROR"
mkdir -p "$MIRROR"

# WHITE-LIST: file/folder aplikasi yang sah. Semua di luar ini TIDAK disalin.
ITEMS=(
  "index.html"
  "style.css"
  "sw.js"
  "manifest.json"
  "vercel.json"
  ".vercelignore"
  "dexie.min.js"      # perpustakaan Dexie (IndexedDB)
  "server.cjs"        # dev server lokal (port 8086)
  "README.md"
  "AGENTS.md"
  "CHANGELOG.md"
  "DESIGN.md"
  "assets"            # logo, icon, favicon, splash
  "css"               # modular CSS (base.css + components-*.css)
  "js"                # seluruh modul ES6+ (modular-atomic 3-layer)
  "docs"              # dokumentasi developer
)

echo "▸ Menyalin file aplikasi ke mirror..."
for it in "${ITEMS[@]}"; do
  if [ -e "$PROD/$it" ]; then
    cp -R "$PROD/$it" "$MIRROR/"
    echo "   ✓ $it"
  else
    echo "   ⚠ lewati (tidak ada di produksi): $it"
  fi
done

echo ""
echo "✓ Selesai menyinkronkan folder mirror."
echo "  Selanjutnya: buka folder mirror dan commit & push manual:"
echo "    cd C:\\Users\\Admin\\Documents\\GitHub\\kasol"
echo "    git add kaki5/"
echo "    git commit -m \"feat(kaki5): ...\""
echo "    git push origin main"