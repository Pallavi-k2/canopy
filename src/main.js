// main.js
// -----------------------------------------------------------------------------
// Starting point: creates the PixiJS app, builds the scene and runs the main
// animation loop. Each feature lives in its own file; this one just wires them
// together.
// -----------------------------------------------------------------------------

import { Application } from 'pixi.js';
import { CONFIG } from './config.js';
import { createScene } from './scene.js';
import { createZones } from './zones.js';
import { createParticles } from './particles.js';
import { createClouds } from './clouds.js';
import { createBirds } from './birds.js';
import { createDrawing } from './drawing.js';
import { detectCircle } from './circle.js';
import { createHint } from './hint.js';

// The visitor asked their device for less motion (checked live, so changing
// the setting takes effect without a reload).
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

async function start() {
  const container = document.getElementById('app');

  // 1. Create the drawing surface (a <canvas>) that fills the window.
  const app = new Application();
  await app.init({
    background: CONFIG.page.background,
    resizeTo: window, // follows the window size, which also works inside an iframe
    resolution: Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio),
    autoDensity: true, // keeps the canvas the right CSS size on sharp screens
    antialias: true,
  });
  container.appendChild(app.canvas);

  // 2. Build the layered illustration and everything that lives in it.
  const scene = await createScene(app);
  const zones = await createZones();
  const particles = await createParticles();
  const clouds = await createClouds({ layer: scene.layers.clouds, zones, particles });
  const birds = await createBirds({ layer: scene.layers.birds, zones, particles });

  // 3. Taps and clicks (birds, trees, clouds) and drawing (circles).
  const trees = {
    /** Tap on the trees → a few leaves come loose. Returns true if it was trees. */
    tap(x, y) {
      // Screen → artwork pixels, minus how far the trees have shifted right now.
      const spot = scene.screenToScene(x, y);
      const shift = scene.offsets.treesFront;
      if (!zones.isTrees(spot.x - shift.x, spot.y - shift.y)) return false;
      const local = scene.layers.falling.toLocal({ x, y });
      particles.fallingLeaves(scene.layers.falling, local.x, local.y);
      return true;
    },
  };
  setUpTaps(app.canvas, { birds, trees, clouds });

  const hint = createHint({ app, scene });

  const drawing = createDrawing({
    app,
    onStrokeEnd(points) {
      const circle = detectCircle(points);
      if (!circle) return false;
      // A circle anywhere adds a bird right where it was drawn.
      const zone = whereIsCircle(circle, scene, zones);
      const spot = birds.toLayer(circle.x, circle.y);
      birds.addFromCircle(spot.x, spot.y, zone);
      hint.dismiss(); // they've got it now
      return true;
    },
  });

  pauseWhenNotSeen(app);

  // While developing (npm run dev only), type `canopy` in the browser console
  // to poke at things, e.g. canopy.birds.count().
  if (import.meta.env.DEV) window.canopy = { app, scene, zones, clouds, birds, trees };

  // 4. Main loop: runs every frame (~60 times a second).
  app.ticker.add((ticker) => {
    // deltaMS = milliseconds since the last frame. Capped so a slow frame
    // (or coming back to the tab) never makes things jump.
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    // Reduced motion: clouds, birds and particles drift more slowly.
    const lifeDt = reducedMotion.matches ? dt * CONFIG.reducedMotion.speed : dt;
    scene.update(dt);
    clouds.update(lifeDt);
    birds.update(lifeDt);
    particles.update(lifeDt);
    drawing.update(dt); // your own strokes always respond at normal speed
  });
}

/**
 * Stop animating while nobody can see it, to save battery and keep the
 * portfolio page around it smooth:
 *   - the browser tab is hidden, or
 *   - (inside an iframe) the canvas has been scrolled out of view.
 */
function pauseWhenNotSeen(app) {
  let tabVisible = !document.hidden;
  let onScreen = true;
  const apply = () => {
    if (tabVisible && onScreen) app.ticker.start();
    else app.ticker.stop();
  };

  document.addEventListener('visibilitychange', () => {
    tabVisible = !document.hidden;
    apply();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      apply();
    }).observe(app.canvas);
  }
}

/**
 * Is a circle (in screen pixels) mostly on the open "sky" or on the "trees"?
 * Checks several spots inside it against the hidden zone map and takes a vote.
 */
function whereIsCircle(circle, scene, zones) {
  // Screen → artwork pixels, then undo how far the trees have shifted
  // (parallax + sway), so we look at the spot the trees are drawn at right now.
  const center = scene.screenToScene(circle.x, circle.y);
  const treesShift = scene.offsets.treesFront;
  const radius = scene.screenLengthToScene(circle.diameter / 2);
  const skyShare = zones.skyAmount(
    center.x - treesShift.x,
    center.y - treesShift.y,
    radius * 0.8,
    CONFIG.circle.zoneSamples - 1,
  );
  return skyShare >= 0.5 ? 'sky' : 'trees';
}

/**
 * A "tap" is a quick press and release without dragging (mouse, finger or pen).
 * Tapping a bird startles it; tapping the trees shakes a few leaves loose;
 * tapping a cloud makes it fizzle. Checked front to back: birds fly in front
 * of the trees, and clouds are behind them. Dragging is left for drawing.
 */
function setUpTaps(canvas, { birds, trees, clouds }) {
  const { tapMaxMove, tapMaxTime } = CONFIG.input;
  let press = null;

  // Pointer position relative to the canvas, in CSS pixels.
  const positionOf = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  canvas.addEventListener('pointerdown', (event) => {
    press = { id: event.pointerId, time: performance.now(), ...positionOf(event) };
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!press || press.id !== event.pointerId) return;
    const { x, y } = positionOf(event);
    const moved = Math.hypot(x - press.x, y - press.y);
    const seconds = (performance.now() - press.time) / 1000;
    press = null;
    if (moved > tapMaxMove || seconds > tapMaxTime) return; // that was a drag, not a tap
    birds.tap(x, y) || trees.tap(x, y) || clouds.tap(x, y); // stops at the first one hit
  });

  canvas.addEventListener('pointercancel', () => {
    press = null;
  });

  // Mouse users get a hand cursor over birds and clouds, as a hint they can be clicked.
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const { x, y } = positionOf(event);
    canvas.style.cursor = birds.isOverBird(x, y) || clouds.isOverCloud(x, y) ? 'pointer' : 'default';
  });
}

start();
