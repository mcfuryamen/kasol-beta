#!/usr/bin/env bash
# =========================================================================
#  sync-to-mirror.sh — Salin file APLIKASI dari produksi -> folder mirror.
#
#  JALANKAN DARI FOLDER PRODUKSI RETAIL:
#     cd C:\Users\Admin\Documents\kasol\retail
#     bash sync-to-mirror.sh
#
#  Yang dilakukan:
#    1. Menghapus isi lama folder mirror retail.
#    2. Menyalin WHITE-LIST (hanya file aplikasi yang benar).
#    3. Sampah development (node_modules, tes, screenshot, report, dsb)
#       TIDAK PERNAH disalin => folder mirror pasti bersih.
#
#  Skrip ini hanya MENYALIN. Push ke GitHub dilakukan oleh skrip
#  push-to-github.sh di root monorepo kasol.
# =========================================================================
set -euo pipefail

# Lokasi
PROD="$(cd "$(dirname "$0")" && pwd)"                                   # folder produksi retail
ROOT_REPO="$(cygpath -u "$USERPROFILE/Documents/GitHub/kasol" 2>/dev/null || echo "$HOME/Documents/GitHub/kasol")"
MIRROR="$ROOT_REPO/retail"

echo "�▸ Produksi : $PROD"
echo "�▸ Mirror   : $MIRROR"

# Sanity check: folder produksi harus memiliki index.html dan style.css (minimal)
[ -f "$PROD/index.html" ] || { echo "��✗ File index.html tidak ada di produksi: $PROD"; exit 1; }
[ -d "$ROOT_REPO/.git" ] || { echo "��✗ Root monorepo bukan repo git: $ROOT_REPO"; exit 1; }

# Bersihkan folder mirror retail lalu buat ulang
echo "�▸ Menghapus isi lama folder mirror retail..."
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
  "openBarcodeFix.js" # fix barcode scanner di mobile
  "README.md"
  "AGENTS.md"
  "CHANGELOG.md"
  "AUDIT_REPORT.md"
  "assets"            # logo, icon, favicon, splash
)

echo "�▸ Menyalin file aplikasi ke mirror..."
for it in "${ITEMS[@]}"; do
  if [ -e "$PROD/$it" ]; then
    cp -R "$PROD/$it" "$MIRROR/"
    echo "   � ✓ $it"
  else
    echo "   �� ⚠ lewati (tidak ada di produksi): $it"
  fi
done

echo ""
echo "��✓ Selesai menyinkronkan folder mirror."
echo "  Selanjutnya: buka folder mirror dan jalankan push-to-github.sh"
echo "  (atau pakai GitHub Desktop seperti biasa)"