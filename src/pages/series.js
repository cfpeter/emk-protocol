import { gsap, reduce } from "../lib/ui.js";
import { setFlag, getState, ensureId, toast } from "../lib/state.js";
import * as sound from "../lib/sound.js";
import { initUnbox } from "../lib/unbox.js";

// hotspots on the real photos (u, v as fractions of each 3:4 photo)
const SPOTS = [
  { side: "back", u: 0.55, v: 0.47, title: "The back print", text: "PEACE, سلام and Խաղաղություն inside one cream frame.", img: "img/print-art.webp" },
  { side: "back", u: 0.53, v: 0.615, title: "Խաղաղություն", text: "Armenian for peace, said khaghaghutyun.", img: "img/print-art.webp" },
  { side: "back", u: 0.37, v: 0.745, title: "The hem print", text: "A barcode print at the hem: EMK-001 / Peace Collection.", img: "img/hem.webp" },
  { side: "front", u: 0.705, v: 0.41, title: "The woven label", text: "PEACE and سلام on the left chest, with the series barcode PCE24LDN8T004.", img: "img/label.webp" },
  { side: "front", u: 0.645, v: 0.495, title: "The barcode", text: "Scan it further down this page to open the protocol layer.", img: "img/label-tag.webp" },
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

  scanner();
  unbox();
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
  const x0 = 0.31, x1 = 0.73;
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
