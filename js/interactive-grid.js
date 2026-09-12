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
// the middle so page content never has to compete with them.
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

// Unit building: x/y in [-0.5, 0.5], z from 0 to 1. Scaling z therefore
// grows it upward out of the plane with its base staying put. The floor
// rings are what separate "digital skyscraper" from "wireframe box".
function buildingGeometry(THREE, rings = 4) {
  const pts = [];
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  corners.forEach(([x, y]) => pts.push(x, y, 0, x, y, 1));
  const levels = [0, 1];
  for (let i = 1; i <= rings; i++) levels.push(i / (rings + 1));
  levels.forEach((z) => {
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = corners[i];
      const [x2, y2] = corners[(i + 1) % 4];
      pts.push(x1, y1, z, x2, y2, z);
    }
  });
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
  let skylineMaterial = null;
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

    const shape = buildingGeometry(THREE, 3);
    skylineMaterial = new THREE.LineBasicMaterial({
      color: 0x7fe8b4,
      transparent: true,
      opacity: 0,
      // The grid is drawn transparent too; not writing depth keeps the two
      // from fighting over which is in front at their intersections.
      depthWrite: false,
    });

    const rand = makeRandom(0xc1745);
    const towerCount = isCompact ? 14 : 26;
    for (let i = 0; i < towerCount; i++) {
      // Alternating sides, never inside x = ±2.1. Page content spans most
      // of the container, not just its middle, so the avenue has to be
      // wide enough that towers stay outside the text rather than
      // crossing it.
      const side = i % 2 ? 1 : -1;
      const tower = new THREE.LineSegments(shape, skylineMaterial);
      // y is depth up the tilted plane. Starting at 4.5 rather than at the
      // frame edge keeps the near foreground clear and reads as a skyline
      // on the horizon instead of towers looming over the copy.
      const depth = 4.5 + rand() * 9.5;
      tower.position.set(side * (2.1 + rand() * 5.2), depth, 0);
      const footprintX = 0.16 + rand() * 0.24;
      const footprintY = 0.16 + rand() * 0.24;
      // Nearer towers are drawn shorter so they don't swamp the frame.
      const height = (1.1 + rand() * 3.4) * (0.6 + Math.min(1, depth / 8) * 0.6);
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
  // following the pointer and the idle orbit.
  let lastPointAt = -999;
  // Briefly boosted by a tap so a single touch reads as a hit rather than
  // as nothing happening.
  let tapPulse = 0;
  function setTargetFromPoint(clientX, clientY) {
    pointerTarget.x = ((clientX / window.innerWidth) * 2 - 1) * mouseScale.x;
    pointerTarget.y = -((clientY / window.innerHeight) * 2 - 1) * mouseScale.y;
    lastPointAt = clock ? clock.getElapsedTime() : 0;
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
    const targetOpacity = 0.28 + targetDarkness * 0.16;

    opacity += (targetOpacity - opacity) * 0.06;
    darkness += (targetDarkness - darkness) * 0.06;
    currentTilt += (targetTilt - currentTilt) * 0.04;
    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.04;

    const elapsedNow = clock.getElapsedTime();

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

    // Towers rise with scroll progress, each on its own threshold.
    for (const b of buildings) {
      const t = Math.min(1, Math.max(0, (progress - b.riseStart) / b.riseSpan));
      const eased = t * t * (3 - 2 * t);
      const h = eased * b.height;
      b.obj.visible = h > 0.012;
      if (b.obj.visible) b.obj.scale.set(b.footprintX, b.footprintY, h);
    }
    // Kept a little brighter than the grid so they read as structures
    // standing on it rather than as more of the same mesh.
    // Deliberately below the grid's own brightness: the skyline is depth,
    // not a foreground element, and page copy has to win over it.
    skylineMaterial.opacity = Math.min(0.5, opacity * 0.95);

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
