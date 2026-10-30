import * as sound from "../lib/sound.js";

export default function lost() {
  const root = document.querySelector(".lost");
  const fill = root.querySelector(".ritual-ring .fill");
  let held = 0, holding = false, last = performance.now();
  const start = () => { holding = true; }, stop = () => { holding = false; };
  root.addEventListener("pointerdown", start); addEventListener("pointerup", stop); addEventListener("pointercancel", stop);
  addEventListener("keydown", (e) => e.code === "Space" && start()); addEventListener("keyup", (e) => e.code === "Space" && stop());
  (function loop(now) {
    const dt = (now - last) / 1000; last = now;
    held = Math.max(0, Math.min(1.5, held + (holding ? dt : -dt * 2)));
    fill.style.strokeDashoffset = String(289 * (1 - held / 1.5));
    if (held >= 1.5) { sound.chord(); location.href = "index.html"; return; }
    requestAnimationFrame(loop);
  })(last);
}
