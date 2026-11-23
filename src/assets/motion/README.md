# Four-frame motion assets

Runway tasks (2026-11-23):

- Kohitos: `f39407eb-c104-4712-84f4-ad4f0bffd641`, 1728×2304.
- Residents: `099ac373-ac1b-43e9-b429-efd0e0715ced`, 2048×2048.
- Corrected pole-and-flag row: `654adf1c-9a24-496f-a638-6c4453e7a31b`, 3136×1344.

The initial flag row lost its pole or cloth in some frames and was replaced
with the dedicated strip. Inspected source crops are encoded in
`scripts/prepare-motion-art.py`; all frames in each row share a size and foot
baseline. Magenta is keyed out, with alpha preserved in quality-95 WebP.

Each 256px cell has a four-pixel gutter and an inner 248px image. Four columns
play left to right at 0.35s/frame. Kohito rows follow KOHITO_IDS and end with
hidden tarejiri (7 rows, 28 frames). Resident rows follow RESIDENT_IDS
(4 rows, 16 frames). The source includes the greeter's small drain prop.

This adds 44 frames; the previous two-pose kohito sheet remains available
for decisive moments, frozen album photos and loading fallbacks.

Rebuild using Pillow and downloaded originals:

```sh
python scripts/prepare-motion-art.py kohitos.png residents.png flag.png
```

Preview with `npm run dev` at `/tools/motion-preview.html`.
