import { gsap, reduce } from "../lib/ui.js";
import * as sound from "../lib/sound.js";

export default function minds() {
  const el = document.querySelector(".minds");
  const btn = el.querySelector("[data-together]");
  const set = (p) => el.style.setProperty("--split", `${p}%`);
  let split = 50, target = 50, together = false;
  const follow = (x) => { if (together) return; const r = el.getBoundingClientRect(); const lim = Math.max(18, ((btn.offsetWidth / 2 + 16) / r.width) * 100); target = Math.max(lim, Math.min(100 - lim, ((x - r.left) / r.width) * 100)); };
  el.addEventListener("pointermove", (e) => (e.pointerType === "mouse" || e.buttons) && follow(e.clientX));
  el.addEventListener("pointerdown", (e) => follow(e.clientX));
  // a half that gets too narrow hides its copy, so its words never cross the seam
  const narrow = innerWidth < 761 ? 44 : 26;
  gsap.ticker.add(() => { if (Math.abs(target - split) > 0.05) { split += (target - split) * (reduce ? 1 : 0.12); set(split); el.classList.toggle("a-narrow", split < narrow); el.classList.toggle("b-narrow", split > 100 - narrow); } });

  btn.addEventListener("click", () => {
    together = !together;
    el.classList.toggle("together", together);
    btn.setAttribute("aria-pressed", String(together));
    const label = btn.querySelector(".roll-inner span"); label.textContent = label.dataset.copy = together ? "Apart" : "Together";
    if (together) { target = 50; sound.chord(); gsap.to(".mind-b", { opacity: 0.5, duration: reduce ? 0 : 1 }); el.querySelector(".mind-b").style.clipPath = "inset(0 0 0 0)"; el.querySelector(".mind-b").style.mixBlendMode = "screen"; }
    else { el.querySelector(".mind-b").style.clipPath = ""; el.querySelector(".mind-b").style.mixBlendMode = ""; gsap.to(".mind-b", { opacity: 1, duration: reduce ? 0 : 0.6 }); }
  });
}
