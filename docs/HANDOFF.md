# EMK SYSTEM · Peace Protocol site — handoff (30 Oct 2026)

Start the next session **in this folder** (`~/Work/emk-protocol`) and read this file first.

## What this is
A showcase-only (no cart) interactive website for **EMK SYSTEM™**, a two-founder streetwear label from Los Angeles (Instagram @emk_system, email emksystem01@gmail.com). The owner of this project is building it for the founder (a friend). Ordering is by Instagram DM. Built from the prompt in `docs/PROMPT-INTERACTIVE-SITE.md` (in `~/Work/emk-system/docs/`), design rules in `DESIGN.md`.

## Stack and running it
- Vite + vanilla JS + Three.js + GSAP/ScrollTrigger + Lenis. Fonts self-hosted via @fontsource. No AI, no server, no analytics: 100% static.
- Dev: `npx vite --port 4420` → http://localhost:4420 (the Claude desktop launch config name is `emk-protocol`; `emk-protocol-build` serves the production build on 4421).
- Build: `npx vite build` → `dist/`. Deploy: `.github/workflows/deploy.yml` builds and publishes to GitHub Pages on push to `main`.

## Pages (all interactive)
- **index** — gold liquid-wave ritual (hold still to calm the waves; 3 words morph out of particles: PEACE, سلام, Խաղաղություն) → "Protocol complete" → the **3D EMK box** rises in (drag up or "Open it for me"): lid lifts and leans back ("MADE WITH INTENTION / PEACE · UNITY · CULTURE"), card/seal/sticker set aside, tissue opens, camera looks into the real box photo → access ID + See Series 001 / Order by DM. Then a scroll photo story (back print wipes to chest label) and tiles.
- **series** — full-frame photos with Back/Front wipe, Closer zoom, hotspots on the photo; Up close strip; **100% cotton** section with a fabric loupe; the barcode scan (parks as READ once read, opens a layer); the 3D box again.
- **protocol** — manifesto lines light on scroll; trace each word in ink (always traceable; "Trace it again").
- **minds** — split screen of two photos, Together merges them. Founder names/story still unknown.
- **lookbook** — 12 photos floating in 3D, drag to drift, tap to open a lightbox; "Every photo" grid below.
- **order** — size dial (S/M/L/XL from the real chest table), DM to claim (copies the message, opens ig.me/m/emk_system), Join the 002 list (DM), Protocol Card (canvas story image).
- **404** — hold to reconnect.
- Global: Protocol bar (access ID, 3 word dots, size, Skip to order), menu (lines → X), cursor labels, short UI sounds (no background drone), view transitions.

## Key files
- `src/lib/ritual.js` (gold waves + words), `src/lib/unbox.js` (3D box), `src/lib/ui.js` (global interactions), `src/lib/state.js` (localStorage protocol), `src/lib/sound.js`, `src/pages/*.js`, `src/styles.css` (later blocks marked `/* lead: ... */` override earlier ones), `partials/*.html` (injected by `vite.config.js`).
- Photos: originals in `images/`; processed web set in `public/img/` (lb-* lookbook, label, label-tag, hem, print-art, box-floor, folded, fig-back-cut-fade for 404). `raw/` (git-ignored) holds p0–p11 copies, masks and depth maps.
- Processing scripts used: `~/Work/emk-system/scripts/process-new.mjs`, `process-mask.mjs` (Depth Anything + background removal) and inline PIL crops.

## Confirmed facts
Barcode **PCE24LDN8T004**. **100% cotton.** Sizes flat chest/length: S 24/27, M 25/28.25, L 25/29, XL 26/29. All sales final; size exchanges 14 days unworn with tags; customer pays shipping. Label EST. 2021. **Never invent** prices, stock, reviews, "limited".

## Owner preferences learned (important)
- Hates: text overlapping text, noise/grain, the 3D cut-out person (removed), background drone sound, hover labels that lie (menu), flashes of old content on refresh. Wants everything interactive, natural, clean; likes the box a lot.
- Copy: plain American English, no em dashes, no "unlock/elevate/seamless".
- Don't push/deploy or make repos public without his word. Use the design-taste lint + inspector (`~/.claude/skills/design-taste-frontend/scripts/`) and Playwright (`playwright-cli`) to verify, and **close test browsers afterwards** (`playwright-cli close-all`) — they spin the laptop fans.

## Status / next
- All work committed locally on `main`. **Not pushed.** GitHub repo `cfpeter/emk-protocol` does not exist yet (see push steps below).
- Inspector: 0 FAIL except `covered-text` on phone for two Series headings and one Home tile label — verified false positives (mid-reveal animation when the inspector jumps).
- To verify next: the fabric loupe by hand on desktop + phone; a real iPhone opened from Instagram (performance + touch).
- Open items from the founder: names/story for Two Minds, why these three languages (Protocol page), price, any more photos/video.

## Push steps (owner runs, or tells Claude "make it public")
```bash
cd ~/Work/emk-protocol && gh repo create emk-protocol --public --source . --remote origin --push
gh api -X POST "repos/cfpeter/emk-protocol/pages" -f build_type=workflow
gh workflow run "Deploy to GitHub Pages" -R cfpeter/emk-protocol
```
Live URL afterwards: https://cfpeter.github.io/emk-protocol/
