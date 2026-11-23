# Runway sound effects

Four one-second MP3 cues generated for the prototype on 2026-11-23:

| File | Scene/event | Runway task |
| --- | --- | --- |
| shutter.mp3 | Camera shutter | 6d94521f-7fea-43ca-a269-3b958fbd2d2c |
| hint.mp3 | New observation clue | d0cad442-425e-44f5-ac32-bc16f52844df |
| resident.mp3 | Friendly human false-positive result | 597cb8cc-6123-477e-92a5-7b7bb6907855 |
| ending.mp3 | Water drops in the ending puddle | 7c240a90-8333-4d02-b333-e2e3f31c4def |

`scripts/prepare-sound.py` uses ffmpeg to normalize each original to a -6dB
peak before 128kbps MP3 encoding. Playback applies the existing 0.25 master
volume and a 0.65 sample gain. Hint/resident cues wait 0.18 seconds after the
shutter; the ending drops start after 2 seconds to match the puddle scene.

Samples load and decode only after a user gesture. Unavailable samples fall
back to the existing procedural sounds. All recorded and scheduled voices
stop when muted. No external request is made during gameplay.
