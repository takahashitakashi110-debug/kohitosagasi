import * as T from 'three';
import { buildStreet, oval } from './scenery';
import { FeatureVisibility } from './visibility';
import { buildCharacter, poseCharacter } from './hohomochi';
import { actorSpot, leafSpot, looseSpot } from './rules';
import type { Behavior, Period, Sighting, Photo } from './rules';

export type View = Photo['cameraTransform'];
const palettes: Record<Period, [string, string, string, number]> = {
  morning: ['#b9dcd9', '#ffdfad', '#a8bfab', 1.68],
  noon: ['#aad8e5', '#fff2cf', '#aec8ad', 2.02],
  evening: ['#ecbbac', '#ffbd82', '#baa6ad', 1.22],
  night: ['#424f6f', '#bfcbe5', '#7f88a9', 0.65],
};

export class World {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(64, 1, 0.055, 90);
  private sun = new T.DirectionalLight();
  private sky = new T.HemisphereLight();
  private set: ReturnType<typeof buildStreet>;
  private actor: ReturnType<typeof buildCharacter>;
  private actorRoot = new T.Group();
  private shadow: T.Mesh;
  private visibility = new FeatureVisibility();
  private pictureURL = '';
  private frameGeneration = 0;
  private period?: Period;
  private lastWidth = 0;
  private lastHeight = 0;
  private stillView: string | null = null;

  constructor(readonly canvas: HTMLCanvasElement, coat: T.Group) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
    this.scene.add(this.sky, this.sun);
    this.sun.position.set(-7, 12, 8);
    this.set = buildStreet(this.scene);
    this.actor = buildCharacter(coat);
    this.scene.add(this.actorRoot);
    this.actorRoot.add(this.actor.figure);
    this.shadow = oval(this.scene, '#83825b', actorSpot.x, .504, actorSpot.z, .49, .009, .34);
  }

  render(
    view: View,
    period: Period,
    behavior: Behavior,
    t: number,
    collection: number,
    carrying: boolean,
    trusted: boolean,
  ) {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    // A stationary room or an empty hedge needs a redraw only when its camera, light or props change.
    const stationary = behavior === 'absent' || behavior === 'hidden';
    const key = stationary
      ? [
          w,
          h,
          period,
          behavior,
          carrying,
          trusted,
          view.x,
          view.y,
          view.z,
          view.yaw,
          view.pitch,
          view.fov,
        ].join('/')
      : null;
    if (key !== null && this.stillView === key) return;
    this.stillView = key;
    if (w !== this.lastWidth || h !== this.lastHeight) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.lastWidth = w;
      this.lastHeight = h;
      this.camera.updateProjectionMatrix();
    }
    if (period !== this.period) {
      this.period = period;
      const [bg, light, ground, intensity] = palettes[period];
      this.scene.background = new T.Color(bg);
      this.scene.fog = new T.Fog(bg, 18, 57);
      this.sky.color.set(period === 'night' ? '#bdcbe4' : '#fff3df');
      this.sky.groundColor.set(ground);
      this.sky.intensity = period === 'night' ? 0.64 : 1.47;
      this.sun.color.set(light);
      this.sun.intensity = intensity;
    }
    this.camera.position.set(view.x, view.y, view.z);
    this.camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
    if (view.fov !== this.camera.fov) {
      this.camera.fov = view.fov;
      this.camera.updateProjectionMatrix();
    }
    const root = this.actorRoot, shadow = this.shadow;
    root.visible = behavior !== 'absent' && behavior !== 'hidden';
    shadow.visible = root.visible;
    const walk = behavior === 'collect' ? Math.sin(Math.PI * collection) : 0;
    root.position.set(
      actorSpot.x + (leafSpot.x - actorSpot.x) * walk,
      0.51 - 0.45 * walk,
      actorSpot.z + (leafSpot.z - 0.328 - actorSpot.z) * walk,
    );
    shadow.position.x = root.position.x;
    shadow.position.z = root.position.z;
    poseCharacter(this.actor, behavior, t, collection, trusted);
    this.set.loose.visible =
      period === 'morning' && !carrying && !trusted && (behavior !== 'collect' || collection < 0.5);
    if (behavior === 'collect') this.set.loose.position.set(leafSpot.x, 0.31, leafSpot.z);
    else this.set.loose.position.set(looseSpot.x, 0.13, looseSpot.z);
    this.renderer.render(this.scene, this.camera);
  }

  sight(behavior: Behavior): Sighting {
    const distance = this.camera.position.distanceTo(this.actorRoot.position);
    const empty = { distance, heightFraction: 0, cheek: false, nut: false, behavior };
    if (!this.actorRoot.visible || distance > 9) return empty;
    const head = this.actor.cheeks[0].getWorldPosition(new T.Vector3());
    const low = head
      .clone()
      .add(new T.Vector3(0, -0.55, 0))
      .project(this.camera);
    const high = head
      .clone()
      .add(new T.Vector3(0, 0.45, 0))
      .project(this.camera);
    const surfaces: T.Object3D[] = [...this.set.occluders];
    for (const item of [this.actorRoot, this.shadow, this.set.loose, this.set.frame])
      item.traverseVisible((n) => {
        if (n instanceof T.Mesh) surfaces.push(n);
      });
    return {
      distance,
      heightFraction: Math.abs(high.y - low.y) / 2,
      behavior,
      cheek: this.actor.cheeks.some((m) => this.visibility.sees(this.camera, m, 'cheek', surfaces)),
      nut:
        this.actor.held.group.visible &&
        this.visibility.sees(this.camera, this.actor.held.shell, 'nut', surfaces),
    };
  }

  snapshot() {
    // Even for a still view, render into the current framebuffer immediately before the copy.
    this.renderer.render(this.scene, this.camera);
    const copy = document.createElement('canvas');
    copy.width = this.canvas.width;
    copy.height = this.canvas.height;
    const ctx = copy.getContext('2d');
    if (!ctx) throw new Error('canvas2d');
    ctx.drawImage(this.canvas, 0, 0);
    return {
      width: copy.width,
      height: copy.height,
      blob: new Promise<Blob>((resolve, reject) =>
        copy.toBlob((b) => (b?.size ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.92),
      ),
    };
  }

  async exhibit(photo: Photo | undefined, onBroken: () => void) {
    const generation = ++this.frameGeneration;
    this.stillView = null;
    const m = this.set.frame.material;
    this.set.frame.visible = false;
    m.map?.dispose();
    m.map = null;
    m.needsUpdate = true;
    if (this.pictureURL) URL.revokeObjectURL(this.pictureURL);
    this.pictureURL = '';
    if (!photo) return;
    const url = URL.createObjectURL(photo.imageBlob);
    this.pictureURL = url;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
      if (generation !== this.frameGeneration) return;
      const t = new T.Texture(img);
      t.colorSpace = T.SRGBColorSpace;
      t.needsUpdate = true;
      m.map = t;
      m.needsUpdate = true;
      const factor = Math.min(1.43 / img.naturalWidth, 0.82 / img.naturalHeight);
      this.set.frame.scale.set(img.naturalWidth * factor, img.naturalHeight * factor, 1);
      this.set.frame.visible = true;
      this.stillView = null;
    } catch {
      if (generation === this.frameGeneration) onBroken();
    }
  }
}
