import { gsap, ScrollTrigger, fine, reduce } from "../lib/ui.js";
import { initRitual } from "../lib/ritual.js";
import { initFigure } from "../lib/figure.js";

export default async function home() {
  initRitual(document.querySelector(".ritual"));

  // the tee turns from its back print to its chest label as you scroll
  const turn = document.querySelector(".turn");
  const stage = turn.querySelector(".turn-stage");
  initFigure(stage, stage.querySelector("canvas"), { scrollTurn: true }).then((fig) => {
    if (!fig) return;
    ScrollTrigger.create({ trigger: turn, start: "top top", end: "bottom bottom", onUpdate: (s) => fig.setProgress(s.progress) });
  });
  if (!reduce) {
    gsap.timeline({ scrollTrigger: { trigger: turn, start: "top top", end: "bottom bottom", scrub: 1 } })
      .fromTo(".turn-copy [data-step='1']", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, 0.35)
      .fromTo(".turn-copy [data-step='2']", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.45);
  }

  // tiles tilt toward the pointer
  if (fine && !reduce) {
    document.querySelectorAll(".tile").forEach((t) => {
      const rx = gsap.quickTo(t, "rotationX", { duration: 0.6 }), ry = gsap.quickTo(t, "rotationY", { duration: 0.6 });
      t.addEventListener("pointermove", (e) => {
        const r = t.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 10); rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
      });
      t.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
  }
}
