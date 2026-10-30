// prepare-assets.js
// -----------------------------------------------------------------------------
// Cleans up the art in /assets so it's ready for the animation.
// Run it with:   npm run prepare-assets
//
// What it does:
//   1. Backs up your original PNGs into assets/raw/originals/ (only the first
//      time — it never overwrites a backup). Every later run starts from those
//      originals, so running the script twice gives the same result.
//   2. Scene layers: pads them with transparent pixels so they are all exactly
//      the same size as sky.png.
//   3. "Almost solid" pixels (alpha 245–254) become fully solid (255), so the
//      sky doesn't faintly show through the trees.
//   4. Clouds: removes tiny stray specks that aren't part of the cloud.
//   5. Birds: lines up all 5 wing frames on the same body point and puts it in
//      the exact center of the image, so the bird doesn't jitter when it flaps.
//   6. Traces the torn-paper edge from sky.png into scene-mask.png.
//   7. Saves a small .webp copy of every image. The website loads these
//      (about 0.7 MB in total instead of 9 MB of PNGs).
//
// If you swap in new art: drop the new PNG into /assets, delete its old copy in
// assets/raw/originals/, and run the script again.
// -----------------------------------------------------------------------------

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ASSETS = 'assets';
const ORIGINALS = path.join(ASSETS, 'raw', 'originals');

const LAYERS = ['trees-back.png', 'trees-front.png', 'leaves-fore.png'];
const CLOUDS = ['cloud-1.png', 'cloud-2.png', 'cloud-3.png', 'cloud-4.png'];
const BIRDS = ['bird-1.png', 'bird-2.png', 'bird-3.png', 'bird-4.png', 'bird-5.png'];

// WebP quality for the website copies (0–100). 85 looks the same as the PNGs
// at a fraction of the size; lower = smaller files but softer art.
const WEBP_QUALITY = 85;

// Pixels at least this opaque are made fully opaque.
const SNAP_ALPHA_FROM = 245;

// Final size of every bird frame. A little bigger than the originals (720×330)
// so the wing tips have breathing room. The bird's body sits at the center.
const BIRD_W = 760;
const BIRD_H = 360;

// ---------------------------------------------------------------- helpers ---

/** Back up the original once, then always read from the backup. */
function originalPath(name) {
  const backup = path.join(ORIGINALS, name);
  if (!fs.existsSync(backup)) fs.copyFileSync(path.join(ASSETS, name), backup);
  return backup;
}

/** Load a PNG as raw RGBA pixels: { data, width, height }. */
async function readRGBA(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Save raw RGBA pixels as a PNG. */
function writeRGBA(img, file) {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

/** Make nearly-solid pixels fully solid. Returns how many pixels changed. */
function snapAlpha(img) {
  let changed = 0;
  for (let i = 3; i < img.data.length; i += 4) {
    const a = img.data[i];
    if (a >= SNAP_ALPHA_FROM && a < 255) {
      img.data[i] = 255;
      changed++;
    }
  }
  return changed;
}

/** Copy img onto a new transparent canvas of size w×h at offset (dx, dy). */
function placeOnCanvas(img, w, h, dx, dy) {
  const out = Buffer.alloc(w * h * 4); // all zeros = fully transparent
  for (let y = 0; y < img.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= h) continue;
    for (let x = 0; x < img.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= w) continue;
      img.data.copy(out, (ty * w + tx) * 4, (y * img.width + x) * 4, (y * img.width + x) * 4 + 4);
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Remove small specks: find separate "islands" of visible pixels and erase any
 * island much smaller than the biggest one (the cloud itself).
 * Returns how many specks were removed.
 */
function removeSpecks(img, minAlpha = 4, keepRatio = 0.02) {
  const { data, width: w, height: h } = img;
  const label = new Int32Array(w * h).fill(-1);
  const islands = []; // list of pixel-index arrays
  const stack = [];

  for (let start = 0; start < w * h; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] < minAlpha) continue;
    const id = islands.length;
    const pixels = [];
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      pixels.push(p);
      const px = p % w, py = (p / w) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = px + ox, ny = py + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx;
          if (label[n] === -1 && data[n * 4 + 3] >= minAlpha) {
            label[n] = id;
            stack.push(n);
          }
        }
      }
    }
    islands.push(pixels);
  }

  const biggest = Math.max(0, ...islands.map((s) => s.length));
  let removed = 0;
  for (const pixels of islands) {
    if (pixels.length >= biggest * keepRatio) continue;
    for (const p of pixels) data.fill(0, p * 4, p * 4 + 4);
    removed++;
  }
  // Also clear the faint haze below minAlpha that wasn't part of any island.
  for (let p = 0; p < w * h; p++) if (data[p * 4 + 3] < minAlpha) data.fill(0, p * 4, p * 4 + 4);
  return removed;
}

/**
 * Find the bird's body anchor: halfway between the center of the dark beak
 * and the center of the dark tail feet.
 */
function birdAnchor(img) {
  const { data, width: w, height: h } = img;
  const beak = { x: 0, y: 0, n: 0 };
  const tail = { x: 0, y: 0, n: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dark = data[i + 3] > 150 && data[i] + data[i + 1] + data[i + 2] < 200;
      if (!dark) continue;
      const bucket = y < h / 2 ? beak : tail; // beak is in the top half, tail in the bottom
      bucket.x += x; bucket.y += y; bucket.n++;
    }
  }
  if (!beak.n || !tail.n) throw new Error('Could not find the beak or tail in a bird frame');
  return {
    x: (beak.x / beak.n + tail.x / tail.n) / 2,
    y: (beak.y / beak.n + tail.y / tail.n) / 2,
  };
}

// ------------------------------------------------------------------- main ---

fs.mkdirSync(ORIGINALS, { recursive: true });

// The sky sets the size every scene layer should match.
const skyMeta = await sharp(originalPath('sky.png')).metadata();
const SCENE_W = skyMeta.width;
const SCENE_H = skyMeta.height;
console.log(`Scene size (from sky.png): ${SCENE_W}×${SCENE_H}`);

// 1. Scene layers: pad to the sky's size (split evenly left/right, top/bottom).
for (const name of LAYERS) {
  const img = await readRGBA(originalPath(name));
  const dx = Math.floor((SCENE_W - img.width) / 2);
  const dy = Math.floor((SCENE_H - img.height) / 2);
  const out = placeOnCanvas(img, SCENE_W, SCENE_H, dx, dy);
  const snapped = snapAlpha(out);
  await writeRGBA(out, path.join(ASSETS, name));
  console.log(`${name}: ${img.width}×${img.height} → ${SCENE_W}×${SCENE_H}, ${snapped} pixels made solid`);
}

// 2. Clouds: remove specks, snap alpha.
for (const name of CLOUDS) {
  const img = await readRGBA(originalPath(name));
  const specks = removeSpecks(img);
  const snapped = snapAlpha(img);
  await writeRGBA(img, path.join(ASSETS, name));
  console.log(`${name}: removed ${specks} specks, ${snapped} pixels made solid`);
}

// 3. Birds: put every frame's body anchor at the exact center of the canvas.
for (const name of BIRDS) {
  const img = await readRGBA(originalPath(name));
  const a = birdAnchor(img);
  const dx = Math.round(BIRD_W / 2 - a.x);
  const dy = Math.round(BIRD_H / 2 - a.y);
  const out = placeOnCanvas(img, BIRD_W, BIRD_H, dx, dy);
  const snapped = snapAlpha(out);
  await writeRGBA(out, path.join(ASSETS, name));
  console.log(`${name}: anchor was (${a.x.toFixed(1)}, ${a.y.toFixed(1)}), moved by (${dx}, ${dy}), ${snapped} pixels made solid`);
}

// 4. Scene mask: the ragged "torn paper" edge, traced from sky.png.
await buildSceneMask();

// 5. Smaller copies for the website: every PNG also gets a .webp version (the
//    app loads those). WebP keeps transparency and is usually 5–10× smaller.
await makeWebpCopies();

console.log('Done. Originals are in', ORIGINALS);

async function makeWebpCopies() {
  const pngs = ['sky.png', ...LAYERS, ...CLOUDS, ...BIRDS, 'scene-mask.png'];
  let before = 0;
  let after = 0;
  for (const name of pngs) {
    const src = path.join(ASSETS, name);
    const out = src.replace(/\.png$/, '.webp');
    // The mask needs exact edges, so it's saved without any quality loss.
    const lossless = name === 'scene-mask.png';
    await sharp(src).webp(lossless ? { lossless: true } : { quality: WEBP_QUALITY, alphaQuality: 90, effort: 6 }).toFile(out);
    before += fs.statSync(src).size;
    after += fs.statSync(out).size;
  }
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';
  console.log(`WebP copies: ${mb(before)} of PNGs → ${mb(after)} of WebP`);
}

/**
 * Builds assets/scene-mask.png: white where the scene should show, transparent
 * where the cream paper border is. The app clips every layer to this shape, so
 * the trees end at the same ragged edge as the sky (like Master scene.png).
 *
 * How: start at the image border and "flood" inward through paper-coloured
 * pixels. Wherever the flood reaches is paper. The sun glow at the top of the
 * sky is also cream-coloured, so a slightly wobbly rounded rectangle just
 * inside the usual border depth always stays visible ("safety net").
 */
async function buildSceneMask() {
  const sky = await readRGBA(originalPath('sky.png'));
  const { data, width: w, height: h } = sky;

  // Paper colour = average of the four corners.
  const paper = [0, 0, 0];
  for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) {
    for (let c = 0; c < 3; c++) paper[c] += data[(y * w + x) * 4 + c] / 4;
  }
  const PAPER_TOLERANCE = 30; // how close a colour must be to count as paper
  const isPaperColour = (p) => {
    const i = p * 4;
    return Math.hypot(data[i] - paper[0], data[i + 1] - paper[1], data[i + 2] - paper[2]) < PAPER_TOLERANCE;
  };

  // Flood from every border pixel through paper-coloured pixels.
  const isPaper = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => { const p = y * w + x; if (!isPaper[p] && isPaperColour(p)) { isPaper[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  // Typical border depth on each side: median over the middle of that side
  // (corners are left out because the paper is deeper there).
  const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };
  const depthAt = (count, at) => {
    const out = [];
    for (let k = Math.round(count * 0.2); k < count * 0.8; k++) {
      let d = 0;
      while (d < 300 && isPaper[at(k, d)]) d++;
      out.push(d);
    }
    return median(out);
  };
  const inset = {
    top: depthAt(w, (x, d) => d * w + x),
    bottom: depthAt(w, (x, d) => (h - 1 - d) * w + x),
    left: depthAt(h, (y, d) => y * w + d),
    right: depthAt(h, (y, d) => y * w + (w - 1 - d)),
  };

  // Safety net: a rounded rectangle just inside that typical border, with a
  // gently wobbly (noisy) edge. Everything inside it always shows, so the
  // cream-coloured sun glow can't cut a notch into the trees.
  const SLACK = 22;         // how far past the typical border the real edge may reach
  const CORNER_RADIUS = 90; // roundness of the corners
  const WOBBLE = 10;        // how wavy the safety-net edge is (pixels)
  const left = inset.left + SLACK, right = w - inset.right - SLACK;
  const top = inset.top + SLACK, bottom = h - inset.bottom - SLACK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!isPaper[p]) continue;
      // Signed distance to the rounded rectangle (negative = inside).
      const qx = Math.max(left + CORNER_RADIUS - x, x - (right - CORNER_RADIUS), 0);
      const qy = Math.max(top + CORNER_RADIUS - y, y - (bottom - CORNER_RADIUS), 0);
      const outsideCore = Math.hypot(qx, qy) - CORNER_RADIUS;
      const insideCore = Math.min(x - left, right - x, y - top, bottom - y);
      const dist = qx > 0 || qy > 0 ? outsideCore : -insideCore;
      if (dist + WOBBLE * noise2D(x / 28, y / 28) < 0) isPaper[p] = 0;
    }
  }

  // White image, alpha = 255 inside the scene, 0 on paper. A tiny blur
  // softens the jagged pixel steps.
  const mask = Buffer.alloc(w * h * 4, 255);
  for (let p = 0; p < w * h; p++) mask[p * 4 + 3] = isPaper[p] ? 0 : 255;
  await sharp(mask, { raw: { width: w, height: h, channels: 4 } })
    .blur(0.6)
    .png({ compressionLevel: 9 })
    .toFile(path.join(ASSETS, 'scene-mask.png'));
  console.log(`scene-mask.png: ${w}×${h} paper edge traced from sky.png`);
}

/** Smooth random wobble between -1 and 1 (simple "value noise"). */
function noise2D(x, y) {
  const hash = (i, j) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); // smoothstep
  const top = hash(x0, y0) * (1 - sx) + hash(x0 + 1, y0) * sx;
  const bottom = hash(x0, y0 + 1) * (1 - sx) + hash(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}
