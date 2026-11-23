// Hero object: the ANT CHAIN stack in 3D.
// Three plates are the three chains (Ethereum, Robinhood Chain, ANT CHAIN). On the top plate,
// the latest real ANT CHAIN blocks stand as amber bars, height = gas used. A new block drops in
// when it is made. Batch packets sink through the pillars to Robinhood Chain and on to Ethereum
// (that flow is an illustration of the route; the bars are live data).
import * as THREE from "three";
import { L2, L3 } from "./config.js";

const canvas = document.querySelector("[data-stack]");
if (canvas) init(canvas);

function init(canvas) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { canvas.remove(); return; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const AMBER = 0xffb21a, AMBER_HI = 0xffd27a;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 200);
  camera.position.set(19, 12, 19);
  camera.lookAt(0.6, 0.2, -0.6);

  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x0a0805, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(6, 12, 4);
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);

  // ---------- plates ----------
  const SIZE = 6.2, GAP = 1.95;
  const plates = [
    { name: "ETHEREUM", sub: "settles", y: -GAP, edge: 0x4d4d4d, fill: 0x0b0b0b },
    { name: "ROBINHOOD CHAIN", sub: String(L2.id), y: 0, edge: 0x8c8c8c, fill: 0x0d0d0d },
    { name: "ANT CHAIN", sub: String(L3.id), y: GAP, edge: AMBER, fill: 0x120d04 },
  ];
  function label(text, sub, color) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96;
    const g = c.getContext("2d");
    g.font = "600 36px 'Geist Mono', ui-monospace, monospace"; g.fillStyle = color; g.fillText(text, 4, 42);
    g.font = "500 26px 'Geist Mono', ui-monospace, monospace"; g.fillStyle = "#8c8c8c"; g.fillText(sub, 4, 84);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    s.scale.set(3.0, 0.57, 1);
    s.center.set(0, 0.5);
    return s;
  }
  plates.forEach((p, i) => {
    const g = new THREE.Group();
    g.position.y = p.y;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(SIZE, 0.14, SIZE), new THREE.MeshLambertMaterial({ color: p.fill, transparent: true, opacity: 0.92 }));
    g.add(slab);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: p.edge })));
    const grid = new THREE.GridHelper(SIZE, 8, p.edge, p.edge);
    grid.position.y = 0.075; grid.material.transparent = true; grid.material.opacity = i === 2 ? 0.22 : 0.12;
    g.add(grid);
    const lb = label(p.name, p.sub, i === 2 ? "#ffb21a" : "#ededed");
    lb.position.set(SIZE / 2 + 0.35, 0.05, -SIZE / 2 + 0.3);
    g.add(lb);
    world.add(g);
  });

  // ---------- pillars between plates ----------
  const pillarMat = new THREE.LineDashedMaterial({ color: 0x6b6b6b, dashSize: 0.12, gapSize: 0.12, transparent: true, opacity: 0.8 });
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => [x * (SIZE / 2 - 0.4), z * (SIZE / 2 - 0.4)]);
  corners.forEach(([x, z]) => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, -GAP, z), new THREE.Vector3(x, GAP, z)]);
    const line = new THREE.Line(geo, pillarMat); line.computeLineDistances(); world.add(line);
  });

  // ---------- live blocks on the ANT CHAIN plate ----------
  const N = 7, CELL = (SIZE - 1.2) / N, MAXB = N * N;
  const barGeo = new THREE.BoxGeometry(CELL * 0.72, 1, CELL * 0.72);
  barGeo.translate(0, 0.5, 0);
  const edgeGeo = new THREE.EdgesGeometry(barGeo);
  const bars = []; // newest first
  const top = GAP + 0.07;
  function slot(i) {
    // newest block at the front corner, then a diagonal fill toward the back
    const order = [];
    for (let s = 0; s < 2 * N - 1; s++) for (let r = 0; r < N; r++) { const c = s - r; if (c >= 0 && c < N) order.push([r, c]); }
    const [r, c] = order[i];
    return [SIZE / 2 - 0.6 - CELL * (c + 0.5), SIZE / 2 - 0.6 - CELL * (r + 0.5)];
  }
  const slots = Array.from({ length: MAXB }, (_, i) => slot(i));
  const heightFor = (gas) => 0.14 + Math.min(1, Math.sqrt(gas / 400000)) * 1.55;
  function makeBar(info, fresh) {
    const h = heightFor(info.gasUsed);
    const shade = 0.35 + Math.min(1, info.gasUsed / 300000) * 0.65;
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(AMBER).multiplyScalar(shade), emissive: new THREE.Color(0x3a2400), emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(barGeo, mat);
    const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: AMBER_HI, transparent: true, opacity: 0.9 }));
    mesh.add(edges);
    mesh.scale.y = h;
    mesh.userData = { h, t0: performance.now(), fresh, target: [0, 0], number: info.number };
    world.add(mesh);
    return mesh;
  }
  function layout() {
    bars.forEach((b, i) => { b.userData.target = slots[i]; if (!b.userData.placed) { b.position.set(slots[i][0], top, slots[i][1]); b.userData.placed = true; } });
  }
  function setLedger(list) {
    bars.splice(0).forEach((b) => world.remove(b));
    list.slice(0, MAXB).forEach((info) => bars.push(makeBar(info, false)));
    layout();
  }
  function addBlock(info) {
    if (bars.some((b) => b.userData.number === info.number)) return;
    const b = makeBar(info, true);
    bars.unshift(b);
    while (bars.length > MAXB) world.remove(bars.pop());
    b.userData.placed = true;
    b.position.set(slots[0][0], top + 4.5, slots[0][1]);
    layout();
    spawnPacket();
  }
  if (window.antLedger) setLedger(window.antLedger);
  else setLedger(Array.from({ length: 12 }, (_, i) => ({ number: -i, gasUsed: 0 }))); // empty placeholders until data arrives
  addEventListener("antchain:ledger", (e) => setLedger(e.detail));
  addEventListener("antchain:newblock", (e) => addBlock(e.detail));

  // ---------- batch packets sinking through the stack (illustration) ----------
  const packetGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const packets = [];
  function spawnPacket() {
    const [x, z] = corners[Math.floor(Math.random() * corners.length)];
    const m = new THREE.Mesh(packetGeo, new THREE.MeshBasicMaterial({ color: AMBER_HI }));
    m.position.set(x, GAP, z);
    m.userData = { t0: performance.now(), x, z };
    world.add(m); packets.push(m);
  }

  // ---------- size, input ----------
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // narrow screens: step the camera back so the plate labels stay in frame
    const back = camera.aspect < 1.4 ? 1.18 : 1;
    camera.position.set(19 * back, 12 * back, 19 * back);
    camera.lookAt(0.6 + (back > 1 ? 1.5 : 0), 0.2, -0.6 - (back > 1 ? 0.6 : 0));
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize); resize();
  let px = 0, tx = 0, py = 0, ty = 0, scrollP = 0;
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  addEventListener("scroll", () => { scrollP = Math.min(1.5, scrollY / innerHeight); }, { passive: true });
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  const born = performance.now();
  let lastPacket = 0;
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const frame = (now) => {
    if (visible) {
      const t = now / 1000;
      const k = reduced ? 1 : ease(Math.min(1, (now - born) / 1400));
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      world.rotation.y = (reduced ? 0 : Math.sin(t * 0.18) * 0.22) + px * 0.25 + scrollP * 0.6;
      world.rotation.x = py * 0.06;
      world.position.y = 0.55 + (1 - k) * -1.2 + scrollP * 1.4;
      // plates open up on load: the stack starts collapsed and spreads to its gaps
      world.children.forEach((c) => { if (c.isGroup) c.scale.setScalar(0.85 + 0.15 * k); });
      // bars: glide to their slot, drop in when fresh, grow from the plate
      bars.forEach((b) => {
        const u = b.userData, [x, z] = u.target;
        b.position.x += (x - b.position.x) * 0.12;
        b.position.z += (z - b.position.z) * 0.12;
        b.position.y += (top - b.position.y) * (u.fresh ? 0.09 : 1);
        const grow = Math.min(1, (now - u.t0) / 900);
        b.scale.y = u.h * (reduced ? 1 : ease(grow)) * k + 0.001;
      });
      // ambient packets every few seconds so the route reads even when the chain is quiet
      if (!reduced && now - lastPacket > 2600) { lastPacket = now; spawnPacket(); }
      for (let i = packets.length - 1; i >= 0; i--) {
        const m = packets[i], age = (now - m.userData.t0) / 1000;
        const y = GAP - age * 1.5;
        m.position.y = y;
        m.rotation.y = age * 2;
        if (y < -GAP) { world.remove(m); packets.splice(i, 1); }
      }
      canvas.style.opacity = String(k * Math.max(0, 1 - scrollP * 0.5));
      renderer.render(scene, camera);
    }
    if (!reduced) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (reduced) { frame(performance.now()); }
}
