// Hero object: a price line tied into a knot, in polished chrome.
// The tube follows a (2,3) torus knot whose radius wobbles like a candle chart.
// Reflections come from a studio environment with one cobalt and one amber light panel.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.querySelector("[data-knot]");
if (canvas) init(canvas);

function init(canvas) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  } catch { canvas.remove(); return; }
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  // studio reflections with two coloured panels
  const env = new RoomEnvironment();
  const panel = (color, intensity, pos, rot, size) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); env.add(m);
  };
  panel("#ff9d00", 7, [-5, 2, 3], [0, Math.PI / 3, 0], [4, 6]);
  panel("#ffd27a", 5, [5, -2, 2], [0, -Math.PI / 3, 0], [3, 3]);
  panel("#ffffff", 7, [0, 6, 0], [Math.PI / 2, 0, 0], [10, 4]);
  panel("#ffffff", 5, [0, -6, 1], [-Math.PI / 2, 0, 0], [10, 3]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.035).texture;

  // the knot: torus knot radius modulated by a "candle" wobble
  const P = 2, Q = 3, N = 900;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const wobble = 0.07 * Math.sin(t * 11) + 0.035 * Math.sin(t * 23 + 1.3);
    const r = 1.55 + 0.62 * Math.cos(Q * t) + wobble;
    pts.push(new THREE.Vector3(r * Math.cos(P * t), r * Math.sin(P * t), 0.95 * Math.sin(Q * t) + wobble * 0.6));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
  const geo = new THREE.TubeGeometry(curve, 1600, 0.17, 40, true);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.6 });
  const knot = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(knot);
  group.rotation.set(0.55, -0.35, 0.2);
  scene.add(group);

  // a thin cobalt companion line, slightly larger, like a chart overlay
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(800).map((p) => p.clone().multiplyScalar(1.12))), new THREE.LineBasicMaterial({ color: 0xffb21a, transparent: true, opacity: 0.4 }));
  group.add(line);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  addEventListener("resize", resize);
  resize();

  // pointer + scroll
  let px = 0, py = 0, tx = 0, ty = 0;
  addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  let scrollP = 0;
  addEventListener("scroll", () => { scrollP = Math.min(1.5, scrollY / innerHeight); }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  // entrance: grows in once
  const born = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 4);

  const frame = (now) => {
    if (visible) {
      const t = now / 1000;
      const k = reduced ? 1 : ease(Math.min(1, (now - born) / 1600));
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      group.scale.setScalar(0.72 + 0.28 * k - scrollP * 0.08);
      group.rotation.y = -0.35 + (reduced ? 0 : t * 0.12) + px * 0.35 + scrollP * 0.9;
      group.rotation.x = 0.55 + py * 0.25 + (reduced ? 0 : Math.sin(t * 0.4) * 0.06);
      group.position.y = scrollP * 1.2;
      canvas.style.opacity = String(k * Math.max(0, 1 - scrollP * 0.55));
      renderer.render(scene, camera);
    }
    if (!reduced) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (reduced) renderer.render(scene, camera);
}
