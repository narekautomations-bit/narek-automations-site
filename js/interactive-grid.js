// One persistent, full-page WebGL canvas: an animated "spreadsheet"
// (grid lines + a filled header row + scattered filled "data" cells,
// like an actual open workbook) that reacts to the cursor/touch anywhere
// on the page. It starts near-flat and calm at the top (reads clearly as
// an Excel grid) and gradually tilts into a more dramatic 3D mesh as the
// page scrolls — one continuous effect, not a per-section replay.
//
// Visibility is section-aware: strong over dark sections (hero, process,
// footer), faded almost to nothing over light sections so body text stays
// fully readable — but never literally removed from the DOM, so its
// transform/scroll state keeps evolving underneath and picks up "further
// along" next time a dark section scrolls into view.
//
// Fails soft: any missing WebGL support, error, or reduced-motion
// preference just leaves the plain dark section backgrounds in place
// (see the `webgl-grid-active` class toggle at the end).

const LINE_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uAmplitude;
  varying float vElevation;
  void main() {
    vec3 pos = position;
    float wave = (sin(pos.x * 1.1 + uTime * 0.6) * 0.1 + sin(pos.y * 1.6 - uTime * 0.4) * 0.08) * uAmplitude;
    float dist = distance(pos.xy, uMouse * 3.5);
    float ripple = sin(dist * 2.5 - uTime * 2.0) * exp(-dist * 0.8) * 0.5 * (0.6 + uAmplitude * 0.4);
    pos.z += wave + ripple;
    vElevation = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const LINE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vElevation;
  void main() {
    float alpha = 0.24 + clamp(vElevation * 1.5, -0.14, 0.45);
    gl_FragColor = vec4(uColor, alpha * 0.5 * uOpacity);
  }
`;

const FILL_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uAmplitude;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    float wave = (sin(pos.x * 1.1 + uTime * 0.6) * 0.1 + sin(pos.y * 1.6 - uTime * 0.4) * 0.08) * uAmplitude;
    float dist = distance(pos.xy, uMouse * 3.5);
    float ripple = sin(dist * 2.5 - uTime * 2.0) * exp(-dist * 0.8) * 0.5 * (0.6 + uAmplitude * 0.4);
    pos.z += wave + ripple;
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FILL_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, vAlpha * uOpacity);
  }
`;

function buildLineGeometry(THREE, width, height, cols, rows) {
  const positions = [];
  const stepX = width / cols;
  const stepY = height / rows;
  const originX = -width / 2;
  const originY = -height / 2;

  for (let j = 0; j <= rows; j++) {
    const y = originY + j * stepY;
    for (let i = 0; i < cols; i++) {
      positions.push(originX + i * stepX, y, 0, originX + (i + 1) * stepX, y, 0);
    }
  }
  for (let i = 0; i <= cols; i++) {
    const x = originX + i * stepX;
    for (let j = 0; j < rows; j++) {
      positions.push(x, originY + j * stepY, 0, x, originY + (j + 1) * stepY, 0);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

// Builds every "cell" as a small inset quad so grid lines still frame it,
// with a per-cell alpha: row 0 (header) reads strong/solid, a random
// scatter of other cells reads faint (like populated data), the rest 0
// (skipped entirely — no wasted vertices on empty cells).
function buildFillGeometry(THREE, width, height, cols, rows, seed) {
  const positions = [];
  const alphas = [];
  const stepX = width / cols;
  const stepY = height / rows;
  const originX = -width / 2;
  const originY = -height / 2;
  const inset = 0.12;

  let rand = seed;
  const next = () => {
    rand = (rand * 9301 + 49297) % 233280;
    return rand / 233280;
  };

  function addCell(i, j, alpha) {
    const x0 = originX + (i + inset) * stepX;
    const x1 = originX + (i + 1 - inset) * stepX;
    const y0 = originY + (j + inset) * stepY;
    const y1 = originY + (j + 1 - inset) * stepY;
    positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
    for (let k = 0; k < 6; k++) alphas.push(alpha);
  }

  for (let i = 0; i < cols; i++) addCell(i, 0, 0.4);
  for (let j = 1; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (next() < 0.14) addCell(i, j, 0.1 + next() * 0.14);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
  return geometry;
}

let threePromise = null;
function loadThree() {
  if (!threePromise) {
    threePromise = import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
  }
  return threePromise;
}

export async function initPageGrid({ canvasId = "page-webgl", color = 0x1fbf72 } = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const isCompact = window.innerWidth < 820;

  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    return;
  }

  let renderer, scene, camera, uniformsLines, uniformsFill, clock;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isCompact });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompact ? 1.5 : 2));
    // Opaque dark-navy clear so this single canvas can sit behind the
    // whole page: dark sections go transparent to reveal it (see the
    // .webgl-grid-active CSS rule), light sections simply paint their own
    // opaque background on top, hiding it completely.
    renderer.setClearColor(0x0b1220, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.8, 4.8);

    const cols = isCompact ? 16 : 28;
    const rows = isCompact ? 22 : 34;
    const planeW = 9;
    const planeH = 12;

    const lineGeo = buildLineGeometry(THREE, planeW, planeH, cols, rows);
    uniformsLines = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
      uAmplitude: { value: 0.3 },
    };
    const lineMat = new THREE.ShaderMaterial({
      uniforms: uniformsLines,
      transparent: true,
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    const fillGeo = buildFillGeometry(THREE, planeW, planeH, cols, rows, 42);
    uniformsFill = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0 },
      uAmplitude: { value: 0.3 },
    };
    const fillMat = new THREE.ShaderMaterial({
      uniforms: uniformsFill,
      transparent: true,
      vertexShader: FILL_VERTEX_SHADER,
      fragmentShader: FILL_FRAGMENT_SHADER,
    });
    const fills = new THREE.Mesh(fillGeo, fillMat);
    scene.add(fills);

    // Both meshes are rotated/positioned together as one rig so lines and
    // fills stay perfectly aligned.
    scene.rotation.x = -0.4;
    scene.position.y = -1.6;
    scene.position.z = -1;

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

  const mouseTarget = { x: 0, y: 0 };
  const mouseSmooth = { x: 0, y: 0 };
  function setTargetFromPoint(clientX, clientY) {
    mouseTarget.x = (clientX / window.innerWidth) * 2 - 1;
    mouseTarget.y = -((clientY / window.innerHeight) * 2 - 1);
  }
  window.addEventListener("mousemove", (e) => setTargetFromPoint(e.clientX, e.clientY));
  window.addEventListener(
    "touchstart",
    (e) => e.touches[0] && setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );
  window.addEventListener(
    "touchmove",
    (e) => e.touches[0] && setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );

  // Section darkness zones, recomputed on resize since responsive layout
  // changes section heights.
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

  let currentOpacity = 0;
  let currentTilt = -0.4;
  let currentAmplitude = 0.3;

  function frame() {
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, scrollY / maxScroll);

    // Flat, calm, "just an excel grid" near the top; progressively more
    // tilted/lively 3D mesh further down the page.
    const targetTilt = -0.4 + progress * -0.85;
    const targetAmplitude = 0.3 + progress * 1.1;

    const viewCenter = scrollY + window.innerHeight * 0.4;
    const zone = zones.find((z) => viewCenter >= z.top && viewCenter < z.bottom);
    const targetOpacity = zone ? (zone.dark ? 1 : 0.05) : 0.05;

    currentOpacity += (targetOpacity - currentOpacity) * 0.06;
    currentTilt += (targetTilt - currentTilt) * 0.04;
    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.04;

    const touchBoost = isCompact ? 1.4 : 1;
    mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * (isCompact ? 0.16 : 0.06);
    mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * (isCompact ? 0.16 : 0.06);

    scene.rotation.x = currentTilt;
    const t = clock.getElapsedTime();
    [uniformsLines, uniformsFill].forEach((u) => {
      u.uTime.value = t;
      u.uMouse.value.set(mouseSmooth.x * touchBoost, mouseSmooth.y * touchBoost);
      u.uOpacity.value = currentOpacity;
      u.uAmplitude.value = currentAmplitude;
    });

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
