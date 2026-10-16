import { GM_EARTH, GM_MOON, REAL, type LabParams } from "./constants";

export type V3 = { x: number; y: number; z: number };

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: V3, s: number): V3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return scale(a, 1 / l);
};

export function circularSpeed(mu: number, r: number) {
  return Math.sqrt(mu / Math.max(r, 1));
}

export type BodyState = {
  pos: V3;
  vel: V3;
};

export type SimState = {
  earth: BodyState;
  moon: BodyState;
  elapsedH: number;
  lapClockH: number;
  angAccum: number;
  measuredPeriodH: number;
  prevAngle: number;
  impacted: boolean;
  impactPos: V3 | null;
  impactSpeed: number;
  debrisSpawned: boolean;
};

export type EclipseInfo = {
  type: "none" | "solar-partial" | "solar-total" | "solar-annular" | "lunar-partial" | "lunar-total";
  sep: number;
  angMoon: number;
  angSun: number;
  umbraLen: number;
  axial: number;
  align: number;
};

export type OrbitalMetrics = {
  r: number;
  speed: number;
  periapsis: number;
  apoapsis: number;
  semiMajor: number;
  eccentricity: number;
  periodH: number;
  arealVel: number;
  energy: number;
  bound: boolean;
  escapeRatio: number;
  centripetal: number;
  gravityAccel: number;
  rocheLimit: number;
  measuredPeriodH: number;
};

export function muTotal(p: LabParams) {
  return GM_EARTH * p.gMul * p.earthMassMul + GM_MOON * p.gMul * p.moonMassMul;
}

export function muEarth(p: LabParams) {
  return GM_EARTH * p.gMul * p.earthMassMul;
}

export function earthRadius(p: LabParams) {
  return REAL.R_EARTH * p.earthRadMul;
}

export function moonRadius(p: LabParams) {
  return REAL.R_MOON * p.moonRadMul;
}

export function seedState(p: LabParams): SimState {
  const r0 = REAL.DIST * p.distMul;
  const mu = muEarth(p);
  const vCirc = circularSpeed(mu, r0) * p.speedMul;
  const inc = (p.inclination * Math.PI) / 180;
  const mE = REAL.M_EARTH * p.earthMassMul;
  const mM = REAL.M_MOON * p.moonMassMul;
  const totalM = mE + mM;
  const rE = (mM / totalM) * r0;
  const rM = (mE / totalM) * r0;
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);
  const earthPos = v3(-rE, 0, 0);
  const moonPos = v3(rM * cosI, 0, rM * sinI);
  const earthVel = v3(0, -vCirc * (mM / totalM), 0);
  const moonVel = v3(0, vCirc * (mE / totalM), 0);
  const moonVelTilted = v3(moonVel.x, moonVel.y * cosI, moonVel.y * sinI + moonVel.z);
  const earthVelTilted = v3(earthVel.x, earthVel.y * cosI, earthVel.y * sinI);
  return {
    earth: { pos: earthPos, vel: earthVelTilted },
    moon: { pos: moonPos, vel: moonVelTilted },
    elapsedH: 0,
    lapClockH: 0,
    angAccum: 0,
    measuredPeriodH: 0,
    prevAngle: Math.atan2(moonPos.y - earthPos.y, moonPos.x - earthPos.x),
    impacted: false,
    impactPos: null,
    impactSpeed: 0,
    debrisSpawned: false,
  };
}

function accelOn(pos: V3, other: V3, muOther: number): V3 {
  const d = sub(other, pos);
  const r = len(d);
  if (r < 1) return v3();
  const a = muOther / (r * r);
  return scale(norm(d), a);
}

export function stepBodies(state: SimState, p: LabParams, dtHours: number): SimState {
  if (state.impacted) return state;
  const muE = muEarth(p);
  const muM = GM_MOON * p.gMul * p.moonMassMul;
  const rE = earthRadius(p);
  const rM = moonRadius(p);
  const sumR = rE + rM;
  const rel = sub(state.moon.pos, state.earth.pos);
  const dist = len(rel);
  const relV = sub(state.moon.vel, state.earth.vel);
  const approach = -dot(relV, norm(rel));
  let nSub = 1;
  if (dist < sumR * 8 || approach > 0.5) nSub = 8;
  if (dist < sumR * 3) nSub = 24;
  if (dist < sumR * 1.5) nSub = 64;
  const dt = dtHours / nSub;
  let s = { ...state, earth: { ...state.earth }, moon: { ...state.moon } };
  for (let i = 0; i < nSub; i++) {
    const aE0 = accelOn(s.earth.pos, s.moon.pos, muM);
    const aM0 = accelOn(s.moon.pos, s.earth.pos, muE);
    s.earth.vel = add(s.earth.vel, scale(aE0, dt * 0.5));
    s.moon.vel = add(s.moon.vel, scale(aM0, dt * 0.5));
    s.earth.pos = add(s.earth.pos, scale(s.earth.vel, dt));
    s.moon.pos = add(s.moon.pos, scale(s.moon.vel, dt));
    const aE1 = accelOn(s.earth.pos, s.moon.pos, muM);
    const aM1 = accelOn(s.moon.pos, s.earth.pos, muE);
    s.earth.vel = add(s.earth.vel, scale(aE1, dt * 0.5));
    s.moon.vel = add(s.moon.vel, scale(aM1, dt * 0.5));
    const d = sub(s.moon.pos, s.earth.pos);
    const r = len(d);
    if (r <= sumR) {
      const n = norm(d);
      const contact = add(s.earth.pos, scale(n, rE));
      const relSpeed = len(sub(s.moon.vel, s.earth.vel));
      s.impacted = true;
      s.impactPos = contact;
      s.impactSpeed = relSpeed;
      s.moon.pos = contact;
      s.moon.vel = { ...s.earth.vel };
      break;
    }
  }
  const dxy = sub(s.moon.pos, s.earth.pos);
  const ang = Math.atan2(dxy.y, dxy.x);
  let dAng = ang - s.prevAngle;
  if (dAng > Math.PI) dAng -= 2 * Math.PI;
  if (dAng < -Math.PI) dAng += 2 * Math.PI;
  s.angAccum += Math.abs(dAng);
  s.prevAngle = ang;
  s.elapsedH += dtHours;
  s.lapClockH += dtHours;
  if (s.angAccum >= 2 * Math.PI && s.measuredPeriodH === 0) {
    s.measuredPeriodH = s.lapClockH;
  } else if (s.angAccum >= 2 * Math.PI) {
    s.measuredPeriodH = s.lapClockH;
    s.lapClockH = 0;
    s.angAccum = 0;
  }
  return s;
}

export function classifyEclipse(
  earth: V3,
  moon: V3,
  sunDir: V3,
  p: LabParams
): EclipseInfo {
  const rE = earthRadius(p);
  const rM = moonRadius(p);
  const sunR = REAL.SUN_RADIUS;
  const em = sub(moon, earth);
  const distEM = len(em);
  const emN = norm(em);
  const sunPos = scale(sunDir, REAL.AU);
  const earthToSun = norm(sub(sunPos, earth));
  const angMoon = 2 * Math.atan(rM / distEM);
  const angSun = 2 * Math.atan(sunR / REAL.AU);
  const cosSolar = dot(emN, earthToSun);
  const sepSolar = Math.acos(Math.min(1, Math.max(-1, cosSolar)));
  const cosLunar = dot(scale(emN, -1), earthToSun);
  const sepLunar = Math.acos(Math.min(1, Math.max(-1, cosLunar)));
  const umbraLen = (rE * REAL.AU) / (sunR - rE);
  let type: EclipseInfo["type"] = "none";
  let sep = sepSolar;
  let align = 0;
  let axial = distEM;
  if (cosSolar > 0.99) {
    sep = sepSolar;
    align = Math.max(0, 1 - sepSolar / ((angMoon + angSun) * 0.5));
    const sumAng = (angMoon + angSun) / 2;
    const diffAng = Math.abs(angMoon - angSun) / 2;
    if (sepSolar < diffAng && angMoon > angSun) type = "solar-total";
    else if (sepSolar < diffAng && angMoon < angSun) type = "solar-annular";
    else if (sepSolar < sumAng) type = "solar-partial";
  }
  if (cosLunar > 0.99 && type === "none") {
    sep = sepLunar;
    axial = distEM;
    const umbraRadiusAtMoon = Math.max(0, rE - (distEM * (sunR - rE)) / REAL.AU);
    const penumbraRadius = rE + (distEM * (sunR + rE)) / REAL.AU;
    const angUmbra = Math.atan(umbraRadiusAtMoon / distEM);
    const angPen = Math.atan(penumbraRadius / distEM);
    if (sepLunar < angUmbra) {
      type = "lunar-total";
      align = 1;
    } else if (sepLunar < angPen) {
      type = "lunar-partial";
      align = Math.max(0, 1 - (sepLunar - angUmbra) / (angPen - angUmbra + 1e-9));
    }
  }
  return { type, sep, angMoon, angSun, umbraLen, axial, align };
}

export function computeMetrics(state: SimState, p: LabParams): OrbitalMetrics {
  const rel = sub(state.moon.pos, state.earth.pos);
  const relV = sub(state.moon.vel, state.earth.vel);
  const r = len(rel);
  const speed = len(relV);
  const mu = muEarth(p);
  const hVec = cross(rel, relV);
  const h = len(hVec);
  const arealVel = h / 2;
  const energy = 0.5 * speed * speed - mu / r;
  const bound = energy < 0;
  let a = 0;
  let e = 0;
  let peri = r;
  let apo = r;
  let periodH = 0;
  if (bound && Math.abs(energy) > 1e-12) {
    a = -mu / (2 * energy);
    const eccVec = sub(scale(rel, (speed * speed) / mu - 1 / r), scale(relV, dot(rel, relV) / mu));
    e = Math.min(0.999, len(eccVec));
    peri = a * (1 - e);
    apo = a * (1 + e);
    periodH = 2 * Math.PI * Math.sqrt((a * a * a) / mu);
  } else {
    a = mu / (2 * Math.abs(energy));
    e = 1 + (r * speed * speed) / mu;
    peri = a * (e - 1);
    apo = Infinity;
  }
  const escapeV = Math.sqrt((2 * mu) / r);
  const escapeRatio = speed / escapeV;
  const centripetal = (speed * speed) / r;
  const gravityAccel = mu / (r * r);
  const densE = REAL.M_EARTH / ((4 / 3) * Math.PI * Math.pow(REAL.R_EARTH, 3));
  const densM = REAL.M_MOON / ((4 / 3) * Math.PI * Math.pow(REAL.R_MOON, 3));
  const roche =
    earthRadius(p) *
    2.44 *
    Math.pow((densE * p.earthMassMul) / (densM * p.moonMassMul || 1e-9), 1 / 3);
  return {
    r,
    speed,
    periapsis: peri,
    apoapsis: apo,
    semiMajor: a,
    eccentricity: e,
    periodH,
    arealVel,
    energy,
    bound,
    escapeRatio,
    centripetal,
    gravityAccel,
    rocheLimit: roche,
    measuredPeriodH: state.measuredPeriodH,
  };
}

export function sunDirection(azimuthDeg: number): V3 {
  const a = (azimuthDeg * Math.PI) / 180;
  return v3(Math.cos(a), Math.sin(a), 0);
}
