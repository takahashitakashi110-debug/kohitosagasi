import * as T from 'three';

const offsets = [
  [0, 0],
  [0.42, 0.1],
  [-0.42, 0.12],
  [0, 0.44],
] as const;

// The scene has already been rendered. Use its camera and the same mesh transforms.
export class FeatureVisibility {
  private ray = new T.Raycaster();
  private sample = new T.Vector3();
  private direction = new T.Vector3();
  private hits: T.Intersection[] = [];

  sees(camera: T.PerspectiveCamera, mesh: T.Mesh, feature: string, surfaces: T.Object3D[]): boolean {
    for (const [x, y] of offsets) {
      mesh.localToWorld(this.sample.set(x, y, 0.38));
      this.direction.copy(this.sample).project(camera);
      if (
        Math.abs(this.direction.x) >= 1 ||
        Math.abs(this.direction.y) >= 1 ||
        Math.abs(this.direction.z) >= 1
      )
        continue;
      this.direction.copy(this.sample).sub(camera.position);
      this.ray.far = this.direction.length() + 0.15;
      this.ray.set(camera.position, this.direction.normalize());
      this.hits.length = 0;
      this.ray.intersectObjects(surfaces, false, this.hits);
      if (this.hits[0]?.object.userData.feature === feature) return true;
    }
    return false;
  }
}
