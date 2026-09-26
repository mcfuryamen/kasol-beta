# -*- coding: utf-8 -*-
"""QA v170: pasang pola gradasi rosok ke permukaan terisi kaki5.
Setiap pasangan harus ketemu TEPAT sekali; kalau tidak, tidak ada yang ditulis."""
import io, sys

P = r"C:\Users\Admin\Documents\kasol\kaki5\css\style.css"

EDITS = [
    # header
    ("height:var(--header-h);background:linear-gradient(135deg,var(--primary),var(--primary-light));color:#fff;",
     "height:var(--header-h);background:var(--grad);color:#fff;"),
    # indikator tab aktif
    ("height:3px;background:var(--primary);border-radius:0 0 4px 4px}",
     "height:3px;background:var(--grad);border-radius:0 0 4px 4px}"),
    # tombol
    (".btn-primary{background:var(--primary);color:#fff}",
     ".btn-primary{background:var(--grad);color:#fff;box-shadow:var(--shadow-brand)}"),
    (".btn-primary:active{background:var(--primary-dark);transform:scale(.97)}",
     ".btn-primary:active{filter:brightness(.92);transform:scale(.97)}"),
    (".btn-green{background:var(--green);color:#fff}",
     ".btn-green{background:var(--grad-green);color:#fff}"),
    (".btn-green:active{background:#1B5E20;transform:scale(.97)}",
     ".btn-green:active{filter:brightness(.92);transform:scale(.97)}"),
    (".btn-red{background:var(--red);color:#fff}",
     ".btn-red{background:var(--grad-red);color:#fff}"),
    (".btn-red:active{background:#8E0000;transform:scale(.97)}",
     ".btn-red:active{filter:brightness(.92);transform:scale(.97)}"),
    (".btn-orange{background:var(--orange,#ff8a3d);color:#fff}",
     ".btn-orange{background:var(--grad);color:#fff}"),
    # FAB
    ("border-radius:50%;background:var(--primary);color:#fff;border:none;font-size:32px;cursor:pointer;box-shadow:0 4px 16px rgba(230,81,0,.4);",
     "border-radius:50%;background:var(--grad);color:#fff;border:none;font-size:32px;cursor:pointer;box-shadow:var(--shadow-brand);"),
    # tab kategori
    (".cat-tab.active{background:var(--primary);color:#fff;border-color:var(--primary)}",
     ".cat-tab.active{background:var(--grad);color:#fff;border-color:var(--primary-dark)}"),
    # banner profil
    ("max-width:420px;background:linear-gradient(165deg,var(--primary),#F57C00);color:#fff;",
     "max-width:420px;background:var(--grad);color:#fff;"),
    # pemilih tanggal
    (".date-nav .cal-cell.sel{background:var(--primary);color:#fff}",
     ".date-nav .cal-cell.sel{background:var(--grad);color:#fff}"),
    (".date-nav .week-opt.sel{border-color:var(--primary);background:var(--primary);color:#fff}",
     ".date-nav .week-opt.sel{border-color:var(--primary-dark);background:var(--grad);color:#fff}"),
    (".date-nav .month-opt.sel{border-color:var(--primary);background:var(--primary);color:#fff}",
     ".date-nav .month-opt.sel{border-color:var(--primary-dark);background:var(--grad);color:#fff}"),
    # lisensi + keranjang + held + badge + saklar
    (".btn-extend{background:linear-gradient(135deg,var(--green),var(--green-light));",
     ".btn-extend{background:var(--grad-green);"),
    ("min-width:0;background:var(--green);color:#fff;border-radius:16px;",
     "min-width:0;background:var(--grad-green);color:#fff;border-radius:16px;"),
    ("border-radius:50%;background:var(--orange,#ff8a3d);color:#fff;border:none;box-shadow:0 6px 18px rgba(0,0,0,.28);",
     "border-radius:50%;background:var(--grad);color:#fff;border:none;box-shadow:var(--shadow-brand);"),
    (".held-name-badge{background:var(--orange,#ff8a3d);color:#fff;",
     ".held-name-badge{background:var(--grad);color:#fff;"),
    (".badge-titipan{display:inline-block;background:var(--primary);color:#fff;",
     ".badge-titipan{display:inline-block;background:var(--grad);color:#fff;"),
    (".toggle-switch input:checked+.toggle-slider{background:var(--primary)}",
     ".toggle-switch input:checked+.toggle-slider{background:var(--grad)}"),
]

KPI_ANCHOR = (".kbg-green-b{background:var(--green-bg);border-color:#A5D6A7}"
              ".kbg-red-b{background:var(--red-bg);border-color:#EF9A9A}"
              ".kbg-blue-b{background:var(--blue-bg);border-color:#90CAF9}"
              ".kbg-orange-b{background:var(--orange-bg);border-color:#FFCC80}")

KPI_BLOCK = KPI_ANCHOR + """
/* v170: kartu statistik Beranda ikut pola gradasi rosok (KPI card, rosok/style.css:142-166).
   Selector digabung .stat-card.kbg-* — kelas kbg-* yang sama dipakai 18 .setting-icon di
   halaman Pengaturan, dan tile ikon itu harus TETAP pastel. Spesifisitas (0,3,0) di bawah
   ini mengalahkan .stat-value.green (0,2,0), jadi angka ikut jadi putih. */
.stat-card.kbg-green-b{background:var(--grad-green);border-color:transparent}
.stat-card.kbg-red-b{background:var(--grad-red);border-color:transparent}
.stat-card.kbg-blue-b{background:var(--grad-blue);border-color:transparent}
.stat-card.kbg-orange-b{background:var(--grad-kpi-orange);border-color:transparent}
.stat-card.kbg-green-b .stat-label,.stat-card.kbg-red-b .stat-label,.stat-card.kbg-blue-b .stat-label,.stat-card.kbg-orange-b .stat-label{color:rgba(255,255,255,.9)}
.stat-card.kbg-green-b .stat-value,.stat-card.kbg-red-b .stat-value,.stat-card.kbg-blue-b .stat-value,.stat-card.kbg-orange-b .stat-value{color:#fff}"""

with io.open(P, "r", encoding="utf-8", newline="") as f:
    src = f.read()

bad = []
for old, new in EDITS:
    n = src.count(old)
    if n != 1:
        bad.append((n, old[:70]))
if src.count(KPI_ANCHOR) != 1:
    bad.append((src.count(KPI_ANCHOR), "KPI_ANCHOR"))
if bad:
    for n, s in bad:
        print("MISMATCH count=%d :: %s" % (n, s))
    sys.exit(1)

for old, new in EDITS:
    src = src.replace(old, new, 1)
src = src.replace(KPI_ANCHOR, KPI_BLOCK, 1)

with io.open(P, "w", encoding="utf-8", newline="") as f:
    f.write(src)
print("OK %d penggantian + blok KPI terpasang" % (len(EDITS) + 1))
