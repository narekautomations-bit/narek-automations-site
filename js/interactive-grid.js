// One persistent, full-page WebGL canvas: a flowing wireframe mesh that
// reacts to the cursor/touch anywhere on the page. Starts calm and near-
// flat at the top and gradually tilts into a more dramatic 3D wave as the
// page scrolls. A soft edge vignette keeps its rectangular boundary from
// ever reading as a hard-edged "sheet" — it should feel like an endless
// surface, not a finite plane.
//
// Section darkness is a *proportional* blend of how much of the current
// viewport actually overlaps dark vs. light sections (not a single sample
// point), so the transition through mixed viewports — e.g. the bottom of
// Contact and the top of the Footer both visible at once — is smooth and
// correct instead of snapping between two states.
//
// Touch/cursor response is real spring physics (position + velocity),
// not a plain exponential smoothing — it should follow with a natural,
// slightly elastic quality rather than either lagging flatly or jumping.
// When nothing has been pointing at it for a few seconds the ripple
// drifts on its own orbit, which is what keeps the surface alive on a
// phone — there's no cursor there, so without it the mesh just sits
// still until someone happens to drag a finger across it.
//
// A wireframe skyline rises out of the plane as the page scrolls, in step
// with the tilt: nothing at the top of the page, a full city by the
// bottom. The buildings are children of the same scene, so they tilt with
// the grid and stay locked to its drift, and they leave an avenue down
// the middle so page content never has to compete with them. Each tower
// also counter-rotates as the page scrolls, so by the bottom it is
// standing straight up rather than leaning with the plane it sits on, and
// brightens when the cursor or a finger passes near it.
//
// Fails soft: any missing WebGL support, error, or reduced-motion
// preference just leaves the plain dark section backgrounds in place
// (see the `webgl-grid-active` class toggle at the end).

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uAmplitude;
  uniform float uRippleBoost;
  varying float vElevation;
  varying vec2 vUv;
  void main() {
    vec3 pos = position;
    float wave = (sin(pos.x * 0.6 + uTime * 0.25) * 0.025 + sin(pos.y * 0.8 - uTime * 0.2) * 0.02) * uAmplitude;
    float dist = distance(pos.xy, uMouse);
    float bump = exp(-dist * dist * 0.9) * 0.8 * uRippleBoost;
    pos.z += wave + bump;
    vElevation = pos.z;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColorLight;
  uniform vec3 uColorDark;
  uniform float uDarkness;
  uniform float uOpacity;
  varying float vElevation;
  varying vec2 vUv;
  void main() {
    float alpha = 0.3 + clamp(vElevation * 1.9, -0.14, 0.6);
    // Soft rectangular vignette so the mesh's own edges fade to nothing
    // instead of presenting as a visible sheet boundary.
    vec2 centered = abs(vUv - 0.5) * 2.0;
    float edge = max(centered.x, centered.y);
    float edgeFade = 1.0 - smoothstep(0.72, 1.0, edge);
    vec3 col = mix(uColorLight, uColorDark, uDarkness);
    gl_FragColor = vec4(col, alpha * uOpacity * edgeFade);
  }
`;

// ---------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------
// Built in unit space: the plan sits inside x/y of [-0.5, 0.5] and the
// profile runs from z = 0 upward, so scaling z grows a tower out of the
// plane with its base staying put.
//
// Every tower is generated from two independent pieces — a plan (the
// floorplate outline) and a profile (how the footprint scales on the way
// up) — which is what produces variety instead of 26 shoeboxes. Setbacks,
// continuous taper, podiums and crowns are all just shapes of the same
// profile, so they all fall out of one loop.

// Floorplate outline, as points around the perimeter.
function towerPlan(rand) {
  const kind = rand();
  if (kind < 0.3) {
    // Chamfered corners: the single cheapest thing that stops a tower
    // reading as a shoebox.
    const c = 0.13 + rand() * 0.14;
    return [
      [-0.5 + c, -0.5],
      [0.5 - c, -0.5],
      [0.5, -0.5 + c],
      [0.5, 0.5 - c],
      [0.5 - c, 0.5],
      [-0.5 + c, 0.5],
      [-0.5, 0.5 - c],
      [-0.5, -0.5 + c],
    ];
  }
  if (kind < 0.46) {
    // Cruciform — a real high-rise floorplate, and in wireframe it reads
    // completely differently from a box.
    const a = 0.15 + rand() * 0.11;
    return [
      [-a, -0.5],
      [a, -0.5],
      [a, -a],
      [0.5, -a],
      [0.5, a],
      [a, a],
      [a, 0.5],
      [-a, 0.5],
      [-a, a],
      [-0.5, a],
      [-0.5, -a],
      [-a, -a],
    ];
  }
  return [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
}

// Footprint scale as a function of height, as {z, s} control points. Two
// entries sharing a z is a setback — the ledge between them.
function towerProfile(rand) {
  const p = [];
  let z = 0;

  // Podium: a wider block of low floors at street level.
  if (rand() < 0.42) {
    const h = 0.05 + rand() * 0.07;
    const ps = 1.18 + rand() * 0.3;
    p.push({ z: 0, s: ps }, { z: h, s: ps }, { z: h, s: 1 });
    z = h;
  } else {
    p.push({ z: 0, s: 1 });
  }

  const style = rand();
  if (style < 0.26) {
    // Tapered shaft, narrowing the whole way up.
    p.push({ z: 1, s: 0.6 + rand() * 0.26 });
  } else if (style < 0.52) {
    // Flat-topped slab with a slight batter.
    p.push({ z: 1, s: 0.9 + rand() * 0.1 });
  } else if (style < 0.8) {
    // One setback, then a slimmer upper shaft.
    const zb = z + (1 - z) * (0.44 + rand() * 0.26);
    p.push({ z: zb, s: 0.95 });
    const upper = 0.6 + rand() * 0.18;
    p.push({ z: zb, s: upper }, { z: 1, s: upper * (0.88 + rand() * 0.12) });
  } else {
    // Ziggurat: Art Deco stepping, two or three setbacks.
    const steps = 2 + Math.floor(rand() * 2);
    let cur = 1;
    let zc = z;
    for (let i = 0; i < steps; i++) {
      const zn = Math.min(0.94, zc + ((1 - zc) / (steps - i)) * (0.65 + rand() * 0.4));
      p.push({ z: zn, s: cur });
      cur *= 0.58 + rand() * 0.22;
      p.push({ z: zn, s: cur });
      zc = zn;
    }
    p.push({ z: 1, s: cur });
  }

  // Crown: either a pyramid cap or a projecting slab roof.
  const crown = rand();
  const topS = p[p.length - 1].s;
  if (crown < 0.3) {
    p.push({ z: 1 + 0.05 + rand() * 0.11, s: topS * (0.08 + rand() * 0.22) });
  } else if (crown < 0.46) {
    p.push({ z: 1.03, s: topS * 1.14 }, { z: 1.06, s: topS * 1.14 });
  }
  return p;
}

function towerGeometry(THREE, rand, worldHeight) {
  const pts = [];
  const seg = (x1, y1, z1, x2, y2, z2) => pts.push(x1, y1, z1, x2, y2, z2);

  const plan = towerPlan(rand);
  const profile = towerProfile(rand);
  const topZ = profile[profile.length - 1].z;

  // Extra points along each plan edge. These are the facade mullions, and
  // they carry most of the density that makes a wireframe tower look like
  // a building rather than a crate.
  const perEdge = plan.length > 8 ? 1 : 2 + Math.floor(rand() * 3);
  const outline = [];
  for (let i = 0; i < plan.length; i++) {
    const [x1, y1] = plan[i];
    const [x2, y2] = plan[(i + 1) % plan.length];
    for (let k = 0; k < perEdge; k++) {
      const t = k / perEdge;
      outline.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
  }

  // Each mullion is one polyline through the whole profile, so a taper
  // slants it, a setback puts a ledge in it, and a crown closes it.
  for (const [px, py] of outline) {
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1];
      const b = profile[i];
      seg(px * a.s, py * a.s, a.z, px * b.s, py * b.s, b.z);
    }
  }

  const scaleAt = (z) => {
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1];
      const b = profile[i];
      if (z <= b.z) {
        const span = b.z - a.z;
        return span < 1e-6 ? b.s : a.s + (b.s - a.s) * ((z - a.z) / span);
      }
    }
    return profile[profile.length - 1].s;
  };

  const ring = (z, sc) => {
    for (let i = 0; i < plan.length; i++) {
      const [x1, y1] = plan[i];
      const [x2, y2] = plan[(i + 1) % plan.length];
      seg(x1 * sc, y1 * sc, z, x2 * sc, y2 * sc, z);
    }
  };

  // Floors at a constant world spacing, so floor count still reads as
  // height across the whole skyline.
  const floorSpacing = 0.135;
  const floors = Math.max(3, Math.round((worldHeight * topZ) / floorSpacing));
  for (let f = 0; f <= floors; f++) {
    const z = (topZ * f) / floors;
    ring(z, scaleAt(z));
  }
  // Both sides of every setback ledge, which the floor rings can't draw
  // because two of them share a z.
  for (const pt of profile) ring(pt.z, pt.s);

  if (rand() < 0.34) {
    seg(0, 0, topZ, 0, 0, topZ + 0.08 + rand() * 0.2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return geometry;
}

// Deterministic, so the skyline is the same one on every visit.
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let threePromise = null;
function loadThree() {
  if (!threePromise) {
    threePromise = import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
  }
  return threePromise;
}

export async function initPageGrid({ canvasId = "page-webgl", color = 0x93e0b8 } = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const isCompact = window.innerWidth < 820;
  // Sized generously larger than the camera's view so the vignette fade
  // always has room to resolve before the true edge of the geometry.
  const planeW = 15;
  const planeH = 20;
  const mouseScale = { x: planeW / 2, y: planeH / 2 };

  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    return;
  }

  let renderer, scene, camera, uniforms, clock, mesh, cellH;
  let skyline = null;
  const buildings = [];
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isCompact });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompact ? 1.5 : 2));
    renderer.setClearColor(0x0b1220, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.8, 4.8);

    const cols = isCompact ? 26 : 44;
    const rows = isCompact ? 34 : 58;
    // One grid cell. The mesh drifts by exactly this much per loop, which
    // makes a finite plane read as an endlessly flowing grid.
    cellH = planeH / rows;

    const geometry = new THREE.PlaneGeometry(planeW, planeH, cols, rows);
    uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColorLight: { value: new THREE.Color(0x3d4b63) },
      uColorDark: { value: new THREE.Color(color) },
      uDarkness: { value: 1 },
      uOpacity: { value: 0 },
      uAmplitude: { value: 0.3 },
      uRippleBoost: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      wireframe: true,
      transparent: true,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    scene.rotation.x = -0.4;
    scene.position.y = -1.6;
    scene.position.z = -1;

    // ---- Skyline -------------------------------------------------------
    skyline = new THREE.Group();
    scene.add(skyline);

    // One material per tower rather than one shared: it's 26 tiny objects,
    // and it's what lets a tower brighten on its own when the pointer is
    // near it.
    const makeSkylineMaterial = () =>
      new THREE.LineBasicMaterial({
        color: 0x7fe8b4,
        transparent: true,
        opacity: 0,
        // The grid is drawn transparent too; not writing depth keeps the
        // two from fighting over which is in front at their intersections.
        depthWrite: false,
      });

    const rand = makeRandom(0xc1745);
    const towerCount = isCompact ? 14 : 26;
    // Half-width of the frame, in world units, at a mid-skyline depth.
    const frameHalfWidth = Math.tan((45 * Math.PI) / 360) * 8 * (window.innerWidth / window.innerHeight);
    const avenue = Math.max(0.8, Math.min(2.1, frameHalfWidth * 0.62));
    const spread = Math.max(2.4, frameHalfWidth * 2.1);
    for (let i = 0; i < towerCount; i++) {
      // Alternating sides, never inside the avenue. On a wide screen the
      // avenue is wide because page copy spans most of the container; on a
      // portrait phone the frame is only ~1.5 world units across at these
      // depths, so the same avenue would push every tower off-screen —
      // hence scaling both the avenue and the spread by the viewport.
      const side = i % 2 ? 1 : -1;
      // y is depth up the tilted plane. Starting at 4.5 rather than at the
      // frame edge keeps the near foreground clear and reads as a skyline
      // on the horizon instead of towers looming over the copy.
      const depth = 4.5 + rand() * 9.5;
      const footprintX = 0.16 + rand() * 0.24;
      const footprintY = 0.16 + rand() * 0.24;
      // Nearer towers are drawn shorter so they don't swamp the frame.
      const height = (1.1 + rand() * 3.4) * (0.6 + Math.min(1, depth / 8) * 0.6);
      // Geometry is per-tower because floor spacing is in world units —
      // it has to know how tall this one ends up.
      const tower = new THREE.LineSegments(towerGeometry(THREE, rand, height), makeSkylineMaterial());
      tower.position.set(side * (avenue + rand() * spread), depth, 0);
      // Yaw about the tower's own vertical axis. Euler order is XYZ, so
      // this is applied before the per-frame stand-up rotation on X,
      // which is exactly the order a building needs.
      tower.rotation.z = rand() * Math.PI * 2;
      tower.visible = false;
      skyline.add(tower);
      buildings.push({
        obj: tower,
        footprintX,
        footprintY,
        height,
        // Staggered thresholds so the city grows in waves down the page
        // rather than every tower stretching in unison.
        riseStart: 0.04 + rand() * 0.52,
        riseSpan: 0.22 + rand() * 0.26,
      });
    }

    clock = new THREE.Clock();
  } catch {
    return;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Spring-based follow (position + velocity) instead of plain exponential
  // smoothing — reads as a natural, slightly elastic response rather than
  // either laggy or robotic.
  // Where the pointer last was, where the spring currently is, and the
  // blended target the spring actually chases (pointer vs. idle orbit).
  const pointerTarget = { x: 0, y: 0 };
  const mouseTarget = { x: 0, y: 0 };
  const mousePos = { x: 0, y: 0 };
  const mouseVel = { x: 0, y: 0 };
  // Seconds since the last real pointer input, used to fade between
  // following the pointer and the idle orbit. frameTime is written once
  // per frame and is the only clock reading anything outside frame() may
  // use (see setTargetFromPoint).
  let frameTime = 0;
  let lastPointAt = -999;
  // Briefly boosted by a tap so a single touch reads as a hit rather than
  // as nothing happening.
  let tapPulse = 0;
  function setTargetFromPoint(clientX, clientY) {
    pointerTarget.x = ((clientX / window.innerWidth) * 2 - 1) * mouseScale.x;
    pointerTarget.y = -((clientY / window.innerHeight) * 2 - 1) * mouseScale.y;
    // Deliberately NOT clock.getElapsedTime(): that calls getDelta()
    // internally and would steal the frame loop's delta, which collapses
    // dt toward zero on every pointer move and makes the spring crawl.
    lastPointAt = frameTime;
  }
  window.addEventListener("mousemove", (e) => setTargetFromPoint(e.clientX, e.clientY));
  window.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches[0]) return;
      setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY);
      tapPulse = 1;
    },
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => e.touches[0] && setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );

  let zones = [];
  function computeZones() {
    zones = Array.from(document.querySelectorAll("main > section, footer")).map((el) => ({
      top: el.offsetTop,
      bottom: el.offsetTop + el.offsetHeight,
      dark: el.classList.contains("tone-dark"),
    }));
  }
  computeZones();
  window.addEventListener("resize", () => setTimeout(computeZones, 150));

  // Proportional: how much of the *current viewport* overlaps dark zones,
  // 0..1 — not a single sample point that can disagree with what's
  // actually on screen when two zones share the viewport.
  function viewportDarkness() {
    const viewTop = window.scrollY;
    const viewBottom = viewTop + window.innerHeight;
    let darkSpan = 0;
    for (const z of zones) {
      const overlap = Math.min(viewBottom, z.bottom) - Math.max(viewTop, z.top);
      if (overlap > 0 && z.dark) darkSpan += overlap;
    }
    return Math.min(1, darkSpan / window.innerHeight);
  }

  let opacity = 0;
  let darkness = 1;
  let currentTilt = -0.4;
  let currentAmplitude = 0.3;

  const SPRING_STIFFNESS = 140;
  const SPRING_DAMPING = 16;
  // Slow enough to read as a drift rather than motion you track.
  const GRID_DRIFT_SPEED = 0.1;

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, scrollY / maxScroll);

    const targetTilt = -0.4 + progress * -0.7;
    const targetAmplitude = 0.3 + progress * 0.7;

    const targetDarkness = viewportDarkness();
    // Calm, legible by default — the mesh brightens locally near the
    // cursor/touch bump (see the fragment shader) rather than needing a
    // loud resting state to feel present.
    const targetOpacity = 0.25 + targetDarkness * 0.14;

    opacity += (targetOpacity - opacity) * 0.06;
    darkness += (targetDarkness - darkness) * 0.06;
    currentTilt += (targetTilt - currentTilt) * 0.04;
    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.04;

    const elapsedNow = clock.elapsedTime;
    frameTime = elapsedNow;

    // Blend from "follow the pointer" to "wander on its own" over the two
    // seconds after input stops. On a phone there is no cursor, so this is
    // the difference between a live surface and a still one.
    const idleness = Math.min(1, Math.max(0, (elapsedNow - lastPointAt - 1.4) / 2));
    const orbitX = Math.cos(elapsedNow * 0.21) * mouseScale.x * 0.44;
    const orbitY = Math.sin(elapsedNow * 0.17) * mouseScale.y * 0.3;
    mouseTarget.x = pointerTarget.x + (orbitX - pointerTarget.x) * idleness;
    mouseTarget.y = pointerTarget.y + (orbitY - pointerTarget.y) * idleness;

    // Critically-damped-ish spring toward the target for both axes.
    tapPulse *= Math.exp(-3.2 * dt);
    const boost = (isCompact ? 1.75 : 1) * (1 + tapPulse * 0.85);
    ["x", "y"].forEach((axis) => {
      const force = (mouseTarget[axis] - mousePos[axis]) * SPRING_STIFFNESS;
      mouseVel[axis] += force * dt;
      mouseVel[axis] *= Math.exp(-SPRING_DAMPING * dt);
      mousePos[axis] += mouseVel[axis] * dt;
    });

    // Flow the grid lines themselves, matrix-rain style. Wrapping at
    // exactly one cell height makes the finite plane read as an endless
    // scrolling grid with no visible seam.
    const elapsed = elapsedNow;
    const driftY = (elapsed * GRID_DRIFT_SPEED) % cellH;
    mesh.position.y = driftY;
    // Locked to the grid's own drift so the towers never slide across it.
    skyline.position.y = driftY;

    // Towers rise with scroll progress, each on its own threshold, and
    // counter-rotate as they go: the plane they stand on ends up steeply
    // tilted, and a city leaning with it looks like it's falling over.
    // At progress 1 the correction cancels the tilt exactly, so the
    // towers are dead vertical by the bottom of the page.
    const standUp = progress * (-Math.PI / 2 - currentTilt);
    // Deliberately below the grid's own brightness: the skyline is depth,
    // not a foreground element, and page copy has to win over it.
    const skylineOpacity = Math.min(isCompact ? 0.3 : 0.44, opacity * 0.95);
    const rippleX = uniforms.uMouse.value.x;
    const rippleY = uniforms.uMouse.value.y;

    for (const b of buildings) {
      const t = Math.min(1, Math.max(0, (progress - b.riseStart) / b.riseSpan));
      const eased = t * t * (3 - 2 * t);
      const h = eased * b.height;
      b.obj.visible = h > 0.012;
      if (!b.obj.visible) continue;

      // Same falloff shape as the ripple in the vertex shader, so a tower
      // lights up exactly where the surface under it is being pushed.
      const dx = b.obj.position.x - rippleX;
      const dy = b.obj.position.y - rippleY;
      const near = Math.exp(-(dx * dx + dy * dy) * 0.11);

      b.obj.scale.set(b.footprintX, b.footprintY, h * (1 + near * 0.14));
      b.obj.rotation.x = standUp;
      b.obj.material.opacity = Math.min(0.95, skylineOpacity * (1 + near * 2.1));
    }

    scene.rotation.x = currentTilt;
    uniforms.uTime.value = elapsed;
    // The bump is computed from the mesh's *local* vertex positions, so the
    // drift has to be subtracted out of the pointer position — otherwise the
    // bump would slide along with the grid and snap back every wrap.
    uniforms.uMouse.value.set(mousePos.x, mousePos.y - driftY);
    uniforms.uOpacity.value = opacity;
    uniforms.uAmplitude.value = currentAmplitude;
    uniforms.uRippleBoost.value = boost;
    uniforms.uDarkness.value = darkness;

    renderer.setClearAlpha(darkness);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  let rafId = null;
  let running = false;
  function start() {
    if (running) return;
    running = true;
    clock.start();
    frame();
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") start();
    else stop();
  });

  start();
  document.documentElement.classList.add("webgl-grid-active");
}
