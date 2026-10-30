import { gsap, reduce } from "../lib/ui.js";
import { initFigure } from "../lib/figure.js";
import { setFlag, getState, ensureId, toast } from "../lib/state.js";
import * as sound from "../lib/sound.js";

// hotspots: where they sit on each photo (u, v from top-left of the cut-out)
const SPOTS = [
  { side: "back", u: 0.52, v: 0.36, title: "The back print", text: "PEACE, سلام and Խաղաղություն inside one cream frame.", img: "img/print-close.webp" },
  { side: "back", u: 0.53, v: 0.53, title: "Խաղաղություն", text: "Armenian for peace, said khaghaghutyun.", img: "img/armenian-close.webp" },
  { side: "front", u: 0.70, v: 0.42, title: "The woven label", text: "PEACE and سلام with the series barcode, on the left chest.", img: "img/label-close.webp" },
  { side: "front", u: 0.30, v: 0.84, title: "The hem tag", text: "A small EMK tag at the hem. TODO(founders): confirm detail.", img: "img/front.webp" },
];

export default async function series() {
  const piece = document.querySelector(".piece");
  const layer = piece.querySelector(".hotspots");
  const detail = document.querySelector("[data-detail]");
  const fig = await initFigure(piece, piece.querySelector("canvas"), { drag: true, scrollTurn: false });

  // front / back
  piece.querySelectorAll("[data-face]").forEach((b) => b.addEventListener("click", () => {
    piece.querySelectorAll("[data-face]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    fig?.setFace(b.dataset.face);
  }));
  piece.querySelector("[data-zoom]")?.addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
    e.currentTarget.setAttribute("aria-pressed", String(on));
    fig?.zoomBy(on ? 1 : -1);
  });

  // hotspots follow the figure and only show on the side facing you
  const dots = SPOTS.map((s, i) => {
    const b = document.createElement("button");
    b.className = "hotspot"; b.type = "button"; b.setAttribute("aria-label", s.title); b.dataset.cursor = "Open";
    b.addEventListener("click", () => openDetail(s));
    layer.appendChild(b);
    return b;
  });
  if (fig) {
    fig.onFrame(() => {
      SPOTS.forEach((s, i) => {
        const p = fig.project(s.side, s.u, s.v);
        dots[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
        dots[i].hidden = !p.facing;
      });
    });
  } else dots.forEach((d) => (d.hidden = true));

  function openDetail(s) {
    detail.querySelector("img").src = s.img;
    detail.querySelector("h3").textContent = s.title;
    detail.querySelector("p").textContent = s.text;
    detail.classList.add("on");
    sound.chime(1);
  }
  const closeDetail = () => detail.classList.remove("on");
  detail.querySelector("[data-close]").addEventListener("click", closeDetail);
  addEventListener("scroll", () => { if (detail.classList.contains("on") && scrollY > innerHeight * 0.4) closeDetail(); }, { passive: true });
  addEventListener("keydown", (e) => e.key === "Escape" && closeDetail());

  scanner();
  box();
}

// ---------- the barcode is a key ----------
function scanner() {
  const label = document.querySelector("[data-scan]");
  if (!label) return;
  const line = label.querySelector(".scan-line");
  const barsEl = label.querySelector(".scan-bars");
  const BARS = 24;
  barsEl.innerHTML = "<i></i>".repeat(BARS);
  const bars = [...barsEl.children];
  const vault = document.querySelector("[data-vault]");
  const x0 = 0.40, x1 = 0.80;
  let dragging = false, done = getState().flags?.barcode, lit = 0;
  const setX = (fx) => {
    line.style.left = `${fx * 100}%`;
    const k = Math.floor(((fx - x0) / (x1 - x0)) * BARS);
    for (let i = lit; i < Math.min(k, BARS); i++) { bars[i].classList.add("on"); sound.tick(); }
    lit = Math.max(lit, Math.min(k, BARS));
    if (lit >= BARS && !done) openVault();
  };
  const fromEvent = (e) => { const r = label.getBoundingClientRect(); return Math.max(0.04, Math.min(0.96, (e.clientX - r.left) / r.width)); };
  line.addEventListener("pointerdown", (e) => { dragging = true; line.setPointerCapture(e.pointerId); });
  line.addEventListener("pointermove", (e) => dragging && setX(fromEvent(e)));
  line.addEventListener("pointerup", () => { dragging = false; });
  line.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") { e.preventDefault(); setX(Math.min(0.96, parseFloat(line.style.left || "6") / 100 + 0.04)); } });
  function openVault() {
    done = true;
    setFlag("barcode");
    sound.chord(); sound.buzz(40);
    toast("Barcode read. Protocol layer open.");
    vault.querySelector("[data-vault-id]").textContent = getState().id || ensureId();
    reveal();
  }
  function reveal() { vault.classList.add("on"); gsap.from(vault.children, { autoAlpha: 0, y: 20, stagger: 0.1, duration: 0.8, ease: "expo.out" }); }
  if (done) { bars.forEach((b) => b.classList.add("on")); line.style.left = "90%"; vault.querySelector("[data-vault-id]").textContent = getState().id; vault.classList.add("on"); }
}

// ---------- the black box: drag the lid up ----------
function box() {
  const lid = document.querySelector("[data-lid]");
  if (!lid) return;
  const light = document.querySelector(".box-light");
  const tee = document.querySelector(".box-inner img");
  const hint = document.querySelector("[data-box-hint]");
  let y0 = null, open = 0, opened = false;
  const apply = (p) => {
    open = Math.max(0, Math.min(1, p));
    lid.style.transform = `rotateX(${-open * 112}deg)`;
    light.style.background = `rgba(232,224,204,${open * 0.18})`;
    tee.style.transform = `translateZ(${open * 60}px) scale(${0.9 + open * 0.15})`;
  };
  lid.addEventListener("pointerdown", (e) => { y0 = e.clientY; lid.setPointerCapture(e.pointerId); sound.friction(); });
  lid.addEventListener("pointermove", (e) => { if (y0 == null || opened) return; apply((y0 - e.clientY) / 180); });
  lid.addEventListener("pointerup", () => {
    y0 = null;
    if (open > 0.45) { opened = true; gsap.to({ p: open }, { p: 1, duration: reduce ? 0 : 0.6, ease: "power3.out", onUpdate() { apply(this.targets()[0].p); } }); sound.chime(0); setFlag("box"); hint.textContent = "Opened. Inside: Peace Collection 001."; }
    else gsap.to({ p: open }, { p: 0, duration: 0.4, onUpdate() { apply(this.targets()[0].p); } });
  });
  lid.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apply(1); opened = true; setFlag("box"); hint.textContent = "Opened. Inside: Peace Collection 001."; } });
}
