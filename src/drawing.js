// drawing.js
// -----------------------------------------------------------------------------
// Draws the soft white brush stroke that follows your mouse, finger or pen.
//
// - Press and drag to draw. (A quick tap doesn't draw anything; taps are for
//   clouds.)
// - When you let go, the stroke is handed to `onStrokeEnd(points)`, which
//   says whether it was a circle.
//   · circle      → the stroke simply fades out
//   · not circle  → it does a tiny wobble ("nope!") while it fades
//
// Strokes are drawn on top of everything, in SCREEN pixels.
// -----------------------------------------------------------------------------

import { Container, Graphics } from 'pixi.js';
import { getStroke } from 'perfect-freehand';
import { CONFIG } from './config.js';

export function createDrawing({ app, onStrokeEnd }) {
  const D = CONFIG.drawing;
  const canvas = app.canvas;

  // Strokes sit above the whole scene.
  const layer = new Container();
  app.stage.addChild(layer);

  let current = null; // the stroke being drawn right now
  const fading = []; // finished strokes that are fading away

  // Pointer position relative to the canvas, in CSS pixels.
  const positionOf = (event) => {
    const box = canvas.getBoundingClientRect();
    // Pens report real pressure; mice/fingers don't (perfect-freehand fakes it).
    const pressure = event.pointerType === 'pen' ? event.pressure : 0.5;
    return [event.clientX - box.left, event.clientY - box.top, pressure];
  };

  /** Turn the list of points into a smooth brush shape and draw it. */
  function render(stroke) {
    const options = {
      size: D.width,
      thinning: D.thinning,
      smoothing: D.smoothing,
      streamline: D.streamline,
      simulatePressure: stroke.pointerType !== 'pen',
    };
    const g = stroke.graphics;
    g.clear();
    // A wide faint halo underneath, then the brighter core: looks soft and brushy.
    const halo = getStroke(stroke.points, { ...options, size: D.width * D.haloScale });
    const core = getStroke(stroke.points, options);
    if (halo.length > 2) g.poly(halo.flat()).fill({ color: D.color, alpha: D.haloAlpha });
    if (core.length > 2) g.poly(core.flat()).fill({ color: D.color, alpha: D.alpha });
  }

  // --- Pointer events -------------------------------------------------------------
  canvas.addEventListener('pointerdown', (event) => {
    if (current) return; // ignore a second finger while drawing
    try {
      canvas.setPointerCapture(event.pointerId); // keep drawing even outside the canvas
    } catch {
      // Some pointers can't be captured; drawing still works without it.
    }
    current = {
      id: event.pointerId,
      pointerType: event.pointerType,
      points: [positionOf(event)],
      graphics: null, // created once the pointer has moved enough (so taps don't draw)
    };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!current || current.id !== event.pointerId) return;
    // Coalesced events give every in-between position, for a smoother line.
    const coalesced = event.getCoalescedEvents?.() ?? [];
    for (const e of coalesced.length ? coalesced : [event]) current.points.push(positionOf(e));

    if (!current.graphics) {
      const [x0, y0] = current.points[0];
      const [x, y] = current.points[current.points.length - 1];
      if (Math.hypot(x - x0, y - y0) < CONFIG.input.tapMaxMove) return; // still might be a tap
      current.graphics = new Graphics();
      layer.addChild(current.graphics);
    }
    render(current);
  });

  function finish(event, cancelled) {
    if (!current || current.id !== event.pointerId) return;
    const stroke = current;
    current = null;
    if (!stroke.graphics) return; // it was a tap, nothing was drawn

    const isCircle = cancelled ? false : onStrokeEnd(stroke.points.map(([x, y]) => ({ x, y })));

    // Wobble around the middle of the stroke.
    const xs = stroke.points.map((p) => p[0]);
    const ys = stroke.points.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    stroke.graphics.pivot.set(cx, cy);
    stroke.graphics.position.set(cx, cy);

    fading.push({ graphics: stroke.graphics, age: 0, wobble: !isCircle });
  }
  canvas.addEventListener('pointerup', (event) => finish(event, false));
  canvas.addEventListener('pointercancel', (event) => finish(event, true));

  // --- Every frame ---------------------------------------------------------------------
  function update(dt) {
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      f.age += dt;
      const t = Math.min(1, f.age / D.fadeTime);
      f.graphics.alpha = 1 - t;

      if (f.wobble) {
        // A quick little side-to-side shake that settles down.
        const w = Math.max(0, 1 - f.age / D.wobbleTime);
        f.graphics.rotation = Math.sin(f.age * 35) * D.wobbleAmount * w;
        f.graphics.scale.set(1 - 0.04 * (1 - w));
      }

      if (t >= 1) {
        f.graphics.destroy();
        fading.splice(i, 1);
      }
    }
  }

  return { update };
}
