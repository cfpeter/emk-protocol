import { gsap, reduce } from "../lib/ui.js";
import { setSize, claim } from "../lib/state.js";
import * as sound from "../lib/sound.js";
import { mountCard } from "../lib/card.js";

const SIZES = { S: [24, 27], M: [25, 28.25], L: [25, 29], XL: [26, 29] };
const ORDER = ["S", "M", "L", "XL"];
const pick = (v) => (v < 24.5 ? "S" : v < 25.25 ? "M" : v < 25.75 ? "L" : "XL");

export default function order() {
  const dial = document.querySelector("[data-dial]");
  const valueEl = document.querySelector("[data-dial-value]");
  const read = document.querySelector("[data-readout]");
  const why = document.querySelector("[data-why]");
  const tee = document.querySelector(".tee-size");
  const you = document.querySelector(".tee-you");
  const rows = document.querySelectorAll(".size-table tbody tr");
  const fitBtns = document.querySelectorAll("[data-fit]");
  let fit = "boxy", lastSize = null;

  function update() {
    const v = parseFloat(dial.value);
    let s = pick(v);
    if (fit === "closer") s = ORDER[Math.max(0, ORDER.indexOf(s) - 1)];
    valueEl.textContent = `${v.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")} in`;
    read.textContent = s;
    why.textContent = fit === "closer"
      ? `Your tee is ${v} in across. For a closer fit, ${s} at ${SIZES[s][0]} in.`
      : `Your tee is ${v} in across. ${s} is ${SIZES[s][0]} in across and ${SIZES[s][1]} in long, cut boxy.`;
    rows.forEach((r) => r.classList.toggle("on", r.dataset.size === s));
    // the outline grows to scale: garment in cream, your measurement dashed
    tee.style.transform = `scale(${SIZES[s][0] / 25}, ${SIZES[s][1] / 28.25})`;
    you.style.transform = `scale(${v / 25}, 1)`;
    if (s !== lastSize) { sound.tick(); lastSize = s; if (!reduce) gsap.fromTo(read, { yPercent: 30, autoAlpha: 0.4 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, ease: "expo.out" }); }
    setSize(s);
  }
  dial.addEventListener("input", update);
  fitBtns.forEach((b) => b.addEventListener("click", () => {
    fit = b.dataset.fit;
    fitBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    update();
  }));
  update();

  document.querySelectorAll("[data-claim]").forEach((b) => b.addEventListener("click", () => claim(b.dataset.claim)));

  // ---------- the Protocol Card ----------
  mountCard(document.querySelector("[data-card]"), document.querySelector("[data-save-card]"));
}
