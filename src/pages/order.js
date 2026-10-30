import { gsap, reduce } from "../lib/ui.js";
import { setSize, claim } from "../lib/state.js";
import * as sound from "../lib/sound.js";
import { mountCard } from "../lib/card.js";

// the founders' size guide, garment measured flat in inches
const SIZES = {
  S: { chest: 24, length: 27, shoulder: 23 },
  M: { chest: 25, length: 28.25, shoulder: 23 },
  L: { chest: 25, length: 29, shoulder: 24 },
  XL: { chest: 26, length: 29, shoulder: 24 },
};
const ORDER = ["S", "M", "L", "XL"];
const NAMES = { chest: ["wider in the chest", "narrower in the chest", "same chest"], length: ["longer", "shorter", "same length"], shoulder: ["wider in the shoulders", "narrower in the shoulders", "same shoulders"] };
const fmt = (n) => String(Math.round(n * 100) / 100);

// closest size to the visitor's own tee on all three measurements (chest counts a little more);
// a tie goes to the larger size, since the tee is meant to be worn oversized
function closest(m) {
  let best = null, bestD = Infinity;
  ORDER.forEach((s) => {
    const z = SIZES[s];
    const d = Math.abs(z.chest - m.chest) * 1.5 + Math.abs(z.length - m.length) + Math.abs(z.shoulder - m.shoulder);
    if (d <= bestD + 1e-9) { best = s; bestD = d; }
  });
  return best;
}
// "same chest, 0.75 in longer, same shoulders"
function compare(s, m) {
  return ["chest", "length", "shoulder"].map((k) => {
    const diff = SIZES[s][k] - m[k];
    if (Math.abs(diff) < 0.13) return NAMES[k][2];
    return `${fmt(Math.abs(diff))} in ${diff > 0 ? NAMES[k][0] : NAMES[k][1]}`;
  }).join(", ");
}

export default function order() {
  const inputs = Object.fromEntries([...document.querySelectorAll("[data-measure]")].map((el) => [el.dataset.measure, el]));
  const read = document.querySelector("[data-readout]");
  const why = document.querySelector("[data-why]");
  const tee = document.querySelector(".tee-size");
  const you = document.querySelector(".tee-you");
  const rows = document.querySelectorAll(".size-table tbody tr");
  const guides = Object.fromEntries([...document.querySelectorAll("[data-guide]")].map((g) => [g.dataset.guide, g]));
  let lastSize = null;

  function update() {
    const m = {};
    Object.entries(inputs).forEach(([k, el]) => {
      m[k] = parseFloat(el.querySelector("input").value);
      el.querySelector("[data-out]").textContent = `${fmt(m[k])} in`;
    });
    const s = closest(m);
    read.textContent = s;
    why.textContent = `Compared with your tee, ${s} is: ${compare(s, m)}.`;
    rows.forEach((r) => r.classList.toggle("on", r.dataset.size === s));
    // both outlines to scale: our size in cream, your tee dashed
    tee.style.transform = `scale(${SIZES[s].chest / 25}, ${SIZES[s].length / 28.25})`;
    you.style.transform = `scale(${m.chest / 25}, ${m.length / 28.25})`;
    if (s !== lastSize) { if (lastSize) sound.tick(); lastSize = s; if (!reduce) gsap.fromTo(read, { yPercent: 30, autoAlpha: 0.4 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: "expo.out" }); }
    setSize(s);
  }
  // the guide line on the drawing shows where you are measuring
  Object.entries(inputs).forEach(([k, el]) => {
    const input = el.querySelector("input");
    const on = (v) => guides[k]?.classList.toggle("on", v);
    input.addEventListener("input", update);
    ["focus", "pointerenter", "pointerdown"].forEach((e) => input.addEventListener(e, () => { Object.values(guides).forEach((g) => g.classList.remove("on")); on(true); }));
    ["blur", "pointerleave"].forEach((e) => input.addEventListener(e, () => on(false)));
  });
  update();

  document.querySelectorAll("[data-claim]").forEach((b) => b.addEventListener("click", () => claim(b.dataset.claim)));

  // ---------- the Protocol Card ----------
  mountCard(document.querySelector("[data-card]"), document.querySelector("[data-save-card]"));
}
