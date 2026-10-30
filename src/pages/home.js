import { gsap, ScrollTrigger, fine, reduce, lenis } from "../lib/ui.js";
import * as sound from "../lib/sound.js";
import { initRitual } from "../lib/ritual.js";
import { initUnbox } from "../lib/unbox.js";
import { getState, setFlag } from "../lib/state.js";

export default async function home() {
  const ritual = document.querySelector(".ritual");
  initRitual(ritual);

  // the reward: once the protocol is complete, their box rises in and they open it
  // between "Protocol complete" and the box, the page holds still and a loader shows the box is on its way
  ritual.addEventListener("protocol:complete", () => { waiting(ritual); setTimeout(() => revealBox(ritual), reduce ? 0 : 1700); }, { once: true });

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

// the wait: scrolling pauses, the bar runs to 90% on its own and only reaches 100% when the 3D box is ready
let wait = null;
function waiting(ritual) {
  const bar = ritual.querySelector("[data-wait-bar]"), text = ritual.querySelector("[data-wait-text]");
  const html = document.documentElement;
  lenis?.stop(); html.style.overflow = "hidden"; // touch scrolling on phones and in Instagram too
  const p = { v: 0 };
  let step = 0;
  const draw = () => {
    bar.style.transform = `scaleX(${p.v})`;
    const n = Math.round(p.v * 100);
    text.textContent = n >= 100 ? "YOUR BOX IS READY" : `PREPARING YOUR BOX · ${n}%`;
    if (Math.floor(n / 20) > step) { step = Math.floor(n / 20); sound.tick(); }
  };
  const run = gsap.to(p, { v: 0.9, duration: reduce ? 0 : 2.2, ease: "power2.out", onUpdate: draw });
  wait = {
    done() {
      run.kill();
      gsap.to(p, { v: 1, duration: reduce ? 0 : 0.35, ease: "power1.out", onUpdate: draw, onComplete: () => { html.style.overflow = ""; lenis?.start(); } });
    },
  };
  // never trap the page: if loading stalls, scrolling comes back anyway
  setTimeout(() => { html.style.overflow = ""; lenis?.start(); }, 12000);
}

async function revealBox(ritual) {
  const el = ritual.querySelector("[data-ritual-box]");
  const hint = el.querySelector("[data-rb-hint]");
  const actions = el.querySelector("[data-rb-actions]");
  const done = el.querySelector("[data-rb-done]");
  el.querySelector("[data-rb-id]").textContent = getState().id || "";
  gsap.set(el, { autoAlpha: 0 }); el.hidden = false; // laid out (so the 3D can size itself) but invisible until it is ready
  const fadeIn = () => {
    gsap.to(el, { autoAlpha: 1, duration: reduce ? 0 : 1, ease: "power2.out", onComplete: () => { ritual.dataset.paused = "1"; } });
    gsap.from(el.querySelectorAll(".rb-head > *, .rb-actions"), { autoAlpha: 0, y: 20, stagger: 0.1, duration: 0.9, ease: "expo.out", delay: 0.4 });
  };
  const showDone = () => {
    setFlag("box");
    hint.textContent = "Inside: the card, the seal, the PEACE sticker and your tee.";
    actions.hidden = true;
    gsap.to(el.querySelector(".rb-head"), { autoAlpha: 0, y: -12, duration: 0.6, ease: "power2.in" }); // the box interior speaks for itself
    done.hidden = false;
    gsap.from(done.children, { autoAlpha: 0, y: 16, stagger: 0.1, duration: 0.8, ease: "expo.out" });
  };
  const box = await initUnbox(el);
  wait?.done();
  setTimeout(fadeIn, reduce ? 0 : 400); // let "YOUR BOX IS READY" land first
  if (!box) { showDone(); return; } // no 3D available: go straight to the next steps
  el.addEventListener("unboxed", showDone, { once: true });
  el.querySelector("[data-rb-open]").addEventListener("click", () => box.openAll());
  el.querySelector("canvas").focus({ preventScroll: true });
}
