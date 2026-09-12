// One persistent, full-page WebGL canvas: an animated "spreadsheet" — a
// procedural grid of thin cell borders, a filled header row, and scattered
// colored data cells (green/amber, like conditional formatting) — that
// reacts to the cursor/touch anywhere on the page. Starts near-flat and
// calm at the top (reads as a plain Excel view) and gradually tilts into
// a more dramatic 3D mesh as the page scrolls.
//
// The grid is drawn with real per-pixel alpha (a procedural border/fill
// test in the fragment shader, not GPU line primitives): empty cell
// interiors are fully transparent, only borders and filled cells carry
// color. That matters because this canvas sits behind the *whole* page,
// including light sections — earlier versions cleared to an opaque navy
// backdrop everywhere, so blending it through a section's background
// just produced a flat gray wash rather than a visible grid. Now the
// renderer's clear alpha itself tracks the current section's darkness
// (opaque navy behind dark sections, fully transparent behind light
// ones), so light sections reveal only the actual grid lines/fills at
// low opacity — a genuine subtle texture, not a tint.
//
// Fails soft: any missing WebGL support, error, or reduced-motion
// preference just leaves the plain dark section backgrounds in place
// (see the `webgl-grid-active` class toggle at the end).

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uAmplitude;
  uniform float uRippleBoost;
  varying vec2 vUv;
  varying float vElevation;
  void main() {
    vec3 pos = position;
    float wave = (sin(pos.x * 1.1 + uTime * 0.6) * 0.1 + sin(pos.y * 1.6 - uTime * 0.4) * 0.08) * uAmplitude;
    float dist = distance(pos.xy, uMouse);
    float ripple = sin(dist * 2.5 - uTime * 2.4) * exp(-dist * 0.7) * 0.65 * (0.6 + uAmplitude * 0.4) * uRippleBoost;
    pos.z += wave + ripple;
    vElevation = pos.z;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec2 uCellCount;
  uniform vec3 uColorLight;
  uniform vec3 uColorDark;
  uniform vec3 uHeaderColor;
  uniform vec3 uGoodColor;
  uniform vec3 uFlagColor;
  uniform float uDarkness;
  uniform float uOpacityLines;
  uniform float uOpacityFills;
  varying vec2 vUv;
  varying float vElevation;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 cellUv = vUv * uCellCount;
    vec2 cellIndex = floor(cellUv);
    vec2 localUv = fract(cellUv);

    float edgeDist = min(min(localUv.x, 1.0 - localUv.x), min(localUv.y, 1.0 - localUv.y));
    float lineAlpha = 1.0 - smoothstep(0.0, 0.05, edgeDist);

    float h = hash(cellIndex + 7.0);
    vec3 fillColor = vec3(0.0);
    float fillAlpha = 0.0;
    if (cellIndex.y < 1.0) {
      fillColor = uHeaderColor;
      fillAlpha = 0.55;
    } else if (h < 0.08) {
      fillColor = uGoodColor;
      fillAlpha = 0.42;
    } else if (h < 0.12) {
      fillColor = uFlagColor;
      fillAlpha = 0.36;
    }

    float elevationBoost = clamp(vElevation * 1.4, -0.15, 0.4);
    vec3 lineColor = mix(uColorLight, uColorDark, uDarkness);

    vec3 finalColor = mix(fillColor, lineColor, lineAlpha);
    float finalAlpha = max(fillAlpha * uOpacityFills, lineAlpha * (0.6 + elevationBoost) * uOpacityLines);

    if (finalAlpha < 0.012) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

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
  const planeW = 9;
  const planeH = 12;
  // Half-extents the on-screen cursor/touch position maps into — using
  // the plane's actual half-width/height means a touch near the top/
  // bottom of the screen still lands inside the grid instead of the
  // ripple center drifting outside the mesh.
  const mouseScale = { x: planeW / 2, y: planeH / 2 };

  let THREE;
  try {
    THREE = await loadThree();
  } catch {
    return;
  }

  let renderer, scene, camera, uniforms, clock;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isCompact });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompact ? 1.5 : 2));
    renderer.setClearColor(0x0b1220, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.8, 4.8);

    const cols = isCompact ? 16 : 28;
    const rows = isCompact ? 22 : 34;

    const geometry = new THREE.PlaneGeometry(planeW, planeH, cols, rows);
    uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uCellCount: { value: new THREE.Vector2(cols, rows) },
      uColorLight: { value: new THREE.Color(0x4b5a72) },
      uColorDark: { value: new THREE.Color(color) },
      uHeaderColor: { value: new THREE.Color(0x8fa2c2) },
      uGoodColor: { value: new THREE.Color(0x2fcf8e) },
      uFlagColor: { value: new THREE.Color(0xe0a23a) },
      uDarkness: { value: 1 },
      uOpacityLines: { value: 0 },
      uOpacityFills: { value: 0 },
      uAmplitude: { value: 0.3 },
      uRippleBoost: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

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
    mouseTarget.x = ((clientX / window.innerWidth) * 2 - 1) * mouseScale.x;
    mouseTarget.y = -((clientY / window.innerHeight) * 2 - 1) * mouseScale.y;
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

  let lineOpacity = 0;
  let fillOpacity = 0;
  let darkness = 1;
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
    const dark = zone ? zone.dark : true;
    // Lines stay meaningfully visible everywhere — a real grid texture the
    // whole way down the page, not just in dark sections. Fills (the
    // louder colored cells) recede hard over light sections so they never
    // compete with body text.
    const targetLineOpacity = dark ? 0.85 : 0.55;
    const targetFillOpacity = dark ? 0.9 : 0.12;

    lineOpacity += (targetLineOpacity - lineOpacity) * 0.06;
    fillOpacity += (targetFillOpacity - fillOpacity) * 0.06;
    darkness += ((dark ? 1 : 0) - darkness) * 0.06;
    currentTilt += (targetTilt - currentTilt) * 0.04;
    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.04;

    const lerp = isCompact ? 0.24 : 0.1;
    mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * lerp;
    mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * lerp;

    scene.rotation.x = currentTilt;
    const t = clock.getElapsedTime();

    uniforms.uTime.value = t;
    uniforms.uMouse.value.set(mouseSmooth.x, mouseSmooth.y);
    uniforms.uOpacityLines.value = lineOpacity;
    uniforms.uOpacityFills.value = fillOpacity;
    uniforms.uAmplitude.value = currentAmplitude;
    uniforms.uRippleBoost.value = isCompact ? 1.8 : 1;
    uniforms.uDarkness.value = darkness;

    // The canvas's own background: opaque navy behind dark sections (a
    // solid backdrop), fully transparent behind light ones (so only the
    // shader's own line/fill pixels show through them at all).
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
