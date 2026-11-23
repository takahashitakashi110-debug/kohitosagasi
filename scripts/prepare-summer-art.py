"""Prepare the two original Runway images for offline game use (requires Pillow).

Usage: python scripts/prepare-summer-art.py sprites.png background.png
The observed atlas has five paired rows, then four sprites across its last row.
Coordinates refer to that specific 1696 x 2528 original, not an assumed grid.
No download URLs or credentials are stored in the repository.
"""
import argparse
from pathlib import Path

from PIL import Image


def prepare(sprites: Path, background: Path, output: Path) -> None:
    source = Image.open(sprites).convert('RGBA')
    if source.size != (1696, 2528):
        raise ValueError('Expected the original 1696 x 2528 sprite atlas')
    # Remove only the saturated magenta matte; retain pink tongues and red cloth.
    pixels = []
    for index, (r, g, b, a) in enumerate(source.getdata()):
        excess = min(r, b) - g
        # The pale jade rump has partially transparent matte-colored edges.
        threshold = 5 if index // source.width >= 2110 else 50
        if excess > threshold:
            a = 255 - excess
            if a < 24:
                a = 0
            # Unmix the magenta backing instead of leaving a purple fringe.
            if a:
                r, g, b = (max(0, min(255, round(v * 255 / a)))
                           for v in (r - excess, g, b - excess))
            else:
                r = g = b = 0
        pixels.append((r, g, b, a))
    source.putdata(pixels)
    boxes = [
        (180, 30, 780, 400), (1000, 25, 1510, 400),
        (300, 420, 585, 860), (1110, 420, 1415, 860),
        (165, 900, 710, 1210), (1000, 900, 1510, 1210),
        (95, 1220, 745, 1680), (1070, 1220, 1510, 1680),
        (100, 1680, 735, 2100), (1030, 1680, 1485, 2100),
        (70, 2110, 380, 2528), (455, 2110, 755, 2528),
        (970, 2140, 1180, 2460), (1360, 2130, 1575, 2528),
    ]
    # Equal cells simplify runtime frame selection; transparent gutters avoid bleed.
    atlas = Image.new('RGBA', (512, 7 * 256))
    for index, box in enumerate(boxes):
        sprite = source.crop(box)
        bounds = sprite.getbbox()
        if bounds is None:
            raise ValueError(f'Empty sprite {index}')
        sprite = sprite.crop(bounds).resize((248, 248), Image.Resampling.LANCZOS)
        atlas.paste(sprite, ((index % 2) * 256 + 4, (index // 2) * 256 + 4))
    output.mkdir(parents=True, exist_ok=True)
    atlas.save(output / 'kohitos.png', optimize=True)
    image = Image.open(background).convert('RGB')
    image.thumbnail((1008, 672), Image.Resampling.LANCZOS)
    image.save(output / 'town.webp', quality=88, method=6)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sprites', type=Path)
    parser.add_argument('background', type=Path)
    args = parser.parse_args()
    prepare(args.sprites, args.background,
            Path(__file__).resolve().parents[1] / 'src/assets/summer')
