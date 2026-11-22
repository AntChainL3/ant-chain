// App hero visuals (point clouds, same language as the 02 showcase).
//   data-appvisual="bridge"  two chains as dotted spheres; particles arc from Robinhood Chain to ANT CHAIN
//                            (deposits), a thinner stream returns slowly (withdrawals)
//   data-appvisual="swap"    two dotted rings, ANT and any ERC-20; particles trade places on a figure-eight
// Pauses off screen; a still frame when reduced motion is on; hides itself without WebGL.
import * as THREE from "three";

const canvas = document.querySelector("[data-appvisual]");
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ok = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();

if (canvas && ok) {
  const kind = canvas.dataset.appvisual;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.6, 11);
  camera.lookAt(0, 0, 0);
  const root = new THREE.Group();
  scene.add(root);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const sprite = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const g = c.getContext("2d"); const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.5, "rgba(255,255,255,.75)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  function cloud(points, colors, size = 0.04, additive = false) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(points, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    const p = new THREE.Points(geo, mat);
    root.add(p);
    return p;
  }
  const WHITE = [0.86, 0.86, 0.86], AMBER = [1, 0.7, 0.1];
  function shell(n, cx, R, tint, bands = true) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let lat, lon;
      if (bands && i % 3) { lat = (Math.floor(rnd(0, 13)) / 12 - 0.5) * Math.PI * 0.94 + gauss() * 0.01; lon = rnd(0, Math.PI * 2); }
      else { const y = rnd(-1, 1); lat = Math.asin(y); lon = rnd(0, Math.PI * 2); }
      const r = R * (1 + gauss() * 0.012);
      pos.set([r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)], i * 3);
      const c = Math.random() < 0.85 ? tint : WHITE, k = 0.6 + Math.random() * 0.4;
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    }
    const p = cloud(pos, col, 0.038); p.position.x = cx; return p;
  }
  function ring(n, cx, R, r, tint) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd(0, Math.PI * 2), v = rnd(0, Math.PI * 2), rr = r * (0.6 + Math.abs(gauss()) * 0.5);
      pos.set([(R + rr * Math.cos(v)) * Math.cos(u), (R + rr * Math.cos(v)) * Math.sin(u), rr * Math.sin(v)], i * 3);
      const k = 0.6 + Math.random() * 0.4, c = Math.random() < 0.85 ? tint : WHITE;
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    }
    const p = cloud(pos, col, 0.036); p.position.x = cx; return p;
  }

  // ---- moving stream along a path function f(t) -> [x,y,z] ----
  function stream(n, path, speed, color, size, jitter) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const seeds = Array.from({ length: n }, () => ({ t: Math.random(), v: speed * (0.6 + Math.random() * 0.8), o: [gauss() * jitter, gauss() * jitter, gauss() * jitter] }));
    for (let i = 0; i < n; i++) col.set(color, i * 3);
    const pts = cloud(pos, col, size, true);
    return {
      step(dt) {
        for (let i = 0; i < n; i++) {
          const s = seeds[i];
          s.t = (s.t + s.v * dt) % 1;
          const [x, y, z] = path(s.t);
          const fade = Math.sin(s.t * Math.PI);
          pos[i * 3] = x + s.o[0] * fade; pos[i * 3 + 1] = y + s.o[1] * fade; pos[i * 3 + 2] = z + s.o[2] * fade;
        }
        pts.geometry.attributes.position.needsUpdate = true;
      },
    };
  }

  const streams = [];
  const spinners = [];
  if (kind === "bridge") {
    spinners.push(shell(2600, -3.1, 1.45, WHITE));
    spinners.push(shell(2600, 3.1, 1.45, AMBER));
    // deposit: an arc over the top, left to right
    const arc = (t) => { const x = -3.1 + 6.2 * t; return [x, 1.0 + Math.sin(t * Math.PI) * 1.6, Math.sin(t * Math.PI * 2) * 0.25]; };
    streams.push(stream(700, arc, 0.22, AMBER, 0.06, 0.12));
    // withdrawal: a thinner, slower return underneath
    const back = (t) => { const x = 3.1 - 6.2 * t; return [x, -1.0 - Math.sin(t * Math.PI) * 1.1, -Math.sin(t * Math.PI * 2) * 0.2]; };
    streams.push(stream(160, back, 0.06, WHITE, 0.045, 0.06));
  } else {
    spinners.push(ring(2400, -2.4, 1.25, 0.32, AMBER));
    spinners.push(ring(2400, 2.4, 1.25, 0.32, WHITE));
    // figure-eight through both rings: tokens changing hands
    const eight = (t) => { const a = t * Math.PI * 2; return [Math.sin(a) * 2.4, Math.sin(a * 2) * 1.0, Math.cos(a) * 0.5]; };
    streams.push(stream(620, eight, 0.12, AMBER, 0.055, 0.1));
    streams.push(stream(620, (t) => eight((t + 0.5) % 1), 0.12, WHITE, 0.05, 0.1));
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1.3 ? 15 : 11;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const target = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => { target.x = (e.clientX / innerWidth - 0.5) * 2; target.y = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });

  let prev = performance.now(), running = false, visible = true;
  function frame(now, dt) {
    streams.forEach((s) => s.step(dt));
    spinners.forEach((p, i) => { p.rotation.y += dt * (i ? -0.12 : 0.12); });
    root.rotation.y += ((target.x * 0.18) - root.rotation.y) * 0.05;
    root.rotation.x += ((0.12 + target.y * 0.1) - root.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    frame(now, dt);
    requestAnimationFrame(loop);
  }
  function update() {
    const want = visible && !document.hidden && !reduced();
    if (want && !running) { running = true; prev = performance.now(); requestAnimationFrame(loop); }
    else if (!want) { running = false; frame(performance.now(), 0); }
  }
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }).observe(canvas);
  document.addEventListener("visibilitychange", update);
  streams.forEach((s) => s.step(0));
  frame(performance.now(), 0);
  update();
} else if (canvas) {
  canvas.parentElement.hidden = true;
}
