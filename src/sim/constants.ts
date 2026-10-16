/** Physical constants in km / hours units for numerical stability */

export const REAL = {
  G: 6.6743e-11, // m³ kg⁻¹ s⁻²
  M_EARTH: 5.972e24, // kg
  M_MOON: 7.342e22, // kg
  R_EARTH: 6371, // km
  R_MOON: 1737.4, // km
  DIST: 384400, // km mean Earth–Moon
  PERIOD_DAYS: 27.321661, // sidereal month
  AU: 149597870.7, // km
  SUN_RADIUS: 695700, // km
} as const;

// Convert G to km³ h⁻² kg⁻¹
// G_si * (1e-9 km³/m³) * (3600² s²/h²)
const G_KM_H =
  REAL.G * 1e-9 * 3600 * 3600; // ≈ 8.640e-13

export const GM_EARTH = G_KM_H * REAL.M_EARTH; // ≈ 5.1657e12 km³/h²
export const GM_MOON = G_KM_H * REAL.M_MOON;

export const SUN_DIST = 1.496e8; // km (1 AU)

export type LabParams = {
  gMul: number;
  earthMassMul: number;
  moonMassMul: number;
  earthRadMul: number;
  moonRadMul: number;
  distMul: number;
  speedMul: number;
  inclination: number; // degrees
  sunAzimuth: number; // degrees
  hoursPerSecond: number;
  seedNonce: number;
};

export const DEFAULT_PARAMS: LabParams = {
  gMul: 1,
  earthMassMul: 1,
  moonMassMul: 1,
  earthRadMul: 1,
  moonRadMul: 1,
  distMul: 1,
  speedMul: 1,
  inclination: 5.14,
  sunAzimuth: 0,
  hoursPerSecond: 48,
  seedNonce: 0,
};

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  params: Partial<LabParams>;
};

export const PRESETS: Preset[] = [
  {
    id: "present",
    name: "Present Day",
    blurb: "Real Earth–Moon numbers",
    params: { ...DEFAULT_PARAMS },
  },
  {
    id: "total-solar",
    name: "Total Solar Eclipse",
    blurb: "Moon at perigee, aligned for totality",
    params: {
      distMul: 0.945,
      sunAzimuth: 0,
      inclination: 0.2,
      hoursPerSecond: 12,
    },
  },
  {
    id: "lunar-eclipse",
    name: "Lunar Eclipse",
    blurb: "Moon in Earth's umbra (copper glow)",
    params: {
      sunAzimuth: 180,
      inclination: 0.3,
      hoursPerSecond: 24,
    },
  },
  {
    id: "drop",
    name: "Drop the Moon",
    blurb: "Zero orbital speed → radial fall",
    params: {
      speedMul: 0,
      hoursPerSecond: 6,
      inclination: 0,
    },
  },
  {
    id: "heavy-g",
    name: "Heavy Gravity",
    blurb: "10× G → rapid inspiral & impact",
    params: {
      gMul: 10,
      hoursPerSecond: 2,
    },
  },
  {
    id: "escape",
    name: "Escape Trajectory",
    blurb: "Speed above escape → hyperbolic path",
    params: {
      speedMul: 1.6,
      hoursPerSecond: 80,
    },
  },
  {
    id: "giant-moon",
    name: "Giant Moon",
    blurb: "3× Moon radius & mass",
    params: {
      moonRadMul: 3,
      moonMassMul: 3,
      hoursPerSecond: 36,
    },
  },
  {
    id: "flyby",
    name: "Close Flyby",
    blurb: "High inclination, near-miss trajectory",
    params: {
      inclination: 45,
      distMul: 0.7,
      speedMul: 1.15,
      hoursPerSecond: 30,
    },
  },
];
