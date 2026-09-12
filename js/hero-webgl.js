// Animated wireframe grid in the hero, reacting to the cursor (or touch, on
// phones) — a living version of the static spreadsheet-grid backdrop. Runs
// on both desktop and mobile, at reduced geometry/pixel-ratio on narrow
// viewports to keep it light on weaker GPUs and battery. Fails soft
// everywhere: any missing support, error, or reduced-motion preference just
// leaves the static CSS grid (#hero-bg-grid) visible, since the "active"
// flag/attribute that hides it is only set after full success.

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  varying float vElevation;
  void main() {
    vec3 pos = position;
    float wave = sin(pos.x * 1.1 + uTime * 0.6) * 0.12 + sin(pos.y * 1.6 - uTime * 0.4) * 0.1;
    float dist = distance(pos.xy, uMouse * 3.5);
    float ripple = sin(dist * 2.5 - uTime * 2.0) * exp(-dist * 0.8) * 0.45;
    pos.z += wave + ripple;
    vElevation = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColor;
  varying float vElevation;
  void main() {
    float alpha = 0.28 + clamp(vElevation * 1.3, -0.16, 0.4);
    gl_FragColor = vec4(uColor, alpha * 0.5);
  }
`;

export async function initHeroWebGL() {
  const canvas = document.getElementById("hero-webgl");
  const gridFallback = document.getElementById("hero-bg-grid");
  const heroSection = canvas?.closest(".hero");
  if (!canvas || !heroSection) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const isCompact = window.innerWidth < 820;

  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
  } catch {
    return;
  }

  let renderer, scene, camera, mesh, uniforms, clock;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isCompact });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompact ? 1.5 : 2));

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2.3, 4.4);
    camera.lookAt(0, -0.3, 0);

    const segments = isCompact ? [26, 17] : [46, 30];
    const geometry = new THREE.PlaneGeometry(9, 6, segments[0], segments[1]);
    uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColor: { value: new THREE.Color(0x1fbf72) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      wireframe: true,
      transparent: true,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -1.15;
    mesh.position.y = -0.6;
    scene.add(mesh);
    clock = new THREE.Clock();
  } catch {
    return;
  }

  function resize() {
    const w = heroSection.clientWidth;
    const h = heroSection.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const mouseTarget = { x: 0, y: 0 };
  const mouseSmooth = { x: 0, y: 0 };

  function setTargetFromPoint(clientX, clientY) {
    const rect = heroSection.getBoundingClientRect();
    mouseTarget.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseTarget.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  }

  window.addEventListener("mousemove", (e) => setTargetFromPoint(e.clientX, e.clientY));

  // Touch: follow a finger while it's actually on the hero (dragging/tapping
  // there), same ripple math as the desktop cursor.
  heroSection.addEventListener(
    "touchstart",
    (e) => setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );
  heroSection.addEventListener(
    "touchmove",
    (e) => setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );

  let running = false;
  let rafId = null;

  function renderFrame() {
    if (!running) return;
    mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * 0.06;
    mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * 0.06;
    uniforms.uMouse.value.set(mouseSmooth.x, mouseSmooth.y);
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(renderFrame);
  }

  function start() {
    if (running) return;
    running = true;
    clock.start();
    renderFrame();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Only pay the render cost while the hero is actually on screen.
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => (entry.isIntersecting ? start() : stop())),
    { threshold: 0.05 }
  );
  observer.observe(heroSection);

  gridFallback?.setAttribute("data-webgl-active", "true");
}
