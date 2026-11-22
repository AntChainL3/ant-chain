// Halftone dot fields (dot-matrix on a regular grid).
//
// Hero: the dots re-form to tell the story, sweeping left to right between shapes:
//   01 Ticker        the letters ANT
//   02 Market        a candlestick chart (illustrative, not price data)
//   03 Chain         a row of linked blocks, the newest in amber
//   04 Intelligence  a layered neural network
// Footer: a large "ANT CHAIN" wordmark in dots.
// Dots near the pointer swell like a lens. A real new block advances the hero to the next shape.
// Pauses off screen; a still frame when motion is off or reduced.

const motionOff = () => document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;
const AMBER = "#ffb21a", WHITE = "#ededed", GREY = "rgba(150,150,150,.55)";

// Shape painters draw into a low-res mask: one pixel per grid cell.
// Red channel = amber dots, green channel = white dots.
const painters = {
  ticker(g, w, h) {
    g.fillStyle = "rgb(0,255,0)";
    g.textAlign = "center"; g.textBaseline = "middle";
    let size = Math.floor(h * 0.66);
    const set = () => { g.font = `600 ${size}px Geist, "Segoe UI", Arial, sans-serif`; };
    set();
    while (g.measureText("ANT").width > w * 0.8 && size > 6) { size--; set(); }
    g.fillText("ANT", w / 2, h * 0.52);
  },
  market(g, w, h) {
    let seed = 11; const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const C = Math.max(8, Math.min(16, Math.floor(w / 3.2))), k = []; let p = 0;
    for (let i = 0; i < C; i++) { const o = p, c = p + (r() - 0.4) * 0.9; k.push({ o, c, hi: Math.max(o, c) + r() * 0.35, lo: Math.min(o, c) - r() * 0.35 }); p = c; }
    const lo = Math.min(...k.map((x) => x.lo)), hi = Math.max(...k.map((x) => x.hi));
    const Y = (v) => h * 0.84 - ((v - lo) / (hi - lo)) * h * 0.66, dx = (w * 0.86) / C, x0 = w * 0.07;
    k.forEach((c, i) => {
      g.fillStyle = c.c >= c.o ? "rgb(255,0,0)" : "rgb(0,255,0)";
      const x = Math.round(x0 + dx * i + dx * 0.5);
      g.fillRect(x, Math.round(Y(c.hi)), 1, Math.max(1, Math.round(Y(c.lo) - Y(c.hi))));
      const bw = Math.max(1, Math.round(dx * 0.55));
      g.fillRect(Math.round(x - bw / 2 + 0.5), Math.round(Y(Math.max(c.o, c.c))), bw, Math.max(1, Math.round(Math.abs(Y(c.o) - Y(c.c)))));
    });
  },
  chain(g, w, h) {
    const B = w < 40 ? 4 : 5, s = Math.min(h * 0.34, (w * 0.84) / (B * 1.45)), gap = s * 0.45, total = B * s + (B - 1) * gap;
    const x0 = (w - total) / 2, y0 = (h - s) / 2;
    g.lineWidth = 1;
    for (let i = 0; i < B; i++) {
      const x = Math.round(x0 + i * (s + gap));
      g.strokeStyle = i === B - 1 ? "rgb(255,0,0)" : "rgb(0,255,0)";
      g.strokeRect(x + 0.5, Math.round(y0) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
      if (i === B - 1) { g.fillStyle = "rgb(255,0,0)"; g.fillRect(x + 2, Math.round(y0) + 2, Math.round(s) - 4, Math.round(s) - 4); }
      if (i < B - 1) { g.fillStyle = "rgb(255,0,0)"; g.fillRect(Math.round(x + s), Math.round(h / 2), Math.round(gap), 1); }
    }
  },
  neural(g, w, h) {
    const layers = [3, 5, 5, 3], L = layers.length, pts = [];
    layers.forEach((n, li) => {
      const x = w * 0.14 + (li / (L - 1)) * w * 0.72;
      for (let j = 0; j < n; j++) pts.push({ x, y: h * 0.18 + ((j + 0.5) / n) * h * 0.64, li });
    });
    // synapses as sparse dotted lines to the two nearest nodes in the next layer
    g.fillStyle = "rgb(0,255,0)";
    pts.forEach((a) => {
      pts.filter((b) => b.li === a.li + 1).sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y)).slice(0, 2).forEach((b) => {
        const steps = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 2.2));
        for (let s = 1; s < steps; s++) g.fillRect(Math.round(a.x + ((b.x - a.x) * s) / steps), Math.round(a.y + ((b.y - a.y) * s) / steps), 1, 1);
      });
    });
    pts.forEach((p) => {
      g.fillStyle = p.li === L - 1 ? "rgb(255,0,0)" : "rgb(0,255,0)";
      g.beginPath(); g.arc(p.x, p.y, Math.max(1.3, h * 0.045), 0, Math.PI * 2); g.fill();
    });
  },
  word(text, align = "center") {
    return (g, w, h) => {
      g.fillStyle = "rgb(0,255,0)";
      g.textAlign = align; g.textBaseline = "middle";
      let size = Math.floor(h * 0.8);
      const set = () => { g.font = `700 ${size}px Geist, "Segoe UI", Arial, sans-serif`; };
      set();
      while (g.measureText(text).width > w * 0.9 && size > 6) { size--; set(); }
      g.fillText(text, align === "left" ? 1 : w / 2, h * 0.54);
    };
  },
};

function dotField(canvas, { shapes, step, minStep = 8, lens = true, background = true, autoplay = true, onShape }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, S = step;
  let cur = new Float32Array(0), tgt = new Float32Array(0), kind = new Uint8Array(0), nextKind = new Uint8Array(0), bg = new Float32Array(0);
  let masks = [], shape = 0, sweep = 1, lastSwitch = performance.now();
  const pointer = { x: -1e4, y: -1e4 };

  function buildMasks() {
    masks = shapes.map((paint) => {
      const m = document.createElement("canvas"); m.width = cols; m.height = rows;
      const g = m.getContext("2d", { willReadFrequently: true });
      // crisp mask; dot size follows a smooth diagonal gradient, like a halftone print
      paint(g, cols, rows);
      const d = g.getImageData(0, 0, cols, rows).data;
      const amt = new Float32Array(cols * rows), k = new Uint8Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const r = d[i * 4], gg = d[i * 4 + 1];
        const on = Math.max(r, gg) > 70;
        const x = i % cols, y = Math.floor(i / cols);
        const shade = 0.58 + 0.42 * (1 - Math.min(1, (x / cols) * 0.7 + (y / rows) * 0.45));
        amt[i] = on ? shade : 0;
        k[i] = r >= gg ? 2 : 1;
      }
      return { amt, k };
    });
  }
  function setup() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return false;
    S = W < 520 ? Math.max(minStep, Math.round(step * 0.62)) : step;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(W / S); rows = Math.floor(H / S);
    const n = cols * rows;
    cur = new Float32Array(n); tgt = new Float32Array(n); kind = new Uint8Array(n); nextKind = new Uint8Array(n); bg = new Float32Array(n);
    // background: faint dots that fade toward the edges, denser toward the lower left (cofer-like falloff)
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const nx = x / cols - 0.5, ny = y / rows - 0.5;
      bg[y * cols + x] = background ? Math.max(0, 0.55 - Math.hypot(nx * 1.1, ny * 1.3)) * 0.9 : 0;
    }
    buildMasks();
    apply(shape, true);
    return true;
  }
  function apply(k, instant) {
    shape = k;
    const m = masks[k];
    for (let i = 0; i < m.amt.length; i++) { tgt[i] = m.amt[i]; nextKind[i] = m.k[i]; if (instant) { cur[i] = m.amt[i]; kind[i] = m.k[i]; } }
    sweep = instant ? 1 : 0;
    lastSwitch = performance.now();
    onShape?.(k);
  }
  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    if (sweep < 1) sweep = Math.min(1, sweep + dt / 1.1);
    const front = sweep * (cols + 12) - 6;
    const buckets = [[], [], []];
    const ox = (W - cols * S) / 2 + S / 2, oy = (H - rows * S) / 2 + S / 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const reached = x < front;
        const goal = reached ? tgt[i] : cur[i] > 0.02 && sweep < 1 ? cur[i] * 0.98 : cur[i];
        // dots that the sweep has passed ease to the new shape; the wavefront itself flares
        cur[i] += ((reached ? tgt[i] : goal) - cur[i]) * 0.16;
        if (reached) kind[i] = nextKind[i];
        const px = ox + x * S, py = oy + y * S;
        let r;
        const wave = sweep < 1 ? Math.max(0, 1 - Math.abs(x - front) / 3) * 0.5 : 0;
        if (cur[i] > 0.06) r = S * 0.38 * Math.min(1, cur[i] + wave * 0.35) * (0.93 + 0.07 * Math.sin(t * 1.4 + x * 0.22 - y * 0.17));
        else {
          const shimmer = 0.75 + 0.25 * Math.sin(t * 0.8 + x * 0.35 + y * 0.21);
          r = S * 0.085 * (bg[i] * shimmer + wave * 0.6);
        }
        if (lens) {
          const d = Math.hypot(px - pointer.x, py - pointer.y);
          if (d < 90) r *= 1 + (1 - d / 90) * 0.9;
        }
        if (r < 0.35) continue;
        buckets[cur[i] > 0.06 ? kind[i] : 0].push(px, py, r);
      }
    }
    const colors = [GREY, WHITE, AMBER];
    for (let b = 0; b < 3; b++) {
      const arr = buckets[b];
      if (!arr.length) continue;
      ctx.fillStyle = colors[b];
      ctx.beginPath();
      for (let j = 0; j < arr.length; j += 3) { ctx.moveTo(arr[j] + arr[j + 2], arr[j + 1]); ctx.arc(arr[j], arr[j + 1], arr[j + 2], 0, Math.PI * 2); }
      ctx.fill();
    }
  }

  let running = false, visible = true, prev = performance.now();
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    if (autoplay && shapes.length > 1 && now - lastSwitch > 5600) apply((shape + 1) % shapes.length);
    draw(now / 1000, dt);
    requestAnimationFrame(loop);
  }
  function still() { sweep = 1; for (let i = 0; i < cur.length; i++) { cur[i] = tgt[i]; kind[i] = nextKind[i]; } draw(performance.now() / 1000, 0); }
  function update() {
    const want = visible && !document.hidden && !motionOff();
    if (want && !running) { running = true; prev = performance.now(); requestAnimationFrame(loop); }
    else if (!want) { running = false; still(); }
  }
  canvas.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; if (!running) still(); }, { passive: true });
  canvas.addEventListener("pointerleave", () => { pointer.x = pointer.y = -1e4; if (!running) still(); });
  let rt;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (setup()) (running ? null : still()); }, 120); }).observe(canvas);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; update(); }).observe(canvas);
  document.addEventListener("visibilitychange", update);
  addEventListener("antchain:motion", update);
  if (document.fonts?.ready) document.fonts.ready.then(() => { if (setup() && !running) still(); });
  if (setup()) still();
  update();
  return {
    go(k) { apply(k, false); if (!running) still(); },
    next() { apply((shape + 1) % shapes.length, false); if (!running) still(); },
  };
}

// ---------- hero ----------
const heroCanvas = document.querySelector("[data-hero3d]");
const steps = [...document.querySelectorAll("[data-morph-step]")];
if (heroCanvas) {
  const hero = dotField(heroCanvas, {
    shapes: [painters.ticker, painters.market, painters.chain, painters.neural],
    step: 12,
    onShape: (k) => steps.forEach((s, i) => { s.classList.toggle("on", i === k); s.setAttribute("aria-pressed", String(i === k)); }),
  });
  steps.forEach((s, i) => s.addEventListener("click", () => hero.go(i)));
  addEventListener("antchain:block", () => { if (!motionOff()) hero.next(); });
  heroCanvas.parentElement.classList.add("ready");
}

// ---------- footer wordmark ----------
document.querySelectorAll("[data-dotword]").forEach((el) => {
  const app = !!el.closest(".app-dotword");
  dotField(el, { shapes: [painters.word(el.dataset.dotword || "ANT CHAIN", app ? "left" : "center")], step: app ? 9 : 11, minStep: app ? 5 : 8, background: !app, autoplay: false });
});
