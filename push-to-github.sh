#!/usr/bin/env bash
# =========================================================================
#  push-to-github.sh — Commit + push monorepo kasol ke GitHub cloud.
#
#  JALANKAN DARI ROOT MONOREPO KASOL:
#     cd C:\Users\Admin\Documents\GitHub\kasol
#     bash push-to-github.sh
#
#  Yang dilakukan:
#    1. Menampilkan perubahan yang siap di-commit (biar kamu bisa cek).
#    2. git add -A (monorepo: menangkap rosok + subrepo lain).
#    3. Commit dengan pesan otomatis berisi timestamp.
#    4. Push ke origin/main.
#
#  Vercel auto-deploy setelah push.
#  Gantikan GitHub Desktop: jalankan skrip ini untuk push ke cloud.
# =========================================================================
set -euo pipefail

cd "$(dirname "$0")"   # pastikan berada di root monorepo kasol
ROOT_REPO="$(pwd)"

echo "▸ Root monorepo: $ROOT_REPO"
[ -d ".git" ] || { echo "✗ Bukan repo git: $ROOT_REPO"; exit 1; }

# --- 1. Tampilkan ringkasan perubahan --------------------------------------
echo ""
echo "▸ Perubahan yang akan di-commit:"
git status --short
echo ""

# --- 2. Commit + push -------------------------------------------------------
STAMP="$(date '+%Y-%m-%d %H:%M')"

if [ -z "$(git status --porcelain)" ]; then
  echo "▸ Tidak ada perubahan untuk di-commit."
  exit 0
fi

git add -A
git commit -m "update: sinkronisasi produksi $STAMP"
echo "▸ Push ke origin/main..."
git push origin main

echo ""
echo "✓ Push selesai. Vercel akan auto-deploy."
echo "  Cek progres: https://console.vercel.com — project kasir-rosok"
