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

  let renderer, scene, camera, uniforms, clock;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isCompact });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompact ? 1.5 : 2));
    renderer.setClearColor(0x0b1220, 1);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.8, 4.8);

    const cols = isCompact ? 26 : 44;
    const rows = isCompact ? 34 : 58;

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

  // Spring-based follow (position + velocity) instead of plain exponential
  // smoothing — reads as a natural, slightly elastic response rather than
  // either laggy or robotic.
  const mouseTarget = { x: 0, y: 0 };
  const mousePos = { x: 0, y: 0 };
  const mouseVel = { x: 0, y: 0 };
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

    // Critically-damped-ish spring toward the target for both axes.
    const boost = isCompact ? 1.6 : 1;
    ["x", "y"].forEach((axis) => {
      const force = (mouseTarget[axis] - mousePos[axis]) * SPRING_STIFFNESS;
      mouseVel[axis] += force * dt;
      mouseVel[axis] *= Math.exp(-SPRING_DAMPING * dt);
      mousePos[axis] += mouseVel[axis] * dt;
    });

    scene.rotation.x = currentTilt;
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uMouse.value.set(mousePos.x, mousePos.y);
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
