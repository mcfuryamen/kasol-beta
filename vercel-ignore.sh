#!/bin/bash

# vercel-ignore.sh
# Dipakai di Vercel Settings > Git > Ignored Build Step
# Command: bash ../vercel-ignore.sh

echo "Checking for changes in current directory..."

# Cek apakah ada perubahan di folder saat ini dibanding commit sebelumnya
git diff --quiet HEAD^ HEAD .

# Exit code 1 (ada perubahan) -> Vercel lanjut build
# Exit code 0 (tidak ada perubahan) -> Vercel batalkan build
if [ $? -eq 0 ]; then
  echo "✓ No changes in this app. Skipping build."
  exit 0
else
  echo "⚡ Changes detected. Proceeding with build."
  exit 1
fi
