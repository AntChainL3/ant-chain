// Section 02 showcase: a dense particle cloud that changes form as you scroll through the pinned band.
//   Form 01  Linked blocks   two interlocked links (a chain)
//   Form 02  Blockspace      a rolling surface of points
//   Form 03  Settlement      a globe of latitude bands
// Scroll drives the morph and the 00-100 ruler. Time adds a slow turn unless motion is off.
import * as THREE from "three";

const section = document.querySelector("[data-showcase]");
const canvas = document.querySelector("[data-showcase-canvas]");
const stageEl = document.querySelector("[data-showcase-stage]");
const ruler = document.querySelector(".ruler");
const tags = [...document.querySelectorAll(".tags li")];
const depth = [-140, 90, -60, 160]; // parallax: each tag drifts at its own speed as the band scrolls
const motionOff = () => document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;

function supported() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

if (section && canvas && supported()) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0.4, 11);
  camera.lookAt(0, 0.4, 0);

  const N = innerWidth < 760 ? 9000 : 16000;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function make(fn) {
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = fn(i); p[i * 3] = v[0]; p[i * 3 + 1] = v[1]; p[i * 3 + 2] = v[2]; }
    return p;
  }
  // Form 01: two interlocked tori, a chain link pair, with a soft volumetric fuzz
  const links = make((i) => {
    const R = 1.55, r = 0.42 + Math.abs(gauss()) * 0.22, u = rnd(0, Math.PI * 2), v = rnd(0, Math.PI * 2);
    const x = (R + r * Math.cos(v)) * Math.cos(u), y = (R + r * Math.cos(v)) * Math.sin(u), z = r * Math.sin(v);
    return i % 2 ? [x - 1.05, y, z] : [x + 1.05, z, y];
  });
  // Form 02: blockspace, a wide rolling surface
  const surface = make(() => {
    const x = rnd(-5.2, 5.2), z = rnd(-3.4, 3.4);
    const y = Math.sin(x * 0.9) * 0.45 + Math.cos(z * 1.3 + x * 0.4) * 0.35 + gauss() * 0.04;
    return [x, y - 0.2, z];
  });
  // Form 03: settlement, a globe banded by latitude
  const globe = make(() => {
    const band = Math.floor(rnd(0, 22)), lat = (band / 21 - 0.5) * Math.PI * 0.96 + gauss() * 0.012, lon = rnd(0, Math.PI * 2), R = 2.5 + gauss() * 0.03;
    return [R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), R * Math.cos(lat) * Math.sin(lon)];
  });
  const forms = [links, surface, globe];
  const names = ["Form 01 / Linked blocks", "Form 02 / Blockspace", "Form 03 / Settlement"];

  const pos = new Float32Array(links);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const amber = Math.random() < 0.07;
    const g = 0.65 + Math.random() * 0.35;
    col[i * 3] = amber ? 1 : g; col[i * 3 + 1] = amber ? 0.7 : g; col[i * 3 + 2] = amber ? 0.1 : g;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const sprite = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d"); const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.5, "rgba(255,255,255,.8)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const mat = new THREE.PointsMaterial({ size: 0.034, map: sprite, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95 });
  const cloud = new THREE.Points(geo, mat);
  scene.add(cloud);

  // scroll -> form: hold, morph, hold, morph, hold
  const keys = [[0, 0.26, 0], [0.26, 0.42, 0.5], [0.42, 0.6, 1], [0.6, 0.76, 1.5], [0.76, 1.01, 2]];
  function formAt(p) {
    for (const [a, b, f] of keys) if (p >= a && p < b) {
      if (Number.isInteger(f)) return f;
      const k = (p - a) / (b - a);
      return Math.floor(f) + (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    }
    return 2;
  }
  let shown = -1;
  function applyForm(f) {
    const a = Math.floor(Math.min(f, 1.999)), t = f - a, A = forms[a], B = forms[Math.min(a + 1, 2)];
    for (let i = 0; i < N * 3; i++) pos[i] = A[i] + (B[i] - A[i]) * t;
    geo.attributes.position.needsUpdate = true;
    const label = Math.round(f);
    if (label !== shown && stageEl) { shown = label; stageEl.textContent = names[label]; }
  }

  function progress() {
    const r = section.getBoundingClientRect();
    const span = r.height - innerHeight;
    return Math.max(0, Math.min(1, -r.top / (span || 1)));
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 16 : 11;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const target = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => { target.x = (e.clientX / innerWidth - 0.5) * 2; target.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  let lastF = -1;
  const t0 = performance.now();
  function frame(now) {
    const p = progress();
    ruler?.style.setProperty("--p", p.toFixed(4));
    tags.forEach((el, i) => { el.style.translate = `0 ${((p - 0.5) * depth[i]).toFixed(1)}px`; });
    const f = formAt(p);
    if (Math.abs(f - lastF) > 1e-4) { applyForm(f); lastF = f; }
    const t = motionOff() ? 0 : (now - t0) / 1000;
    cloud.rotation.y += ((t * 0.12 + p * 2.2 + target.x * 0.25) - cloud.rotation.y) * 0.08;
    cloud.rotation.x += ((0.35 + target.y * 0.12 + (f > 0.8 && f < 1.4 ? -0.15 : 0)) - cloud.rotation.x) * 0.06;
    renderer.render(scene, camera);
  }

  let running = false, visible = false;
  function loop(now) { if (!running) return; frame(now); requestAnimationFrame(loop); }
  function update() {
    const want = visible && !document.hidden;
    if (want && !running) { running = true; requestAnimationFrame(loop); }
    else if (!want) running = false;
  }
  // motion off: no continuous loop, redraw only when the user scrolls
  addEventListener("scroll", () => { if (visible && motionOff()) frame(performance.now()); }, { passive: true });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }).observe(section);
  document.addEventListener("visibilitychange", update);
  applyForm(0);
  frame(performance.now());
} else if (canvas) {
  canvas.hidden = true;
}
