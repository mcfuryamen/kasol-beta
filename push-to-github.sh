#!/usr/bin/env bash
# =========================================================================
#  push-to-github.sh — Commit dan push seluruh perubahan di mirror ke GitHub.
#
#  JALANKAN DARI ROOT MONOPOLI KASOL:
#     cd C:\Users\Admin\Documents\kasol
#     bash push-to-github.sh
#
#  Yang dilakukan:
#    1. Menambahkan semua perubahan di mirror (git add -A).
#    2. Commit dengan pesan standar atau yang dapat diinput pengguna.
#    3. Push ke origin/main.
#
#  Catatan:
#    - Tidak ada auto-commit; user harus memberikan persetujuan secara eksplisit.
#    - Push ke GitHub akan memicu Vercel untuk auto-deploy masing-masing aplikasi
#      karena masing-masing aplikasi terkonfigurasi sebagai project terpisah di Vercel
#      dengan Root Directory = folder aplikasi (mis. retail/).
# =========================================================================
set -euo pipefail

# Lokasi root monorepo
ROOT_REPO="$(cd "$(dirname "$0")" && pwd)"
echo "���▸ Root monorepo: $ROOT_REPO"

# Pastikan kita berada di dalam repo git
[ -d "$ROOT_REPO/.git" ] || { echo "������✗ Bukan direktori Git: $ROOT_REPO"; exit 1; }

# Tampilkan status singkat
echo "���▸ Status git sebelum add:"
git status --porcelain | head -20
echo ""

# Tambahkan semua perubahan
echo "���▸ Menambahkan semua perubahan di mirror..."
git add -A

# Tampilkan apa yang akan di-commit
echo "���▸ File yang akan di-commit:"
git diff --cached --name-only | head -20
echo ""

# Mintakan pesan commit
echo "���▸ Masukkan pesan commit (atau tekan Enter untuk default):"
read -r commit_msg
if [ -z "$commit_msg" ]; then
    commit_msg="chore: update retail mirror $(date +'%Y-%m-%d %H:%M')"
fi

echo ""
echo "���▸ Commit: $commit_msg"
git commit -m "$commit_msg"

# Push ke origin/main
echo "���▸ Push ke origin/main..."
git push origin main

echo ""
echo "������✓ Push selesai. Vercel akan otomatis mendeploy perubahan."
echo "  Untuk monitoring deployment, buka dashboard Vercel."