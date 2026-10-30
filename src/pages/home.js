import { gsap, ScrollTrigger, fine, reduce } from "../lib/ui.js";
import { initRitual } from "../lib/ritual.js";
import { initUnbox } from "../lib/unbox.js";
import { getState, setFlag } from "../lib/state.js";

export default async function home() {
  const ritual = document.querySelector(".ritual");
  initRitual(ritual);

  // the reward: once the protocol is complete, their box rises in and they open it
  ritual.addEventListener("protocol:complete", () => setTimeout(() => revealBox(ritual), reduce ? 0 : 1700), { once: true });

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

async function revealBox(ritual) {
  const el = ritual.querySelector("[data-ritual-box]");
  const hint = el.querySelector("[data-rb-hint]");
  const actions = el.querySelector("[data-rb-actions]");
  const done = el.querySelector("[data-rb-done]");
  el.querySelector("[data-rb-id]").textContent = getState().id || "";
  el.hidden = false;
  gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduce ? 0 : 1, ease: "power2.out", onComplete: () => { ritual.dataset.paused = "1"; } });
  gsap.from(el.querySelectorAll(".rb-head > *, .rb-actions"), { autoAlpha: 0, y: 20, stagger: 0.1, duration: 0.9, ease: "expo.out", delay: 0.4 });
  const showDone = () => {
    setFlag("box");
    hint.textContent = "Inside: the card, the seal, the PEACE sticker and your tee.";
    actions.hidden = true;
    gsap.to(el.querySelector(".rb-head"), { autoAlpha: 0, y: -12, duration: 0.6, ease: "power2.in" }); // the box interior speaks for itself
    done.hidden = false;
    gsap.from(done.children, { autoAlpha: 0, y: 16, stagger: 0.1, duration: 0.8, ease: "expo.out" });
  };
  const box = await initUnbox(el);
  if (!box) { showDone(); return; } // no 3D available: go straight to the next steps
  el.addEventListener("unboxed", showDone, { once: true });
  el.querySelector("[data-rb-open]").addEventListener("click", () => box.openAll());
  el.querySelector("canvas").focus({ preventScroll: true });
}
