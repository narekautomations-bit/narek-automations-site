// One persistent, full-page WebGL canvas: a flowing wireframe mesh (the
// original "matrix" look — triangulated grid + diagonals, not a flat
// bordered-cell pattern) that reacts to the cursor/touch anywhere on the
// page. Starts calm and near-flat at the top and gradually tilts into a
// more dramatic 3D wave as the page scrolls. Motion is deliberately
// gentle (low-frequency, low-amplitude wave + a broad soft ripple) so it
// reads as a smooth flowing surface rather than a jittery/nervous one.
//
// The grid is meant to stay genuinely visible the entire way down the
// page, including through light sections — see the CSS in layout.css
// that makes .tone-light sections translucent, plus the renderer's clear
// alpha here tracking section darkness per frame (opaque navy backdrop
// behind dark sections, fully transparent behind light ones, so light
// sections reveal only the mesh's own lines, not a flat wash). Heading
// text gets a soft halo in components.css so it stays legible over the
// busier background.
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
  void main() {
    vec3 pos = position;
    // Very subtle ambient life — just enough that the mesh doesn't look
    // frozen — so the cursor/touch response is unmistakably the dominant
    // motion instead of competing with a full-sheet wave.
    float wave = (sin(pos.x * 0.6 + uTime * 0.25) * 0.025 + sin(pos.y * 0.8 - uTime * 0.2) * 0.02) * uAmplitude;
    // A smooth, tightly-localized bump that tracks the cursor/touch
    // directly — like pressing into fabric right where your finger is —
    // rather than a radiating ripple, which read as moving the whole
    // sheet regardless of where you touched.
    float dist = distance(pos.xy, uMouse);
    float bump = exp(-dist * dist * 1.1) * 0.85 * uRippleBoost;
    pos.z += wave + bump;
    vElevation = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColorLight;
  uniform vec3 uColorDark;
  uniform float uDarkness;
  uniform float uOpacity;
  varying float vElevation;
  void main() {
    float alpha = 0.55 + clamp(vElevation * 1.6, -0.2, 0.5);
    vec3 col = mix(uColorLight, uColorDark, uDarkness);
    gl_FragColor = vec4(col, alpha * uOpacity);
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

    const cols = isCompact ? 18 : 32;
    const rows = isCompact ? 24 : 40;

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

  let opacity = 0;
  let darkness = 1;
  let currentTilt = -0.4;
  let currentAmplitude = 0.3;

  function frame() {
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, scrollY / maxScroll);

    const targetTilt = -0.4 + progress * -0.7;
    const targetAmplitude = 0.3 + progress * 0.7;

    const viewCenter = scrollY + window.innerHeight * 0.4;
    const zone = zones.find((z) => viewCenter >= z.top && viewCenter < z.bottom);
    const dark = zone ? zone.dark : true;
    // Meaningfully visible everywhere — dark sections get the full
    // treatment, light sections stay clearly present too (not a whisper),
    // with heading text protected by a halo (components.css) instead of
    // by hiding the grid behind it.
    const targetOpacity = dark ? 0.65 : 0.6;

    opacity += (targetOpacity - opacity) * 0.06;
    darkness += ((dark ? 1 : 0) - darkness) * 0.06;
    currentTilt += (targetTilt - currentTilt) * 0.04;
    currentAmplitude += (targetAmplitude - currentAmplitude) * 0.04;

    const lerp = isCompact ? 0.28 : 0.16;
    mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * lerp;
    mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * lerp;

    scene.rotation.x = currentTilt;
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uMouse.value.set(mouseSmooth.x, mouseSmooth.y);
    uniforms.uOpacity.value = opacity;
    uniforms.uAmplitude.value = currentAmplitude;
    uniforms.uRippleBoost.value = isCompact ? 1.8 : 1;
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
