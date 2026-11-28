import { expect, it } from 'vitest';
import * as T from 'three';
import { buildCharacter, glanceAngle, poseCharacter } from '../../src/prototype3d/hohomochi';
import { naturalBehavior, tuning } from '../../src/prototype3d/rules';

function character() {
  // The browser suite loads the shipped geometry. Here the two local origins anchor pose measurements.
  const coat = new T.Group();
  for (const [name, side] of [['CheekLeft', -1], ['CheekRight', 1]] as const) {
    const cheek = new T.Mesh();
    cheek.name = name;
    cheek.position.set(side * .282, .710, .146);
    coat.add(cheek);
  }
  return buildCharacter(coat);
}

it('turns through a side and a back view between rubs, facing the path for every ecology exposure', () => {
  expect(glanceAngle(11.575)).toBeCloseTo(Math.PI / 2);
  expect(glanceAngle(12.8)).toBeCloseTo(Math.PI);
  expect(glanceAngle(12.8, true)).toBe(0);
  for (let t = 0; t < 6 * tuning.cycle; t += .05) {
    if (naturalBehavior(t) === 'cheek') expect(glanceAngle(t)).toBe(0);
  }
});

it('lifts a supported nut to the cheek while the free fingertips return under the opposite cheek', () => {
  const actor = character();
  const sample = (t: number) => {
    poseCharacter(actor, naturalBehavior(t), t, 0);
    const fruit = actor.held.group.position;
    expect(actor.hands[1].palm.position.distanceTo(fruit)).toBeLessThan(.11);
    return fruit.clone();
  };
  const idle = sample(.5), midway = sample(2.1), pressed = sample(3.2);
  expect(midway.y).toBeGreaterThan(idle.y);
  expect(midway.y).toBeLessThan(pressed.y);
  expect(pressed.y).toBeCloseTo(actor.cheeks[1].position.y, 1);
  expect(pressed.x).toBeCloseTo(actor.cheeks[1].position.x, 1);
  const left = actor.hands[0].palm.position;
  expect(left.x).toBeCloseTo(actor.cheeks[0].position.x, 1);
  expect(left.y + .085).toBeGreaterThan(.5);
  expect(left.y).toBeLessThan(.5);
});

it('takes the returned nut on contact with the leaf and presents it between both palms', () => {
  const actor = character();
  poseCharacter(actor, 'collect', 12.8, .49);
  expect(actor.held.group.visible).toBe(false);
  poseCharacter(actor, 'collect', 12.8, .5);
  expect(actor.held.group.visible).toBe(true);
  expect(actor.held.group.position.z).toBeCloseTo(.328);
  expect(actor.held.group.position.y + .06).toBeCloseTo(.31, 1);
  poseCharacter(actor, 'show', 12.8, 0);
  expect(actor.figure.rotation.y).toBe(0);
  for (const { palm } of actor.hands) expect(palm.position.distanceTo(actor.held.group.position)).toBeLessThan(.11);
});
