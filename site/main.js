// ANT CHAIN site: live chain readout, hero route field, dot-matrix figures, stages, progress, wallet, copy.
(() => {
  "use strict";

  const L3_RPC = "https://rpc.testnet.antchain.tech";
  const L1_RPCS = ["https://antchain.tech/rpc/rh-testnet", "https://website-production-ec713a93.up.railway.app/rpc/rh-testnet", "https://rpc.testnet.chain.robinhood.com"]; // testnet profile (mainnet: drpc + rpc.mainnet)
  const A = {
    ant: "0xbf10d827020a5f4260e27a005ae0034d97514b17",
    bridge: "0x8d3A8e6E0938009ba6d46E9904E7B367Ef290682",
    seqInbox: "0x6908E358ff65aed84c44C3Df699262f5B6CBD151",
    rollup: "0xe5336CD5C0A0a9f26967FB4C2F14a8F1109Cd62D",
    pricer: "0x545328faa9c28fda8d9c1d23ad4bd32f52b2daa7",
    validator: "0x08d03d05ffe87bE0f234af772Dea69Af98895d59",
  };
  const SEL = { batchCount: "0x06f13056", balanceOf: "0x70a08231", antUsd: "0xca3d55bd", currentRate: "0xf9f8bdb7", isStaked: "0x6177fd18" };
  const TRANSFER_GAS = 28402n; // measured on mainnet, 20 Nov 2026
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // "Motion off" toggle (top bar) behaves like reduced motion for everything that moves.
  const motionOff = () => reduceMotion || document.documentElement.dataset.motion === "off";
  const AMBER = "#ffb21a";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- live values: skeleton first, short amber tick on change ----------
  $$("[data-live]").forEach((el) => {
    if (el.textContent.trim() === "…") { el.textContent = " "; el.classList.add("loading"); el.setAttribute("aria-busy", "true"); }
  });
  const setLive = (key, text) => $$(`[data-live="${key}"]`).forEach((el) => {
    const wasLoading = el.classList.contains("loading");
    if (el.textContent === text && !wasLoading) return;
    el.textContent = text;
    el.classList.remove("loading");
    el.removeAttribute("aria-busy");
    if (!wasLoading && !motionOff() && key !== "updated") {
      el.classList.remove("tick");
      void el.offsetWidth;
      el.classList.add("tick");
    }
  });
  const pad = (addr) => addr.toLowerCase().replace("0x", "").padStart(64, "0");

  // ---------- JSON-RPC ----------
  async function rpc(url, method, params = []) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    return j.result;
  }
  let l1Index = 0;
  async function l1(method, params) {
    for (let i = 0; i < L1_RPCS.length; i++) {
      const url = L1_RPCS[(l1Index + i) % L1_RPCS.length];
      try {
        const res = await rpc(url, method, params);
        l1Index = (l1Index + i) % L1_RPCS.length;
        return res;
      } catch (e) { /* try the next RPC */ }
    }
    throw new Error("Robinhood Chain RPC unavailable");
  }
  const call = (to, data) => l1("eth_call", [{ to, data }, "latest"]);

  const big = (hex) => BigInt(hex);
  const fmtInt = (n) => Number(n).toLocaleString("en-US");
  const units = (wei, decimals = 18, digits = 4) => (Number(wei) / 10 ** decimals).toLocaleString("en-US", { maximumFractionDigits: digits });
  const sig = (x, digits = 2) => (x === 0 ? "0" : x.toLocaleString("en-US", { maximumSignificantDigits: digits }));

  // ---------- live readout ----------
  let lastBlock = null, antUsd = null, gasPrice = null;

  async function refreshL3() {
    try {
      const [blockHex, gasHex] = await Promise.all([rpc(L3_RPC, "eth_blockNumber"), rpc(L3_RPC, "eth_gasPrice")]);
      const block = big(blockHex);
      gasPrice = big(gasHex);
      setLive("block", fmtInt(block));
      setLive("block2", fmtInt(block));
      setLive("block3", fmtInt(block));
      const g = `${sig(Number(gasPrice) / 1e9, 3)} gwei`;
      setLive("gas", g);
      setLive("gas2", g);
      setLive("gas3", g);
      if (lastBlock !== null && block > lastBlock) onNewBlock();
      lastBlock = block;
      setLive("updated", `Read from the chain at ${new Date().toLocaleTimeString()}`);
      renderFee();
    } catch (e) {
      setLive("block", "offline");
      setLive("updated", "ANT CHAIN RPC did not answer. Retrying.");
    }
  }

  async function refreshL1() {
    const jobs = [
      call(A.seqInbox, SEL.batchCount).then((h) => setLive("batches", fmtInt(big(h)))),
      call(A.ant, SEL.balanceOf + pad(A.bridge)).then((h) => { setLive("escrow", `${units(big(h), 18, 4)} tANT`); setLive("escrow2", `${units(big(h), 18, 4)} tANT`); }),
      call(A.pricer, SEL.antUsd).then((h) => {
        antUsd = Number(big(h)) / 1e18;
        setLive("antusd", `$${antUsd.toFixed(2)}`);
        setLive("antusd2", `$${antUsd.toFixed(2)}`);
        setLive("antusd3", `$${antUsd.toFixed(2)}`);
        window.dispatchEvent(new CustomEvent("antchain:price", { detail: antUsd }));
        renderFee();
      }),
      call(A.pricer, SEL.currentRate).then((h) => setLive("rate", `${(Number(big(h)) / 1e18).toFixed(2)} ANT per ETH`)),
      call(A.rollup, SEL.isStaked + pad(A.validator)).then((h) => {
        const staked = big(h) === 1n;
        setLive("validator", staked ? "Staked" : "Not staked");
        setLive("validator2", staked ? "Staked, bond posted" : "Not staked");
        setLive("validator3", staked ? "Staked" : "Not staked");
      }),
    ];
    const res = await Promise.allSettled(jobs);
    if (res.every((r) => r.status === "rejected")) setLive("batches", "offline");
  }

  function renderFee() {
    if (gasPrice === null) return;
    const feeAnt = Number(gasPrice * TRANSFER_GAS) / 1e18;
    setLive("fee-ant", `${sig(feeAnt, 2)} tANT`);
    const text = antUsd !== null ? `$${sig(feeAnt * antUsd, 2)}` : `${sig(feeAnt, 2)} tANT`;
    setLive("fee", text);
    setLive("fee2", text);
    if (antUsd !== null) setLive("fee-usd", text);
  }

  function onNewBlock() {
    if (!motionOff()) $$("[data-live-dot]").forEach((dot) => { dot.classList.remove("flash"); void dot.offsetWidth; dot.classList.add("flash"); });
    field.pulse();
    window.dispatchEvent(new Event("antchain:block"));
  }

  // ---------- hero field: the real route as dotted arcs, packets travel it ----------
  const field = (() => {
    const canvas = $(".field");
    const api = { pulse() {} };
    if (!canvas) return api;
    const ctx = canvas.getContext("2d");
    const NAMES = ["your wallet", "sequencer", "batch · robinhood chain", "validator", "ethereum"];
    let w, h, dpr, nodes = [], arcs = [], packets = [], grid = [], rain = [], t0 = performance.now();
    const HEX = "0123456789abcdef";

    function layout() {
      const narrow = w < 760;
      const P = narrow
        ? [[0.1, 0.9], [0.18, 0.12], [0.82, 0.1], [0.9, 0.5], [0.86, 0.92]]
        : [[0.07, 0.74], [0.17, 0.3], [0.8, 0.2], [0.93, 0.56], [0.8, 0.86]];
      nodes = P.map(([x, y], i) => ({ x: x * w, y: y * h, name: NAMES[i], glow: 0 }));
      const lift = [0.22, 0.55, 0.18, 0.2];
      arcs = [];
      for (let i = 0; i < 4; i++) {
        const a = nodes[i], b = nodes[i + 1];
        const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - h * lift[i];
        arcs.push({ a, b, cx: mx, cy: i === 3 ? (a.y + b.y) / 2 : my, len: 0 });
      }
      arcs.forEach((arc) => { // approximate length for even dot spacing
        let L = 0, p = pt(arc, 0);
        for (let s = 1; s <= 40; s++) { const q = pt(arc, s / 40); L += Math.hypot(q.x - p.x, q.y - p.y); p = q; }
        arc.len = L;
      });
      grid = [];
      const step = narrow ? 26 : 22;
      for (let y = h * 0.5; y < h; y += step) for (let x = step / 2; x < w; x += step) grid.push({ x, y });
      rain = Array.from({ length: narrow ? 5 : 11 }, (_, i) => ({
        x: (narrow ? 0.05 : 0.03) * w + (i / (narrow ? 5 : 11)) * w * 0.96 + Math.random() * 20,
        y: Math.random() * h, v: 0.15 + Math.random() * 0.35, n: 6 + Math.floor(Math.random() * 7),
        s: Array.from({ length: 14 }, () => HEX[Math.floor(Math.random() * 16)]),
      }));
      nodes = []; arcs = [];
      packets = motionOff() ? [] : arcs.map((arc, i) => ({ arc: i, t: Math.random(), v: 0.0016 + Math.random() * 0.0012, bright: false }));
    }
    function pt(arc, t) {
      const u = 1 - t;
      return { x: u * u * arc.a.x + 2 * u * t * arc.cx + t * t * arc.b.x, y: u * u * arc.a.y + 2 * u * t * arc.cy + t * t * arc.b.y };
    }
    function setup() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      draw(performance.now());
    }
    function draw(now) {
      const time = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      // dune of dots in the lower half, gently breathing
      for (const g of grid) {
        const n = Math.sin(g.x * 0.006 + time * 0.25) + Math.sin(g.y * 0.011 - time * 0.18) + Math.sin((g.x + g.y) * 0.004);
        const depth = (g.y - h * 0.5) / (h * 0.5);
        const a = Math.max(0, (n + 1.2) / 4.2) * 0.32 * depth;
        if (a < 0.02) continue;
        ctx.fillStyle = `rgba(200,200,200,${a.toFixed(3)})`;
        ctx.fillRect(g.x, g.y, 1.4, 1.4);
      }
      // slow columns of hex, like calldata drifting past
      ctx.font = "500 10px 'Geist Mono', ui-monospace, monospace";
      ctx.textAlign = "center";
      for (const r of rain) {
        for (let k = 0; k < r.n; k++) {
          const yy = r.y - k * 13;
          if (yy < 0 || yy > h) continue;
          ctx.fillStyle = `rgba(160,160,160,${(0.16 * (1 - k / r.n)).toFixed(3)})`;
          ctx.fillText(r.s[k % r.s.length], r.x, yy);
        }
      }
      // dotted arcs
      for (const arc of arcs) {
        const n = Math.max(12, Math.floor(arc.len / 7));
        for (let s = 0; s <= n; s++) {
          const p = pt(arc, s / n);
          ctx.fillStyle = "rgba(237,237,237,0.2)";
          ctx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
        }
      }
      // packets with fading tails
      for (const pk of packets) {
        const arc = arcs[pk.arc];
        for (let k = 0; k < 14; k++) {
          const tt = pk.t - k * 0.012;
          if (tt < 0) break;
          if (tt > 1) continue;
          const p = pt(arc, tt);
          const a = (1 - k / 14) * (pk.bright ? 1 : 0.7);
          ctx.fillStyle = k === 0 ? AMBER : `rgba(255,178,26,${(a * 0.6).toFixed(3)})`;
          const r = k === 0 ? (pk.bright ? 3 : 2.2) : 1.4;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      // nodes + labels
      ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace";
      ctx.textBaseline = "middle";
      const showLabels = w >= 760;
      nodes.forEach((n, i) => {
        if (n.glow > 0.01) {
          ctx.beginPath(); ctx.arc(n.x, n.y, 6 + n.glow * 14, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,178,26,${(n.glow * 0.25).toFixed(3)})`; ctx.fill();
          n.glow *= 0.95;
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#0a0a0a"; ctx.fill();
        ctx.strokeStyle = i === 0 ? AMBER : "rgba(237,237,237,0.55)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? AMBER : "rgba(237,237,237,0.8)"; ctx.fill();
        if (showLabels) {
          const right = n.x < w / 2;
          ctx.textAlign = right ? "left" : "right";
          ctx.fillStyle = "rgba(160,160,160,0.9)";
          ctx.fillText(n.name, n.x + (right ? 12 : -12), n.y);
        }
      });
    }
    function step() {
      for (const r of rain) {
        r.y += r.v;
        if (r.y - r.n * 13 > h) { r.y = -10; r.s[Math.floor(Math.random() * r.s.length)] = HEX[Math.floor(Math.random() * 16)]; }
      }
      for (const pk of packets) {
        pk.t += pk.v * (pk.bright ? 2.4 : 1);
        if (pk.t > 1.17) {
          nodes[pk.arc + 1].glow = Math.max(nodes[pk.arc + 1].glow, pk.bright ? 1 : 0.35);
          if (pk.bright && pk.arc < 3) { pk.arc += 1; pk.t = 0; } // a real block's packet walks the whole route
          else { pk.t = 0; pk.bright = false; pk.v = 0.0016 + Math.random() * 0.0012; }
        }
      }
    }
    let running = false, visible = true;
    function loop(now) { if (!running) return; step(); draw(now); requestAnimationFrame(loop); }
    api.pulse = () => {
      if (!nodes.length) return;
      nodes[0].glow = 1;
      if (motionOff()) { draw(performance.now()); return; }
      packets.push({ arc: 0, t: 0, v: 0.004, bright: true });
      if (packets.length > 10) packets.splice(4, 1);
    };
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(setup, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(performance.now()));
    setup();
    const sync = () => {
      const want = visible && !document.hidden && !motionOff();
      if (want && !packets.length) packets = arcs.map((arc, i) => ({ arc: i, t: Math.random(), v: 0.0016 + Math.random() * 0.0012, bright: false }));
      if (want && !running) { running = true; requestAnimationFrame(loop); }
      else if (!want) { running = false; draw(performance.now()); }
    };
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }).observe(canvas);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("antchain:motion", sync);
    return api;
  })();

  // ---------- dot-matrix figures (static, except the sphere which turns while in view) ----------
  (() => {
    const INK = "rgba(237,237,237,";
    const figs = {
      stack(ctx, w, h) { // three stacked layers: Ethereum, Robinhood Chain, ANT CHAIN
        const cx = w / 2, cy = h * 0.5, s = Math.min(w, h) * 0.34;
        [0.28, 0, -0.28].forEach((dy, layer) => {
          for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
            const x = cx + (i - j) * s / 8.5, y = cy + dy * s * 1.4 + (i + j) * s / 17;
            const top = layer === 2;
            ctx.fillStyle = top ? AMBER : INK + (0.25 + layer * 0.25) + ")";
            ctx.fillRect(x - 1, y - 1, top ? 2.4 : 1.8, top ? 2.4 : 1.8);
          }
        });
      },
      sphere(ctx, w, h, t) {
        const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.33, N = 420, ga = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < N; i++) {
          const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i + t * 0.35;
          const x = Math.cos(th) * r, z = Math.sin(th) * r;
          const a = 0.15 + (z + 1) * 0.4;
          ctx.fillStyle = INK + a.toFixed(3) + ")";
          const sz = 1 + (z + 1) * 0.7;
          ctx.fillRect(cx + x * R, cy + y * R * 0.98, sz, sz);
        }
      },
      graph(ctx, w, h) { // hub (L3) and spokes
        const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.32;
        const pts = Array.from({ length: 7 }, (_, i) => { const a = i / 7 * Math.PI * 2 - 0.4; return { x: cx + Math.cos(a) * R * (i % 2 ? 1 : 0.78), y: cy + Math.sin(a) * R * 0.8 }; });
        pts.forEach((p) => {
          const n = 22;
          for (let k = 1; k < n; k++) { ctx.fillStyle = INK + "0.35)"; ctx.fillRect(cx + (p.x - cx) * k / n, cy + (p.y - cy) * k / n, 1.2, 1.2); }
          ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fillStyle = "#0a0a0a"; ctx.fill(); ctx.strokeStyle = INK + "0.7)"; ctx.lineWidth = 1; ctx.stroke();
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fillStyle = INK + "0.8)"; ctx.fill();
        });
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,178,26,.18)"; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.fill();
      },
      wave(ctx, w, h) { // illustrative: many quick confirmations
        const base = h * 0.72, n = Math.floor(w / 5);
        for (let i = 0; i < n; i++) {
          const x = 14 + i * ((w - 28) / n);
          const v = 0.35 + 0.3 * Math.sin(i * 0.37) * Math.sin(i * 0.11) + 0.25 * Math.abs(Math.sin(i * 1.7));
          const top = base - v * h * 0.5;
          for (let y = base; y > top; y -= 3.2) { ctx.fillStyle = INK + "0.55)"; ctx.fillRect(x, y, 1.4, 1.4); }
          if (i % 9 === 4) { ctx.fillStyle = AMBER; ctx.fillRect(x - 0.6, top - 5, 2.6, 2.6); }
        }
        for (let x = 14; x < w - 14; x += 4) { ctx.fillStyle = INK + "0.3)"; ctx.fillRect(x, base + 6, 1.2, 1.2); }
      },
      matrix(ctx, w, h) { // assertions on a grid; one disputed, one confirmed path
        const cols = 14, rows = 8, cs = Math.min((w - 40) / cols, (h - 50) / rows), ox = (w - cs * cols) / 2, oy = (h - 24 - cs * rows) / 2;
        let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const x = ox + i * cs, y = oy + j * cs, r = rnd();
          if (j === 3 && i < 11) { ctx.fillStyle = "#ededed"; ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4); continue; }
          if (j === 3 && i === 11) { ctx.fillStyle = AMBER; ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4); continue; }
          if (r < 0.42) { ctx.fillStyle = INK + "0.85)"; ctx.fillRect(x + 3, y + 3, cs - 6, cs - 6); }
          else { ctx.strokeStyle = INK + "0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x + 3.5, y + 3.5, cs - 7, cs - 7); }
        }
      },
      rings(ctx, w, h) { // L3 inside L2 inside Ethereum
        const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.36;
        [1, 0.66, 0.34].forEach((k, ring) => {
          const r = R * k, n = Math.floor(r * 0.9);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            ctx.fillStyle = ring === 2 ? AMBER : INK + (0.3 + ring * 0.25) + ")";
            const sz = ring === 2 ? 2.2 : 1.6;
            ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62, sz, sz);
          }
        });
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.fill();
      },
    };

    const items = $$("canvas[data-fig]").map((c) => ({ c, kind: c.dataset.fig, ctx: c.getContext("2d"), w: 0, h: 0 }));
    function size(it) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      it.w = it.c.clientWidth; it.h = it.c.clientHeight;
      it.c.width = it.w * dpr; it.c.height = it.h * dpr;
      it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function paint(it, t = 0) {
      if (!it.w) return;
      it.ctx.clearRect(0, 0, it.w, it.h);
      figs[it.kind](it.ctx, it.w, it.h, t);
    }
    const all = () => items.forEach((it) => { size(it); paint(it); });
    all();
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(all, 200); });

    const sphere = items.find((it) => it.kind === "sphere");
    if (sphere) {
      let on = false, inView = false, start = performance.now();
      const spin = (now) => { if (!on) return; paint(sphere, (now - start) / 1000); requestAnimationFrame(spin); };
      const sync = () => {
        const want = inView && !motionOff();
        if (want && !on) { on = true; requestAnimationFrame(spin); } else if (!want) on = false;
      };
      new IntersectionObserver(([en]) => { inView = en.isIntersecting; sync(); }).observe(sphere.c);
      window.addEventListener("antchain:motion", sync);
    }
  })();

  // ---------- tabs (route stages + code), arrow-key navigation ----------
  const stageNames = ["Sign", "Order", "Batch", "Vouch", "Settle"];
  function onStage(index) {
    const flowNodes = $$("[data-flow] .flow-node");
    const links = $$("[data-flow] .flow-links line");
    flowNodes.forEach((n, i) => { n.classList.toggle("on", i === index); n.classList.toggle("done", i < index); });
    links.forEach((l, i) => l.classList.toggle("done", i < index));
    const num = $("[data-stage-num]"), name = $("[data-stage-name]");
    if (num) num.textContent = String(index + 1).padStart(2, "0");
    if (name) name.textContent = stageNames[index];
  }
  $$("[data-tabs]").forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const isStages = root.hasAttribute("data-stages");
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        panel.hidden = !on;
        if (on && !motionOff()) { panel.classList.remove("in"); void panel.offsetWidth; panel.classList.add("in"); }
      });
      if (focus) tab.focus();
      if (isStages) onStage(tabs.indexOf(tab));
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t, false));
      t.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") next = tabs[0];
        if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
    if (isStages) onStage(0);
  });

  // ---------- header: blur after scroll, section progress + active link ----------
  (() => {
    const top = $("[data-top]");
    const fill = $("[data-progress-fill]");
    const progLinks = $$("[data-progress] a");
    const navLinks = $$(".nav nav a");
    const ids = [...new Set([...progLinks, ...navLinks].map((a) => a.getAttribute("href").slice(1)))];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const first = $("#route"), last = $("#build");
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      top.classList.toggle("scrolled", y > 24);
      if (fill && first && last) {
        const start = first.offsetTop - window.innerHeight * 0.5;
        const end = last.offsetTop + last.offsetHeight - window.innerHeight * 0.6;
        const p = Math.min(1, Math.max(0, (y - start) / (end - start)));
        fill.parentElement.style.setProperty("--p", p.toFixed(4));
      }
      const line = window.innerHeight * 0.35;
      let current = null;
      sections.forEach((s) => { if (s.getBoundingClientRect().top <= line) current = s.id; });
      [...progLinks, ...navLinks].forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${current}`));
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  // ---------- split headline letters and section-title words for the blur-in ----------
  (() => {
    let c = 0;
    $$(".blur-in").forEach((el) => {
      const text = el.textContent;
      el.textContent = "";
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); return; }
        const word = document.createElement("span");
        word.className = "wd";
        for (const ch of part) {
          const span = document.createElement("span");
          span.className = "ch";
          span.style.setProperty("--c", c++);
          span.textContent = ch;
          word.appendChild(span);
        }
        el.appendChild(word);
      });
    });
    $$(".reveal h2, h2.reveal").forEach((h2) => {
      if (!h2.getAttribute("aria-label")) h2.setAttribute("aria-label", h2.textContent.replace(/\s+/g, " ").trim());
      let i = 0;
      [...h2.childNodes].forEach((node) => {
        if (node.nodeType === 3) {
          const frag = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement("span");
            w.className = "w";
            w.setAttribute("aria-hidden", "true");
            w.style.setProperty("--w", i++);
            const inner = document.createElement("span");
            inner.className = "wi";
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          node.replaceWith(frag);
        } else if (node.nodeType === 1) {
          node.classList.add("w");
          node.setAttribute("aria-hidden", "true");
          node.style.setProperty("--w", i++);
        }
      });
    });
  })();

  // ---------- marquee: duplicate the list once so the loop is seamless ----------
  $$("[data-marquee] ul").forEach((ul) => {
    [...ul.children].forEach((li) => { const c = li.cloneNode(true); c.setAttribute("aria-hidden", "true"); ul.appendChild(c); });
  });

  // ---------- CTA: zoom + mask. A circle grows with scroll and inverts the words it covers ----------
  (() => {
    const band = $("[data-zoom]");
    if (!band) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = band.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight + r.height * 0.4)));
      band.style.setProperty("--z", motionOff() ? 0.62 : p.toFixed(4));
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  })();

  // ---------- motion toggle ----------
  (() => {
    const btn = $("[data-motion-toggle]");
    if (!btn) return;
    const paint = () => { const off = motionOff(); btn.textContent = off ? "Motion off" : "Motion on"; btn.setAttribute("aria-pressed", String(!off)); };
    btn.addEventListener("click", () => {
      const root = document.documentElement;
      if (root.dataset.motion === "off") delete root.dataset.motion; else root.dataset.motion = "off";
      try { localStorage.setItem("antchain-motion", root.dataset.motion === "off" ? "off" : "on"); } catch (e) {}
      if (root.dataset.motion === "off") $$(".reveal").forEach((el) => el.classList.add("shown"));
      paint();
      window.dispatchEvent(new Event("antchain:motion"));
    });
    if (reduceMotion) { btn.disabled = true; btn.title = "Your system asks for reduced motion"; }
    paint();
  })();

  // ---------- reveal on scroll (content is visible without JS and with reduced motion) ----------
  (() => {
    const els = $$(".reveal");
    if (motionOff() || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("shown")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("shown"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));
  })();

  // ---------- add network to wallet ----------
  const walletMsg = $("[data-wallet-msg]");
  async function addNetwork() {
    const say = (text, err) => { if (!walletMsg) return; walletMsg.textContent = text; walletMsg.classList.toggle("error", !!err); };
    if (!window.ethereum) { say("No browser wallet found. Install one such as MetaMask, or add the network by hand from Network details.", true); return; }
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: "0x68b1", chainName: "ANT CHAIN Testnet", nativeCurrency: { name: "tANT", symbol: "tANT", decimals: 18 }, rpcUrls: [L3_RPC] }],
      });
      say("ANT CHAIN added to your wallet.");
    } catch (e) {
      say(e && e.code === 4001 ? "Request cancelled in your wallet." : "Your wallet could not add the network. Add it by hand from Network details.", true);
    }
  }
  $$("[data-add-network]").forEach((b) => b.addEventListener("click", addNetwork));

  // ---------- copy ----------
  $$(".copy.addr").forEach((b) => {
    const full = b.dataset.copy;
    b.textContent = `${full.slice(0, 8)}…${full.slice(-6)}`;
    b.title = full;
    b.setAttribute("aria-label", `Copy address ${full}`);
  });
  const copyMsg = $("[data-copy-msg]");
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const v = b.dataset.copy;
    const isLabel = b.textContent.trim() === "Copy";
    try {
      await navigator.clipboard.writeText(v);
      b.classList.add("done");
      if (isLabel) b.textContent = "Copied";
      if (copyMsg) copyMsg.textContent = `Copied ${v.length > 24 ? v.slice(0, 10) + "…" + v.slice(-6) : v}`;
      setTimeout(() => { b.classList.remove("done"); if (isLabel) b.textContent = "Copy"; }, 1500);
    } catch (e) {
      if (copyMsg) copyMsg.textContent = "Copy is blocked in this browser. Select the text and copy it by hand.";
    }
  }));

  // ---------- start ----------
  refreshL3();
  refreshL1();
  setInterval(refreshL3, 4000);
  setInterval(refreshL1, 30000);
})();
