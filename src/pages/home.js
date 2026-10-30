import { gsap, ScrollTrigger, fine, reduce } from "../lib/ui.js";
import { initRitual } from "../lib/ritual.js";

export default async function home() {
  initRitual(document.querySelector(".ritual"));

  // the story: the back print wipes over to the chest label as you scroll
  const story = document.querySelector(".story");
  if (story && !reduce) {
    gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: story, start: "top top", end: "bottom bottom", scrub: 0.8 } })
      .fromTo(".story-back", { scale: 1.12 }, { scale: 1, duration: 0.45 }, 0)
      .fromTo(".story-front", { clipPath: "inset(0 0 0 100%)", scale: 1.08 }, { clipPath: "inset(0 0 0 0%)", scale: 1, duration: 0.35 }, 0.45)
      .to(".story-back", { scale: 0.96, autoAlpha: 0.4, duration: 0.35 }, 0.45)
      .to(".story-steps [data-step='1']", { autoAlpha: 0, y: -16, duration: 0.12 }, 0.42)
      .fromTo(".story-steps [data-step='2']", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.14 }, 0.58)
      .fromTo(".story-progress span", { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0);
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
