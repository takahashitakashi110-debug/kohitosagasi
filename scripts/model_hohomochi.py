"""Bake the approved three-view artwork onto a small, hand-shaped game mesh.

Usage: python scripts/model_hohomochi.py <approved-hohomochi-three-view.png>
Requires Pillow, NumPy and OpenCV for asset preparation only.
"""
import argparse
import hashlib
import io
import json
import struct
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

APPROVED = "3d7445144233138ed8fb6d16f7814969c15f823f0d6986d2518679442adf8645"
OUTPUT = Path(__file__).resolve().parents[1] / "src/prototype3d/assets/hohomochi.glb"
# Measured sections of the belly, neck and crown: height, half-width, half-depth, depth offset.
PROFILE = np.array([
    [.050, .003, .004, -.025], [.066, .195, .173, -.027],
    [.089, .270, .242, -.030], [.145, .346, .299, -.029],
    [.225, .389, .332, -.030], [.325, .406, .349, -.030],
    [.425, .402, .342, -.027], [.520, .387, .315, -.023],
    [.610, .355, .288, -.014], [.733, .321, .267, .004],
    [.842, .345, .292, .008], [.924, .324, .277, .002],
    [1.015, .284, .244, -.003], [1.082, .231, .205, -.007],
    [1.129, .171, .154, -.009], [1.161, .109, .099, -.010],
    [1.175, .055, .051, -.011], [1.180, .003, .003, -.011],
])
LOW, HIGH = PROFILE[0, 0], PROFILE[-1, 0]


def smooth(start, end, value):
    t = np.clip((value - start) / (end - start), 0, 1)
    return t * t * (3 - 2 * t)


def skin(theta, height):
    """Surface of the soft trunk united with forward, slightly drooping cheek lobes."""
    dx, dz = np.sin(theta), np.cos(theta)
    rx, rz, z0 = (np.interp(height, PROFILE[:, 0], col) for col in PROFILE.T[1:])
    trunk = 1 / np.sqrt((dx / rx) ** 2 + (dz / rz) ** 2)
    # Forehead and muzzle sit just in front of the saddle between the two cheeks.
    trunk += .027 * np.exp(-((height - .855) / .102) ** 2) * np.maximum(dz, 0) ** 10
    hy = (height - .710) / .235
    cx, cz = .282 - .024 * hy, .146 - z0
    ax, az = .250, .235
    a = (dx / ax) ** 2 + (dz / az) ** 2
    b = np.abs(dx) * cx / ax ** 2 + dz * cz / az ** 2
    c = (cx / ax) ** 2 + (cz / az) ** 2 + hy ** 2 - 1
    discriminant = b * b - a * c
    cheek = np.where(discriminant > 0, (b + np.sqrt(np.maximum(0, discriminant))) / a, 0)
    blend = np.maximum(.050 - np.abs(cheek - trunk), 0) ** 2 / .200
    merge = smooth(0, .15, discriminant / a)
    radius = trunk + (np.maximum(trunk, cheek) + blend - trunk) * merge
    return radius * dx, z0 + radius * dz, (merge > .16) & (cheek > trunk - .025)


def source_views(path):
    rgb = np.array(Image.open(path).convert("RGB"))
    # Moving appendages are modeled separately. Repair only these marks on a working copy.
    mask = np.zeros(rgb.shape[:2], np.uint8)
    for x, y, rx, ry in [(204, 272, 19, 17), (311, 272, 19, 17), (135, 450, 41, 35),
                         (380, 450, 41, 35), (620, 447, 62, 37), (550, 434, 23, 25),
                         (599, 273, 14, 15), (881, 542, 24, 19), (1135, 548, 28, 27)]:
        cv2.ellipse(mask, (x, y), (rx, ry), 0, 0, 360, 255, -1)
    clean = rgb.copy()
    views = []
    for x0, x1 in [(28, 480), (503, 908), (914, 1350)]:
        crop = rgb[:, x0:x1].astype(np.int16)
        chroma = crop[:, :, 0] - crop[:, :, 2]
        silhouette = (chroma > 17).astype(np.uint8)
        silhouette[:170] = silhouette[638:] = 0
        contours, _ = cv2.findContours(silhouette, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filled = np.zeros_like(silhouette)
        cv2.drawContours(filled, [max(contours, key=cv2.contourArea)], -1, 1, cv2.FILLED)
        left = np.argmax(filled, axis=1) + x0
        right = x1 - 1 - np.argmax(filled[:, ::-1], axis=1)
        valid = np.flatnonzero(filled.any(axis=1))
        for row in valid:
            inset = min(4, (right[row] - left[row]) // 2)
            clean[row, x0:left[row]+inset] = rgb[row, left[row]+inset]
            clean[row, right[row]-inset:x1] = rgb[row, right[row]-inset]
        rows = np.arange(rgb.shape[0])
        views.append((np.interp(rows, valid, left[valid]), np.interp(rows, valid, right[valid])))
    return cv2.inpaint(clean, mask, 7, cv2.INPAINT_TELEA), views


def bake_texture(path):
    image, views = source_views(path)
    width, height = 1152, 608
    theta = ((np.arange(width) + .5) / width * 2 * np.pi - np.pi)[None, :]
    y = (HIGH - (np.arange(height) + .5) / height * (HIGH - LOW))[:, None]
    x, z, _ = skin(theta, y)
    pixel_y = np.clip(632 - y * 390, 175, 609)
    side_angle = np.deg2rad(74)
    side_x = x * np.cos(side_angle) - z * np.sin(side_angle)
    screen = [x, np.abs(x) * np.cos(side_angle) - z * np.sin(side_angle), -x]
    angle = np.abs(np.rad2deg(theta))
    front, back = 1 - smooth(49, 78, angle), smooth(98, 144, angle)
    mixed = np.zeros((height, width, 3))
    for (left, right), projection, span, weight in zip(
        views, screen, (x, side_x, -x), (front, 1-front-back, back)
    ):
        row_min, row_max = span.min(axis=1, keepdims=True), span.max(axis=1, keepdims=True)
        fraction = np.clip((projection - row_min) / (row_max - row_min), 0, 1)
        # Stay inside the subject even at its tiniest crown ring, never sample the paper.
        lo = np.interp(pixel_y, np.arange(len(left)), left)
        hi = np.interp(pixel_y, np.arange(len(right)), right)
        inset = np.minimum(3.0, (hi-lo) * .2)
        u = lo + inset + fraction * (hi-lo-2*inset)
        sample = cv2.remap(image, u.astype("f4"), np.broadcast_to(pixel_y, u.shape).astype("f4"),
                           cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        mixed += sample * weight[..., None]
    result = io.BytesIO()
    Image.fromarray(np.uint8(np.clip(mixed, 0, 255))).save(result, "JPEG", quality=93, subsampling=0)
    return result.getvalue()


class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.doc = dict(asset={"version": "2.0", "generator": "hohomochi three-view study"},
                        scene=0, scenes=[{"nodes": []}], nodes=[], meshes=[], accessors=[], bufferViews=[])

    def view(self, data):
        self.bin.extend(bytes(-len(self.bin) % 4))
        start = len(self.bin)
        self.bin.extend(data)
        self.doc["bufferViews"].append(dict(buffer=0, byteOffset=start, byteLength=len(data)))
        return len(self.doc["bufferViews"]) - 1

    def accessor(self, values, dtype, kind, bounds=False):
        values = np.ascontiguousarray(values, dtype=dtype)
        desc = dict(bufferView=self.view(values.tobytes()), componentType=5123 if dtype == "<u2" else 5126,
                    count=len(values), type=kind)
        if bounds:
            desc.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
        self.doc["accessors"].append(desc)
        return len(self.doc["accessors"]) - 1

    def mesh(self, name, pos, uv, triangles, center, scale):
        indices, remap = np.unique(triangles, return_inverse=True)
        # Local cheek axes also give the game's raycaster meaningful surface sample positions.
        verts = (pos[indices] - center) / scale
        primitive = dict(attributes={"POSITION": self.accessor(verts, "<f4", "VEC3", True),
                                     "TEXCOORD_0": self.accessor(uv[indices], "<f4", "VEC2")},
                         indices=self.accessor(remap.reshape(-1), "<u2", "SCALAR"), material=0)
        index = len(self.doc["nodes"])
        self.doc["meshes"].append({"primitives": [primitive]})
        self.doc["nodes"].append(dict(name=name, mesh=index, translation=center, scale=scale))
        self.doc["scenes"][0]["nodes"].append(index)

    def finish(self, texture):
        self.doc.update(images=[dict(bufferView=self.view(texture), mimeType="image/jpeg")],
                        textures=[{"source": 0}], extensionsUsed=["KHR_materials_unlit"],
                        materials=[{"name": "Approved coat", "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}},
                                    "extensions": {"KHR_materials_unlit": {}}}])
        self.doc["buffers"] = [dict(byteLength=len(self.bin))]
        desc = json.dumps(self.doc, separators=(",", ":")).encode()
        desc += b" " * (-len(desc) % 4)
        self.bin.extend(bytes(-len(self.bin) % 4))
        return (struct.pack("<4sII", b"glTF", 2, 28 + len(desc) + len(self.bin))
                + struct.pack("<I4s", len(desc), b"JSON") + desc
                + struct.pack("<I4s", len(self.bin), b"BIN\0") + self.bin)


def build(path):
    if hashlib.sha256(path.read_bytes()).hexdigest() != APPROVED:
        raise ValueError("Expected the approved 1376 x 768 hohomochi three-view.")
    n, m = 80, 54
    u, v = np.meshgrid(np.linspace(0, 1, n + 1), np.linspace(1, 0, m + 1))
    y = HIGH - v * (HIGH - LOW)
    x, z, _ = skin((u * 2 - 1) * np.pi, y)
    pos = np.stack([x, y, z], -1).reshape(-1, 3)
    uv = np.stack([u, v], -1).reshape(-1, 2)
    iy, ix = np.indices((m, n))
    a = iy * (n + 1) + ix
    quads = np.stack([a, a+1, a+n+2, a, a+n+2, a+n+1], -1)
    theta = ((ix + .5) / n * 2 - 1) * np.pi
    _, _, cheek = skin(theta, LOW + (iy + .5) / m * (HIGH - LOW))
    model = Glb()
    for name, selected, center, scale in [
        ("Coat", ~cheek, [0, 0, 0], [1, 1, 1]),
        ("CheekLeft", cheek & (theta < 0), [-.282, .710, .146], [.250, .235, .235]),
        ("CheekRight", cheek & (theta >= 0), [.282, .710, .146], [.250, .235, .235]),
    ]:
        model.mesh(name, pos, uv, quads[selected], center, scale)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(model.finish(bake_texture(path)))
    print(f"{OUTPUT.name}: {OUTPUT.stat().st_size} bytes, {m*n*2} triangles")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("approved_png", type=Path)
    build(parser.parse_args().approved_png)
