// circle.js
// -----------------------------------------------------------------------------
// Decides whether a drawn stroke is a circle. If it is, returns its center and
// size; if not, returns null.
//
// A stroke counts as a circle when ALL of these are true:
//   1. It has enough points (not just a tiny flick).
//   2. It's big enough (at least `minSize` pixels across).
//   3. It's roughly round, not a long thin shape (`minRoundness`).
//   4. It closes up: the end comes back near the start (`closeGap`).
//   5. It actually goes AROUND its middle (`minSweep` degrees), so a
//      back-and-forth scribble that happens to end near its start doesn't count.
//
// Points are {x, y} in screen pixels.
// -----------------------------------------------------------------------------

import { CONFIG } from './config.js';

export function detectCircle(points) {
  const C = CONFIG.circle;
  if (points.length < C.minPoints) return null;

  // Bounding box.
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const size = (width + height) / 2;

  // 2. Big enough?
  if (Math.max(width, height) < C.minSize) return null;

  // 3. Round-ish? (1 = as wide as tall; a straight line is close to 0)
  if (Math.min(width, height) / Math.max(width, height) < C.minRoundness) return null;

  // 4. Does it close up? Measure the gap from the start to the nearest point in
  //    the last third of the stroke (so drawing a bit past the start is fine).
  const start = points[0];
  let gap = Infinity;
  for (let i = Math.floor(points.length * 0.66); i < points.length; i++) {
    gap = Math.min(gap, Math.hypot(points[i].x - start.x, points[i].y - start.y));
  }
  if (gap > size * C.closeGap) return null;

  // Center = average of points spread evenly along the line (so slow, dense
  // parts of the stroke don't pull the center toward them).
  const even = resample(points, 64);
  const center = {
    x: even.reduce((sum, p) => sum + p.x, 0) / even.length,
    y: even.reduce((sum, p) => sum + p.y, 0) / even.length,
  };

  // 5. Does it go around the center? Add up how much the angle turns.
  let sweep = 0;
  for (let i = 1; i < even.length; i++) {
    const a1 = Math.atan2(even[i - 1].y - center.y, even[i - 1].x - center.x);
    const a2 = Math.atan2(even[i].y - center.y, even[i].x - center.x);
    let turn = a2 - a1;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn)); // wrap to -180°…180°
    sweep += turn;
  }
  if (Math.abs(sweep) < (C.minSweep * Math.PI) / 180) return null;

  // Diameter = twice the average distance from the center.
  const averageRadius = even.reduce((sum, p) => sum + Math.hypot(p.x - center.x, p.y - center.y), 0) / even.length;

  return { x: center.x, y: center.y, diameter: averageRadius * 2 };
}

/** Return `count` points spaced evenly along the stroke. */
function resample(points, count) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  if (total === 0) return [points[0]];

  const spacing = total / (count - 1);
  const result = [points[0]];
  let carried = 0;
  for (let i = 1; i < points.length && result.length < count; i++) {
    let a = points[i - 1];
    const b = points[i];
    let segment = distance(a, b);
    while (carried + segment >= spacing && result.length < count) {
      const t = (spacing - carried) / segment;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      result.push(a);
      segment = distance(a, b);
      carried = 0;
    }
    carried += segment;
  }
  return result;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
