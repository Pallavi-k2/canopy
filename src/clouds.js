// clouds.js
// -----------------------------------------------------------------------------
// The clouds that are always drifting around the sky.
//
// - A few clouds are there from the start, each wandering slowly in its own
//   direction, bobbing and "breathing" a little.
// - When a cloud nears the edge of the open sky, it gently turns back.
// - Tap/click a cloud → it fizzles: it blurs, swells and fades while small
//   puffs drift away from it. A few seconds later a new cloud fades in.
//
// Clouds live in the `clouds` layer: above the sky, behind all the trees.
// Positions are in ARTWORK pixels.
// -----------------------------------------------------------------------------

import { Assets, BlurFilter, Point, Sprite } from 'pixi.js';
import { CONFIG } from './config.js';
import { loadAlphaMap } from './zones.js';

const CLOUD_URLS = [1, 2, 3, 4].map((n) => new URL(`../assets/cloud-${n}.webp`, import.meta.url).href);

const random = (min, max) => min + Math.random() * (max - min);
const TAU = Math.PI * 2;

/** Turn `angle` toward `target` by at most `maxStep` radians, the short way round. */
function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to -π…π
  return angle + Math.max(-maxStep, Math.min(maxStep, diff));
}

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

export async function createClouds({ layer, zones, particles }) {
  const C = CONFIG.clouds;

  // Cloud pictures, plus their transparency so taps only count on the cloud itself.
  const textures = await Promise.all(
    CLOUD_URLS.map((src) => Assets.load({ src, data: { autoGenerateMipmaps: true } })),
  );
  const alphaMaps = await Promise.all(CLOUD_URLS.map((url) => loadAlphaMap(url, 0.25)));

  const clouds = [];
  const respawnTimers = []; // seconds until each waiting cloud appears

  // --- Creating a cloud ---------------------------------------------------------
  function spawnCloud({ fadeIn }) {
    // Prefer a picture that isn't already in the sky, so they don't look repeated.
    const used = new Set(clouds.map((c) => c.image));
    const free = textures.map((_, i) => i).filter((i) => !used.has(i));
    const image = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * textures.length);

    const size = random(C.sizeMin, C.sizeMax);
    const radius = textures[image].width * size * 0.35; // rough size of the visible cloud
    const spot = zones.randomSkyPoint(radius * 0.8, clouds);

    const sprite = new Sprite(textures[image]);
    sprite.anchor.set(0.5);
    layer.addChild(sprite);

    const cloud = {
      sprite,
      image,
      size,
      radius,
      x: spot.x,
      y: spot.y,
      heading: Math.random() * TAU, // direction of travel (radians)
      speed: random(C.speedMin, C.speedMax),
      phase: Math.random() * 100, // so each cloud bobs/breathes at its own rhythm
      age: 0,
      appear: fadeIn ? 0 : 1, // 0 → 1 while fading in
      fizzle: null, // set while fizzling
    };
    clouds.push(cloud);
    placeSprite(cloud);
    return cloud;
  }

  // --- Moving ---------------------------------------------------------------------
  function steer(cloud, dt) {
    // 1. Wander: slowly change direction, like being nudged by soft breezes.
    cloud.heading += Math.sin(cloud.age * C.wanderSpeed + cloud.phase) * C.wanderAmount * dt;

    // 2. Stay in the sky: look a little ahead; if that's trees or paper, turn
    //    gently toward the middle of the sky. Turn harder if already over trees.
    const lookAhead = cloud.radius + C.edgeLookAhead;
    const aheadX = cloud.x + Math.cos(cloud.heading) * lookAhead;
    const aheadY = cloud.y + Math.sin(cloud.heading) * lookAhead;
    const centerInSky = zones.isSky(cloud.x, cloud.y);
    if (!zones.isSky(aheadX, aheadY) || !centerInSky) {
      const toCenter = Math.atan2(zones.skyCenter.y - cloud.y, zones.skyCenter.x - cloud.x);
      const strength = centerInSky ? C.steerStrength : C.steerStrength * 2;
      cloud.heading = turnToward(cloud.heading, toCenter, strength * dt);
    }
  }

  function move(cloud, dt) {
    let vx = Math.cos(cloud.heading) * cloud.speed;
    let vy = Math.sin(cloud.heading) * cloud.speed;

    // 3. Give each other a little room, so they scatter instead of piling up.
    for (const other of clouds) {
      if (other === cloud || other.fizzle) continue;
      const dx = cloud.x - other.x;
      const dy = cloud.y - other.y;
      const distance = Math.hypot(dx, dy) || 1;
      const comfortable = (cloud.radius + other.radius) * C.personalSpace;
      if (distance < comfortable) {
        const push = (1 - distance / comfortable) * C.speedMax;
        vx += (dx / distance) * push;
        vy += (dy / distance) * push;
      }
    }

    const slowdown = cloud.fizzle ? 1 - easeOutCubic(cloud.fizzle.t) : 1; // fizzling clouds slow to a stop
    cloud.x += vx * dt * slowdown;
    cloud.y += vy * dt * slowdown;
  }

  /** Apply position, bob, breathing, fade-in and fizzle to the picture. */
  function placeSprite(cloud) {
    const bob = Math.sin((cloud.age / C.bobPeriod) * TAU + cloud.phase) * C.bobDistance;
    const breath = 1 + Math.sin((cloud.age / C.breathPeriod) * TAU + cloud.phase) * C.breathing;
    const appear = easeOutCubic(cloud.appear);
    let scale = cloud.size * breath * (0.75 + 0.25 * appear);
    let alpha = appear;

    if (cloud.fizzle) {
      const t = cloud.fizzle.t;
      scale *= 1 + C.fizzleSwell * easeOutCubic(t); // swells a little as it thins out
      alpha *= 1 - t * t; // lingers at first, then thins away
      cloud.fizzle.blur.strength = C.fizzleBlur * t; // gets steadily softer
    }

    cloud.sprite.position.set(cloud.x, cloud.y + bob);
    cloud.sprite.scale.set(scale);
    cloud.sprite.alpha = alpha;
  }

  // --- Fizzling --------------------------------------------------------------------
  function startFizzle(cloud) {
    const blur = new BlurFilter({ strength: 0, quality: 3 });
    cloud.sprite.filters = [blur];
    cloud.fizzle = { t: 0, blur };

    // Small puffs pulled from the cloud's own picture drift away and fade.
    const map = alphaMaps[cloud.image];
    for (let i = 0; i < C.fizzlePuffs; i++) {
      // Pick a random spot that is actually part of the cloud.
      let u = 0;
      let v = 0;
      for (let tries = 0; tries < 30; tries++) {
        u = Math.random() * map.width;
        v = Math.random() * map.height;
        if (map.at(u, v) > 0.6) break;
      }
      const offsetX = (u - map.width / 2) * cloud.size;
      const offsetY = (v - map.height / 2) * cloud.size;
      const outward = Math.atan2(offsetY, offsetX) + random(-0.4, 0.4);
      const speed = random(C.fizzlePuffSpeed * 0.5, C.fizzlePuffSpeed);

      const puff = new Sprite(textures[Math.floor(Math.random() * textures.length)]);
      puff.anchor.set(0.5);
      puff.position.set(cloud.sprite.x + offsetX, cloud.sprite.y + offsetY);
      puff.scale.set(cloud.size * random(0.18, 0.32));
      puff.rotation = Math.random() * TAU;
      puff.alpha = 0.85;
      layer.addChild(puff);
      particles.add({
        sprite: puff,
        vx: Math.cos(outward) * speed,
        vy: Math.sin(outward) * speed,
        life: C.fizzleTime * random(0.9, 1.4),
        drag: 0.6,
        spin: random(-0.3, 0.3),
        grow: 0.5,
        delay: random(0, C.fizzleTime * 0.3),
      });
    }
  }

  // --- Tapping -----------------------------------------------------------------------
  const screenPoint = new Point();
  const local = new Point();

  /** The topmost cloud under a screen position (CSS pixels), or null. */
  function cloudAt(screenX, screenY) {
    screenPoint.set(screenX, screenY);
    for (let i = clouds.length - 1; i >= 0; i--) {
      const cloud = clouds[i];
      if (cloud.fizzle || cloud.appear < 0.5) continue;
      // toLocal undoes everything (window fit, parallax, bob, scale) for us.
      cloud.sprite.toLocal(screenPoint, undefined, local);
      const map = alphaMaps[cloud.image];
      if (map.at(local.x + map.width / 2, local.y + map.height / 2) > C.tapAlpha) return cloud;
    }
    return null;
  }

  /** Called on a tap/click. Returns true if a cloud was hit. */
  function tap(screenX, screenY) {
    const cloud = cloudAt(screenX, screenY);
    if (!cloud) return false;
    startFizzle(cloud);
    respawnTimers.push(random(C.respawnDelayMin, C.respawnDelayMax));
    return true;
  }

  // --- Every frame ---------------------------------------------------------------------
  function update(dt) {
    for (let i = clouds.length - 1; i >= 0; i--) {
      const cloud = clouds[i];
      cloud.age += dt;
      cloud.appear = Math.min(1, cloud.appear + dt / C.appearTime);
      if (cloud.fizzle) {
        cloud.fizzle.t = Math.min(1, cloud.fizzle.t + dt / C.fizzleTime);
      } else {
        steer(cloud, dt);
      }
      move(cloud, dt);
      placeSprite(cloud);

      if (cloud.fizzle && cloud.fizzle.t >= 1) {
        cloud.sprite.destroy();
        clouds.splice(i, 1);
      }
    }

    // New clouds to replace fizzled ones.
    for (let i = respawnTimers.length - 1; i >= 0; i--) {
      respawnTimers[i] -= dt;
      if (respawnTimers[i] <= 0) {
        respawnTimers.splice(i, 1);
        spawnCloud({ fadeIn: true });
      }
    }
  }

  // Clouds that are already in the sky when the page opens.
  for (let i = 0; i < C.count; i++) spawnCloud({ fadeIn: false });

  return { update, tap, isOverCloud: (x, y) => cloudAt(x, y) !== null };
}
