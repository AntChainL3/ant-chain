// Shared page behaviour for every ANT CHAIN page: smooth scroll, mobile menu,
// header that steps aside while reading, and rise-in reveals. Reduced motion is respected.
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- smooth scroll ----------
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    window.antLenis = lenis;
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash.length < 2) return;
    const target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: -90 });
    else target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", url.hash);
  });

  // ---------- mobile menu ----------
  const sheet = document.getElementById("sheet");
  const openBtn = document.querySelector("[data-menu]");
  function closeMenu() {
    if (!sheet || !sheet.classList.contains("open")) return;
    sheet.classList.remove("open");
    openBtn?.setAttribute("aria-expanded", "false");
    lenis?.start();
    openBtn?.focus();
  }
  openBtn?.addEventListener("click", () => {
    sheet.classList.add("open");
    openBtn.setAttribute("aria-expanded", "true");
    lenis?.stop();
    sheet.querySelector("a")?.focus();
  });
  document.querySelector("[data-menu-close]")?.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // ---------- header steps aside on the way down, returns on the way up ----------
  const top = document.querySelector("[data-top]");
  if (top) {
    let last = scrollY;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (Math.abs(y - last) < 6) return;
      top.classList.toggle("hide", y > last && y > 240 && !top.contains(document.activeElement));
      last = y;
    }, { passive: true });
  }


  // ---------- orbit linework (engraved dial), shared by every page ----------
  (() => {
    const NS = "http://www.w3.org/2000/svg";
    const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    // ---------- orbit linework (engraved dial) ----------
    document.querySelectorAll("[data-orbit]").forEach((svg) => {
      svg.setAttribute("viewBox", "-500 -500 1000 1000");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      const radii = [90, 150, 215, 290, 370, 460];
      radii.forEach((r, i) => el("circle", { r, class: "o-ring" + (i === 2 ? " strong" : "") }, svg));
      for (let a = 0; a < 360; a += 15) {
        const t = (a * Math.PI) / 180;
        el("line", { x1: Math.cos(t) * 90, y1: Math.sin(t) * 90, x2: Math.cos(t) * 490, y2: Math.sin(t) * 490, class: "o-spoke" }, svg);
      }
      for (let a = 0; a < 360; a += 3) {
        const t = (a * Math.PI) / 180, long = a % 15 === 0;
        el("line", { x1: Math.cos(t) * 215, y1: Math.sin(t) * 215, x2: Math.cos(t) * (215 + (long ? 14 : 6)), y2: Math.sin(t) * (215 + (long ? 14 : 6)), class: "o-tick" }, svg);
      }
      const labels = ["SIGN", "ORDER", "BATCH", "VOUCH", "SETTLE", "26801", "4663", "ETH"];
      labels.forEach((t, i) => {
        const a = (i / labels.length) * Math.PI * 2 - Math.PI / 2, r = 300;
        const tx = el("text", { x: Math.cos(a) * r, y: Math.sin(a) * r, "text-anchor": "middle" }, svg);
        tx.textContent = t;
      });
      const sweep = el("line", { x1: 0, y1: 0, x2: 0, y2: -460, class: "o-sweep" }, svg);
      if (!reduced) {
        let ang = 0;
        const spin = () => { ang = (ang + 0.12) % 360; sweep.setAttribute("transform", `rotate(${ang})`); requestAnimationFrame(spin); };
        requestAnimationFrame(spin);
      }
    });

  })();

  // ---------- reveals ----------
  const els = $$(".rv, .line-mask");
  if (reduced || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -6% 0px" });
  els.forEach((el) => io.observe(el));
})();

// Copy buttons on every page: any element with data-copy="<text>", including ones added later.
(() => {
  "use strict";
  let live = document.querySelector("[data-copy-msg]");
  if (!live) { live = document.createElement("p"); live.className = "sr-only"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite"); document.body.appendChild(live); }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-copy]");
    if (!b) return;
    e.preventDefault();
    const v = b.dataset.copy, label = b.textContent.trim() === "Copy";
    if (await copyText(v)) {
      b.classList.add("done"); if (label) b.textContent = "Copied";
      live.textContent = `Copied ${v}`;
      setTimeout(() => { b.classList.remove("done"); if (label) b.textContent = "Copy"; }, 1500);
    } else live.textContent = "Copy is blocked in this browser.";
  });
})();
