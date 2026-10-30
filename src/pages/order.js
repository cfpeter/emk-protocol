import { gsap, reduce } from "../lib/ui.js";
import { setSize, getState, claim, ensureId, wordCount, onChange, toast } from "../lib/state.js";
import * as sound from "../lib/sound.js";

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
  const cv = document.querySelector("[data-card]");
  const draw = () => drawCard(cv);
  document.fonts.ready.then(draw);
  onChange(draw);
  document.querySelector("[data-save-card]").addEventListener("click", async () => {
    ensureId(); draw();
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    const file = new File([blob], `${getState().id}-emk-protocol.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "EMK SYSTEM · Peace Protocol" }); return; } catch {} }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    toast("Card saved. Post it and tag @emk_system.");
  });
}

function drawCard(cv) {
  const s = getState();
  const W = 1080, H = 1920, c = cv.getContext("2d");
  cv.width = W; cv.height = H;
  c.fillStyle = "#0a0a0a"; c.fillRect(0, 0, W, H);
  const cream = "#e8e0cc", gold = "#d4c3a3", dim = "#3a3732";
  c.strokeStyle = cream; c.lineWidth = 10; c.strokeRect(120, 520, W - 240, 820);
  c.fillStyle = cream; c.textAlign = "left";
  c.font = "600 44px Archivo"; c.fillText("EMK SYSTEM™", 120, 300);
  c.font = "500 34px Archivo"; c.fillStyle = "#a9a294"; c.fillText("PEACE PROTOCOL · SERIES-001", 120, 360);
  const words = [["peace", "PEACE", "600 150px Archivo", "ltr"], ["salam", "سلام", "700 170px 'Noto Naskh Arabic'", "rtl"], ["khaghaghutyun", "Խաղաղություն", "700 92px 'Noto Serif Armenian'", "ltr"]];
  c.textAlign = "center";
  words.forEach(([k, t, f, dir], i) => {
    c.font = f; c.direction = dir; c.fillStyle = (s.words || []).includes(k) ? cream : dim;
    c.fillText(t, W / 2, 700 + i * 250); c.direction = "ltr";
  });
  c.textAlign = "left"; c.fillStyle = gold; c.font = "600 120px Archivo"; c.fillText(s.id || "PCE-····", 120, 1560);
  c.fillStyle = cream; c.font = "500 40px Archivo";
  c.fillText(`${wordCount()}/3 words${s.size ? ` · Size ${s.size}` : ""}${s.since ? ` · ${s.since}` : ""}`, 120, 1640);
  c.fillStyle = "#a9a294"; c.font = "500 36px Archivo"; c.fillText("Move with intention. Peace is power.", 120, 1760); c.fillText("@emk_system", 120, 1820);
}
