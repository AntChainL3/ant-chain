// Site-wide effects: smooth scroll, magnetic buttons,
// label scramble. Skipped entirely for reduced motion
// and, for pointer effects, on touch screens.
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  if (reduced) return;

  // ---------- smooth scroll (Lenis) ----------
  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // in-page anchors glide too, landing below the fixed header
    document.addEventListener("click", (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 80;
      lenis.scrollTo(target, { offset: -(top + 8) });
      history.replaceState(null, "", id);
    });
  }

  // ---------- label scramble: [ 01 / Route ] decodes as it enters ----------
  (() => {
    const GLYPHS = "ABCDEF0123456789/\\[]<>#$%&*+=";
    const els = $$(".frame-head .label, .showcase-label, .kicker, .app-hero .kicker");
    const run = (el) => {
      const final = el.dataset.final || el.textContent;
      el.dataset.final = final;
      const len = final.length, t0 = performance.now(), D = 700;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / D);
        const fixed = Math.floor(p * len);
        let out = final.slice(0, fixed);
        for (let i = fixed; i < len; i++) out += final[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        el.textContent = out;
        if (p < 1) requestAnimationFrame(step); else el.textContent = final;
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } }), { rootMargin: "0px 0px -10% 0px" });
    els.forEach((el) => { if (!el.querySelector("*")) io.observe(el); });
  })();

  if (!fine) return;

  // ---------- magnetic buttons ----------
  $$(".btn, .pill-btn, .cmd-btn, .t-ca button, .app-go").forEach((b) => {
    b.classList.add("magnet");
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / r.width, y = (e.clientY - (r.top + r.height / 2)) / r.height;
      b.style.translate = `${(x * 10).toFixed(1)}px ${(y * 8).toFixed(1)}px`;
    });
    b.addEventListener("pointerleave", () => { b.style.translate = ""; });
  });

})();
