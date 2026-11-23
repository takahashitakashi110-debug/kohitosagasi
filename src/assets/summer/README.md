# Summer artwork

Generated with Runway for Issue #21 / PR #22 on 2026-11-23.

- Sprite source task: `0f7f96e3-e93d-4b4f-952b-4e4c0f8b42ad` (1696×2528).
- Town source task: `00e2ea62-eac9-416f-b863-1c7f5c2b9f12` (2528×1696).
- `kohitos.png`: 512×1792 RGBA, two 256px cells per row; normal/special
  for urasumi, haritsuki, dobunozoki, noboriyurashi, kagebousi, tarejiri,
  then hidden tarejiri. Each crop occupies the inner 248px square, which
  is mapped to the existing scoring rectangle by `summerImages.ts`.
- `town.webp`: resized title illustration, including the dry drainage channel.

Rebuild with Pillow and the original images:

```sh
python scripts/prepare-summer-art.py /path/to/sprites.png /path/to/background.png
```

The observed source places the last four sprites side by side, so the script
uses explicit crop rectangles. It removes the magenta matte and preserves
the colored details. No source download URL is committed. These two local
assets are bundled by Vite; gameplay does not contact Runway.
