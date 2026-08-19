# Deploy Preview ke kaki5.vercel.app - Setup Guide
# ================================================
# Langkah-langkah untuk mengaktifkan auto-deploy dari branch preview ke kaki5.vercel.app

## 1. Dapatkan Vercel Token (satu kali saja)
Jalankan di terminal PowerShell:
  npx vercel login
# Pilih GitHub → authorize di browser → selesai

Setelah login, ambil token:
  npx vercel token list
# Copy token yang paling baru (prefix: vca_)

ATAU buat token baru khusus CI/CD:
  npx vercel tokens add CI-kaki5-preview

## 2. Set GitHub Secrets
Masuk ke: https://github.com/mcfuryamen/kasol/settings/secrets/actions/new

Buat 3 secrets:

  Name: VERCEL_TOKEN
  Value: [token dari langkah 1, prefix vca_]

  Name: VERCEL_ORG_ID
  Value: team_VPDFCbDl3nLlG8rmsam7Px7H

  Name: VERCEL_PROJECT_ID
  Value: prj_TqDGwweClzM6DTo2k4zeooeLjxXO

## 3. Commit & Push workflow
  git add .github/workflows/deploy-preview.yml
  git commit -m "ci: auto-deploy preview to kaki5.vercel.app"
  git push origin preview

## 4. Cek di GitHub Actions
Buka: https://github.com/mcfuryamen/kasol/actions
Workflow akan jalan otomatis saat push ke branch preview.

## Info Project Vercel (sudah ter-link)
  Project: kaki5
  Org: mcfury (team_VPDFCbDl3nLlG8rmsam7Px7H)
  Project ID: prj_TqDGwweClzM6DTo2k4zeooeLjxXO
  Domain target: https://kaki5.vercel.app
  Branch target: preview
