// particles.js
// -----------------------------------------------------------------------------
// Little short-lived bits that drift, spin, grow and fade, then disappear:
//   - cloud "fizzle" puffs (made in clouds.js, animated here)
//   - the leaf burst when a bird bursts out of the trees
//   - the soft white puff when a bird appears in the open sky
//   - feathers drifting down when a bird is tapped
//   - leaves fluttering down when the trees are tapped
//
// Usage:  particles.add({ sprite, vx, vy, life, ... })  — see `add` below.
// -----------------------------------------------------------------------------

import { Graphics, Sprite, Texture } from 'pixi.js';
import { CONFIG } from './config.js';
import { URLS } from './scene.js';

const random = (min, max) => min + Math.random() * (max - min);

export async function createParticles() {
  const list = [];
  const leafColors = await sampleTreeColors(URLS.treesFront);
  const softDot = makeSoftDotTexture();

  /**
   * Start a particle. The sprite must already be added to a layer.
   *   vx, vy   starting speed (artwork pixels per second)
   *   life     how long it lasts (seconds)
   *   drag     how quickly it slows down (0 = never)
   *   gravity  pull downward (pixels per second², 0 = none)
   *   spin     turning speed (radians per second)
   *   grow     how much bigger it gets by the end (0.4 = 40% bigger)
   *   delay    wait this long before appearing (seconds)
   *   fadeLate stay solid most of its life and fade only at the end
   *   sway     side-to-side drift like a falling leaf (pixels; 0 = none)
   *   swaySpeed how fast it swings side to side (radians per second)
   */
  function add({
    sprite, vx = 0, vy = 0, life = 1, drag = 0, gravity = 0, spin = 0, grow = 0, delay = 0, fadeLate = false,
    sway = 0, swaySpeed = 0,
  }) {
    list.push({
      sprite,
      vx,
      vy,
      life,
      drag,
      gravity,
      spin,
      grow,
      fadeLate,
      sway,
      swaySpeed,
      swayPhase: Math.random() * Math.PI * 2,
      swayOffset: 0,
      baseRotation: sprite.rotation,
      age: -delay,
      startAlpha: sprite.alpha,
      startScale: sprite.scale.x,
    });
    if (delay > 0) sprite.alpha = 0;
  }

  /** 8–14 little green leaves pop out, spin, fall and fade. */
  function leafBurst(layer, x, y) {
    const L = CONFIG.leafBurst;
    const count = Math.round(random(L.countMin, L.countMax));
    for (let i = 0; i < count; i++) {
      const leaf = makeLeaf(leafColors[Math.floor(Math.random() * leafColors.length)], L.size * random(0.7, 1.2));
      leaf.position.set(x + random(-10, 10), y + random(-10, 10));
      leaf.rotation = Math.random() * Math.PI * 2;
      layer.addChild(leaf);
      const angle = Math.random() * Math.PI * 2;
      const speed = random(L.speedMin, L.speedMax);
      add({
        sprite: leaf,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // a little upward pop first
        life: L.life * random(0.8, 1.2),
        drag: 1.2,
        gravity: L.gravity,
        spin: random(-5, 5),
        fadeLate: true,
      });
    }
  }

  /** A soft white puff of little round wisps. */
  function skyPuff(layer, x, y) {
    const P = CONFIG.skyPuff;
    for (let i = 0; i < P.count; i++) {
      const wisp = new Sprite(softDot);
      wisp.anchor.set(0.5);
      wisp.position.set(x, y);
      wisp.scale.set((P.size * random(0.6, 1.1)) / softDot.width);
      wisp.alpha = 0.7;
      layer.addChild(wisp);
      const angle = (i / P.count) * Math.PI * 2 + random(-0.3, 0.3);
      const speed = P.speed * random(0.6, 1.2);
      add({
        sprite: wisp,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: P.life * random(0.8, 1.2),
        drag: 2,
        grow: 1.2,
      });
    }
  }

  /**
   * A few leaves shaken loose by a tap on the trees. They flutter down,
   * swinging side to side, and grow a little as they fall toward you.
   */
  function fallingLeaves(layer, x, y) {
    const F = CONFIG.fallingLeaves;
    const count = Math.round(random(F.countMin, F.countMax));
    for (let i = 0; i < count; i++) {
      const leaf = makeLeaf(leafColors[Math.floor(Math.random() * leafColors.length)], F.size * random(0.8, 1.2));
      leaf.position.set(x + random(-F.spread, F.spread), y + random(-F.spread, F.spread));
      leaf.rotation = Math.random() * Math.PI * 2;
      layer.addChild(leaf);
      add({
        sprite: leaf,
        vx: random(-15, 15),
        vy: random(0, 15),
        life: F.life * random(0.8, 1.2),
        drag: 0.9,
        gravity: F.fallSpeed * 0.9, // with drag, settles at about fallSpeed
        spin: random(-0.8, 0.8),
        grow: F.grow,
        sway: F.sway * random(0.7, 1.3),
        swaySpeed: F.swaySpeed * random(0.8, 1.2),
        delay: random(0, 0.35), // they come loose one after another
        fadeLate: true,
      });
    }
  }

  /** A few small white feathers that float and rock gently downward. */
  function feathers(layer, x, y, count, life, size) {
    for (let i = 0; i < count; i++) {
      const feather = new Graphics()
        .ellipse(0, 0, size / 2, size / 5)
        .fill({ color: 0xffffff, alpha: 0.95 })
        .moveTo(-size / 2, 0)
        .lineTo(size / 2, 0)
        .stroke({ width: 0.6, color: 0xd9dfea, alpha: 0.8 });
      feather.position.set(x + random(-size, size), y + random(-size, size));
      feather.rotation = Math.random() * Math.PI * 2;
      layer.addChild(feather);
      add({
        sprite: feather,
        vx: random(-40, 40),
        vy: random(-30, 10),
        life: life * random(0.8, 1.2),
        drag: 1.4,
        gravity: 22, // floats down slowly
        spin: random(-2, 2),
        fadeLate: true,
      });
    }
  }

  function update(dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age < 0) continue; // still waiting to start

      const t = Math.min(1, p.age / p.life); // 0 → 1 over its life
      p.vx *= Math.exp(-p.drag * dt);
      p.vy *= Math.exp(-p.drag * dt);
      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.baseRotation += p.spin * dt;
      p.sprite.rotation = p.baseRotation;

      if (p.sway) {
        // Swing side to side, tilting into each swing, like a leaf on the air.
        const swing = Math.sin(p.age * p.swaySpeed + p.swayPhase);
        const offset = swing * p.sway;
        p.sprite.x += offset - p.swayOffset;
        p.swayOffset = offset;
        p.sprite.rotation += Math.cos(p.age * p.swaySpeed + p.swayPhase) * 0.6;
      }
      p.sprite.scale.set(p.startScale * (1 + p.grow * easeOut(t)));
      // Quick soft fade-in, then a gentle fade-out (late or all along).
      const fadeIn = Math.min(1, p.age / 0.15);
      const fadeOut = p.fadeLate ? 1 - t ** 3 : (1 - t) * (1 - t);
      p.sprite.alpha = p.startAlpha * fadeIn * fadeOut;

      if (t >= 1) {
        p.sprite.destroy();
        list.splice(i, 1);
      }
    }
  }

  return { add, update, leafBurst, skyPuff, feathers, fallingLeaves };
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

/** A small pointed leaf shape with a thin darker edge and vein. */
function makeLeaf(color, length) {
  const half = length / 2;
  const leaf = new Graphics()
    .moveTo(-half, 0)
    .quadraticCurveTo(0, -half * 0.9, half, 0)
    .quadraticCurveTo(0, half * 0.9, -half, 0)
    .fill(color)
    .stroke({ width: 0.8, color: 0x3d5a1e, alpha: 0.55 }) // edge, so it reads against foliage
    .moveTo(-half * 0.8, 0)
    .lineTo(half * 0.8, 0)
    .stroke({ width: 0.6, color: 0x3d5a1e, alpha: 0.35 });
  return leaf;
}

/** A round white blob that fades out softly at the edges. */
function makeSoftDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 253, 245, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 253, 245, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

/**
 * Make a tree colour fresher and brighter (more saturated, lighter), so the
 * flying leaves stand out against the trees they came from.
 */
function sunlit(r, g, b) {
  const amount = CONFIG.leafBurst.brighten;
  // Push each channel away from the grey average (more colour)…
  const grey = (r + g + b) / 3;
  const saturate = (c) => grey + (c - grey) * (1 + amount * 2);
  // …then lighten toward a warm white.
  const lighten = (c, to) => Math.max(0, Math.min(255, Math.round(c + (to - c) * amount * 0.6)));
  return (lighten(saturate(r), 255) << 16) | (lighten(saturate(g), 255) << 8) | lighten(saturate(b), 200);
}

/** Pick ~40 leafy green colours straight from the tree picture. */
async function sampleTreeColors(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = Math.round((200 * img.naturalHeight) / img.naturalWidth);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const colors = [];
  for (let tries = 0; tries < 5000 && colors.length < 40; tries++) {
    const i = Math.floor(Math.random() * (data.length / 4)) * 4;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const isLeafy = a > 240 && g > r && g > b + 40; // solid and clearly green (not bark)
    if (isLeafy) colors.push(sunlit(r, g, b));
  }
  return colors.length ? colors : [0x8fbf3a, 0xa7cc4a, 0x6f9e2e];
}
