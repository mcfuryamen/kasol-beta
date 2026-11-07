#!/usr/bin/env bash
# =========================================================================
#  deploy-gh.sh — Rosok: salin produksi -> mirror GitHub, commit, push.
#
#  MENGGANTIKAN GitHub Desktop untuk alur "edit produksi -> push ke GitHub".
#  Vercel auto-deploy setelah push. Jalankan dari folder produksi rosok.
#
#  Struktur repo git ada di ROOT kasol:
#    C:\Users\Admin\Documents\GitHub\kasol  (git remote: mcfuryamen/kasol.git, branch main)
#  Folder mirror rosok yang di-deploy:
#    C:\Users\Admin\Documents\GitHub\kasol\rosok
#
#  WHITE-LIST: hanya file aplikasi modular yang disalin, sampah dev TIDAK ikut.
# =========================================================================
set -euo pipefail

# --- 1. Lokasi ------------------------------------------------------------
PROD="$(cd "$(dirname "$0")" && pwd)"                 # folder produksi rosok
ROOT_REPO="$(cygpath -u "$USERPROFILE/Documents/GitHub/kasol" 2>/dev/null || echo "$HOME/Documents/GitHub/kasol")"
MIRROR="$ROOT_REPO/rosok"

echo "▸ Produksi : $PROD"
echo "▸ Mirror   : $MIRROR"
echo "▸ Git root : $ROOT_REPO"

# --- 2. Sanity check ------------------------------------------------------
[ -d "$ROOT_REPO/.git" ] || { echo "✗ Bukan repo git: $ROOT_REPO"; exit 1; }
[ -d "$PROD/js" ]        || { echo "✗ Folder produksi bukan modular (tidak ada js/): $PROD"; exit 1; }

# --- 3. Bersihkan folder mirror rosok --------------------------------------
echo "▸ Menghapus isi lama folder mirror..."
rm -rf "$MIRROR"
mkdir -p "$MIRROR"

# --- 4. Salin white-list dari produksi ke mirror ---------------------------
# File & folder inti aplikasi modular. Tambah/kurangi sesuai kebutuhan.
ITEMS=(
  "index.html"
  "style.css"
  "sw.js"
  "manifest.json"
  "vercel.json"
  ".vercelignore"
  "dexie.min.js"
  "run-local.js"
  "README.md"
  "AGENTS.md"
  "CHANGELOG.md"
  "assets"
  "js"
)

echo "▸ Menyalin file aplikasi..."
for it in "${ITEMS[@]}"; do
  if [ -e "$PROD/$it" ]; then
    cp -R "$PROD/$it" "$MIRROR/"
    echo "   ✓ $it"
  else
    echo "   ⚠ lewati (tidak ada): $it"
  fi
done

# --- 5. Commit + push dari root repo ---------------------------------------
cd "$ROOT_REPO"
STAMP="$(date '+%Y-%m-%d %H:%M')"

if [ -z "$(git status --porcelain)" ]; then
  echo "▸ Tidak ada perubahan untuk di-commit."
else
  echo "▸ Menambahkan & commit..."
  git add -A
  git commit -m "rosok: update produksi $STAMP" || { echo "✗ commit gagal"; exit 1; }
  echo "▸ Push ke origin/main..."
  git push origin main
  echo "✓ Push selesai. Vercel akan auto-deploy."
fi

echo ""
echo "✓ Selesai. Cek: https://console.vercel.com — project kasir-rosok"
