// Global interaction system, on every page: one scroll loop, menu, links, buttons, cursor,
// reveals, sound toggle, Protocol bar.
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { mountBar, getState, isReturning, toast } from "./state.js";
import * as sound from "./sound.js";

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: "power3.out", duration: 0.85 });

export const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
export const phone = () => innerWidth < 761;
export const inInstagram = /Instagram/i.test(navigator.userAgent);
export let lenis = null;

// ---------- one loop: Lenis on the GSAP ticker, wired to ScrollTrigger ----------
function scroll() {
  if (!reduce && !document.body.dataset.noSmooth) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.9, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
  }
  gsap.ticker.lagSmoothing(0);
  addEventListener("load", () => ScrollTrigger.refresh());
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  const bar = document.querySelector(".progress-line span");
  if (bar) {
    gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
  }
}

// ---------- roll links: wrap the label so it can roll up to its copy ----------
function rolls() {
  document.querySelectorAll(".roll-inner").forEach((el) => {
    if (el.firstElementChild) return;
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.innerHTML = `<span data-copy="${el.dataset.text || text}" aria-hidden="true">${text}</span>`;
  });
}

// ---------- menu ----------
function menu() {
  const btn = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-menu]");
  if (!btn || !nav) return;
  const label = btn.querySelector(".roll-inner > span");
  const page = document.body.dataset.page;
  nav.querySelectorAll("a[data-page]").forEach((a) => a.dataset.page === page && a.setAttribute("aria-current", "page"));
  const photos = nav.querySelectorAll(".menu-photos img");
  const show = (p) => photos.forEach((img) => img.classList.toggle("on", img.dataset.for === p));
  nav.querySelectorAll("a[data-page]").forEach((a) => {
    a.addEventListener("pointerenter", () => { show(a.dataset.page); sound.tick(); });
    a.addEventListener("focus", () => show(a.dataset.page));
  });
  let open = false;
  const set = (v) => {
    open = v;
    btn.setAttribute("aria-expanded", String(v));
    // the label rolls to the same word on hover; it only changes when the menu actually opens or closes
    label.textContent = v ? "Close" : "Menu";
    label.dataset.copy = label.textContent;
    btn.classList.toggle("is-open", v);
    if (v) {
      nav.hidden = false;
      lenis?.stop();
      show(page);
      gsap.fromTo(nav, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: reduce ? 0 : 0.7, ease: "power4.inOut" });
      gsap.fromTo(nav.querySelectorAll(".menu-links a"), { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.05, duration: reduce ? 0 : 0.8, ease: "power4.out", delay: reduce ? 0 : 0.25 });
      nav.querySelector("a")?.focus({ preventScroll: true });
    } else {
      gsap.to(nav, { clipPath: "inset(0 0 100% 0)", duration: reduce ? 0 : 0.5, ease: "power4.inOut", onComplete: () => { nav.hidden = true; } });
      lenis?.start();
    }
  };
  btn.addEventListener("click", () => { sound.click(); set(!open); });
  addEventListener("keydown", (e) => e.key === "Escape" && open && set(false));
  // swipe down closes on a phone
  let y0 = null;
  nav.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  nav.addEventListener("touchend", (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) set(false); y0 = null; });
}

// ---------- buttons: press spring, click sound, magnetic on mouse ----------
function buttons() {
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".btn, .seg button, .tile");
    if (!b) return;
    b.classList.add("is-pressed");
    sound.click(); sound.buzz();
    const up = () => { b.classList.remove("is-pressed"); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
    addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  if (!fine || reduce) return;
  document.querySelectorAll(".btn").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.45 }), yTo = gsap.quickTo(el, "y", { duration: 0.45 });
    // measure once on enter (minus the pull already applied), never on every move
    let cx = 0, cy = 0;
    el.addEventListener("pointerenter", () => {
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2 - (gsap.getProperty(el, "x") || 0); cy = r.top + r.height / 2 - (gsap.getProperty(el, "y") || 0);
    });
    el.addEventListener("pointermove", (e) => { xTo((e.clientX - cx) * 0.18); yTo((e.clientY - cy) * 0.22); });
    el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
  });
}

// ---------- cursor (mouse only): dot + lagging ring that says View / Drag ----------
function cursor() {
  const c = document.querySelector(".cursor");
  if (!c || !fine) return;
  const dot = c.querySelector(".cursor-dot"), ring = c.querySelector(".cursor-ring"), label = c.querySelector(".cursor-label");
  const dx = gsap.quickTo(dot, "x", { duration: 0.08 }), dy = gsap.quickTo(dot, "y", { duration: 0.08 });
  const rx = gsap.quickTo(ring, "x", { duration: 0.4 }), ry = gsap.quickTo(ring, "y", { duration: 0.4 });
  let px = -1, py = -1, shown = "", queued = false;
  const read = (el) => {
    const t = el?.closest?.("[data-cursor], a, button, input");
    const word = t?.dataset?.cursor || "";
    const kind = word ? `w:${word}` : t ? "link" : "";
    if (kind === shown) return; // touch the DOM only when the state changes
    shown = kind;
    c.classList.toggle("is-label", Boolean(word));
    c.classList.toggle("is-link", Boolean(t) && !word);
    if (word) label.textContent = word;
  };
  // scrolling moves content under a still mouse: re-read what's under it, once per frame
  const recheck = () => {
    if (queued || px < 0) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; read(document.elementFromPoint(px, py)); });
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    px = e.clientX; py = e.clientY;
    dx(px); dy(py); rx(px); ry(py);
    read(e.target);
  }, { passive: true });
  addEventListener("scroll", recheck, { passive: true });
  document.addEventListener("cursor:refresh", () => { shown = "?"; recheck(); }); // a page changed a data-cursor
  document.addEventListener("pointerleave", () => { shown = ""; px = -1; c.classList.remove("is-label", "is-link"); });
}

// ---------- reveals: headings rise word by word, blocks lift, photos wipe open ----------
export function splitWords(el) {
  if (el.dataset.split === "done") return el.querySelectorAll(".word");
  const text = el.textContent.trim().replace(/\s+/g, " ");
  el.setAttribute("aria-label", text);
  el.innerHTML = text.split(" ").map((w) => `<span class="mask" aria-hidden="true"><span class="word">${w}</span></span>`).join(" ");
  el.dataset.split = "done";
  return el.querySelectorAll(".word");
}
function reveals() {
  if (reduce) { gsap.set("[data-reveal], [data-clip]", { clearProps: "all" }); return; }
  document.querySelectorAll("[data-split]").forEach((el) => {
    gsap.from(splitWords(el), { yPercent: 108, duration: 1, ease: "power4.out", stagger: 0.06, scrollTrigger: { trigger: el, start: "top 96%", once: true } });
  });
  document.querySelectorAll("[data-reveal]").forEach((el, i) => {
    gsap.to(el, { autoAlpha: 1, y: 0, duration: 1, ease: "expo.out", delay: (i % 3) * 0.06, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });
  document.querySelectorAll("[data-clip]").forEach((el) => {
    gsap.timeline({ scrollTrigger: { trigger: el, start: "top 85%", once: true } })
      .to(el, { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power4.out" })
      .from(el.querySelector("img"), { scale: 1.1, duration: 1.4, ease: "power4.out" }, 0);
  });
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.4, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 90%", once: true }, onUpdate: () => { el.textContent = (Math.round(o.v * 4) / 4).toString(); } });
  });
}

// ---------- sound toggle ----------
function soundToggle() {
  document.querySelectorAll("[data-sound]").forEach((b) => {
    b.setAttribute("aria-pressed", String(sound.soundOn()));
    b.addEventListener("click", () => sound.setSound(!sound.soundOn()));
  });
  // browsers need a gesture before audio: resume a saved "on" at the first touch
  if (sound.soundOn()) addEventListener("pointerdown", () => sound.setSound(true), { once: true });
}

// ---------- shared-element page transitions: the tapped photo becomes the next page ----------
function transitions() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-vt]");
    if (!a) return;
    const img = a.querySelector("img");
    if (img) img.style.viewTransitionName = "hero-photo";
  });
}

export function startUI() {
  document.documentElement.classList.add("js");
  scroll(); rolls(); menu(); buttons(); cursor(); soundToggle(); transitions(); mountBar();
  reveals();
  if (isReturning() && document.body.dataset.page === "index") {
    setTimeout(() => toast(`Welcome back, ${getState().id}.`), 900);
  }
}
export { gsap, ScrollTrigger };
