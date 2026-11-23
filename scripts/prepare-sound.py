"""Normalize the four generated MP3s to a -6dB peak (requires ffmpeg).

Usage: python scripts/prepare-sound.py input-directory output-directory
Input and output directories must be different. Originals are retained.
"""
import re
import subprocess
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
output = Path(sys.argv[2]).resolve()
if source == output:
    raise ValueError('Keep the original sounds in a separate directory')
output.mkdir(parents=True, exist_ok=True)
for name in ['shutter', 'hint', 'resident', 'ending']:
    path = source / f'{name}.mp3'
    result = subprocess.run(['ffmpeg', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    peak = float(re.search(r'max_volume: (-?[\d.]+) dB', result.stderr)[1])
    gain = -6 - peak
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-af', f'volume={gain}dB', '-codec:a', 'libmp3lame', '-b:a', '128k', str(output / path.name)], check=True)
    print(name, f'input peak {peak}dB, applied {gain:.1f}dB')
