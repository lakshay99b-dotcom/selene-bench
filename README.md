# Selene Bench

Interactive **Earth–Moon physics laboratory** for study. True-scale Newtonian gravity, eclipses, Kepler metrics, and cinematic collisions — all adjustable.

## Features

- **True-scale two-body gravity** (velocity Verlet, barycenter)
- **Live sliders** for G, masses, radii, distance, orbital speed, inclination, sun azimuth, time rate
- **Solar & lunar eclipses** — umbra/penumbra cones, angular-size matching, copper Moon tint
- **Cinematic impact** — approach camera, flash, debris, surface scar, screen shake
- **Kepler lab** — eccentricity, period (predicted + measured), areal velocity, Roche limit, escape ratio
- **Presets**: Present Day · Total Solar · Lunar Eclipse · Drop the Moon · Heavy Gravity · Escape · Giant Moon · Flyby
- **Cameras**: System · Earth · Moon · Totality · Chase (keys 1–5)

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Deploy to Vercel

This is a standard Vite SPA — Vercel works out of the box.

### Option A — Git (recommended)

1. Push this folder to a GitHub/GitLab/Bitbucket repo
2. [vercel.com/new](https://vercel.com/new) → import the repo
3. Framework preset: **Vite** (auto-detected)
4. Build command: `npm run build` · Output: `dist`
5. Deploy

`vercel.json` already configures SPA rewrites so client routes work.

### Option B — CLI

```bash
npm i -g vercel
npm run build
vercel --prod
```

### Option C — Static upload

```bash
npm run build
```

Upload the `dist/` folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

## Controls

| Input | Action |
|-------|--------|
| Drag | Orbit camera |
| Scroll | Zoom |
| Space | Pause / resume |
| 1–5 | Camera modes |
| R | Reset orbit |

## Stack

Vite · React 19 · TypeScript · Three.js r172

Newtonian two-body only — no GR, no solar perturbations. Good enough to feel the laws; not an ephemeris.
