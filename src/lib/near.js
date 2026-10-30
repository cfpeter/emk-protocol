// Resolves once an element comes within `margin` px of the viewport (lazy-start heavy scenes).
export function whenNear(el, margin = 600) {
  return new Promise((resolve) => {
    if (!("IntersectionObserver" in window)) return resolve();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); resolve(); }
    }, { rootMargin: `${margin}px 0px` });
    io.observe(el);
  });
}
