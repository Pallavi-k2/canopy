# Canopy — Project Brief

## What this is
Canopy is an interactive illustration for my design portfolio. The viewer looks
straight up from the forest floor (an ant's-eye view) through a ring of tree
canopies at an open patch of sky. The scene is already alive when it opens: a few
clouds drift slowly around the sky and 5 white birds are flying, like the sheep
already grazing in `style-sheep.png`. The viewer can:

- Circle ANYWHERE (sky or trees) with the mouse or a finger → a new white bird
  appears there and joins the others flying around the sky. On the trees it
  bursts out of the leaves; on the sky it appears with a soft white puff.
- Tap or click a CLOUD → it fizzles out softly, like a real cloud thinning away.
  A new cloud drifts in a little later so the sky never empties.
- Tap or click a BIRD → it gets startled: a little jump, a burst of fast
  flapping, a swerve away from the tap, and a few feathers drifting down.
- Tap or click the TREES → a few leaves come loose and flutter down, swinging
  side to side and growing a little as they fall toward the viewer.

It should feel calm, cozy and playful. Slow, soft movement. Nothing fast or jarring.
I'm a beginner, so please keep the code clean, well commented and easy to tweak.

## Step 0: organize the folder first
My images are currently all in the top level of this folder. Before writing code,
move them into this structure (move, don't delete anything):

```
Canopy/
├── BRIEF.md
├── assets/
│   ├── sky.png
│   ├── trees-back.png
│   ├── trees-front.png
│   ├── leaves-fore.png
│   ├── cloud-1.png … cloud-4.png
│   └── bird-1.png … bird-5.png
│   └── scene-mask.png     (made by `npm run prepare-assets`: the torn-paper edge)
├── assets/raw/
│   ├── clouds.png         (the uncut cloud sheet — already cut into cloud-1..4)
│   ├── Birds.png          (the uncut bird sheet — already cut into bird-1..5)
│   └── originals/         (untouched copies of my PNGs, made by the asset script)
└── references/
    ├── Master scene.png   (the full combined scene I generated)
    ├── style-sheep.png
    ├── canopy-1.png
    ├── canopy-2.png
    └── swan-frames.png
```

## Reference images (look at these first)
- `references/Master scene.png`: the full scene as it should look when all
  layers are stacked. Use it to check the layers line up.
- `references/style-sheep.png`: the overall feel I want: soft, puffy, cozy
  diorama, ragged dry-brush edges fading into cream paper, and how selected
  objects and interactions feel. Mood only; not an asset.
- `references/canopy-1.png`, `canopy-2.png`: the camera angle and composition
  (looking straight up through trees). Mood only; not assets.
- `references/swan-frames.png`: how the bird flaps (5 wing positions seen from
  below). Mood only; not an asset.

## Assets (all in /assets, transparent PNGs)
| File | What it is | Layer order (bottom → top) |
|---|---|---|
| sky.png | Open sky with ragged edges on cream paper | 1 |
| cloud-1..4.png | Four separate clouds seen from below | 2 (above sky, below trees) |
| trees-back.png | Smaller, lighter, distant canopies (inner ring) | 3 |
| trees-front.png | Big, dark nearby canopies + trunks (outer ring) | 4 |
| bird-1..5.png | One bird, 5 wing frames, head/neck pointing UP in the image | 5 |
| leaves-fore.png | Out-of-focus leaves at the corners | 6 (top) |

Before building, please CHECK the assets and tell me about any problems:
- Are the scene layers (sky, trees-back, trees-front, leaves-fore) all the same
  pixel size? If not, tell me and suggest how to fix it (e.g. resize them all to
  match sky.png, keeping alignment with `Master scene.png`).
- Do any images have a solid or fake-checkerboard background instead of real
  transparency? Tell me rather than guessing.
- Bird frames: are bird-1..5 all the same size, with the body centered in the
  same spot? If not, normalize them (a small Node script using `sharp` is fine)
  so the bird doesn't jitter when animated. Keep my originals in assets/raw/.

## Tech stack
- Vite + vanilla JavaScript (no framework)
- PixiJS v8 for rendering
- `perfect-freehand` for the drawing stroke
- No backend, no API keys. Everything runs in the browser.
- Must work as a static site (I'll host it on Netlify or Vercel and embed it in
  my portfolio with an iframe).

## Layout
- Page background: warm cream paper `#F2EDE3`.
- The scene fills its container/window and keeps its aspect ratio (fit fully
  inside, centered, cream paper around it). It must resize cleanly, including
  inside an iframe.
- Cap device pixel ratio at 2 for performance.

## Feature details

### 1. Layers + parallax
- Stack the layers in the order above.
- Mouse parallax: as the pointer moves, shift each layer slightly by a different
  amount (sky least, foreground leaves most), so it feels like depth. Smooth it
  with easing so it never snaps. Max shift about 6–20 px depending on layer.
- Scale the layers up very slightly (a few %) so parallax never reveals an edge.
- On touch devices, use a very small idle drift instead of mouse parallax.
- Gentle sway on the tree layers: a slow, tiny back-and-forth movement so the
  leaves feel like they're in a breeze. Very subtle.

### 2. Drawing
- Pointer events (mouse, pen and touch). Use `touch-action: none` on the canvas
  so drawing on phones doesn't scroll the page.
- Draw the stroke with perfect-freehand: soft white, slightly transparent,
  brush-like.
- When the pointer is released, the stroke fades out over about 0.6 s.

### 3. Circle detection
- A stroke counts as a circle when its start and end points are close together
  (gap less than ~30% of the stroke's bounding-box size), it has enough points,
  and it's at least ~40 px across.
- Not a circle → the stroke just does a tiny wobble and fades. Nothing spawns.
- Circle → find its center and diameter, and add a bird there (see 6).
- A quick tap or click without dragging is NOT a stroke. It's checked front to
  back: on a bird → the bird is startled (see 6); on the trees → leaves fall
  (see 6b); on a cloud → that cloud fizzles (see 5).

### 4. Sky or trees?
- Used to decide HOW a new bird appears (leaf burst on trees, soft puff on sky)
  and to keep birds and clouds over the open sky.
- Build a hidden "zone mask" from the alpha channel of trees-back.png +
  trees-front.png combined: transparent = SKY, opaque = TREES.
- Sample about 15 points inside the circle and take the majority vote.
- Remember to convert screen coordinates to image coordinates (account for
  scaling, centering and parallax offset).

### 5. Clouds (always there, tap to fizzle)
- About 4 clouds (one of each image) are in the sky from the start, at random
  places and slightly different sizes.
- Render clouds above the sky and BELOW all tree layers, so they drift behind
  the leaves.
- Movement: each cloud drifts slowly in its own random direction ("scattering"),
  changing direction gently over time. Add a gentle up-and-down bob and a very
  slight "breathing" scale (about 2%).
- Clouds stay in the blue sky: when one nears the edge of the open sky, it
  turns back softly (no bouncing or sharp turns).
- Tap/click a cloud → it fizzles: it breaks into a few soft puffs that spread
  apart, shrink and fade over about 1.5 s.
- A few seconds after a cloud fizzles, a new one fades in somewhere else in the
  sky, so the number of clouds stays about the same.

### 6. Birds (5 to start, circle anywhere for more)
- 5 birds are already flying when the page opens, spread around the sky.
- Birds render above the tree layers and below the foreground leaves.
- Appear (after a circle, anywhere): the bird starts small at the circle's
  center and grows to full size over ~0.4 s while flying outward toward the
  open sky.
  - Circle on TREES → also spawn a "leaf burst": 8–14 small green leaf particles
    (drawn in code as little ellipses in greens sampled from the tree art) that
    pop out, spin, fall and fade.
  - Circle on SKY → also spawn a soft white puff instead of leaves.
- Flapping: loop the frames in this order: 3 → 4 → 5 → 1 → 2 → 3 … at about
  10 frames per second. Occasionally glide: hold frame 3 (wings spread flat)
  for 1–3 seconds, then resume flapping.
- Flying: smooth wandering paths with gentle curves, never sharp turns. Speed
  roughly 60–110 px/s, slightly different per bird.
- The bird image has its head pointing UP, so rotate each bird to face the
  direction it's moving.
- Birds mostly stay over the open sky: look ahead along their path using the
  zone mask, and steer softly back toward the sky center if they're heading
  deep into the trees or off the edge.
- Very slight scale change over time (a bit larger and smaller) to suggest
  height changes.
- Max 12 birds (the 5 starting ones count); if exceeded, the oldest flies
  off-screen and is removed.
- Birds are pure white (no tint, no shadows: we look up from below with the
  sun above, so a shadow on the sky wouldn't make sense).
- Tap/click a bird → startle (~1.4 s): a quick ~12% size "jump", flaps about
  twice as fast and flies faster, swerves away from the side that was tapped,
  and 3–5 small white feathers float down. Then it eases back to normal.
  Birds are in front of clouds, so a tap checks birds first.

### 6b. Falling leaves (tap the trees)
- Tap/click on the trees (anywhere the zone mask says TREES) → 3–6 leaves come
  loose there, one after another.
- Leaves are drawn in code in greens sampled from the tree art (same as the
  leaf burst), and flutter down slowly (~45 px/s), swinging side to side and
  tilting into each swing.
- They fall toward the viewer, so they render in front of everything
  (above leaves-fore) and grow ~60% as they fall, fading out after ~3 s.

### 7. First-visit hint
- Small, soft text near the bottom: "circle anywhere for a bird · tap a cloud,
  a bird or the trees".
- Fades away after the first successful circle, and isn't shown again in that
  browser (can be switched off in config).

### 8. Performance + polish
- Pause animation when the tab is hidden, or when the iframe is scrolled out
  of view on the portfolio page.
- Smooth 60 fps on a normal laptop and a recent phone.
- Respect `prefers-reduced-motion`: turn off parallax and sway, and slow
  everything down.
- Large PNGs: if any asset is very large (over ~2 MB), suggest compressed
  versions (e.g. WebP) to keep loading fast in my portfolio.
  → Done: `npm run prepare-assets` makes WebP copies and the site loads those
  (~0.7 MB total instead of ~9 MB of PNGs).

## Make it easy for me to tweak
Put every tunable number in one file, `src/config.js`, with a plain-English
comment on each: parallax amounts, sway speed, number of clouds, cloud speeds,
fizzle time, cloud respawn delay, number of starting birds, bird speed, flap
rate, glide chance, max birds, circle detection tolerance, stroke color and
width, fade times, hint text.

## Suggested file structure
```
src/
  main.js          // setup + main loop
  config.js        // all tunable values
  scene.js         // layers, resizing, parallax, sway
  drawing.js       // stroke capture + rendering
  circle.js        // circle detection
  zones.js         // sky/tree mask + lookup
  clouds.js        // ambient clouds, drifting, tap-to-fizzle
  birds.js         // starting birds, spawning, flapping, flying
  particles.js     // leaf burst, sky puff, cloud fizzle puffs
  hint.js          // first-visit hint
```

## Build in stages (stop after each so I can check)
0. Organize the folder + check the assets (report any problems).
1. Project setup + layers displayed correctly and resizing properly.
2. Parallax + tree sway.
3. Drifting clouds + tap-to-fizzle.
4. Drawing + circle detection (log "sky" or "trees" in the console).
5. Birds: 5 starting birds, circle anywhere to add more, leaf burst / sky puff.
6. Hint, reduced motion, performance and polish.

(Stages 3–5 were reordered on 2026-10-30 when the interactions changed: clouds
became ambient and tappable, and circles now always add birds.)

After each stage, tell me how to view it (e.g. `npm run dev` and the URL) and
what I should check. Explain things in simple terms — I'm a beginner.

## When finished
- A README.md explaining: how to run it, how to swap in new art, what the main
  settings in config.js do, and how to build and deploy to Netlify.
- How to embed it in my portfolio with an iframe.
