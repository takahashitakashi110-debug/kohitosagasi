"""Prepare one isolated image per character for a future Runway GLB request.

python scripts/prepare-model-references.py original-sprites.png output-directory
No 3D generation or paid API call is made by this script.
"""
import json
import runpy
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[2]).resolve()
(out / 'references').mkdir(parents=True, exist_ok=True)
key_image = runpy.run_path(str(root / 'scripts/prepare-motion-art.py'))['key_image']
source = key_image(sys.argv[1])
creatures = {
    'urasumi': (180, 30, 780, 400), 'haritsuki': (300, 420, 585, 860),
    'dobunozoki': (165, 900, 710, 1210), 'noboriyurashi': (95, 1220, 745, 1680),
    'kagebousi': (100, 1680, 735, 2100), 'tarejiri': (70, 2110, 380, 2528),
}
images = {name: source.crop(box) for name, box in creatures.items()}
for path in (root / 'src/assets/townspeople').glob('*.webp'):
    images[path.stem] = Image.open(path).convert('RGBA')
requests = []
for name, image in images.items():
    image = image.crop(image.getbbox())
    image.thumbnail((896, 896), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (1024, 1024))
    canvas.paste(image, ((1024 - image.width) // 2, (1024 - image.height) // 2))
    canvas.save(out / 'references' / f'{name}.webp', quality=95, method=6)
    requests.append({ 'name': name, 'model': 'tripo3d-h3-1',
        'referenceImageFile': f'references/{name}.webp', 'geometryQuality': 'standard',
        'textureQuality': 'standard', 'texture': True, 'pbr': True,
        'faceLimit': 50000, 'estimatedCredits': 30, 'status': 'not_generated' })
(out / 'requests.json').write_text(json.dumps({ 'characters': requests,
    'estimatedTotalCredits': 300, 'note': 'Resolve referenceImageFile relative to this directory. No GLB was generated.' }, ensure_ascii=False, indent=2))
print(f'Prepared {len(requests)} references in {out}; no generation submitted.')
