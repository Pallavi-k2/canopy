// birds.js
// -----------------------------------------------------------------------------
// The white birds flying around the sky.
//
// - A few birds are already flying when the page opens.
// - Circle anywhere → a new bird appears there, grows to full size and flies
//   out toward the open sky (with a leaf burst on trees, a puff on sky).
// - Birds flap (frames 3 → 4 → 5 → 1 → 2 …), sometimes glide, wander in
//   gentle curves, and steer back toward the open sky.
// - If there are too many, the oldest one flies off the edge and is removed.
// - Tap/click a bird → it's startled: a little jump, fast flapping, a swerve
//   away from your tap, and a few feathers drifting down. Then it calms down.
//
// Birds live in the `birds` layer: above the trees, below the corner leaves.
// Positions are in ARTWORK pixels. The bird pictures point their head UP.
// -----------------------------------------------------------------------------

import { Assets, Point, Sprite } from 'pixi.js';
import { CONFIG } from './config.js';

const BIRD_URLS = [1, 2, 3, 4, 5].map((n) => new URL(`../assets/bird-${n}.webp`, import.meta.url).href);

const random = (min, max) => min + Math.random() * (max - min);
const TAU = Math.PI * 2;

/** Turn `angle` toward `target` by at most `maxStep` radians, the short way round. */
function turnToward(angle, target, maxStep) {
  const diff = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + Math.max(-maxStep, Math.min(maxStep, diff));
}

/** Overshoots a touch then settles: a soft "pop" for growing in. */
function easeOutBack(t) {
  const s = 1.4;
  return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
}

export async function createBirds({ layer, zones, particles }) {
  const B = CONFIG.birds;
  const { width, height } = CONFIG.scene;

  const frames = await Promise.all(
    BIRD_URLS.map((src) => Assets.load({ src, data: { autoGenerateMipmaps: true } })),
  );
  // flapOrder uses picture numbers 1–5; turn them into list positions 0–4.
  const order = B.flapOrder.map((n) => n - 1);
  const GLIDE_FRAME = 2; // bird-3: wings spread flat

  const birds = [];

  // --- Creating a bird ---------------------------------------------------------
  function makeBird(x, y, heading, emerging) {
    const sprite = new Sprite(frames[order[0]]);
    sprite.anchor.set(0.5); // the body is centered in every frame
    sprite.tint = B.tint; // white by default (see config)
    layer.addChild(sprite);

    const bird = {
      sprite,
      x,
      y,
      heading,
      speed: random(B.speedMin, B.speedMax),
      size: random(B.sizeMin, B.sizeMax),
      phase: Math.random() * 100, // so each bird wanders/bobs differently
      age: 0,
      flapClock: Math.random() * order.length, // which frame we're on (with fraction)
      glide: 0, // seconds of gliding left
      emerge: emerging ? 0 : 1, // 0 → 1 while growing in
      leaving: false,
      startle: 0, // seconds of "startled!" left after being tapped
      startleHeading: 0, // the direction it swerves to
    };
    birds.push(bird);
    return bird;
  }

  /** Add a bird where a circle was drawn. `x, y` are in this layer's pixels. */
  function addFromCircle(x, y, zone) {
    // Head out toward the open sky (a bit of randomness so it's not robotic).
    const toSky = Math.atan2(zones.skyCenter.y - y, zones.skyCenter.x - x);
    const heading = zone === 'trees' ? toSky + random(-0.5, 0.5) : Math.random() * TAU;
    makeBird(x, y, heading, true);

    if (zone === 'trees') particles.leafBurst(layer, x, y);
    else particles.skyPuff(layer, x, y);

    makeRoom();
  }

  /** Too many birds? The oldest one leaves (flies off-screen). */
  function makeRoom() {
    const staying = birds.filter((b) => !b.leaving);
    for (let i = 0; i < staying.length - B.maxCount; i++) {
      const bird = staying[i]; // oldest first
      bird.leaving = true;
      bird.glide = 0;
    }
  }

  // --- Tapping a bird ------------------------------------------------------------
  const S = B.startle;
  const screenPoint = new Point();
  const local = new Point();

  /** The bird under a screen position (CSS pixels), or null. */
  function birdAt(screenX, screenY) {
    screenPoint.set(screenX, screenY);
    for (let i = birds.length - 1; i >= 0; i--) {
      const bird = birds[i];
      if (bird.leaving || bird.emerge < 1) continue;
      // toLocal undoes position, turning and size, so we can test against the
      // picture itself: an oval over the bird, generous because birds move.
      bird.sprite.toLocal(screenPoint, undefined, local);
      const texture = bird.sprite.texture;
      const nx = local.x / (texture.width * S.hitSize);
      const ny = local.y / (texture.height * S.hitSize);
      if (nx * nx + ny * ny <= 1) return bird;
    }
    return null;
  }

  /** Called on a tap/click. Startles the bird under it. Returns true if hit. */
  function tap(screenX, screenY) {
    const bird = birdAt(screenX, screenY);
    if (!bird) return false;

    // Swerve away from the side that was tapped.
    const tapped = layer.toLocal(screenPoint.set(screenX, screenY));
    const toTapX = tapped.x - bird.x;
    const toTapY = tapped.y - bird.y;
    const side = Math.cos(bird.heading) * toTapY - Math.sin(bird.heading) * toTapX; // + = tap on the right
    bird.startleHeading = bird.heading + (side > 0 ? -S.swerve : S.swerve);
    bird.startle = S.duration;
    bird.glide = 0; // no gliding while startled

    particles.feathers(layer, bird.x, bird.y, S.feathers, S.featherLife, 26 * (bird.size / 0.24));
    return true;
  }

  /** How startled a bird is right now: 1 = just tapped, 0 = calm. */
  const startleAmount = (bird) => Math.max(0, bird.startle / S.duration);

  // --- Flying --------------------------------------------------------------------
  function steer(bird, dt) {
    if (bird.startle > 0 && !bird.leaving && startleAmount(bird) > 0.4) {
      // Just been tapped: swerve away quickly, then go back to normal flying.
      bird.heading = turnToward(bird.heading, bird.startleHeading, S.turnRate * dt);
      return;
    }

    if (bird.leaving) {
      // Head straight out, away from the middle of the sky.
      const away = Math.atan2(bird.y - zones.skyCenter.y, bird.x - zones.skyCenter.x);
      bird.heading = turnToward(bird.heading, away, B.steerStrength * dt);
      return;
    }

    // Look ahead: trees or too close to the edge → curve back toward the sky.
    const aheadX = bird.x + Math.cos(bird.heading) * B.lookAhead;
    const aheadY = bird.y + Math.sin(bird.heading) * B.lookAhead;
    const m = B.edgeMargin;
    const offEdge = aheadX < m || aheadX > width - m || aheadY < m || aheadY > height - m;
    if (offEdge || !zones.isSky(aheadX, aheadY)) {
      const toSky = Math.atan2(zones.skyCenter.y - bird.y, zones.skyCenter.x - bird.x);
      bird.heading = turnToward(bird.heading, toSky, B.steerStrength * dt);
    } else {
      // Free sky ahead: wander in lazy curves (two waves mixed so it never repeats).
      const t = bird.age * B.wanderSpeed + bird.phase;
      const curve = Math.sin(t) * 0.65 + Math.sin(t * 2.3 + 1.7) * 0.35;
      bird.heading += curve * B.wanderTurn * dt;
    }

    // Give each other room: turn gently away from a bird that's too close.
    for (const other of birds) {
      if (other === bird) continue;
      const dx = bird.x - other.x;
      const dy = bird.y - other.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0 && distance < B.personalSpace) {
        const away = Math.atan2(dy, dx);
        const strength = (1 - distance / B.personalSpace) * B.steerStrength * 0.6;
        bird.heading = turnToward(bird.heading, away, strength * dt);
      }
    }
  }

  function flap(bird, dt) {
    if (bird.glide > 0) {
      bird.glide -= dt;
      return GLIDE_FRAME;
    }
    const before = Math.floor(bird.flapClock);
    const flapSpeed = B.flapFps * (1 + (S.flapBoost - 1) * startleAmount(bird)); // flaps hard when startled
    bird.flapClock = (bird.flapClock + dt * flapSpeed) % order.length;
    const now = Math.floor(bird.flapClock);
    // Finished a wingbeat (back to the first frame)? Maybe glide for a while.
    if (now < before && !bird.leaving && bird.startle <= 0 && Math.random() < B.glideChance) {
      bird.glide = random(B.glideMin, B.glideMax);
    }
    return order[now];
  }

  // --- Every frame -------------------------------------------------------------------
  function update(dt) {
    for (let i = birds.length - 1; i >= 0; i--) {
      const bird = birds[i];
      bird.age += dt;
      bird.emerge = Math.min(1, bird.emerge + dt / B.emergeTime);
      bird.startle = Math.max(0, bird.startle - dt);
      const startled = startleAmount(bird);

      steer(bird, dt);
      const startleSpeed = 1 + (S.speedBoost - 1) * startled * startled; // eases back smoothly
      const speed = bird.speed * (bird.leaving ? B.leaveSpeedBoost : 1) * startleSpeed;
      bird.x += Math.cos(bird.heading) * speed * dt;
      bird.y += Math.sin(bird.heading) * speed * dt;

      // Picture, position, facing, size.
      const sprite = bird.sprite;
      sprite.texture = frames[flap(bird, dt)];
      sprite.position.set(bird.x, bird.y);
      sprite.rotation = bird.heading + Math.PI / 2; // picture faces up, so turn a quarter extra
      const altitude = 1 + Math.sin((bird.age / B.heightPeriod) * TAU + bird.phase) * B.heightChange;
      const grow = B.emergeStartScale + (1 - B.emergeStartScale) * easeOutBack(bird.emerge);
      // A quick little size "jump" right after being tapped.
      const sinceTap = (1 - startled) * S.duration;
      const pop = startled > 0 ? 1 + S.pop * Math.sin(Math.min(1, sinceTap / 0.35) * Math.PI) : 1;
      sprite.scale.set(bird.size * altitude * grow * pop);
      sprite.alpha = Math.min(1, bird.emerge * 4);

      // Gone off the edge? Remove it.
      const margin = 150;
      if (bird.leaving && (bird.x < -margin || bird.x > width + margin || bird.y < -margin || bird.y > height + margin)) {
        sprite.destroy();
        birds.splice(i, 1);
      }
    }
  }

  // The birds already flying when the page opens.
  for (let i = 0; i < B.startCount; i++) {
    const spot = zones.randomSkyPoint(40, birds);
    makeBird(spot.x, spot.y, Math.random() * TAU, false);
  }

  const point = new Point();
  return {
    update,
    addFromCircle,
    tap,
    isOverBird: (x, y) => birdAt(x, y) !== null,
    /** How many birds there are: { flying, leaving }. Handy for testing. */
    count: () => ({ flying: birds.filter((b) => !b.leaving).length, leaving: birds.filter((b) => b.leaving).length }),
    /** Convert a screen position (CSS pixels) into this layer's pixels. */
    toLayer: (x, y) => layer.toLocal(point.set(x, y)),
  };
}
