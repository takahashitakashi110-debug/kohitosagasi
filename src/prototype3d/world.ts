import * as T from 'three';
import { buildStreet, nut, oval } from './scenery';
import { FeatureVisibility } from './visibility';
import { actorSpot, leafSpot, looseSpot, tuning } from './rules';
import type { Behavior, Period, Sighting, Photo } from './rules';

export type View = Photo['cameraTransform'];
const palettes: Record<Period, [string, string, string, number]> = {
  morning: ['#b9dcd9', '#ffdfad', '#a8bfab', 1.68],
  noon: ['#aad8e5', '#fff2cf', '#aec8ad', 2.02],
  evening: ['#ecbbac', '#ffbd82', '#baa6ad', 1.22],
  night: ['#424f6f', '#bfcbe5', '#7f88a9', 0.65],
};

function buildCharacter(scene: T.Scene) {
  const root = new T.Group();
  scene.add(root);
  const figure = new T.Group();
  root.add(figure);
  oval(figure, '#e2bc89', 0, 0.36, -0.03, 0.34, 0.36, 0.26);
  oval(figure, '#f4dfae', 0, 0.35, 0.173, 0.236, 0.246, 0.105);
  for (const side of [-1, 1]) {
    oval(figure, '#ae8861', side * 0.2, 0.075, 0.045, 0.154, 0.079, 0.153);
    const ear = oval(figure, '#ddbd91', side * 0.325, 1.02, -0.065, 0.104, 0.16, 0.078);
    ear.rotation.z = -side * 0.63;
  }
  oval(figure, '#f2d5a9', 0, 0.79, 0, 0.44, 0.35, 0.32);
  const cheeks: T.Mesh[] = [];
  for (const sign of [-1, 1]) {
    const cheek = oval(figure, '#efa98c', sign * 0.305, 0.711, 0.152, 0.243, 0.204, 0.193);
    cheek.userData.feature = 'cheek';
    cheeks.push(cheek);
    for (let i = 0; i < 3; i++) {
      const freckle = oval(
        figure,
        '#c88b74',
        sign * (0.295 + i * 0.039),
        0.734 + (i % 2) * 0.026,
        0.342 - i * 0.008,
        0.014,
        0.0085,
        0.009,
      );
      freckle.userData.feature = 'cheek';
    }
    const eye = oval(figure, '#514338', sign * 0.156, 0.868, 0.277, 0.044, 0.057, 0.032);
    oval(eye, '#fff3d3', -0.25, 0.34, 0.85, 0.26, 0.23, 0.19);
    const brow = oval(figure, '#ad8b68', sign * 0.159, 0.964, 0.241, 0.05, 0.013, 0.018);
    brow.rotation.z = sign * 0.08;
  }
  oval(figure, '#a6745c', 0, 0.777, 0.32, 0.042, 0.025, 0.021);
  oval(figure, '#785648', 0, 0.712, 0.314, 0.036, 0.019, 0.014);
  const tuft = oval(figure, '#839e64', 0.045, 1.136, -0.035, 0.071, 0.148, 0.036);
  tuft.rotation.z = -0.68;
  const sprout = oval(figure, '#adbb72', -0.03, 1.115, -0.038, 0.052, 0.101, 0.035);
  sprout.rotation.z = 0.62;
  const hands = [-1, 1].map((s) => oval(figure, '#e7bd8e', s * 0.132, 0.43, 0.36, 0.077, 0.076, 0.067));
  const held = nut(figure, 0, 0.42, 0.36, 0.12);
  held.group.traverse((n) => {
    n.userData.feature = 'nut';
  });
  const shadow = oval(scene, '#83825b', actorSpot.x, 0.504, actorSpot.z, 0.52, 0.009, 0.33);
  return { root, figure, cheeks, hands, held, shadow };
}

export class World {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(64, 1, 0.055, 90);
  private sun = new T.DirectionalLight();
  private sky = new T.HemisphereLight();
  private set: ReturnType<typeof buildStreet>;
  private actor: ReturnType<typeof buildCharacter>;
  private visibility = new FeatureVisibility();
  private pictureURL = '';
  private frameGeneration = 0;
  private period?: Period;
  private lastWidth = 0;
  private lastHeight = 0;
  private stillView: string | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
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
    this.actor = buildCharacter(this.scene);
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
    const { root, figure, hands, held, shadow, cheeks } = this.actor;
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
    figure.position.y = Math.sin(t * 2.6) * 0.013 + Math.abs(Math.sin(t * 12)) * walk * 0.045;
    figure.rotation.z = Math.sin(t * 1.7) * 0.021;
    const phase = t % tuning.cycle;
    let press = 0;
    if (behavior === 'cheek') press = 1;
    if (behavior === 'regrip') press = T.MathUtils.smoothstep(phase, tuning.regripStart, tuning.cheekStart);
    if (behavior === 'idle' && phase >= tuning.cheekEnd)
      press = 1 - T.MathUtils.smoothstep(phase, tuning.cheekEnd, tuning.cheekEnd + 0.55);
    const show = behavior === 'show' ? 1 : 0;
    const px = 0.355 * press,
      py = 0.395 + 0.296 * press + 0.166 * show - 0.15 * walk,
      pz = 0.328 + 0.075 * press + 0.16 * show;
    held.group.visible = behavior !== 'collect' || collection >= 0.5;
    held.group.position.set(px, py, pz);
    held.group.rotation.z = 0.26 * press;
    for (let i = 0; i < 2; i++) {
      hands[i].position.set(px + (i ? 1 : -1) * 0.117, py - 0.058, pz + 0.016);
      cheeks[i].scale.y = 0.204 + show * 0.032 + (i ? press * 0.015 : 0);
    }
    this.set.loose.visible =
      period === 'morning' && !carrying && !trusted && (behavior !== 'collect' || collection < 0.5);
    if (behavior === 'collect') this.set.loose.position.set(leafSpot.x, 0.31, leafSpot.z);
    else this.set.loose.position.set(looseSpot.x, 0.13, looseSpot.z);
    this.renderer.render(this.scene, this.camera);
  }

  sight(behavior: Behavior): Sighting {
    const distance = this.camera.position.distanceTo(this.actor.root.position);
    const empty = { distance, heightFraction: 0, cheek: false, nut: false, behavior };
    if (!this.actor.root.visible || distance > 9) return empty;
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
    for (const item of [this.actor.root, this.actor.shadow, this.set.loose, this.set.frame])
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
