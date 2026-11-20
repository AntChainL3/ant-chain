// ---------- Ant colony hero animation ----------
(function colony() {
  const canvas = document.getElementById("colony");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BG = "10, 24, 40";
  let w, h, dpr, nodes, edges, ants;

  function setup() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Nodes are "blocks"; denser on the right so the headline stays readable.
    const count = Math.round(Math.max(14, Math.min(34, (w * h) / 32000)));
    nodes = [];
    for (let i = 0; i < count; i++) {
      const bias = Math.pow(Math.random(), 0.55);
      nodes.push({
        x: w * (0.25 + 0.75 * bias),
        y: h * (0.08 + 0.84 * Math.random()),
        r: 2 + Math.random() * 3,
        glow: 0,
      });
    }
    // Connect each node to its nearest neighbours.
    edges = [];
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .filter((o) => o.j !== i)
        .sort((p, q) => p.d - q.d)
        .slice(0, 3);
      near.forEach(({ j }) => {
        if (!edges.some((e) => (e.a === j && e.b === i))) {
          const b = nodes[j];
          // Curved control point to make trails wander like ant paths.
          const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 80;
          const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 80;
          edges.push({ a: i, b: j, cx: mx, cy: my, heat: 0 });
        }
      });
    });

    const antCount = reduce ? 0 : Math.round(count * 2.2);
    ants = [];
    for (let i = 0; i < antCount; i++) ants.push(spawnAnt());

    ctx.fillStyle = `rgb(${BG})`;
    ctx.fillRect(0, 0, w, h);
    if (reduce) drawStatic();
  }

  function spawnAnt(fromNode) {
    const options = fromNode == null ? edges : edges.filter((e) => e.a === fromNode || e.b === fromNode);
    const e = (options.length ? options : edges)[Math.floor(Math.random() * (options.length || edges.length))];
    const forward = fromNode == null ? Math.random() < 0.5 : e.a === fromNode;
    return { e, forward, t: Math.random() * (fromNode == null ? 1 : 0.05), speed: 0.003 + Math.random() * 0.006 };
  }

  function point(e, t) {
    const a = nodes[e.a], b = nodes[e.b];
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * e.cx + t * t * b.x,
      y: u * u * a.y + 2 * u * t * e.cy + t * t * b.y,
    };
  }

  function drawEdges() {
    edges.forEach((e) => {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(e.cx, e.cy, b.x, b.y);
      ctx.strokeStyle = `rgba(242, 177, 52, ${0.04 + e.heat * 0.22})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      e.heat *= 0.985;
    });
  }

  function drawNodes() {
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + n.glow * 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(143, 211, 232, ${0.35 + n.glow * 0.65})`;
      ctx.fill();
      n.glow *= 0.94;
    });
  }

  function drawStatic() {
    edges.forEach((e) => (e.heat = Math.random() * 0.6));
    drawEdges();
    drawNodes();
  }

  function frame() {
    // Fade previous frame to leave short pheromone trails.
    ctx.fillStyle = `rgba(${BG}, 0.16)`;
    ctx.fillRect(0, 0, w, h);
    drawEdges();

    ants.forEach((ant, i) => {
      ant.t += ant.speed;
      const tt = ant.forward ? ant.t : 1 - ant.t;
      const p = point(ant.e, tt);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(246, 205, 120, 0.95)";
      ctx.fill();
      ant.e.heat = Math.min(1, ant.e.heat + 0.02);
      if (ant.t >= 1) {
        const arrived = ant.forward ? ant.e.b : ant.e.a;
        nodes[arrived].glow = 1;
        ants[i] = spawnAnt(arrived);
      }
    });

    drawNodes();
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 200);
  });

  setup();
  if (!reduce) requestAnimationFrame(frame);
})();

// ---------- Copy contract address ----------
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = document.getElementById(btn.dataset.copy).textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Select and copy manually";
    }
    setTimeout(() => (btn.textContent = "Copy address"), 2000);
  });
});

// ---------- Waitlist form ----------
(function waitlist() {
  const form = document.getElementById("waitlist-form");
  if (!form) return;
  const msg = document.getElementById("form-msg");
  const email = form.querySelector("#email");

  // TODO: set this to your backend endpoint (e.g. Formspree, a serverless function, or your API).
  const ENDPOINT = "";

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msg.classList.remove("error");

    if (form.company.value) return; // honeypot: bots fill hidden fields

    if (!email.value || !email.checkValidity()) {
      msg.textContent = "Enter a valid email address, like name@example.com.";
      msg.classList.add("error");
      email.focus();
      return;
    }

    if (!ENDPOINT) {
      console.warn("Waitlist ENDPOINT is not set in main.js; the email was not saved.");
      msg.textContent = "Sign-ups open soon. Follow our announcements to hear when.";
      msg.classList.add("error");
      return;
    }

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value }),
      });
      if (!res.ok) throw new Error(String(res.status));
      msg.textContent = "You're on the list. We'll email you when the testnet opens.";
      form.reset();
    } catch {
      msg.textContent = "We couldn't add you right now. Check your connection and try again.";
      msg.classList.add("error");
    }
  });
})();
