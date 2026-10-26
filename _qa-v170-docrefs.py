# -*- coding: utf-8 -*-
"""QA v170: sinkronkan rujukan baris + penomoran aturan di AGENTS.md & DEVELOPER.md."""
import io, sys

PAIRS = {
r"C:\Users\Admin\Documents\kasol\kaki5\AGENTS.md": [
    ("3. **`escapeHtml` / `buildSafeHtml` untuk SEMUA nilai dinamis**",
     "4. **`escapeHtml` / `buildSafeHtml` untuk SEMUA nilai dinamis**"),
    ("4. **Rilis = bump 6 slot sinkron**", "5. **Rilis = bump 6 slot sinkron**"),
    ("tidak invalid. Insiden tercatat: `CHANGELOG.md:95`.",
     "tidak invalid. Insiden tercatat: `CHANGELOG.md:327`."),
    ("5. **`app-state.js` read-only.**", "6. **`app-state.js` read-only.**"),
    ("6. **Migrasi DB bersifat aditif", "7. **Migrasi DB bersifat aditif"),
    ("7. **SW punya 3 strategi, bukan satu.** `/supabase.co` \u2192 network-only (`sw.js:242`);\n   HTML \u2192 **cache-first** supaya bisa navigasi offline (`sw.js:253`); aset statis \u2192\n   network-first dengan fallback cache (`sw.js:273`).",
     "8. **SW punya 3 strategi, bukan satu.** `/supabase.co` \u2192 network-only (`sw.js:281`);\n   HTML \u2192 **cache-first** supaya bisa navigasi offline (`sw.js:292`); aset statis \u2192\n   network-first dengan fallback cache (`sw.js:312`)."),
    ("8. **Cloud = sumber kebenaran untuk lisensi & profil**", "9. **Cloud = sumber kebenaran untuk lisensi & profil**"),
    ("9. **Keputusan pemilik soal gerbang lisensi (2026-08-29):**", "10. **Keputusan pemilik soal gerbang lisensi (2026-08-29):**"),
    ("(`js/app.js:260-276`, `js/pos.js:552-557`)", "(`js/app.js:260-276`, `js/pos.js:566-573`)"),
    ("10. **Fitur kas bisa dimatikan user.** Gerbang `fiturKasAktif()` ada di `js/kas.js:136,\n    158, 218, 273, 329, 374` dan `js/pos.js:529`.",
     "11. **Fitur kas bisa dimatikan user.** Gerbang `fiturKasAktif()` ada di `js/kas.js:136,\n    158, 231, 286, 342, 468`, `js/pos.js:409` (buka tab Jualan \u2192 munculkan modal Buka Kas,\n    v169), dan `js/pos.js:545` (guard `simpanPenjualan`)."),
    ("- **Bukti rilis = 4 jalur independen**, bukan output git: `ls-remote`, `fetch` +\n  `FETCH_HEAD`, API `curl.exe`, dan **isi file di `raw.githubusercontent.com`**.\n  `gh api` rusak di mesin ini \u2014 pakai `curl.exe -s --noproxy '*'`.",
     "- **Bukti rilis = 5 jalur independen**, bukan output git: `ls-remote`, `fetch` +\n  `FETCH_HEAD`, API `curl.exe`, **isi file di `raw.githubusercontent.com`**, dan **konten\n  yang benar-benar terhidang** di domain-nya (`/js/version.json`, `/sw.js`, `/`).\n  `gh api` rusak di mesin ini \u2014 pakai `curl.exe -s --noproxy '*'`.\n- **URL BETA bukan dari field `homepage` repo.** `homepage` `kasol-beta` menunjuk\n  `kaki5beta.vercel.app` yang 404 semua path; yang benar `https://kq5beta.vercel.app`\n  (cek `vercel project ls`). Jangan fetch `/index.html` di Vercel \u2014 ia 308 ke `/`."),
    ("| `test-data-actions.js`, `test-html-refs.js`, `test-modules.js` | \u274c **merah sejak rilis 1.0.97** \u2014 bukan regresi baru |",
     "| `test-data-actions.js`, `test-html-refs.js`, `test-modules.js` | \u274c **merah sejak rilis 1.0.97** \u2014 bukan regresi baru (dikonfirmasi ulang di v170: sinyal identik) |"),
],
r"C:\Users\Admin\Documents\kasol\kaki5\docs\DEVELOPER.md": [
    ("terdeteksi dinamis dari `renderPOSError('retry-pos')` (`pos.js:366,420`). Komentar",
     "terdeteksi dinamis dari `renderPOSError('retry-pos')` (`pos.js:374,436`). Komentar"),
],
}

fail = []
for path, pairs in PAIRS.items():
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        src = f.read()
    for old, new in pairs:
        n = src.count(old)
        if n != 1:
            fail.append("%s :: count=%d :: %s" % (path.split("\\")[-1], n, old[:64]))
            continue
        src = src.replace(old, new, 1)
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(src)

if fail:
    print("\n".join(fail)); sys.exit(1)
print("OK semua rujukan baris AGENTS.md + DEVELOPER.md tersinkron")
