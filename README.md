# KCITE-PROJECT

Web development workspace — single-file demos (Three.js / GSAP / Lenis via CDN import maps) and full Vite + TypeScript projects.

## Requirements

- Node.js 24+
- npm 12+
- Git

## Quick start

**Single-file page** — open `index.html` directly, or serve it:

```bash
npx serve .
```

**Vite project** (create when needed):

```bash
npm create vite@latest app -- --template vanilla-ts
npm install
npm run dev
```

## Conventions

- One palette per site, defined as CSS custom properties on `:root` and reused in shaders.
- Pin exact library versions in the import map (jsDelivr ESM).
- Clamp device pixel ratio to 2; dispose resources and cancel `requestAnimationFrame` on teardown.
- Honor `prefers-reduced-motion`.

## Git

```bash
git add .
git commit -m "feat: describe change"
git push
```
