"""Kompresi aset foto web-masjid (audit P3.4) — versi adaptive.

Menulis hasil ke _audit/kompresi/ dulu supaya bisa dibandingkan sebelum
menimpa asli. Untuk tiap file: turunkan lebar secara bertahap lalu cari
kualitas tertinggi yang memenuhi target ukuran. PSNR diukur terhadap
versi berukuran sama sehingga mencerminkan kualitas kompresi JPEG-nya.
"""
import io
import math
import os

from PIL import Image, ImageChops, ImageStat, ImageOps

ASSETS = r"C:\Users\Admin\Documents\kasol\masjid\web-masjid\assets"
OUT = r"C:\Users\Admin\Documents\kasol\masjid\_audit\kompresi"
os.makedirs(OUT, exist_ok=True)

# nama file -> (target KB, lebar awal, lebar minimum)
TARGETS = {
    "hero.jpg":     (90,  1400, 1000),
    "galeri-1.jpg": (180, 1400, 900),
    "galeri-2.jpg": (150, 1400, 800),
    "galeri-3.jpg": (130, 1400, 1000),
    "galeri-4.jpg": (150, 1400, 1000),
}
MIN_Q = 58


def encode(img, q):
    buf = io.BytesIO()
    # subsampling=2 (4:2:0) = standar web, jauh lebih kecil untuk foto
    img.save(buf, "JPEG", quality=q, optimize=True, progressive=True, subsampling=2)
    return buf.getvalue()


def psnr(a, b):
    diff = ImageChops.difference(a, b)
    rms = ImageStat.Stat(diff).rms
    mse = sum(v * v for v in rms) / len(rms)
    return 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)


print(f"{'file':16} {'asli':>7} {'hasil':>7} {'q':>3} {'lebar':>11} {'PSNR':>7}")
for name, (target_kb, w_start, w_min) in TARGETS.items():
    src = os.path.join(ASSETS, name)
    asli_kb = os.path.getsize(src) / 1024
    base = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    ow, oh = base.size

    chosen = None
    w = w_start
    while w >= w_min:
        h = round(oh * w / ow)
        cand_img = base.resize((w, h), Image.LANCZOS) if w != ow else base
        for q in range(85, MIN_Q - 1, -1):
            data = encode(cand_img, q)
            if len(data) <= target_kb * 1024:
                chosen = (w, q, cand_img, data)
                break
        if chosen:
            break
        w -= 200

    if chosen is None:
        w = w_min
        h = round(oh * w / ow)
        cand_img = base.resize((w, h), Image.LANCZOS)
        chosen = (w, MIN_Q, cand_img, encode(cand_img, MIN_Q))

    w, q, cand_img, data = chosen
    # Jangan menambah beban: kalau hasil tidak lebih kecil dari asli, biarkan.
    if len(data) >= os.path.getsize(src):
        print(f"{name:16} {asli_kb:6.0f}K {'dipertahankan':>7} (asli sudah paling kecil)")
        continue
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(data)

    hasil = Image.open(io.BytesIO(data)).convert("RGB")
    print(f"{name:16} {asli_kb:6.0f}K {len(data)/1024:6.0f}K {q:3d} "
          f"{ow}x{oh}->{cand_img.width}x{cand_img.height} {psnr(cand_img, hasil):6.1f}dB")
