import { gsap, ScrollTrigger, reduce } from "../lib/ui.js";
import { unlockWord, hasWord } from "../lib/state.js";
import * as sound from "../lib/sound.js";

export default function protocol() {
  // manifesto: one line lights at a time as you scroll
  const lines = [...document.querySelectorAll(".manifesto-stage p")];
  ScrollTrigger.create({
    trigger: ".manifesto", start: "top top", end: "bottom bottom",
    onUpdate: (s) => { const k = Math.min(lines.length - 1, Math.floor(s.progress * lines.length * 0.999)); lines.forEach((l, i) => l.classList.toggle("lit", i <= k)); },
  });
  if (reduce) lines.forEach((l) => l.classList.add("lit"));
  document.querySelectorAll("[data-trace]").forEach(trace);
}

// trace the word with a finger or the mouse: ink appears only where you pass
function trace(section) {
  const box = section.querySelector(".trace-canvas");
  const canvas = box.querySelector("canvas");
  const meter = section.querySelector(".trace-meter span");
  const key = section.dataset.trace, text = section.dataset.text;
  const font = section.dataset.font, dir = section.dataset.dir || "ltr";
  const ctx = canvas.getContext("2d");
  const ink = document.createElement("canvas"), mask = document.createElement("canvas");
  let W, H, dpr, pts = [], covered = 0, done = hasWord(key), last = null;

  function layout() {
    dpr = Math.min(devicePixelRatio, 2);
    W = box.clientWidth; H = box.clientHeight;
    for (const c of [canvas, ink, mask]) { c.width = W * dpr; c.height = H * dpr; }
    const ic = ink.getContext("2d");
    ic.scale(dpr, dpr); ic.fillStyle = "#e8e0cc"; ic.textAlign = "center"; ic.textBaseline = "middle"; ic.direction = dir;
    let size = Math.min(H * 0.7, 260);
    ic.font = font.replace("SIZE", size);
    while (ic.measureText(text).width > W * 0.92 && size > 30) { size -= 6; ic.font = font.replace("SIZE", size); }
    ic.fillText(text, W / 2, H / 2);
    // sample ink points for coverage
    const d = ic.getImageData(0, 0, ink.width, ink.height).data; pts = [];
    const step = Math.max(4, Math.round(6 * dpr));
    for (let y = 0; y < ink.height; y += step) for (let x = 0; x < ink.width; x += step) if (d[(y * ink.width + x) * 4 + 3] > 128) pts.push({ x: x / dpr, y: y / dpr, hit: false });
    covered = 0;
    mask.getContext("2d").clearRect(0, 0, mask.width, mask.height);
    draw();
    if (done) finish(true);
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // a faint guide so people know where to trace
    ctx.globalAlpha = done ? 1 : 0.08; ctx.drawImage(ink, 0, 0); ctx.globalAlpha = 1;
    if (done) return;
    const tmp = document.createElement("canvas"); tmp.width = canvas.width; tmp.height = canvas.height;
    const t = tmp.getContext("2d"); t.drawImage(ink, 0, 0); t.globalCompositeOperation = "destination-in"; t.drawImage(mask, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }
  const R = () => Math.max(26, Math.min(W, H) * 0.07);
  function brush(x, y) {
    const m = mask.getContext("2d"); m.setTransform(dpr, 0, 0, dpr, 0, 0);
    m.lineCap = "round"; m.lineJoin = "round"; m.lineWidth = R() * 2; m.strokeStyle = "#000";
    m.beginPath(); m.moveTo(last ? last.x : x, last ? last.y : y); m.lineTo(x, y); m.stroke();
    const r2 = R() * R();
    for (const p of pts) if (!p.hit && (p.x - x) ** 2 + (p.y - y) ** 2 < r2) { p.hit = true; covered++; }
    last = { x, y };
    const f = pts.length ? covered / pts.length : 0;
    meter.style.transform = `scaleX(${Math.min(1, f / 0.62)})`;
    if (Math.random() < 0.25) sound.tick();
    draw();
    if (f > 0.62) finish(false);
  }
  function finish(silent) {
    done = true;
    section.classList.add("done");
    meter.style.transform = "scaleX(1)";
    draw();
    if (!silent) { unlockWord(key); sound.chime(Number(section.dataset.index)); sound.buzz(30); gsap.fromTo(canvas, { scale: 0.98 }, { scale: 1, duration: 0.8, ease: "expo.out" }); }
    section.querySelector(".trace-hint").textContent = "Written. Added to your protocol.";
  }
  let drawing = false;
  const at = (e) => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  box.addEventListener("pointerdown", (e) => { if (done) return; drawing = true; last = null; box.setPointerCapture(e.pointerId); brush(...at(e)); });
  box.addEventListener("pointermove", (e) => drawing && !done && brush(...at(e)));
  box.addEventListener("pointerup", () => { drawing = false; last = null; });
  section.querySelector("[data-trace-skip]")?.addEventListener("click", () => !done && finish(false));
  new ResizeObserver(layout).observe(box);
  document.fonts.ready.then(layout);
}
