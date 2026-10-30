// scene.js
// -----------------------------------------------------------------------------
// Builds the stack of picture layers and keeps it fitted to the window.
//
// Everything inside `scene` is measured in ARTWORK pixels (1672 × 941), no
// matter how big the window is. We just scale the whole `scene` up or down to
// fit. That means clouds, birds etc. can always use artwork coordinates.
//
// Layer order, bottom → top:
//   1 sky
//   2 clouds        (filled by clouds.js)
//   3 trees-back
//   4 trees-front
//   5 birds         (filled by birds.js; also leaf bursts and feathers)
//   6 leaves-fore
//   7 falling       (leaves shaken loose by tapping the trees; they fall
//                    toward you, so they're in front of everything)
// All of them are clipped to the torn-paper edge (scene-mask.png).
//
// Every frame, each layer is nudged for parallax (follows the mouse, nearer
// layers move more) and the tree layers sway gently in a breeze.
// -----------------------------------------------------------------------------

import { Assets, Container, Sprite } from 'pixi.js';
import { CONFIG } from './config.js';

// Vite turns these into the right URLs for both `npm run dev` and the build.
export const URLS = {
  sky: new URL('../assets/sky.webp', import.meta.url).href,
  treesBack: new URL('../assets/trees-back.webp', import.meta.url).href,
  treesFront: new URL('../assets/trees-front.webp', import.meta.url).href,
  leavesFore: new URL('../assets/leaves-fore.webp', import.meta.url).href,
  mask: new URL('../assets/scene-mask.webp', import.meta.url).href,
};

/** Load the scene images. Mipmaps keep them smooth when shrunk on small screens. */
async function loadTextures() {
  const entries = Object.entries(URLS);
  const textures = await Promise.all(
    entries.map(([, src]) => Assets.load({ src, data: { autoGenerateMipmaps: true } })),
  );
  return Object.fromEntries(entries.map(([name], i) => [name, textures[i]]));
}

/**
 * A full-size picture layer, positioned by its center so it scales and sways
 * around the middle. Slightly enlarged (overscale) so parallax never shows an edge.
 */
function makeLayer(texture) {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.scale.set(CONFIG.scene.overscale);
  return sprite;
}

// Center of the artwork. Picture layers sit here; their parallax/sway offsets
// are added on top every frame.
const CENTER_X = CONFIG.scene.width / 2;
const CENTER_Y = CONFIG.scene.height / 2;

// --- Motion settings ---------------------------------------------------------

// No mouse (phones, tablets) → use the slow automatic drift instead of parallax.
const isTouchOnly = window.matchMedia('(hover: none)').matches;

// The visitor asked their computer for less motion → no parallax, no sway.
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Smoothly move `current` toward `target`. Same feel at any frame rate. */
function ease(current, target, speed, dt) {
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

/**
 * Create the scene and add it to the app.
 * Returns the pieces other files need (layers to add things into, and helpers).
 */
export async function createScene(app) {
  const textures = await loadTextures();

  // `scene` = the whole illustration. It gets scaled to fit the window.
  const scene = new Container();
  scene.alpha = 0; // fades in once everything is ready (see update below)
  app.stage.addChild(scene);

  // `world` = all the layers that get clipped by the torn-paper edge.
  const world = new Container();
  scene.addChild(world);

  const layers = {
    sky: makeLayer(textures.sky),
    clouds: new Container(),
    treesBack: makeLayer(textures.treesBack),
    treesFront: makeLayer(textures.treesFront),
    birds: new Container(),
    leavesFore: makeLayer(textures.leavesFore),
    falling: new Container(),
  };
  world.addChild(
    layers.sky,
    layers.clouds,
    layers.treesBack,
    layers.treesFront,
    layers.birds,
    layers.leavesFore,
    layers.falling,
  );

  // The torn-paper mask. It stays still while the layers move behind it, so
  // the paper edge never shifts and no layer edge can ever peek out.
  const mask = new Sprite(textures.mask);
  scene.addChild(mask);
  world.mask = mask;

  // --- Fitting to the window ------------------------------------------------
  // Fit the artwork fully inside the window, keep its shape, and center it.
  function resize(screenWidth, screenHeight) {
    const { width, height, margin } = CONFIG.scene;
    const availableW = screenWidth * (1 - margin * 2);
    const availableH = screenHeight * (1 - margin * 2);
    const scale = Math.min(availableW / width, availableH / height);
    scene.scale.set(scale);
    scene.position.set((screenWidth - width * scale) / 2, (screenHeight - height * scale) / 2);
  }
  resize(app.screen.width, app.screen.height);
  app.renderer.on('resize', resize);

  /** Convert a point on the screen (e.g. the mouse) into artwork pixels. */
  function screenToScene(x, y) {
    return {
      x: (x - scene.position.x) / scene.scale.x,
      y: (y - scene.position.y) / scene.scale.y,
    };
  }

  /** Where the artwork sits on the screen, in CSS pixels. */
  function screenBounds() {
    const { width, height } = CONFIG.scene;
    return {
      left: scene.position.x,
      top: scene.position.y,
      right: scene.position.x + width * scene.scale.x,
      bottom: scene.position.y + height * scene.scale.y,
    };
  }

  /** Convert a length on the screen (e.g. a circle's size) into artwork pixels. */
  function screenLengthToScene(length) {
    return length / scene.scale.x;
  }

  // --- Mouse tracking for parallax --------------------------------------------
  // `pointer` = where the mouse is, from -1 (left/top edge of the window) to
  // +1 (right/bottom edge). 0,0 is the middle.
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return; // fingers draw, they don't tilt the view
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  });
  // Mouse left the window/iframe → glide back to the middle.
  document.documentElement.addEventListener('mouseleave', () => {
    pointer.x = 0;
    pointer.y = 0;
  });

  // `view` = the eased "look direction" (-1..1) that all layers follow.
  const view = { x: 0, y: 0 };

  // Each layer's current parallax + sway offset, in artwork pixels.
  // Other files use this to line things up with what's on screen.
  const offsets = Object.fromEntries(Object.keys(layers).map((name) => [name, { x: 0, y: 0 }]));

  // --- Per-frame update -------------------------------------------------------
  let age = 0;
  function update(dt) {
    age += dt;
    scene.alpha = Math.min(1, age / CONFIG.scene.fadeInTime); // gentle fade-in

    const still = reducedMotionQuery.matches;

    // 1. Where should the view be looking?
    let targetX = 0;
    let targetY = 0;
    if (still) {
      // reduced motion: stay centered
    } else if (isTouchOnly) {
      // Slow figure-of-eight drift.
      const { amount, period } = CONFIG.parallax.touchDrift;
      const t = (age / period) * Math.PI * 2;
      targetX = Math.sin(t) * amount;
      targetY = Math.sin(t * 2) * amount * 0.5;
    } else {
      targetX = pointer.x;
      targetY = pointer.y;
    }
    view.x = ease(view.x, targetX, CONFIG.parallax.easing, dt);
    view.y = ease(view.y, targetY, CONFIG.parallax.easing, dt);

    // 2. Move every layer: parallax (opposite to the mouse, more for nearer
    //    layers) plus a gentle breeze sway on the tree layers.
    for (const [name, layer] of Object.entries(layers)) {
      const depth = CONFIG.parallax.depth[name] ?? 0;
      let x = -view.x * depth;
      let y = -view.y * depth;
      let tilt = 0;

      const sway = CONFIG.sway[name];
      if (sway && !still) {
        // Two sine waves at different speeds so the breeze never looks mechanical.
        const t = (age / sway.period) * Math.PI * 2;
        const wave = Math.sin(t) * 0.7 + Math.sin(t * 1.7 + 1.3) * 0.3;
        x += wave * sway.distance;
        y += Math.sin(t * 0.8 + 0.5) * sway.distance * 0.4;
        tilt = wave * sway.tilt;
      }

      offsets[name].x = x;
      offsets[name].y = y;
      // Picture layers are positioned by their center; the empty containers
      // for clouds and birds start at the top-left corner (0, 0).
      const isPicture = layer instanceof Sprite;
      layer.position.set((isPicture ? CENTER_X : 0) + x, (isPicture ? CENTER_Y : 0) + y);
      layer.angle = tilt;
    }
  }

  return { scene, layers, offsets, textures, screenToScene, screenLengthToScene, screenBounds, update };
}
