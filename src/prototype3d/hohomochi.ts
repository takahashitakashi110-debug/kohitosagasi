import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Behavior } from './rules';
import { tuning } from './rules';
import { nut } from './scenery';

export async function loadCoat() {
  const url = new URL('./assets/hohomochi.glb', import.meta.url);
  return (await new GLTFLoader().loadAsync(url.href)).scene;
}

const sphere = new T.SphereGeometry(1, 20, 14);
// The painted skin includes its studio shading. Use soft fill on the moving extremities to match it.
const skin = new T.MeshStandardMaterial({
  color: '#dcb6a6', roughness: 0.92, emissive: '#cba694', emissiveIntensity: 0.65,
});
const iris = new T.MeshStandardMaterial({ color: '#321a18', roughness: .39, emissive: '#49221d', emissiveIntensity: .38 });
const glint = new T.MeshBasicMaterial({ color: '#ffead7' });
const up = new T.Vector3(0, 1, 0);

function pad(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number) {
  const part = new T.Mesh(sphere, skin);
  part.position.set(x, y, z);
  part.scale.set(w, h, d);
  parent.add(part);
  return part;
}

function makeHand(parent: T.Group, side: number) {
  const palm = new T.Group();
  parent.add(palm);
  pad(palm, 0, 0, 0, .071, .066, .048);
  for (let i = 0; i < 3; i++) {
    const finger = pad(palm, side * (i - 1) * .035, .039, .014, .021, .043 - .006 * Math.abs(i-1), .023);
    finger.rotation.z = (1 - i) * side * .16;
  }
  pad(palm, -side * .055, .015, .010, .026, .039, .029).rotation.z = side * .40;
  const arm = pad(parent, 0, 0, 0, .066, .10, .065);
  const shoulder = new T.Vector3(side * .283, .423, .134);
  return { palm, arm, shoulder };
}

function setHand(hand: ReturnType<typeof makeHand>, x: number, y: number, z: number, roll: number) {
  const { palm, arm, shoulder } = hand;
  palm.position.set(x, y, z);
  palm.rotation.z = roll;
  arm.position.copy(palm.position).add(shoulder).multiplyScalar(.5);
  arm.scale.y = palm.position.distanceTo(shoulder) * .5 + .036;
  arm.quaternion.setFromUnitVectors(up, direction.subVectors(palm.position, shoulder).normalize());
}
const direction = new T.Vector3();

export function buildCharacter(coat: T.Group) {
  const figure = new T.Group();
  figure.add(coat);
  const cheeks = ['CheekLeft', 'CheekRight'].map((name) => {
    const part = coat.getObjectByName(name);
    if (!(part instanceof T.Mesh)) throw new Error('Missing model surface ' + name);
    part.userData.feature = 'cheek';
    return part;
  });
  for (const side of [-1, 1]) {
    const eye = new T.Mesh(sphere, iris);
    eye.position.set(side * .134, .925, .263);
    eye.scale.set(.029, .028, .023);
    eye.rotation.y = side * .29;
    figure.add(eye);
    const light = new T.Mesh(sphere, glint);
    light.position.set(-.22, .36, .87);
    light.scale.set(.135, .115, .08);
    eye.add(light);
    pad(figure, side * .204, .060, .013, .089, .063, .104);
    for (let i = -1; i <= 1; i++)
      pad(figure, side * .204 + i * .042, .035, .081, .035, .032, .052);
  }
  const tail = pad(figure, 0, .235, -.355, .071, .063, .113);
  tail.rotation.x = .15;
  const hands = [makeHand(figure, -1), makeHand(figure, 1)];
  const held = nut(figure, 0, .38, .36, .105);
  held.group.traverse((part) => { part.userData.feature = 'nut'; });
  return { figure, cheeks, hands, held };
}

// The quiet interval between two rubs lets a player standing on the path see the patterned back.
export function glanceAngle(time: number, trusted = false) {
  const phase = (time + (trusted ? tuning.cycle : 0)) % (3 * tuning.cycle);
  return Math.PI * (T.MathUtils.smoothstep(phase, 11.05, 12.10) - T.MathUtils.smoothstep(phase, 13.48, 14.55));
}

export function poseCharacter(actor: ReturnType<typeof buildCharacter>, behavior: Behavior, time: number, collection: number, trusted = false) {
  const { figure, hands, held } = actor;
  const phase = time % tuning.cycle;
  const collecting = behavior === 'collect';
  const walk = collecting ? Math.sin(Math.PI * collection) : 0;
  const show = behavior === 'show' ? 1 : 0;
  let press = 0;
  if (behavior === 'cheek') press = 1;
  else if (behavior === 'regrip') press = T.MathUtils.smoothstep(phase, tuning.regripStart, tuning.cheekStart);
  else if (behavior === 'idle' && phase >= tuning.cheekEnd)
    press = 1 - T.MathUtils.smoothstep(phase, tuning.cheekEnd, tuning.cheekEnd + .55);

  figure.position.y = Math.sin(time * 2.6) * .009 + Math.abs(Math.sin(time * 12)) * walk * .034;
  figure.rotation.y = collecting || show ? 0 : glanceAngle(time, trusted);
  figure.rotation.z = Math.sin(time * 1.7) * .012 - press * .018;
  const wiggle = press * Math.sin(time * 4.4);
  const x = .246 * press + .004 * wiggle;
  const y = .401 + .269 * press + .139 * show - .155 * walk + .007 * wiggle;
  const z = .361 + .085 * press + .126 * show - .033 * walk;
  held.group.visible = !collecting || collection >= .5;
  held.group.position.set(x, y, z);
  held.group.rotation.z = .31 * press + .055 * wiggle;

  // One hand turns the nut, then cups it against the cheek. The other returns to the low cheek.
  // During pickup and offering, both palms follow the actual nut on the leaf/in front of the belly.
  const support = (collecting || show) ? 0 : T.MathUtils.smoothstep(press, .08, .86);
  const leftX = T.MathUtils.lerp(x - .083, -.294, support);
  const leftY = T.MathUtils.lerp(y - .052, .486, support);
  const leftZ = T.MathUtils.lerp(z + .016, .264, support);
  setHand(hands[0], leftX, leftY, leftZ, -.19 - .17 * support);
  setHand(hands[1], x + .076, y - .063, z + .012, .24 - .09 * press);
}
