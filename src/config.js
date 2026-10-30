// config.js
// -----------------------------------------------------------------------------
// Every number you might want to tweak lives here.
// Change a value, save, and the browser reloads with the new setting.
// (New sections get added here as each stage is built.)
// -----------------------------------------------------------------------------

export const CONFIG = {
  page: {
    // Colour of the paper around the scene (also set in src/style.css).
    background: '#F2EDE3',
  },

  render: {
    // Sharpness on high-resolution screens. 2 looks crisp on phones and Retina
    // laptops; higher costs a lot of speed for little visible gain.
    maxPixelRatio: 2,
  },

  scene: {
    // Size of the artwork in pixels. All scene layers must be exactly this size.
    width: 1672,
    height: 941,

    // Empty space kept around the scene, as a fraction of the window
    // (0.02 = 2%). The art already has its own paper border, so this is small.
    margin: 0.02,

    // How long the scene takes to fade in once the images have loaded (seconds).
    fadeInTime: 0.8,

    // Every layer is drawn this much bigger than the artwork (1.04 = 4%), so
    // that when layers shift for parallax/sway, no edge ever peeks through.
    overscale: 1.04,
  },

  parallax: {
    // How far each layer shifts (in artwork pixels) when the mouse is at the
    // very edge of the window. Further-away layers move less → feels like depth.
    depth: {
      sky: 6,
      clouds: 8,
      treesBack: 11,
      treesFront: 15,
      birds: 13,
      leavesFore: 20,
      falling: 22,
    },

    // How quickly layers catch up with the mouse. Lower = floatier and slower,
    // higher = snappier. 2–4 feels calm.
    easing: 2.5,

    // On phones/tablets (no mouse), the scene slowly drifts by itself instead.
    // `amount` is a fraction of the mouse parallax (0.3 = 30%).
    // `period` is how many seconds one full drift loop takes.
    touchDrift: {
      amount: 0.3,
      period: 18,
    },
  },

  sway: {
    // A slow breeze in the trees. Each layer moves back and forth by up to
    // `distance` artwork pixels and tilts by up to `tilt` degrees, taking about
    // `period` seconds for one full sway. Keep these small, it should be subtle.
    treesBack: { distance: 2, tilt: 0.08, period: 9 },
    treesFront: { distance: 3, tilt: 0.12, period: 11 },
    leavesFore: { distance: 4, tilt: 0.2, period: 7 },
  },

  clouds: {
    // How many clouds float in the sky at once.
    count: 4,

    // Cloud size, as a fraction of the cloud picture (0.45 = 45%). Each cloud
    // gets a random size between these two.
    sizeMin: 0.36,
    sizeMax: 0.5,

    // Drifting speed in artwork pixels per second. Each cloud picks a random
    // speed in this range. (The sky is about 1100 pixels wide.)
    speedMin: 5,
    speedMax: 12,

    // Wandering: how strongly clouds change direction on their own (radians
    // per second), and how often the wandering swings the other way.
    wanderAmount: 0.18,
    wanderSpeed: 0.07,

    // Staying in the sky: how far ahead (pixels) a cloud looks for trees, and
    // how quickly it turns back toward the open sky (radians per second).
    edgeLookAhead: 40,
    steerStrength: 0.25,

    // Clouds keep a little space between each other. 1 = just touching;
    // bigger = more room; 0 = they can overlap freely.
    personalSpace: 0.9,

    // Gentle up-and-down bobbing: distance (pixels) and seconds per bob.
    bobDistance: 4,
    bobPeriod: 7,

    // "Breathing": clouds grow and shrink slightly. 0.02 = 2%. Seconds per breath.
    breathing: 0.02,
    breathPeriod: 9,

    // Seconds a new cloud takes to fade in.
    appearTime: 3,

    // --- Tap a cloud to fizzle it ---
    // How long the fizzle takes (seconds).
    fizzleTime: 1.6,
    // How blurry the cloud gets as it dissolves.
    fizzleBlur: 14,
    // How much it swells while dissolving (0.12 = 12% bigger).
    fizzleSwell: 0.12,
    // Number of little puffs that drift away, and how fast (pixels per second).
    fizzlePuffs: 9,
    fizzlePuffSpeed: 30,
    // A new cloud appears this many seconds after one fizzles (random in range).
    respawnDelayMin: 4,
    respawnDelayMax: 8,
    // How solid a spot must be to count as "on the cloud" (0–1). Lower = easier to hit.
    tapAlpha: 0.15,
  },

  birds: {
    // Birds already flying when the page opens.
    startCount: 5,
    // Most birds at once (starting ones included). Past this, the oldest bird
    // flies away off the edge to make room.
    maxCount: 12,

    // Bird size, as a fraction of the bird picture (0.24 ≈ 165 pixel wingspan).
    sizeMin: 0.22,
    sizeMax: 0.27,

    // Bird colour tint. 0xffffff = the original white picture (no tint).
    // Any other colour darkens/colours the birds (their shading is kept).
    tint: 0xffffff,

    // Flying speed in artwork pixels per second (random per bird in this range).
    speedMin: 60,
    speedMax: 110,

    // Wing flaps: frames per second, and the order the 5 pictures play in.
    flapFps: 10,
    flapOrder: [3, 4, 5, 1, 2],
    // Gliding: after each wingbeat there's this chance (0–1) the bird stops
    // flapping and glides with wings spread for between min and max seconds.
    glideChance: 0.25,
    glideMin: 1,
    glideMax: 3,

    // Wandering: how sharply birds curve on their own (radians per second),
    // and how often the curving changes (higher = changes more often).
    wanderTurn: 0.6,
    wanderSpeed: 0.45,

    // Staying over the sky: how far ahead (pixels) a bird checks for trees or
    // the edge, and how quickly it curves back (radians per second; low = wide,
    // gentle turns).
    lookAhead: 110,
    steerStrength: 1.1,
    // Birds also stay at least this far from the edge of the artwork.
    edgeMargin: 70,
    // Birds closer than this (pixels) gently turn away from each other.
    personalSpace: 140,

    // A slight grow/shrink to suggest flying higher and lower: amount (0.06 = 6%)
    // and seconds per cycle.
    heightChange: 0.06,
    heightPeriod: 7,

    // New birds start this small (fraction of full size) and grow to full size
    // in `emergeTime` seconds while flying out.
    emergeStartScale: 0.2,
    emergeTime: 0.4,
    // A bird that's leaving to make room flies this much faster.
    leaveSpeedBoost: 1.5,

    // --- Tap a bird: it gets startled ---
    startle: {
      // How long the startle lasts (seconds) before the bird calms down.
      duration: 1.4,
      // At the start it flies this much faster and flaps this much faster,
      // easing back to normal.
      speedBoost: 1.8,
      flapBoost: 2.2,
      // It swerves away from your tap by up to this angle (radians, 0.9 ≈ 50°),
      // turning at this speed (radians per second).
      swerve: 0.9,
      turnRate: 2.5,
      // A quick little "jump" in size (0.12 = 12% bigger for a moment).
      pop: 0.12,
      // A few small feathers drift down. How many, and how long they float (seconds).
      feathers: 4,
      featherLife: 2.4,
      // How easy birds are to tap: size of the tap area compared to the bird
      // picture (0.5 = generous, since birds are moving).
      hitSize: 0.5,
    },
  },

  leafBurst: {
    // Leaves that pop out when a bird bursts from the trees.
    countMin: 8,
    countMax: 14,
    // Starting speed (pixels per second), how long they last (seconds),
    // how strongly they fall, and leaf length (pixels).
    speedMin: 120,
    speedMax: 240,
    life: 1.6,
    gravity: 80,
    size: 14,
    // Leaf colours are taken from the tree picture, then made fresher and
    // brighter so they stand out (0 = exact tree colour, 1 = very bright).
    brighten: 0.4,
  },

  fallingLeaves: {
    // Tap/click the trees → a few leaves come loose and flutter down.
    // How many leaves per tap (random in this range).
    countMin: 3,
    countMax: 6,
    // Leaf length (pixels), and how far apart they start around the tap.
    size: 24,
    spread: 20,
    // How fast they fall (pixels per second) and how long they last (seconds).
    fallSpeed: 60,
    life: 3.4,
    // Side-to-side swinging: how far (pixels) and how fast.
    sway: 16,
    swaySpeed: 2.4,
    // They grow as they fall toward you (0.6 = 60% bigger by the end).
    grow: 0.6,
  },

  skyPuff: {
    // The soft white puff when a bird appears in the open sky.
    count: 7,
    speed: 45,
    life: 0.9,
    size: 22,
  },

  drawing: {
    // Brush colour (0xffffff = white) and how see-through it is (0–1).
    color: 0xffffff,
    alpha: 0.75,
    // Brush thickness in screen pixels.
    width: 8,
    // A soft, wider glow drawn underneath: how much wider, and how see-through.
    haloScale: 2.2,
    haloAlpha: 0.18,
    // Brush feel (perfect-freehand settings, all 0–1):
    //   thinning   how much the line thins when moving fast
    //   smoothing  how much the outline is smoothed
    //   streamline how much the line lags behind to smooth out shaky hands
    thinning: 0.5,
    smoothing: 0.6,
    streamline: 0.5,
    // Seconds for a finished stroke to fade away.
    fadeTime: 0.6,
    // The little "nope" wobble when a stroke isn't a circle: how long (seconds)
    // and how much it tilts (radians; 0.05 ≈ 3°).
    wobbleTime: 0.45,
    wobbleAmount: 0.05,
  },

  circle: {
    // A stroke needs at least this many points to be judged at all.
    minPoints: 12,
    // Smallest circle that counts, in screen pixels across.
    minSize: 40,
    // How round it must be: 1 = perfectly round, 0 = a flat line is fine.
    minRoundness: 0.35,
    // How close the end must come back to the start, as a fraction of the
    // circle's size (0.3 = 30%). Bigger = more forgiving.
    closeGap: 0.3,
    // How far around it must go, in degrees (360 = a full loop).
    minSweep: 290,
    // How many spots inside the circle are checked to decide sky vs trees.
    zoneSamples: 15,
  },

  hint: {
    // The little "how to play" line shown on a first visit.
    text: 'circle anywhere for a bird · tap a cloud, a bird or the trees',
    // Seconds after the page loads before it fades in, and fade speed.
    delay: 1.5,
    fadeTime: 1.2,
    // true = once someone has drawn a circle, don't show the hint again on
    // later visits (remembered in their browser). false = show every visit.
    rememberDismissed: true,
    // Space (screen pixels) needed under the scene to put the hint on the
    // paper; with less room it sits just inside the bottom of the scene.
    minRoomBelow: 44,
  },

  reducedMotion: {
    // For visitors who've asked their device for less motion: parallax and
    // sway are switched off, and clouds, birds and particles move at this
    // fraction of their normal speed (0.4 = 40%).
    speed: 0.4,
  },

  zones: {
    // Detail of the hidden sky/trees map (0.25 = quarter size). Higher is more
    // precise but uses more memory; 0.25 is plenty.
    resolution: 0.25,
  },

  input: {
    // A press counts as a "tap" (not a drawing) if the pointer moves less than
    // this many screen pixels and is released within this many seconds.
    tapMaxMove: 10,
    tapMaxTime: 0.4,
  },
};
