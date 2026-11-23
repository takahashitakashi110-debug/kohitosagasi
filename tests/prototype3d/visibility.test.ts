import { it, expect } from 'vitest';
import * as T from 'three';
import { FeatureVisibility } from '../../src/prototype3d/visibility';

it('uses posed geometry and current framing, including a foreground leaf that hides only the nut', () => {
  const camera = new T.PerspectiveCamera(45, 1, 0.1, 20);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const parts = new T.Group(),
    surface = new T.MeshBasicMaterial();
  const part = (x: number, feature: string) => {
    const p = new T.Mesh(new T.SphereGeometry(1, 16, 12), surface);
    p.position.x = x;
    p.scale.setScalar(0.21);
    p.userData.feature = feature;
    parts.add(p);
    return p;
  };
  const cheek = part(-0.44, 'cheek'),
    nut = part(0.44, 'nut');
  const leaf = new T.Mesh(new T.BoxGeometry(0.64, 0.64, 0.08), surface);
  leaf.position.set(0.35, 0, 0.6);
  parts.add(leaf);
  parts.updateMatrixWorld(true);
  const probe = new FeatureVisibility();
  const visible = (m: T.Mesh, feature: string) => probe.sees(camera, m, feature, [cheek, nut, leaf]);
  expect(visible(cheek, 'cheek')).toBe(true);
  expect(visible(nut, 'nut')).toBe(false);
  leaf.position.y = 1.1;
  parts.updateMatrixWorld(true);
  expect(visible(nut, 'nut')).toBe(true);
  camera.lookAt(1.55, 0, 1);
  camera.updateMatrixWorld();
  expect(visible(cheek, 'cheek')).toBe(false);
  camera.lookAt(0, 0, 5);
  camera.updateMatrixWorld();
  expect(visible(nut, 'nut')).toBe(false);
});
