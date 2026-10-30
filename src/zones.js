// zones.js
// -----------------------------------------------------------------------------
// A hidden map that answers "is this spot open SKY, or TREES?"
//
// It's built once at startup from the tree pictures: wherever trees-back.png
// or trees-front.png is see-through (and inside the torn-paper edge) = SKY,
// solid = TREES, outside the torn edge = PAPER. Clouds and birds use it to stay
// in the blue, circles use it to pick leaves or a puff, and taps on the trees
// use it to shake leaves loose.
//
// All positions here are in ARTWORK pixels (1672 × 941).
// -----------------------------------------------------------------------------

import { CONFIG } from './config.js';
import { URLS } from './scene.js';

/**
 * Read just the transparency (alpha) of an image into a small grid.
 * `scale` shrinks it first (0.25 = a quarter of the size) to save memory.
 * `at(x, y)` returns 0 (see-through) … 1 (solid) at a full-size pixel position.
 */
export async function loadAlphaMap(url, scale) {
  const img = new Image();
  img.src = url;
  await img.decode();

  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;

  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];

  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    at(x, y) {
      const ix = Math.floor(x * scale);
      const iy = Math.floor(y * scale);
      if (ix < 0 || iy < 0 || ix >= width || iy >= height) return 0;
      return alpha[iy * width + ix] / 255;
    },
  };
}

export async function createZones() {
  const scale = CONFIG.zones.resolution;
  const [back, front, paper] = await Promise.all([
    loadAlphaMap(URLS.treesBack, scale),
    loadAlphaMap(URLS.treesFront, scale),
    loadAlphaMap(URLS.mask, scale),
  ]);

  const { width, height } = CONFIG.scene;
  const step = 1 / scale; // artwork pixels per grid cell

  // Build the grid (0 = paper border, 1 = SKY, 2 = TREES), and find the middle
  // of the open sky while we're at it.
  const PAPER = 0;
  const SKY = 1;
  const TREES = 2;
  const cols = Math.ceil(width * scale);
  const rows = Math.ceil(height * scale);
  const grid = new Uint8Array(cols * rows);
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * step;
      const y = (row + 0.5) * step;
      const trees = Math.max(back.at(x, y), front.at(x, y));
      const insideEdge = paper.at(x, y) > 0.5;
      if (!insideEdge) continue; // stays PAPER
      if (trees >= 0.5) {
        grid[row * cols + col] = TREES;
      } else {
        grid[row * cols + col] = SKY;
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  /** The middle of the open sky. Things that wander off steer back toward it. */
  const skyCenter = { x: sumX / count, y: sumY / count };

  /** What's at (x, y): PAPER, SKY or TREES. */
  function zoneAt(x, y) {
    const col = Math.floor(x * scale);
    const row = Math.floor(y * scale);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return PAPER;
    return grid[row * cols + col];
  }

  /** true if (x, y) is open sky. */
  const isSky = (x, y) => zoneAt(x, y) === SKY;

  /** true if (x, y) is trees (inside the torn-paper edge). */
  const isTrees = (x, y) => zoneAt(x, y) === TREES;

  /**
   * How much of a circle is sky, from 0 (all trees) to 1 (all sky).
   * Checks the center plus `samples` points spread inside the circle.
   */
  function skyAmount(x, y, radius, samples = 14) {
    let skyCount = isSky(x, y) ? 1 : 0;
    for (let i = 0; i < samples; i++) {
      // Spread points evenly in a sunflower pattern so the whole circle is covered.
      const r = radius * Math.sqrt((i + 0.5) / samples);
      const angle = i * 2.39996; // the "golden angle"
      if (isSky(x + Math.cos(angle) * r, y + Math.sin(angle) * r)) skyCount++;
    }
    return skyCount / (samples + 1);
  }

  /**
   * A random spot in the open sky where a circle of `radius` is (mostly) sky.
   * If `avoid` points are given, picks the candidate furthest from all of them.
   */
  function randomSkyPoint(radius, avoid = []) {
    let best = null;
    let bestDistance = -1;
    for (let attempt = 0; attempt < 300 && (!best || attempt < 40); attempt++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      if (skyAmount(x, y, radius) < 0.85) continue;
      const nearest = Math.min(Infinity, ...avoid.map((p) => Math.hypot(p.x - x, p.y - y)));
      if (nearest > bestDistance) {
        best = { x, y };
        bestDistance = nearest;
      }
    }
    return best ?? { ...skyCenter };
  }

  return { isSky, isTrees, skyAmount, randomSkyPoint, skyCenter };
}
