// The visitor's protocol: an access ID, the three words, a size. Kept on this device only.
const KEY = "emk-protocol";
const WORDS = ["peace", "salam", "khaghaghutyun"];
const listeners = new Set();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} listeners.forEach((f) => f(state)); };

export const getState = () => state;
export const onChange = (f) => (listeners.add(f), () => listeners.delete(f));
export const isReturning = () => Boolean(state.id && state.visits > 1);

export function ensureId() {
  if (!state.id) {
    const n = Math.floor(1000 + Math.random() * 9000);
    state.id = `PCE-${n}`;
    state.since = new Date().toISOString().slice(0, 10);
    save();
  }
  return state.id;
}
export function unlockWord(w) {
  if (!WORDS.includes(w)) return false;
  state.words = state.words || [];
  if (state.words.includes(w)) return false;
  ensureId();
  state.words.push(w);
  save();
  return true;
}
export const hasWord = (w) => (state.words || []).includes(w);
export const wordCount = () => (state.words || []).length;
export function setSize(s) { state.size = s; save(); }
export function setFlag(k) { state.flags = { ...(state.flags || {}), [k]: true }; save(); }
export function setStill(seconds) { state.still = Math.max(state.still || 0, seconds); save(); }

// count visits once per session
try {
  if (!sessionStorage.getItem(KEY)) {
    sessionStorage.setItem(KEY, "1");
    state.visits = (state.visits || 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(state));
  }
} catch {}

// ---------- the bar ----------
export function mountBar() {
  const bar = document.querySelector("[data-bar]");
  if (!bar) return;
  const id = bar.querySelector("[data-bar-id]");
  const size = bar.querySelector("[data-bar-size]");
  const render = (s) => {
    id.textContent = s.id || "PCE-····";
    bar.querySelectorAll("[data-word]").forEach((d) => d.classList.toggle("on", (s.words || []).includes(d.dataset.word)));
    size.textContent = s.size ? `Size ${s.size}` : "No size yet";
  };
  render(state);
  onChange(render);
}

let toastTimer;
export function toast(msg) {
  const el = document.querySelector("[data-toast]");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2600);
}

// ---------- DM to claim: copy the message, then open Instagram ----------
export async function claim(kind = "order") {
  const id = ensureId();
  const size = state.size ? `size ${state.size}` : "size ?";
  const text = kind === "002"
    ? `Hi EMK SYSTEM, add me to Series 002, ${size}. ${id}`
    : `Hi EMK SYSTEM, I'd like Peace tee 001, ${size}. ${id}`;
  try { await navigator.clipboard.writeText(text); toast("Message copied. Paste it in the DM."); }
  catch { toast(text); }
  setTimeout(() => { location.href = "https://ig.me/m/emk_system"; }, 700);
}
