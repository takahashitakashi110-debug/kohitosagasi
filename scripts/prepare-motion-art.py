"""Prepare Runway motion sheets: python scripts/prepare-motion-art.py kohitos.png adults.png [flag.png].

Pillow is a build-time tool only. Coordinates correspond to the inspected originals.
All four frames in a row share a scale and foot baseline; no per-frame zoom.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'src/assets/motion'


def key_image(path):
    im = Image.open(path).convert('RGBA')
    data = []
    for r, g, b, a in im.getdata():
        excess = max(0, min(r, b) - g)
        # Runway may render a warmer pink matte than #ff00ff. Remove that
        # saturated backing too, rather than assuming its blue channel is 255.
        if excess > 70 and r > 140 and b > 100:
            r = g = b = a = 0
        elif excess > 45:
            a = 255 - excess
            if a < 45:
                a = 0
            if a:
                r, g, b = [max(0, min(255, round(v * 255 / a))) for v in (r - excess, g, b - excess)]
            else:
                r = g = b = 0
        data.append((r, g, b, a))
    im.putdata(data)
    return im


def sheet(im, xs, ys, name, replacement=None):
    atlas = Image.new('RGBA', (1024, (len(ys) - 1) * 256))
    for row, (top, bottom) in enumerate(zip(ys, ys[1:])):
        crops = [im.crop((left, top, right, bottom)) for left, right in zip(xs, xs[1:])]
        if row == 3 and replacement:
            w, h = replacement.size
            cuts = [0, 900, 1570, 2420, 3136]
            crops = [replacement.crop((cuts[i], 0, cuts[i + 1], h)) for i in range(4)]
        crops = [c.crop(c.getbbox()) for c in crops]
        width = max(c.width for c in crops)
        height = max(c.height for c in crops)
        for col, crop in enumerate(crops):
            padded = Image.new('RGBA', (width, height))
            padded.paste(crop, ((width - crop.width) // 2, height - crop.height))
            padded = padded.resize((248, 248), Image.Resampling.LANCZOS)
            atlas.paste(padded, (col * 256 + 4, row * 256 + 4))
    OUT.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT / name, quality=95, method=6)


if __name__ == '__main__':
    flag = key_image(sys.argv[3]) if len(sys.argv) > 3 else None
    sheet(key_image(sys.argv[1]), [0, 470, 880, 1320, 1728],
          [0, 290, 650, 920, 1270, 1630, 2050, 2304], 'kohitos-motion.webp', flag)
    sheet(key_image(sys.argv[2]), [0, 512, 1024, 1536, 2048],
          [0, 540, 1024, 1536, 2048], 'townspeople-motion.webp')
