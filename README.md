# Canopy

An interactive illustration: you look straight up from the forest floor through
a ring of trees at a patch of sky. Clouds drift, white birds fly around, and
you can play with them:

| Do this | What happens |
|---|---|
| **Draw a circle** anywhere | A new bird appears there. On the trees it bursts out with a few leaves; on the sky, with a soft white puff. |
| **Tap a bird** | It's startled: a little jump, fast flapping, a swerve, a few feathers. |
| **Tap the trees** | A few leaves come loose and flutter down toward you. |
| **Tap a cloud** | It fizzles away; a new one drifts in later. |

Built with [Vite](https://vitejs.dev), [PixiJS](https://pixijs.com) and
[perfect-freehand](https://github.com/steveruizok/perfect-freehand). No
backend: it's a plain static website.

---

## 1. Run it on your computer

You need [Node.js](https://nodejs.org) (version 20 or newer) installed once.

In Terminal, go to the project folder:

```bash
cd "/Users/pallavi/Desktop/Claude files/Canopy"
```

The first time only, install the libraries:

```bash
npm install
```

Start it:

```bash
npm run dev
```

Then open **http://localhost:5173** in your browser. Leave Terminal open while
you look; saving any file reloads the page. Press **Ctrl + C** in Terminal to
stop.

---

## 2. Tweak how it feels: `src/config.js`

Every number worth changing lives in [`src/config.js`](src/config.js), each
with a plain-English comment. Save the file and the browser updates. The main
sections:

| Section | What it controls |
|---|---|
| `parallax` | How much each layer moves with the mouse (`depth`), how floaty it is (`easing`), and the slow drift on phones (`touchDrift`). |
| `sway` | The gentle breeze in the trees: distance, tilt and speed per layer. |
| `clouds` | How many clouds, their size and speed, wandering, bobbing, "breathing", and the tap-to-fizzle (`fizzleTime`, `fizzlePuffs`, `respawnDelayMin/Max`). |
| `birds` | Starting birds (`startCount`), the limit (`maxCount`), size, speed, flap speed and order, gliding, turning, and `startle` (what happens when you tap one). |
| `leafBurst` / `skyPuff` | The effects when a bird appears on the trees / on the sky. |
| `fallingLeaves` | Leaves that fall when you tap the trees: how many, size, fall speed, swinging. |
| `drawing` | The brush: colour, thickness (`width`), glow, fade time, the "nope" wobble. |
| `circle` | How forgiving circle detection is (`closeGap`, `minSize`, `minSweep`). |
| `hint` | The first-visit hint text and timing. |
| `reducedMotion` | How much slower things move for people who've turned on "reduce motion". |

Colours are written like `0xffffff` (that's white): the same as CSS `#ffffff`
with `0x` instead of `#`.

---

## 3. Swap in new art

1. Put your new PNG in `assets/` with the **same file name** as the one it
   replaces (for example `trees-front.png`).
   - The scene layers (`sky`, `trees-back`, `trees-front`, `leaves-fore`)
     should line up with each other, ideally the same size as `sky.png`.
   - Bird frames: head pointing **up**, wings in the same 5 positions.
2. Delete that file's old backup in `assets/raw/originals/`.
3. Run the asset script:

   ```bash
   npm run prepare-assets
   ```

It backs up your new original, pads and cleans the image, lines up bird
frames, re-traces the torn-paper edge from `sky.png`, and makes the small
`.webp` copies the website actually loads (about 0.7 MB in total instead of
9 MB of PNGs). If the scene size changes, update `scene.width` / `scene.height`
in `src/config.js`.

---

## 4. Put it online (Netlify)

**Option A: drag and drop (simplest)**

1. Build the website:

   ```bash
   npm run build
   ```

   This creates a `dist/` folder: that's the whole finished site.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the
   `dist` folder onto the page. You get a link like
   `https://something-random.netlify.app`. You can rename it in
   **Site configuration → Change site name**.
3. To update it later: run `npm run build` again and drag the new `dist`
   folder onto your site's **Deploys** page.

**Option B: from GitHub (updates automatically)**

1. Put this folder in a GitHub repository.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
   The settings are read from `netlify.toml` (build command `npm run build`,
   publish folder `dist`), so just click **Deploy**.
3. Every time you push to GitHub, Netlify rebuilds the site.

**Vercel works too:** import the repo; it detects Vite automatically (build
`npm run build`, output `dist`).

To check the built version on your computer before uploading:

```bash
npm run build
```

```bash
npm run preview
```

---

## 5. Embed it in your portfolio

Use an `<iframe>` pointing at your Netlify link. This keeps it the scene's
shape (16:9) and full width on any screen:

```html
<div style="position: relative; width: 100%; aspect-ratio: 1672 / 941; border-radius: 12px; overflow: hidden;">
  <iframe
    src="https://YOUR-SITE.netlify.app/"
    title="Canopy: an interactive illustration. Circle anywhere for a bird."
    loading="lazy"
    style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;">
  </iframe>
</div>
```

Good to know:
- The scene always fits inside the iframe and keeps its shape, with cream
  paper around it, so any iframe size works.
- Drawing inside the iframe won't scroll your portfolio page on phones.
- It pauses itself while scrolled out of view or when the tab is hidden, so it
  won't slow down the rest of your page.
- **Webflow / Framer / Squarespace:** use their "Embed" or "Custom code"
  block and paste the snippet above.

---

## Files

```
index.html            the page
src/
  main.js             starts everything; taps; main loop; pausing
  config.js           ← all the settings
  scene.js            layers, fitting the window, parallax, sway
  zones.js            hidden sky / trees map
  clouds.js           drifting clouds, tap-to-fizzle
  birds.js            birds: flapping, flying, steering, startle
  particles.js        leaf burst, sky puff, feathers, falling leaves
  drawing.js          the brush stroke
  circle.js           "was that a circle?"
  hint.js             first-visit hint
  style.css           page styles
public/
  _headers            Netlify caching rules (copied into dist/ when you build)
scripts/
  prepare-assets.js   cleans the art + makes WebP copies (npm run prepare-assets)
assets/               the art (PNG = source, WebP = what the site loads)
assets/raw/originals  untouched backups of your PNGs
references/           mood references (not used by the site)
BRIEF.md              the project brief
```

**While developing** (`npm run dev` only), you can type `canopy` in the
browser console to poke at things, for example `canopy.birds.count()`.
