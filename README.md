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

go to https://advisory-gray-xyuz9gon.edgeone.dev/
or https://selene-bench.vercel.app/

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
