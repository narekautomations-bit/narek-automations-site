// Reusable animated "spreadsheet" grid — clean horizontal/vertical lines
// only (built as LineSegments, not a triangulated wireframe mesh, so it
// reads as an actual grid of cells rather than a 3D terrain mesh), reacting
// to the cursor or touch. Used in multiple dark sections so the interactive
// motif continues past the hero without ever sitting behind text that needs
// to stay easily readable (light sections never get this treatment).
//
// Fails soft everywhere: any missing support, error, or reduced-motion
// preference just leaves the section's static CSS grid fallback visible,
// since the "active" flag/attribute that hides it is only set on success.

const VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  varying float vElevation;
  void main() {
    vec3 pos = position;
    float wave = sin(pos.x * 1.1 + uTime * 0.6) * 0.1 + sin(pos.y * 1.6 - uTime * 0.4) * 0.08;
    float dist = distance(pos.xy, uMouse * 3.5);
    float ripple = sin(dist * 2.5 - uTime * 2.0) * exp(-dist * 0.8) * 0.5;
    pos.z += wave + ripple;
    vElevation = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColor;
  varying float vElevation;
  void main() {
    float alpha = 0.22 + clamp(vElevation * 1.5, -0.14, 0.45);
    gl_FragColor = vec4(uColor, alpha * 0.5);
  }
`;

function buildGridLineGeometry(THREE, width, height, cols, rows) {
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

let threePromise = null;
function loadThree() {
  if (!threePromise) {
    threePromise = import("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js");
  }
  return threePromise;
}

export async function initInteractiveGrid({ canvasId, gridFallbackId, sectionSelector, color = 0x1fbf72 }) {
  const canvas = document.getElementById(canvasId);
  const gridFallback = gridFallbackId ? document.getElementById(gridFallbackId) : null;
  const section = typeof sectionSelector === "string" ? document.querySelector(sectionSelector) : sectionSelector;
  if (!canvas || !section) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const isCompact = window.innerWidth < 820;

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

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 2.1, 4.6);
    camera.lookAt(0, -0.2, 0);

    const cols = isCompact ? 16 : 26;
    const rows = isCompact ? 11 : 17;
    const geometry = buildGridLineGeometry(THREE, 9, 6, cols, rows);
    uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uColor: { value: new THREE.Color(color) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.rotation.x = -1.0;
    lines.position.y = -0.5;
    scene.add(lines);
    clock = new THREE.Clock();
  } catch {
    return;
  }

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
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
    const rect = section.getBoundingClientRect();
    mouseTarget.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseTarget.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  }

  window.addEventListener("mousemove", (e) => setTargetFromPoint(e.clientX, e.clientY));
  section.addEventListener(
    "touchstart",
    (e) => setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );
  section.addEventListener(
    "touchmove",
    (e) => setTargetFromPoint(e.touches[0].clientX, e.touches[0].clientY),
    { passive: true }
  );

  let running = false;
  let rafId = null;

  function renderFrame() {
    if (!running) return;
    // Mobile: track touch more tightly (less lag) so a drag reads as
    // clearly cause-and-effect rather than a vague delayed drift.
    const lerp = isCompact ? 0.14 : 0.06;
    mouseSmooth.x += (mouseTarget.x - mouseSmooth.x) * lerp;
    mouseSmooth.y += (mouseTarget.y - mouseSmooth.y) * lerp;
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

  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => (entry.isIntersecting ? start() : stop())),
    { threshold: 0.05 }
  );
  observer.observe(section);

  gridFallback?.setAttribute("data-webgl-active", "true");
}
