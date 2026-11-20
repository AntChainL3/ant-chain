// ANT CHAIN site: live chain readout, colony canvas, wallet, copy, tabs, theme.
(() => {
  "use strict";

  const L3_RPC = "https://nitro-node-production.up.railway.app";
  const L1_RPCS = ["https://robinhood.drpc.org", "https://rpc.mainnet.chain.robinhood.com"];
  const A = {
    ant: "0xbbB6c29bCc3a1028A2B54310DF73F4F7A3bcB373",
    bridge: "0x3c7218E4E7a0819C3C83065d030BB3502AE76F1a",
    seqInbox: "0xCBD854bbAf1580123cE9f7DF5bac3bFc6C33bf9E",
    rollup: "0xe3A87D0cDA39c335cb2Bbaf4DE1f052fe41aeE06",
    pricer: "0x87b35eb0ed8724250126fd16ba3c1f3509eeb2ab",
    validator: "0x98136b570891de44dAfeC819491b7a5A546faC1E",
  };
  const SEL = { batchCount: "0x06f13056", balanceOf: "0x70a08231", antUsd: "0xca3d55bd", currentRate: "0xf9f8bdb7", isStaked: "0x6177fd18" };
  const TRANSFER_GAS = 28402n; // measured on mainnet, 20 Nov 2026
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // Live values start as skeletons (no layout shift); a changed value gets a short "tick".
  $$("[data-live]").forEach((el) => {
    if (el.textContent.trim() === "…") { el.textContent = " "; el.classList.add("loading"); el.setAttribute("aria-busy", "true"); }
  });
  const setLive = (key, text) => $$(`[data-live="${key}"]`).forEach((el) => {
    const wasLoading = el.classList.contains("loading");
    if (el.textContent === text && !wasLoading) return;
    el.textContent = text;
    el.classList.remove("loading");
    el.removeAttribute("aria-busy");
    if (!wasLoading && !reduceMotion && key !== "updated") {
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
      } catch (e) { /* try next */ }
    }
    throw new Error("Robinhood Chain RPC unavailable");
  }
  const call = (to, data) => l1("eth_call", [{ to, data }, "latest"]);

  // ---------- formatting ----------
  const big = (hex) => BigInt(hex);
  const fmtInt = (n) => Number(n).toLocaleString("en-US");
  function units(wei, decimals = 18, digits = 4) {
    const s = Number(wei) / 10 ** decimals;
    return s.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }
  function sig(x, digits = 2) {
    if (x === 0) return "0";
    return x.toLocaleString("en-US", { maximumSignificantDigits: digits });
  }

  // ---------- live readout ----------
  let lastBlock = null;
  let antUsd = null;
  let gasPrice = null;

  async function refreshL3() {
    try {
      const [blockHex, gasHex] = await Promise.all([rpc(L3_RPC, "eth_blockNumber"), rpc(L3_RPC, "eth_gasPrice")]);
      const block = big(blockHex);
      gasPrice = big(gasHex);
      setLive("block", fmtInt(block));
      setLive("block2", fmtInt(block));
      setLive("gas", `${sig(Number(gasPrice) / 1e9, 3)} gwei`);
      if (lastBlock !== null && block > lastBlock) onNewBlock();
      lastBlock = block;
      setLive("updated", `Last read ${new Date().toLocaleTimeString()}.`);
      renderFee();
    } catch (e) {
      setLive("block", "unreachable");
      setLive("updated", "ANT CHAIN RPC did not answer. Retrying.");
    }
  }

  async function refreshL1() {
    const jobs = [
      call(A.seqInbox, SEL.batchCount).then((h) => setLive("batches", fmtInt(big(h)))),
      call(A.ant, SEL.balanceOf + pad(A.bridge)).then((h) => setLive("escrow", `${units(big(h), 18, 4)} ANT`)),
      call(A.pricer, SEL.antUsd).then((h) => {
        antUsd = Number(big(h)) / 1e18;
        setLive("antusd", `$${antUsd.toFixed(2)}`);
        renderFee();
      }),
      call(A.pricer, SEL.currentRate).then((h) => setLive("rate", `${(Number(big(h)) / 1e18).toFixed(2)} ANT per ETH`)),
      call(A.rollup, SEL.isStaked + pad(A.validator)).then((h) => {
        const staked = big(h) === 1n;
        setLive("validator", staked ? "Staked" : "Not staked");
        setLive("validator2", staked ? "Staked, bond posted" : "Not staked");
      }),
    ];
    const res = await Promise.allSettled(jobs);
    if (res.every((r) => r.status === "rejected")) setLive("batches", "unreachable");
  }

  function renderFee() {
    if (gasPrice === null) return;
    const feeWei = gasPrice * TRANSFER_GAS;
    const feeAnt = Number(feeWei) / 1e18;
    setLive("fee-ant", `${sig(feeAnt, 2)} ANT`);
    if (antUsd !== null) {
      const usd = feeAnt * antUsd;
      setLive("fee", `$${sig(usd, 2)}`);
      setLive("fee-usd", `$${sig(usd, 2)}`);
    } else {
      setLive("fee", `${sig(feeAnt, 2)} ANT`);
    }
  }

  function onNewBlock() {
    const dot = $("[data-live-dot]");
    if (dot && !reduceMotion) {
      dot.classList.remove("flash");
      void dot.offsetWidth;
      dot.classList.add("flash");
    }
    colony.pulse();
  }

  // ---------- colony canvas ----------
  const colony = (() => {
    const canvas = $(".colony");
    const api = { pulse() {} };
    if (!canvas) return api;
    const ctx = canvas.getContext("2d");
    let w, h, dpr, nodes = [], edges = [], ants = [], colors = {};

    function readColors() {
      const cs = getComputedStyle(document.documentElement);
      colors = { ink: cs.getPropertyValue("--ink").trim(), signal: cs.getPropertyValue("--signal").trim(), paper: cs.getPropertyValue("--paper").trim() };
    }
    function hexA(hex, a) {
      const m = hex.replace("#", "");
      const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    function setup() {
      readColors();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // keep the trail to the right so the headline stays clean
      const count = Math.round(Math.max(10, Math.min(26, (w * h) / 45000)));
      const xMin = w < 760 ? 0.55 : 0.58;
      nodes = Array.from({ length: count }, () => ({ x: w * (xMin + (1 - xMin) * Math.random()), y: h * (0.08 + 0.7 * Math.random()), glow: 0 }));
      edges = [];
      nodes.forEach((a, i) => {
        nodes.map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) })).filter((o) => o.j !== i).sort((p, q) => p.d - q.d).slice(0, 2)
          .forEach(({ j }) => {
            if (edges.some((e) => e.a === j && e.b === i)) return;
            const b = nodes[j];
            edges.push({ a: i, b: j, cx: (a.x + b.x) / 2 + (Math.random() - 0.5) * 70, cy: (a.y + b.y) / 2 + (Math.random() - 0.5) * 70, heat: 0 });
          });
      });
      ants = reduceMotion ? [] : Array.from({ length: Math.round(count * 1.8) }, () => spawn());
      draw(true);
    }
    function spawn(from) {
      const opts = from == null ? edges : edges.filter((e) => e.a === from || e.b === from);
      const list = opts.length ? opts : edges;
      const e = list[Math.floor(Math.random() * list.length)];
      return { e, fwd: from == null ? Math.random() < 0.5 : e.a === from, t: from == null ? Math.random() : 0, v: 0.0025 + Math.random() * 0.004 };
    }
    function pt(e, t) {
      const a = nodes[e.a], b = nodes[e.b], u = 1 - t;
      return { x: u * u * a.x + 2 * u * t * e.cx + t * t * b.x, y: u * u * a.y + 2 * u * t * e.cy + t * t * b.y };
    }
    function draw(staticOnly) {
      ctx.clearRect(0, 0, w, h);
      edges.forEach((e) => {
        const a = nodes[e.a], b = nodes[e.b];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(e.cx, e.cy, b.x, b.y);
        ctx.strokeStyle = hexA(colors.ink, 0.1 + e.heat * 0.35); ctx.lineWidth = 1; ctx.setLineDash([2, 5]); ctx.stroke(); ctx.setLineDash([]);
        e.heat *= 0.985;
      });
      if (!staticOnly) {
        ants.forEach((ant, i) => {
          ant.t += ant.v;
          const p = pt(ant.e, ant.fwd ? ant.t : 1 - ant.t);
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.7, 0, Math.PI * 2); ctx.fillStyle = colors.ink; ctx.fill();
          ant.e.heat = Math.min(1, ant.e.heat + 0.015);
          if (ant.t >= 1) ants[i] = spawn(ant.fwd ? ant.e.b : ant.e.a);
        });
      }
      nodes.forEach((n) => {
        ctx.beginPath(); ctx.arc(n.x, n.y, 4 + n.glow * 7, 0, Math.PI * 2);
        ctx.fillStyle = n.glow > 0.02 ? hexA(colors.signal, 0.35 + n.glow * 0.65) : colors.signal; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, 4, 0, Math.PI * 2); ctx.strokeStyle = colors.ink; ctx.lineWidth = 1; ctx.stroke();
        n.glow *= 0.96;
      });
    }
    let running = false;
    function loop() { draw(false); if (running) requestAnimationFrame(loop); }
    api.pulse = () => {
      if (!nodes.length) return;
      const n = nodes[Math.floor(Math.random() * nodes.length)];
      n.glow = 1;
      if (reduceMotion) { draw(true); setTimeout(() => { n.glow = 0; draw(true); }, 800); }
    };
    api.recolor = () => { readColors(); if (reduceMotion) draw(true); };
    let t;
    window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(setup, 200); });
    setup();
    if (!reduceMotion) {
      running = true;
      // pause when the hero is off screen
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting && !running) { running = true; loop(); }
        else if (!en.isIntersecting) running = false;
      }).observe(canvas);
      loop();
    }
    return api;
  })();

  // ---------- ant trail fills as you scroll; stations light up when reached ----------
  (() => {
    const map = $(".trail-map");
    if (!map) return;
    const stations = $$(".stations li", map);
    if (reduceMotion) { map.style.setProperty("--p", 1); stations.forEach((s) => s.classList.add("reached")); return; }
    const update = () => {
      const r = map.getBoundingClientRect();
      const line = window.innerHeight * 0.6;
      const p = Math.min(1, Math.max(0, (line - r.top) / r.height));
      map.style.setProperty("--p", p.toFixed(3));
      stations.forEach((s) => s.classList.toggle("reached", s.getBoundingClientRect().top < line));
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  // ---------- add network to wallet ----------
  const walletMsg = $("[data-wallet-msg]");
  async function addNetwork() {
    const say = (text, err) => { if (!walletMsg) return; walletMsg.textContent = text; walletMsg.classList.toggle("error", !!err); };
    if (!window.ethereum) { say("No browser wallet found. Install one such as MetaMask, or add the network manually with the details below.", true); return; }
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: "0x68b0", chainName: "ANT CHAIN", nativeCurrency: { name: "ANT", symbol: "ANT", decimals: 18 }, rpcUrls: [L3_RPC] }],
      });
      say("ANT CHAIN added to your wallet.");
    } catch (e) {
      say(e && e.code === 4001 ? "Request cancelled in your wallet." : "Your wallet could not add the network. Add it manually with the details below.", true);
    }
  }
  $$("[data-add-network]").forEach((b) => b.addEventListener("click", addNetwork));

  // ---------- copy ----------
  // Addresses are shown shortened so they never wrap; the full value is copied and announced.
  $$(".copy.addr").forEach((b) => {
    const full = b.dataset.copy;
    b.textContent = `${full.slice(0, 8)}…${full.slice(-6)}`;
    b.title = full;
    b.setAttribute("aria-label", `Copy address ${full}`);
  });
  const copyMsg = $("[data-copy-msg]");
  $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const v = b.dataset.copy;
    try {
      await navigator.clipboard.writeText(v);
      b.classList.add("done");
      if (copyMsg) copyMsg.textContent = `Copied ${v.length > 24 ? v.slice(0, 10) + "…" + v.slice(-6) : v}`;
      setTimeout(() => b.classList.remove("done"), 1500);
    } catch (e) {
      if (copyMsg) copyMsg.textContent = "Copy is blocked in this browser. Select the text and copy it manually.";
    }
  }));

  // ---------- tabs ----------
  $$("[data-tabs]").forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") select(tabs[(i + 1) % tabs.length]);
        if (e.key === "ArrowLeft") select(tabs[(i - 1 + tabs.length) % tabs.length]);
      });
    });
  });

  // ---------- theme toggle ----------
  $("[data-theme-toggle]")?.addEventListener("click", () => {
    const root = document.documentElement;
    const isDark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = isDark ? "light" : "dark";
    try { localStorage.setItem("antchain-theme", root.dataset.theme); } catch (e) {}
    colony.recolor();
  });

  // ---------- start ----------
  refreshL3();
  refreshL1();
  setInterval(refreshL3, 4000);
  setInterval(refreshL1, 30000);
})();
