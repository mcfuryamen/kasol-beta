#!/bin/bash
# =============================================================================
# vercel-ignore.sh — Ignored Build Step untuk monorepo kasol
# Dipakai di Vercel: Settings > Git > Ignored Build Step > Command
#   bash ../vercel-ignore.sh
#
# Kontrak exit code Vercel:
#   exit 0 -> BATALKAN build (tidak ada perubahan di app ini)
#   exit 1 -> LANJUTKAN build (ada perubahan)
# Exit code lain dianggap error dan bisa menggagalkan deploy,
# jadi script ini WAJIB selalu keluar dengan 0 atau 1.
# =============================================================================

set +e

APP_DIR="$(basename "$PWD")"
echo "▸ Ignored Build Step untuk app: $APP_DIR"

# ---------------------------------------------------------------------------
# Kalau .git tidak tersedia (mis. dihapus .vercelignore), jangan tebak-tebak:
# lanjutkan build supaya tidak ada deploy yang hilang tanpa sebab.
# ---------------------------------------------------------------------------
if [ ! -d ../.git ]; then
  echo "⚠ .git tidak tersedia — tidak bisa membandingkan commit."
  echo "⚡ LANJUT build (fail-safe)."
  exit 1
fi

# Commit sebelumnya belum ada (build pertama / shallow clone tanpa parent)
if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "⚠ Commit induk (HEAD^) tidak ada — kemungkinan build pertama."
  echo "⚡ LANJUT build (fail-safe)."
  exit 1
fi

# ---------------------------------------------------------------------------
# Bandingkan HEAD^ vs HEAD, hanya untuk folder app ini
# ---------------------------------------------------------------------------
CHANGED="$(git diff --name-only HEAD^ HEAD -- . 2>/dev/null)"

if [ -n "$CHANGED" ]; then
  echo "⚡ Ada perubahan di $APP_DIR:"
  echo "$CHANGED" | sed 's/^/   • /'
  echo "⚡ LANJUT build."
  exit 1
fi

echo "✓ Tidak ada perubahan di $APP_DIR pada commit ini."
echo "✓ BATALKAN build (hemat kuota)."
exit 0
