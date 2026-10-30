import { gsap, reduce } from "../lib/ui.js";
import * as sound from "../lib/sound.js";

export default function minds() {
  const el = document.querySelector(".minds");
  const set = (p) => el.style.setProperty("--split", `${p}%`);
  let split = 50, target = 50, together = false;
  const follow = (x) => { if (together) return; const r = el.getBoundingClientRect(); target = Math.max(18, Math.min(82, ((x - r.left) / r.width) * 100)); };
  el.addEventListener("pointermove", (e) => (e.pointerType === "mouse" || e.buttons) && follow(e.clientX));
  el.addEventListener("pointerdown", (e) => follow(e.clientX));
  gsap.ticker.add(() => { if (Math.abs(target - split) > 0.05) { split += (target - split) * (reduce ? 1 : 0.12); set(split); } });

  const btn = el.querySelector("[data-together]");
  btn.addEventListener("click", () => {
    together = !together;
    el.classList.toggle("together", together);
    btn.setAttribute("aria-pressed", String(together));
    btn.querySelector(".roll-inner span").textContent = together ? "Apart" : "Together";
    if (together) { target = 50; sound.chord(); gsap.to(".mind-b", { opacity: 0.5, duration: reduce ? 0 : 1 }); el.querySelector(".mind-b").style.clipPath = "inset(0 0 0 0)"; el.querySelector(".mind-b").style.mixBlendMode = "screen"; }
    else { el.querySelector(".mind-b").style.clipPath = ""; el.querySelector(".mind-b").style.mixBlendMode = ""; gsap.to(".mind-b", { opacity: 1, duration: reduce ? 0 : 0.6 }); }
  });
}
