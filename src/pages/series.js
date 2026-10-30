import { gsap, reduce } from "../lib/ui.js";
import { setFlag, getState, ensureId } from "../lib/state.js";
import * as sound from "../lib/sound.js";
import { initUnbox } from "../lib/unbox.js";

// hotspots on the real photos (u, v as fractions of each 3:4 photo)
const SPOTS = [
  { side: "back", u: 0.55, v: 0.47, title: "The back print", text: "PEACE, سلام and Խաղաղություն inside one cream frame.", img: "img/print-art.webp" },
  { side: "back", u: 0.53, v: 0.615, title: "Խաղաղություն", text: "Armenian for peace, said khaghaghutyun.", img: "img/print-art.webp" },
  { side: "back", u: 0.37, v: 0.745, title: "The hem print", text: "A barcode print at the hem: EMK-001 / Peace Collection.", img: "img/hem.webp" },
  { side: "front", u: 0.705, v: 0.41, title: "The woven label", text: "PEACE and سلام on the left chest, with the series barcode PCE24LDN8T004.", img: "img/label.webp" },
  { side: "front", u: 0.645, v: 0.495, title: "The barcode", text: "The same code you scanned to open the protocol at the top of this page.", img: "img/label-tag.webp" },
];
// where "Closer" zooms in on each side
const FOCUS = { back: "55% 52%", front: "68% 45%" };

export default async function series() {
  const piece = document.querySelector(".piece");
  const detail = document.querySelector("[data-detail]");
  const zoomEl = piece.querySelector(".piece-zoom");
  const sides = Object.fromEntries([...piece.querySelectorAll(".piece-side")].map((el) => [el.dataset.side, el]));
  let face = "back", zoomed = false;

  // hotspots sit on the photos themselves, so they move and zoom with them
  SPOTS.forEach((s) => {
    const b = document.createElement("button");
    b.className = "hotspot"; b.type = "button"; b.setAttribute("aria-label", s.title); b.dataset.cursor = "Open";
    b.style.left = `${s.u * 100}%`; b.style.top = `${s.v * 100}%`;
    b.addEventListener("click", () => openDetail(s));
    sides[s.side].querySelector(".hotspots").appendChild(b);
  });

  // back / front: the new side wipes in over the old one
  piece.querySelectorAll("[data-face]").forEach((b) => b.addEventListener("click", () => {
    const next = b.dataset.face;
    if (next === face) return;
    piece.querySelectorAll("[data-face]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const from = sides[face], to = sides[next];
    gsap.set(to, { zIndex: 2 }); gsap.set(from, { zIndex: 1 });
    to.classList.add("is-on");
    gsap.fromTo(to, { clipPath: next === "front" ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }, {
      clipPath: "inset(0 0% 0 0%)", duration: reduce ? 0 : 0.8, ease: "power3.inOut",
      onComplete: () => from.classList.remove("is-on"),
    });
    gsap.fromTo(to.querySelector("img"), { scale: 1.08 }, { scale: 1, duration: reduce ? 0 : 1.1, ease: "power3.out" });
    face = next;
    zoomEl.style.transformOrigin = FOCUS[face];
    sound.tick();
  }));

  // closer: a smooth zoom into the print or the label; with a mouse, the view follows the pointer
  const zoomBtn = piece.querySelector("[data-zoom]");
  const setZoom = (on) => {
    zoomed = on;
    zoomBtn.setAttribute("aria-pressed", String(on));
    zoomBtn.textContent = on ? "Full view" : "Closer";
    zoomEl.style.transformOrigin = FOCUS[face];
    gsap.to(zoomEl, { scale: on ? 2.1 : 1, duration: reduce ? 0 : 0.9, ease: "power3.inOut" });
  };
  zoomBtn.addEventListener("click", () => setZoom(!zoomed));
  const frame = piece.querySelector(".piece-frame");
  frame.addEventListener("pointermove", (e) => {
    if (!zoomed || e.pointerType !== "mouse") return;
    const r = frame.getBoundingClientRect();
    zoomEl.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  });
  frame.addEventListener("pointerleave", () => zoomed && (zoomEl.style.transformOrigin = FOCUS[face]));

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

  gate();
  closer();
  unbox();
}

// ---------- 100% cotton: tap to go closer, box → label → hem, each a real photo at full quality ----------
const STEPS = [
  { note: "Folded in the EMK box, wrapped in black tissue printed EMK SYSTEM.", cursor: "Closer" },
  { note: "The chest label: PEACE, سلام, EST. 2021, Los Angeles, EMK-001.", cursor: "Closer" },
  { note: "A barcode print at the hem: EMK-001 / Peace Collection.", cursor: "Back" },
];
function closer() {
  const fig = document.querySelector("[data-fabric]");
  if (!fig) return;
  const stack = fig.querySelector(".fabric-stack"), imgs = [...stack.querySelectorAll("img")];
  const btns = [...document.querySelectorAll("[data-step]")], note = document.querySelector("[data-step-note]");
  let cur = 0, busy = false;
  const go = (i, x = 0.5, y = 0.5) => {
    if (i === cur || busy) return;
    busy = true;
    const from = imgs[cur], to = imgs[i];
    cur = i;
    btns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
    note.textContent = STEPS[i].note;
    fig.dataset.cursor = STEPS[i].cursor; fig.style.cursor = i === 2 ? "zoom-out" : "zoom-in";
    document.dispatchEvent(new CustomEvent("cursor:refresh"));
    sound.tick();
    // the next photo opens as a circle from where you tapped, settling from a slight push-in
    gsap.set(to, { zIndex: 2, visibility: "visible" }); gsap.set(from, { zIndex: 1 });
    const at = `${x * 100}% ${y * 100}%`;
    gsap.fromTo(to, { clipPath: `circle(0% at ${at})`, scale: 1.12, transformOrigin: at }, {
      clipPath: `circle(150% at ${at})`, scale: 1, duration: reduce ? 0 : 0.9, ease: "power3.inOut",
      onComplete: () => { from.classList.remove("is-on"); gsap.set(from, { clearProps: "visibility,zIndex" }); to.classList.add("is-on"); gsap.set(to, { clearProps: "clipPath,zIndex,visibility" }); busy = false; },
    });
  };
  fig.addEventListener("click", (e) => {
    const r = stack.getBoundingClientRect();
    go((cur + 1) % STEPS.length, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  btns.forEach((b) => b.addEventListener("click", () => go(Number(b.dataset.step))));
  // with a mouse the photo tilts toward the pointer and a soft light follows it
  if (reduce || !matchMedia("(pointer: fine)").matches) return;
  const rx = gsap.quickTo(stack, "rotationX", { duration: 0.6, ease: "power3.out" });
  const ry = gsap.quickTo(stack, "rotationY", { duration: 0.6, ease: "power3.out" });
  const sheen = stack.querySelector(".fabric-sheen");
  fig.addEventListener("pointermove", (e) => {
    const r = stack.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    rx((0.5 - v) * 8); ry((u - 0.5) * 10);
    sheen.style.setProperty("--sx", `${u * 100}%`); sheen.style.setProperty("--sy", `${v * 100}%`);
  });
  fig.addEventListener("pointerleave", () => { rx(0); ry(0); });
}

// ---------- the barcode is the key: scan the chest label to open Series 001 ----------
// the scan line is the edge of the reveal: behind it the photo, ahead of it the label
function gate() {
  const piece = document.querySelector(".piece");
  const cover = piece.querySelector("[data-gate]"), line = piece.querySelector("[data-gate-line]");
  const copy = piece.querySelector("[data-gate-copy]"), status = piece.querySelector("[data-gate-status]");
  const lead = piece.querySelector("[data-piece-lead]"), frame = piece.querySelector(".piece-frame");
  // read (or skipped) once, open for good; series.html?scan shows it again
  const again = new URLSearchParams(location.search).has("scan");
  if (!cover || (!again && (getState().flags?.barcode || getState().flags?.gate))) return;
  const LEAD = lead.textContent;
  const BARS = 24, X0 = 0.31, X1 = 0.73, START = 0.06; // where the barcode sits across the label
  let pos = START, read = 0, open = false, dragging = false, auto = null;

  piece.classList.add("is-locked");
  cover.hidden = line.hidden = copy.hidden = false;
  lead.textContent = "The Peace tee. The barcode on its chest label is your key. Drag the scan line across it.";

  const draw = () => {
    cover.style.clipPath = `inset(0 0 0 ${pos * 100}%)`;
    line.style.left = `${pos * 100}%`;
    line.setAttribute("aria-valuenow", String(Math.round(pos * 100)));
  };
  const to = (x) => {
    if (open) return;
    pos = Math.max(pos, Math.min(1, x)); // the line only moves forward
    const k = Math.max(0, Math.min(BARS, Math.floor(((pos - X0) / (X1 - X0)) * BARS)));
    for (; read < k; read++) sound.tick();
    if (read > 0) status.textContent = `Reading ${String(read).padStart(2, "0")} / ${BARS}`;
    draw();
    if (read >= BARS) finish();
  };
  function finish() {
    open = true; clearTimeout(auto);
    setFlag("barcode");
    const id = getState().id || ensureId();
    status.textContent = `Read · Access granted to ${id}`;
    sound.granted(); sound.buzz(40);
    const o = { x: pos };
    gsap.to(o, { x: 1, duration: reduce ? 0 : 0.5, ease: "power2.out", onUpdate: () => { pos = o.x; draw(); }, onComplete: done });
  }
  function done() {
    cover.remove(); line.remove();
    piece.classList.remove("is-locked");
    lead.textContent = LEAD;
    gsap.fromTo(piece.querySelector(".piece-controls"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.6, ease: "expo.out" });
    piece.querySelector("[data-gate-skip]").remove();
    setTimeout(() => gsap.to(copy, { autoAlpha: 0, duration: 0.6, onComplete: () => copy.remove() }), 4000);
  }
  // nobody touching it: after a moment it scans itself, slowly enough to watch
  const selfScan = () => {
    if (open || dragging) return;
    const o = { x: pos };
    gsap.to(o, { x: 1, duration: reduce ? 0 : 2.2, ease: "power1.inOut", onUpdate: () => to(o.x) });
  };
  const arm = () => { clearTimeout(auto); auto = setTimeout(selfScan, 8000); };
  arm();

  const fx = (e) => { const r = frame.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  // a loose sideways swipe anywhere on the label reads it; vertical drags still scroll the page
  [cover, line].forEach((el) => {
    el.addEventListener("pointerdown", (e) => { dragging = true; clearTimeout(auto); el.setPointerCapture(e.pointerId); to(fx(e)); });
    el.addEventListener("pointermove", (e) => dragging && to(fx(e)));
    const up = () => { dragging = false; if (!open) arm(); };
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  });
  line.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); clearTimeout(auto); to(pos + 0.05); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selfScan(); }
  });
  piece.querySelector("[data-gate-skip]").addEventListener("click", () => { clearTimeout(auto); if (!open) { open = true; setFlag("gate"); sound.tick(); done(); } });
  draw();
}

// ---------- the real box, in 3D ----------
async function unbox() {
  const stage = document.querySelector(".unbox-stage");
  if (!stage) return;
  const wrap = stage.closest(".unbox");
  const hint = wrap.querySelector("[data-unbox-hint]");
  const openBtn = wrap.querySelector("[data-unbox-open]");
  const closeBtn = wrap.querySelector("[data-unbox-close]");
  const box = await initUnbox(stage);
  if (!box) { hint.textContent = "Matte black, gold foil, black tissue, a card, a seal and the tee."; openBtn.hidden = true; return; }
  openBtn.addEventListener("click", () => { box.openAll(); openBtn.hidden = true; closeBtn.hidden = false; });
  closeBtn.addEventListener("click", () => { box.close(); closeBtn.hidden = true; openBtn.hidden = false; hint.textContent = "Drag up to lift the lid."; });
  stage.addEventListener("unboxed", () => {
    setFlag("box");
    hint.textContent = "Inside: the card, the seal, the PEACE sticker and your tee.";
    openBtn.hidden = true; closeBtn.hidden = false;
  });
}

