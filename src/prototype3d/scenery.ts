import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { actorSpot, benchSpot, leafSpot, looseSpot, traceSpot } from './rules';

const box = new T.BoxGeometry();
const round = new T.SphereGeometry(1, 12, 8);
const leaf = new T.IcosahedronGeometry(1, 0);
const trunk = new T.CylinderGeometry(0.82, 1, 1, 10);
const roof = new T.ConeGeometry(1, 1, 4);
const smooth = new Map<string, T.MeshLambertMaterial>();
export function material(color: string) {
  if (!smooth.has(color)) smooth.set(color, new T.MeshLambertMaterial({ color }));
  return smooth.get(color)!;
}
export function oval(
  parent: T.Object3D,
  color: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  geometry: T.BufferGeometry = round,
) {
  const mesh = new T.Mesh(geometry, material(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  parent.add(mesh);
  return mesh;
}

export function nut(parent: T.Object3D, x: number, y: number, z: number, size: number) {
  const g = new T.Group();
  parent.add(g);
  g.position.set(x, y, z);
  g.scale.setScalar(size);
  const shell = oval(g, '#a56132', 0, 0, 0, 1, 0.94, 0.87);
  for (const sign of [-1, 1]) {
    const shine = oval(g, '#e9b778', sign * 0.64, 0.11, 0.57, 0.2, 0.49, 0.12);
    shine.rotation.z = -sign * 0.26;
  }
  oval(g, '#554b2e', 0, 0.93, 0, 0.17, 0.27, 0.15, trunk).rotation.z = -0.2;
  return { group: g, shell };
}

// Bake the stationary set into spatial batches. The camera rays use these exact triangles.
function bake(group: T.Group, scene: T.Scene) {
  group.updateMatrixWorld(true);
  const groups = new Map<string, T.BufferGeometry[]>();
  group.traverse((node) => {
    if (!(node instanceof T.Mesh)) return;
    const geom = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geom.applyMatrix4(node.matrixWorld);
    geom.deleteAttribute('uv');
    const color = (node.material as T.MeshLambertMaterial).color;
    const colors = new Float32Array(geom.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const p = new T.Vector3().setFromMatrixPosition(node.matrixWorld);
    const key = Math.floor(p.x / 6) + '/' + Math.floor(p.z / 6);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(geom);
  });
  const paint = new T.MeshLambertMaterial({ vertexColors: true });
  const result: T.Mesh[] = [];
  for (const gs of groups.values()) {
    const geometry = mergeGeometries(gs)!;
    geometry.computeBoundingSphere();
    const m = new T.Mesh(geometry, paint);
    scene.add(m);
    result.push(m);
    gs.forEach((g) => g.dispose());
  }
  return result;
}

export function buildStreet(scene: T.Scene) {
  const set = new T.Group();
  const b = (c: string, x: number, y: number, z: number, w: number, h: number, d: number) =>
    oval(set, c, x, y, z, w, h, d, box);
  const o = (c: string, x: number, y: number, z: number, w: number, h: number, d: number) =>
    oval(set, c, x, y, z, w, h, d);
  const plant = (x: number, y: number, z: number, scale: number, tint = '#72965c') => {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      const l = oval(
        set,
        i % 2 ? tint : '#a1b771',
        x + Math.sin(a) * scale * 0.23,
        y + scale * (0.27 + (i % 3) * 0.055),
        z + Math.cos(a) * scale * 0.18,
        scale * 0.14,
        scale * 0.42,
        scale * 0.11,
        leaf,
      );
      l.rotation.z = -Math.sin(a) * 0.75;
      l.rotation.x = Math.cos(a) * 0.68;
    }
  };
  const pot = (x: number, y: number, z: number, s: number) => {
    oval(set, '#b66d4e', x, y + s * 0.21, z, s * 0.3, s * 0.42, s * 0.3, trunk);
    o('#5e5237', x, y + s * 0.44, z, s * 0.28, 0.045, s * 0.28);
    plant(x, y + s * 0.43, z, s);
  };
  const timber = '#775841',
    wood = '#ad8057',
    trim = '#547974';
  b('#84a779', 0, -0.32, -6, 100, 0.5, 100);
  b('#b6aa95', 0, -0.08, -3.0, 6.5, 0.14, 15.2);
  for (const side of [-1, 1]) {
    b('#dfd1ad', side * 2.62, 0.015, -3, 1.36, 0.08, 15);
    b('#eee3c7', side * 1.92, 0.005, -3, 0.09, 0.035, 15);
    for (let i = 0; i < 12; i++) b('#aeaa94', side * 2.62, 0.061, 3.2 - i * 1.18, 1.33, 0.008, 0.02);
  }
  for (let i = 0; i < 5; i++) {
    const z = 2 - i * 2.45;
    b('#d1c4ac', -1.32, 0.0, z, 0.58, 0.015, 0.1).rotation.y = i * 0.05;
  }

  // Open-front genkan, a writing desk, a low bed and a sunlit window.
  b('#c69f71', 0, 0, 6.9, 7.42, 0.14, 7);
  for (let i = 0; i < 15; i++)
    b(i % 3 === 0 ? '#a7825f' : '#b38c66', -3.52 + i * 0.5, 0.074, 6.9, 0.014, 0.01, 7.0);
  b('#f3dfba', 0, 1.65, 10.55, 7.6, 3.3, 0.2);
  for (const side of [-1, 1]) {
    b('#efdfbc', side * 3.7, 1.65, 6.95, 0.15, 3.3, 7.2);
    b('#ead5ac', side * 2.46, 1.55, 3.4, 2.62, 3.1, 0.19);
    b(timber, side * 1.12, 1.56, 3.4, 0.16, 3.12, 0.25);
    b(wood, side * 2.46, 0.22, 3.54, 2.62, 0.27, 0.12);
  }
  b(timber, 0, 2.84, 3.4, 7.53, 0.18, 0.27);
  b('#efe2c5', 0, 3.18, 3.4, 7.5, 0.54, 0.2);
  b('#eee0be', 0, 3.42, 6.95, 7.6, 0.24, 7.2);
  for (const z of [4.2, 7, 9.7]) b(wood, 0, 3.22, z, 7.45, 0.18, 0.2);
  b('#bb8b61', -2.28, 0.83, 4.29, 2.16, 0.13, 1.22);
  for (const x of [-3.12, -1.45]) for (const z of [3.91, 4.69]) b(timber, x, 0.44, z, 0.12, 0.8, 0.12);
  b('#826349', -2.22, 1.46, 4.03, 1.76, 1.1, 0.11);
  b('#f2e3c0', -2.22, 1.46, 4.101, 1.62, 0.99, 0.029);
  b('#b4b69b', -2.22, 1.46, 4.124, 1.45, 0.83, 0.012);
  pot(-3.08, 0.92, 4.6, 0.46);
  b('#937758', -3.2, 1.09, 4.14, 0.05, 0.33, 0.07);
  o('#b4986d', -3.2, 1.37, 4.14, 0.23, 0.28, 0.039);
  o('#b9cbc0', -3.2, 1.37, 4.18, 0.19, 0.235, 0.017);
  b('#d8bd9c', -2.94, 1.04, 4.57, 0.11, 0.23, 0.1);
  b('#8b9a82', -2.94, 1.18, 4.57, 0.095, 0.059, 0.085);
  b('#738f83', -1.46, 0.925, 4.63, 0.38, 0.045, 0.28).rotation.y = 0.16;
  b('#aa805d', 2.73, 0.35, 7.9, 1.64, 0.36, 3.46);
  b('#c5c4a6', 2.73, 0.6, 7.9, 1.59, 0.2, 3.38);
  b('#799488', 2.73, 0.73, 7.42, 1.62, 0.13, 2.33);
  for (let i = 0; i < 5; i++) b('#b5c0a5', 2.73, 0.803, 6.48 + i * 0.38, 1.6, 0.012, 0.055);
  o('#f3dfa8', 2.73, 0.78, 9.1, 0.62, 0.14, 0.31);
  b(trim, 3.59, 1.81, 5.33, 0.12, 1.61, 1.8);
  b('#b5d3cc', 3.515, 1.83, 5.33, 0.043, 1.39, 1.6);
  b(wood, 3.475, 1.85, 5.33, 0.05, 1.43, 0.085);
  b(wood, 3.475, 1.85, 5.33, 0.05, 0.08, 1.7);
  b('#c99e76', 0, 0.08, 3.41, 2.06, 0.11, 0.52);
  b('#b99471', 0, 0.085, 4.48, 1.62, 0.025, 0.8);
  for (let i = 0; i < 6; i++) b('#d2b491', -0.68 + i * 0.27, 0.102, 4.48, 0.065, 0.012, 0.76);
  pot(1.58, 0.09, 3.93, 0.79);

  const house = (side: number, z: number, plaster: string, tiles: string, awning: string) => {
    const cx = side * 6.35,
      face = side * 3.78,
      h = 4.35;
    b(plaster, cx, h / 2, z, 5.1, h, 4.27);
    const top = oval(set, tiles, cx, h + 0.64, z, 4.12, 1.52, 3.54, roof);
    top.rotation.y = Math.PI / 4;
    b(tiles, cx, h - 0.05, z, 5.62, 0.18, 4.7);
    b('#b5a88f', face, 0.34, z, 0.13, 0.68, 4.3);
    for (const dz of [-1.32, 0.06, 1.45]) {
      b(trim, face - side * 0.045, 2.79, z + dz, 0.13, 1.19, 1.01);
      b('#9bbdb9', face - side * 0.126, 2.82, z + dz, 0.06, 0.96, 0.82);
      b('#e6dbb6', face - side * 0.17, 2.82, z + dz, 0.036, 1, 0.056);
      b('#d1c6a2', face - side * 0.17, 2.65, z + dz, 0.036, 0.046, 0.83);
    }
    const canopy = b(awning, face - side * 0.4, 2.0, z - 0.25, 0.98, 0.12, 2.18);
    canopy.rotation.z = side * 0.16;
    for (let i = 0; i < 7; i++)
      b(i % 2 === 0 ? awning : '#efe0bc', face - side * 0.86, 1.86, z - 1.19 + i * 0.31, 0.09, 0.22, 0.31);
    b(timber, face - side * 0.08, 1.0, z - 0.33, 0.16, 1.88, 1.12);
    for (const dz of [-0.38, 0, 0.38])
      b('#a8b9a3', face - side * 0.18, 1.35, z - 0.33 + dz, 0.06, 0.79, 0.27);
    pot(face - side * 0.48, 0.06, z + 1.33, 0.71);
  };
  house(-1, 0.6, '#e5c69c', '#7d8880', '#928d59');
  house(1, 0.65, '#dfc7ad', '#b87859', '#709a8a');
  house(-1, -5.1, '#e6d8b6', '#6b8988', '#9fa766');
  house(1, -5.35, '#edc9aa', '#708280', '#b98263');
  // Neighbouring roofs, wooden garden fence and hills close the vista.
  for (let i = 0; i < 7; i++) {
    const x = -18 + i * 6,
      z = -20.8 - (i % 2) * 3;
    b(i % 2 ? '#e8cfab' : '#e0c4a1', x, 2.2, z, 5.3, 4.4, 5);
    const m = oval(set, i % 2 ? '#9c7662' : '#758582', x, 5.05, z, 4.5, 1.62, 4, roof);
    m.rotation.y = Math.PI / 4;
    b('#788478', x, 4.32, z, 5.62, 0.15, 5.47);
    for (const dx of [-1.25, 1.25]) {
      b('#73887c', x + dx, 2.9, z + 2.53, 1.16, 1.18, 0.07);
      b('#a8c5bf', x + dx, 2.9, z + 2.58, 0.99, 0.98, 0.045);
      b('#f1dfb9', x + dx, 2.9, z + 2.62, 0.055, 1.02, 0.032);
      b('#cfb58e', x + dx, 2.78, z + 2.62, 1.02, 0.065, 0.033);
      b('#937c61', x + dx, 2.29, z + 2.62, 1.3, 0.09, 0.27);
    }
  }
  for (let i = 0; i < 9; i++)
    o(i % 2 ? '#91ac92' : '#a7bba0', -40 + i * 10, 1, -41 - (i % 3) * 5, 11, 5 + ((i * 7) % 5), 8);
  for (let i = 0; i < 28; i++) {
    const x = -7 + i * 0.52,
      h = 1.74 + 0.07 * Math.sin(i * 2);
    b(i % 3 === 0 ? '#a2825f' : '#ba9870', x, h / 2, -12.1, 0.45, h, 0.15);
  }
  b(timber, 0, 0.9, -11.97, 15, 0.12, 0.13);
  function tree(x: number, z: number, s: number) {
    oval(set, '#846849', x, 1.42 * s, z, 0.23 * s, 2.84 * s, 0.23 * s, trunk);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      oval(
        set,
        ['#769b68', '#88a76d', '#a5b978'][i % 3],
        x + Math.sin(a) * 0.77 * s,
        (2.9 + (i % 3) * 0.31) * s,
        z + Math.cos(a) * 0.65 * s,
        1.3 * s,
        1.15 * s,
        1.22 * s,
        new T.IcosahedronGeometry(1, 1),
      );
    }
  }
  tree(-3.45, -11.45, 1.07);
  tree(3.48, -11.54, 1.37);
  tree(-4.3, -14.1, 1.31);
  for (let i = 0; i < 4; i++)
    o('#f5efda', -16 + i * 10, 11 + (i % 2) * 2, -31 - (i % 2) * 5, 3.4 + (i % 2), 0.58, 1.3);
  b('#b39a77', 0, 0.17, -10.4, 6.19, 0.42, 2.84);
  b('#ccd0ab', 0, 0.39, -10.38, 6.22, 0.12, 2.82);
  b('#7c7e51', 0, 0.46, -10.46, 6.01, 0.09, 2.57);
  for (let i = 0; i < 22; i++) {
    const x = -2.9 + (i % 11) * 0.57,
      z = -11.3 + Math.floor(i / 11) * 0.63;
    oval(
      set,
      ['#71905a', '#86a567', '#97b172'][i % 3],
      x,
      0.88 + (i % 3) * 0.075,
      z,
      0.57,
      0.46 + (i % 3) * 0.07,
      0.52,
      leaf,
    );
  }
  for (const x of [-2.7, -2.1, -1.56, 1.78, 2.32, 2.76]) plant(x, 0.43, -9.39, 0.85 + (x + 3) * 0.055);
  for (let i = 0; i < 18; i++) {
    const x = -2.8 + ((i * 1.73) % 5.6);
    if (Math.abs(x - actorSpot.x) < 0.66) continue;
    const z = -9.18 - (i % 3) * 0.25,
      y = 0.63 + (i % 4) * 0.045;
    b('#638653', x, y - 0.14, z, 0.018, 0.34, 0.018);
    for (let j = 0; j < 5; j++)
      o('#f7e7bd', x + Math.sin(j * 1.256) * 0.055, y, z + Math.cos(j * 1.256) * 0.055, 0.046, 0.025, 0.046);
    o('#dfaa57', x, y + 0.016, z, 0.037, 0.031, 0.037);
  }
  const leafPad = (x: number, z: number, y: number) => {
    o('#758b55', x, y - 0.06, z, 0.47, 0.075, 0.36);
    const m = o('#aac17a', x, y, z, 0.41, 0.042, 0.32);
    m.rotation.y = -0.4;
    b('#d2d899', x, y + 0.043, z, 0.57, 0.009, 0.019).rotation.y = -0.4;
  };
  b('#bcab86', traceSpot.x, 0.15, traceSpot.z, 1.13, 0.3, 0.67);
  leafPad(traceSpot.x, traceSpot.z, 0.33);
  nut(set, traceSpot.x, 0.5, traceSpot.z, 0.158);
  leafPad(leafSpot.x, leafSpot.z, 0.14);
  o('#998c70', looseSpot.x, 0.022, looseSpot.z, 0.14, 0.012, 0.11);
  const loose = nut(scene, looseSpot.x, 0.13, looseSpot.z, 0.14);
  const bx = benchSpot.x + 0.36,
    bz = benchSpot.z;
  for (const z of [bz - 0.71, bz + 0.71]) {
    b('#516660', bx - 0.13, 0.25, z, 0.12, 0.52, 0.13);
    b('#516660', bx + 0.27, 0.55, z, 0.12, 1.08, 0.13);
  }
  for (let i = 0; i < 3; i++) b('#af8253', bx - 0.22 + i * 0.22, 0.54, bz, 0.19, 0.095, 2.12);
  for (let i = 0; i < 2; i++) b('#be9664', bx + 0.3, 0.8 + i * 0.21, bz, 0.11, 0.18, 2.12);
  for (let i = 0; i < 2; i++) {
    const x = -3.04,
      z = 0.5 - i * 8.9;
    oval(set, '#887e68', x, 2.95, z, 0.097, 5.9, 0.097, trunk);
    b('#78796a', x, 5.54, z, 0.9, 0.09, 0.1);
    for (const dx of [-0.36, 0.34]) b('#72786d', x + dx, 5.53, z - 4.45, 0.024, 0.024, 8.9);
    b('#758279', x + 0.28, 3.45, z, 0.67, 0.07, 0.08);
    o('#f1cb87', x + 0.56, 3.32, z, 0.18, 0.13, 0.18);
  }
  const occluders = bake(set, scene);
  const frame = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xffffff }));
  frame.position.set(-2.22, 1.46, 4.142);
  frame.visible = false;
  scene.add(frame);
  return { occluders, frame, loose: loose.group };
}
