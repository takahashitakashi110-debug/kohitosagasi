"""Make an offline playable HTML and a static hosting ZIP after npm run build."""
import base64
import json
import mimetypes
import re
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/kohitosagasi-prototype')
output.mkdir(parents=True, exist_ok=True)
html = (dist / 'index.html').read_text()
script = next((dist / 'assets').glob('index-*.js')).read_text()


def inline(match):
    path = dist / 'assets' / match[1]
    if not path.is_file():
        raise ValueError(f'Missing build asset: {path.name}')
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    value = base64.b64encode(path.read_bytes()).decode()
    return json.dumps(f'data:{mime};base64,{value}')


script = re.sub(r'new URL\("([^"/]+\.(?:png|webp|mp3))",import\.meta\.url\)\.href', inline, script)
html = re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>',
              lambda _: '<script type="module">' + script.replace('</script', '<\\/script') + '</script>', html)
if re.search(r'\bsrc="\./assets/', html):
    raise ValueError('Unbundled script reference remains')
(output / 'kohitosagasi-prototype.html').write_text(html)
with zipfile.ZipFile(output / 'kohitosagasi-prototype-static.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in dist.rglob('*'):
        if path.is_file():
            archive.write(path, path.relative_to(dist))
print(output / 'kohitosagasi-prototype.html')
print(output / 'kohitosagasi-prototype-static.zip')
