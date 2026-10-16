import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PARAMS,
  PRESETS,
  REAL,
  type LabParams,
} from "../sim/constants";
import {
  SeleneEngine,
  type CameraMode,
  type HudSnapshot,
} from "../sim/engine";

function fmt(n: number, d = 2) {
  if (!isFinite(n)) return "\u221e";
  if (Math.abs(n) >= 1e6) return n.toExponential(2);
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(2);
  return n.toFixed(d);
}

function Slider({
  label, value, min, max, step, onChange, unit,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="slider-val">
          {fmt(value, step < 0.1 ? 2 : step < 1 ? 1 : 0)}{unit ?? ""}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export default function SeleneBench() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SeleneEngine | null>(null);
  const [params, setParams] = useState<LabParams>({ ...DEFAULT_PARAMS });
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [tab, setTab] = useState<"sky" | "laws" | "const">("sky");
  const [benchOpen, setBenchOpen] = useState(true);
  const [muted, setMuted] = useState(true);

  const onHud = useCallback((h: HudSnapshot) => setHud(h), []);

  useEffect(() => {
    if (!mountRef.current) return;
    const eng = new SeleneEngine(mountRef.current, onHud);
    engineRef.current = eng;
    return () => eng.dispose();
  }, [onHud]);

  const patch = useCallback((partial: Partial<LabParams>, reseed = false) => {
    setParams((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.setParams(next, reseed);
      return next;
    });
  }, []);

  const applyPreset = (id: string) => {
    const pr = PRESETS.find((p) => p.id === id);
    if (!pr) return;
    const next = { ...DEFAULT_PARAMS, ...pr.params, seedNonce: Date.now() };
    setParams(next);
    engineRef.current?.setParams(next, true);
  };

  const reseed = () => {
    const next = { ...params, seedNonce: Date.now() };
    setParams(next);
    engineRef.current?.setParams(next, true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const eng = engineRef.current;
      if (!eng) return;
      if (e.code === "Space") { e.preventDefault(); eng.togglePause(); }
      const modes: CameraMode[] = ["system", "earth", "moon", "totality", "chase"];
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 5) eng.setCameraMode(modes[num - 1]);
      if (e.key === "r" || e.key === "R") reseed();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const m = hud?.metrics;
  const ec = hud?.eclipse;

  return (
    <div className={`app ${benchOpen ? "bench-open" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">\u263e</span>
          <div>
            <h1>Selene Bench</h1>
            <p>Earth\u2013Moon physics laboratory</p>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" className="btn ghost" onClick={() => engineRef.current?.togglePause()}>
            {hud?.paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn ghost" onClick={reseed}>Reset</button>
          <button type="button" className="btn ghost" onClick={() => {
            const next = !muted; setMuted(next); engineRef.current?.setMuted(next);
          }}>{muted ? "Unmute" : "Mute"}</button>
          <button type="button" className="btn primary bench-toggle" onClick={() => setBenchOpen((v) => !v)}>
            {benchOpen ? "Hide Bench" : "Open Bench"}
          </button>
        </div>
      </header>

      <div className="stage">
        <div className="canvas-wrap" ref={mountRef}>
          <div className="impact-flash" />
        </div>
        <div className="hud-tl">
          <div className="chip"><span className="chip-label">Distance</span>
            <span className="chip-val">{fmt(m?.r ?? REAL.DIST, 0)} km</span></div>
          <div className="chip"><span className="chip-label">Speed</span>
            <span className="chip-val">{fmt(m?.speed ?? 0, 3)} km/h</span></div>
          <div className="chip"><span className="chip-label">Period</span>
            <span className="chip-val">{fmt((m?.periodH ?? 0) / 24, 2)} d
              {m?.measuredPeriodH ? ` \u00b7 meas ${fmt(m.measuredPeriodH / 24, 2)}d` : ""}</span></div>
          <div className="chip"><span className="chip-label">Eclipse</span>
            <span className="chip-val">{ec?.type ?? "none"}</span></div>
        </div>

        {hud?.impacted && (
          <div className="impact-card">
            <h3>Impact</h3>
            <p>Relative speed <strong>{fmt(hud.impactSpeed, 2)} km/h</strong> ({fmt(hud.impactSpeed / 3600, 2)} km/s)</p>
            <p className="muted">Cinematic camera engaged \u00b7 debris field active \u00b7 surface scar painted</p>
          </div>
        )}

        <div className="cam-bar">
          {([["system", "1 System"], ["earth", "2 Earth"], ["moon", "3 Moon"],
            ["totality", "4 Totality"], ["chase", "5 Chase"]] as const).map(([id, label]) => (
            <button key={id} type="button"
              className={`cam-btn ${hud?.cameraMode === id ? "active" : ""}`}
              onClick={() => engineRef.current?.setCameraMode(id)}>{label}</button>
          ))}
        </div>
        <div className="hud-br">
          <span className="scale-hint">Drag orbit \u00b7 Scroll zoom \u00b7 Space pause \u00b7 R reset</span>
        </div>
      </div>

      <aside className="bench">
        <div className="presets">
          {PRESETS.map((pr) => (
            <button key={pr.id} type="button" className="preset" title={pr.blurb}
              onClick={() => applyPreset(pr.id)}>{pr.name}</button>
          ))}
        </div>
        <div className="tabs">
          {(["sky", "laws", "const"] as const).map((t) => (
            <button key={t} type="button" className={`tab ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t === "sky" ? "Sky" : t === "laws" ? "Laws" : "Constants"}
            </button>
          ))}
        </div>
        <div className="bench-body">
          {tab === "sky" && (<>
            <section>
              <h3>Live insight</h3>
              <ul className="facts">
                <li>Orbit is <strong>{m?.bound ? "bound (ellipse)" : "unbound (hyperbolic)"}</strong>
                  {m ? ` \u00b7 e = ${fmt(m.eccentricity, 3)}` : ""}</li>
                <li>Periapsis {fmt(m?.periapsis ?? 0, 0)} km \u00b7 Apoapsis {fmt(m?.apoapsis ?? 0, 0)} km</li>
                <li>Centripetal {fmt(m?.centripetal ?? 0, 4)} km/h\u00b2 vs gravity {fmt(m?.gravityAccel ?? 0, 4)} km/h\u00b2</li>
                <li>Escape ratio {fmt(m?.escapeRatio ?? 0, 3)} (1 = escape speed)</li>
                <li>Roche limit \u2248 {fmt(m?.rocheLimit ?? 0, 0)} km
                  {m && m.r < m.rocheLimit ? " \u2014 Moon is inside Roche limit!" : " \u2014 Moon is outside"}</li>
                <li>Areal velocity {fmt(m?.arealVel ?? 0, 2)} km\u00b2/h (Kepler 2)</li>
                {ec && ec.type !== "none" && (
                  <li>Angular sizes: Moon {(ec.angMoon * (180 / Math.PI)).toFixed(3)}\u00b0 \u00b7
                    Sun {(ec.angSun * (180 / Math.PI)).toFixed(3)}\u00b0</li>
                )}
              </ul>
            </section>
            <section>
              <h3>Time & orbit</h3>
              <Slider label="Hours / second" value={params.hoursPerSecond} min={0.5} max={200} step={0.5}
                onChange={(v) => patch({ hoursPerSecond: v })} />
              <Slider label="Inclination" value={params.inclination} min={0} max={60} step={0.1} unit="\u00b0"
                onChange={(v) => patch({ inclination: v }, true)} />
              <Slider label="Sun azimuth" value={params.sunAzimuth} min={0} max={360} step={1} unit="\u00b0"
                onChange={(v) => patch({ sunAzimuth: v })} />
            </section>
          </>)}
          {tab === "laws" && (
            <section className="laws">
              <h3>Kepler\u2019s laws in this lab</h3>
              <ol>
                <li><strong>Law of orbits</strong> \u2014 Conic with Earth at one focus. e = <code>{fmt(m?.eccentricity ?? 0, 4)}</code>.</li>
                <li><strong>Law of areas</strong> \u2014 Areal velocity <code>{fmt(m?.arealVel ?? 0, 2)} km\u00b2/h</code> conserved.</li>
                <li><strong>Law of periods</strong> \u2014 T\u00b2 \u221d a\u00b3. Predicted <code>{fmt((m?.periodH ?? 0) / 24, 3)} d</code>
                  {m?.measuredPeriodH ? ` \u00b7 measured ${fmt(m.measuredPeriodH / 24, 3)} d` : " \u00b7 measuring\u2026"}. Real \u2248 27.32 d.</li>
              </ol>
              <h3>Compare to nature</h3>
              <table className="cmp">
                <thead><tr><th>Quantity</th><th>Lab</th><th>Real</th></tr></thead>
                <tbody>
                  <tr><td>Mean distance</td><td>{fmt(m?.r ?? 0, 0)} km</td><td>{REAL.DIST.toLocaleString()} km</td></tr>
                  <tr><td>Orbital speed</td><td>{fmt((m?.speed ?? 0) / 3600, 3)} km/s</td><td>\u2248 1.022 km/s</td></tr>
                  <tr><td>Period</td><td>{fmt((m?.periodH ?? 0) / 24, 2)} d</td><td>27.32 d</td></tr>
                  <tr><td>Earth radius</td><td>{fmt(REAL.R_EARTH * params.earthRadMul, 0)} km</td><td>6,371 km</td></tr>
                  <tr><td>Moon radius</td><td>{fmt(REAL.R_MOON * params.moonRadMul, 0)} km</td><td>1,737 km</td></tr>
                </tbody>
              </table>
              <p className="disclaimer">Newtonian two-body only \u2014 no GR, no solar perturbations.</p>
            </section>
          )}
          {tab === "const" && (
            <section>
              <h3>Physical constants (multipliers)</h3>
              <p className="hint">Force parameters update live. Geometry reseeds the orbit.</p>
              <Slider label="Gravity G \u00d7" value={params.gMul} min={0.1} max={20} step={0.1}
                onChange={(v) => patch({ gMul: v })} />
              <Slider label="Earth mass \u00d7" value={params.earthMassMul} min={0.1} max={10} step={0.1}
                onChange={(v) => patch({ earthMassMul: v })} />
              <Slider label="Moon mass \u00d7" value={params.moonMassMul} min={0.1} max={10} step={0.1}
                onChange={(v) => patch({ moonMassMul: v })} />
              <Slider label="Earth radius \u00d7" value={params.earthRadMul} min={0.3} max={5} step={0.05}
                onChange={(v) => patch({ earthRadMul: v }, true)} />
              <Slider label="Moon radius \u00d7" value={params.moonRadMul} min={0.3} max={8} step={0.05}
                onChange={(v) => patch({ moonRadMul: v }, true)} />
              <Slider label="Distance \u00d7" value={params.distMul} min={0.3} max={3} step={0.01}
                onChange={(v) => patch({ distMul: v }, true)} />
              <Slider label="Orbital speed \u00d7" value={params.speedMul} min={0} max={2.5} step={0.01}
                onChange={(v) => patch({ speedMul: v }, true)} />
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
