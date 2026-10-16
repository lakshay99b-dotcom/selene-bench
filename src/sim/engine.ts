import * as THREE from "three";
import {
  DEFAULT_PARAMS,
  REAL,
  SUN_DIST,
  type LabParams,
} from "./constants";
import {
  classifyEclipse,
  computeMetrics,
  earthRadius,
  moonRadius,
  seedState,
  stepBodies,
  sunDirection,
  type EclipseInfo,
  type OrbitalMetrics,
  type SimState,
  type V3,
} from "./physics";
import {
  EARTH_VERT, EARTH_FRAG, MOON_VERT, MOON_FRAG,
  ATM_VERT, ATM_FRAG, SUN_VERT, SUN_FRAG, CONE_VERT, CONE_FRAG,
} from "./shaders";

export type CameraMode = "system" | "earth" | "moon" | "totality" | "chase" | "impact";

export type HudSnapshot = {
  metrics: OrbitalMetrics;
  eclipse: EclipseInfo;
  elapsedH: number;
  impacted: boolean;
  impactSpeed: number;
  paused: boolean;
  cameraMode: CameraMode;
};

export class SeleneEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private earthMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;
  private atmMesh!: THREE.Mesh;
  private sunMesh!: THREE.Mesh;
  private umbraCone!: THREE.Mesh;
  private penumbraCone!: THREE.Mesh;
  private trail: THREE.Line;
  private trailGeo: THREE.BufferGeometry;
  private trailPositions: Float32Array;
  private trailIdx = 0;
  private debris: THREE.Points | null = null;
  private debrisVel: Float32Array | null = null;
  private stars!: THREE.Points;
  private earthMat!: THREE.ShaderMaterial;
  private moonMat!: THREE.ShaderMaterial;
  private atmMat!: THREE.ShaderMaterial;
  private sunMat!: THREE.ShaderMaterial;
  state: SimState;
  params: LabParams = { ...DEFAULT_PARAMS };
  paused = false;
  cameraMode: CameraMode = "system";
  private clock = new THREE.Clock();
  private animId = 0;
  private container: HTMLElement;
  private onHud?: (h: HudSnapshot) => void;
  private yaw = 0.6;
  private pitch = 0.35;
  private distance = 900000;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private impactPhase = 0;
  private impactT = 0;
  private flash = 0;
  private scar = 0;
  private scarDir = new THREE.Vector3(1, 0, 0);
  private muted = true;
  private audioCtx: AudioContext | null = null;

  constructor(container: HTMLElement, onHud?: (h: HudSnapshot) => void) {
    this.container = container;
    this.onHud = onHud;
    this.state = seedState(this.params);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x02040a, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 50, 2e8);
    this.buildScene();
    this.bindInput();
    this.trailPositions = new Float32Array(3500 * 3);
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trail = new THREE.Line(this.trailGeo, new THREE.LineBasicMaterial({ color: 0xc8b48a, transparent: true, opacity: 0.45 }));
    this.scene.add(this.trail);
    window.addEventListener("resize", this.onResize);
    this.animId = requestAnimationFrame(this.loop);
  }

  private buildScene() {
    const starN = 4000;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 4e7 + Math.random() * 8e7;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaabbff, size: 1.2, sizeAttenuation: false }));
    this.scene.add(this.stars);
    const sphere = new THREE.SphereGeometry(1, 96, 64);
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uMoonPos: { value: new THREE.Vector3() },
        uMoonRad: { value: REAL.R_MOON },
        uEarthRad: { value: REAL.R_EARTH },
        uTime: { value: 0 },
        uScar: { value: 0 },
        uScarDir: { value: new THREE.Vector3(1, 0, 0) },
      },
    });
    this.earthMesh = new THREE.Mesh(sphere, this.earthMat);
    this.scene.add(this.earthMesh);
    this.atmMat = new THREE.ShaderMaterial({
      vertexShader: ATM_VERT, fragmentShader: ATM_FRAG,
      uniforms: { uSunDir: { value: new THREE.Vector3(1, 0, 0) } },
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    });
    this.atmMesh = new THREE.Mesh(sphere, this.atmMat);
    this.scene.add(this.atmMesh);
    this.moonMat = new THREE.ShaderMaterial({
      vertexShader: MOON_VERT, fragmentShader: MOON_FRAG,
      uniforms: { uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uEclipse: { value: 0 }, uTime: { value: 0 } },
    });
    this.moonMesh = new THREE.Mesh(sphere, this.moonMat);
    this.scene.add(this.moonMesh);
    this.sunMat = new THREE.ShaderMaterial({
      vertexShader: SUN_VERT, fragmentShader: SUN_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.sunMat);
    this.scene.add(this.sunMesh);
    const coneGeo = new THREE.CylinderGeometry(1, 0.01, 1, 32, 1, true);
    coneGeo.translate(0, 0.5, 0);
    coneGeo.rotateX(-Math.PI / 2);
    this.umbraCone = new THREE.Mesh(coneGeo, new THREE.ShaderMaterial({
      vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0.1, 0.05, 0.2) }, uOpacity: { value: 0.35 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.penumbraCone = new THREE.Mesh(coneGeo.clone(), new THREE.ShaderMaterial({
      vertexShader: CONE_VERT, fragmentShader: CONE_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0.15, 0.1, 0.25) }, uOpacity: { value: 0.18 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.scene.add(this.umbraCone, this.penumbraCone);
  }

  private bindInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", (e) => {
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX; const dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.yaw -= dx * 0.005;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + dy * 0.005));
    });
    el.addEventListener("pointerup", () => { this.dragging = false; });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.distance *= e.deltaY > 0 ? 1.12 : 0.89;
      this.distance = Math.max(12000, Math.min(5e7, this.distance));
    }, { passive: false });
  }

  private onResize = () => {
    const w = this.container.clientWidth; const h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  setParams(p: LabParams, reseed = false) {
    this.params = { ...p };
    if (reseed) {
      this.state = seedState(p);
      this.impactPhase = 0; this.flash = 0; this.scar = 0;
      this.trailIdx = 0; this.trailPositions.fill(0);
      if (this.debris) {
        this.scene.remove(this.debris);
        this.debris.geometry.dispose();
        (this.debris.material as THREE.Material).dispose();
        this.debris = null;
      }
    }
  }

  setCameraMode(m: CameraMode) { this.cameraMode = m; }
  togglePause() { this.paused = !this.paused; }
  setMuted(m: boolean) { this.muted = m; }

  private playImpactSound() {
    if (this.muted) return;
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const ctx = this.audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(80, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.2);
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 1.5);
    } catch { /* ignore */ }
  }

  private spawnDebris(pos: V3, speed: number) {
    const n = 400;
    const positions = new Float32Array(n * 3);
    const velocities = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.3 + Math.random() * 0.9);
      velocities[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      velocities[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * s;
      velocities[i * 3 + 2] = Math.cos(ph) * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.debris = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xff8844, size: 800, sizeAttenuation: true, transparent: true, opacity: 0.9,
    }));
    this.debrisVel = velocities;
    this.scene.add(this.debris);
  }

  private updateDebris(dtH: number) {
    if (!this.debris || !this.debrisVel) return;
    const pos = this.debris.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3] += this.debrisVel[i * 3] * dtH;
      arr[i * 3 + 1] += this.debrisVel[i * 3 + 1] * dtH;
      arr[i * 3 + 2] += this.debrisVel[i * 3 + 2] * dtH;
      this.debrisVel[i * 3] *= 0.998;
      this.debrisVel[i * 3 + 1] *= 0.998;
      this.debrisVel[i * 3 + 2] *= 0.998;
    }
    pos.needsUpdate = true;
    const mat = this.debris.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, mat.opacity - dtH * 0.02);
  }

  private updateTrail() {
    const m = this.state.moon.pos;
    const i = this.trailIdx % 3500;
    this.trailPositions[i * 3] = m.x;
    this.trailPositions[i * 3 + 1] = m.y;
    this.trailPositions[i * 3 + 2] = m.z;
    this.trailIdx++;
    (this.trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.trailGeo.setDrawRange(0, Math.min(this.trailIdx, 3500));
  }

  private updateCamera(eclipse: EclipseInfo, metrics: OrbitalMetrics) {
    const e = this.state.earth.pos;
    const m = this.state.moon.pos;
    const mid = { x: (e.x + m.x) * 0.5, y: (e.y + m.y) * 0.5, z: (e.z + m.z) * 0.5 };
    if (this.state.impacted && this.impactPhase === 0) {
      this.impactPhase = 1; this.impactT = 0; this.cameraMode = "impact";
    }
    if (this.cameraMode === "impact" && this.state.impacted) {
      this.impactT += 0.016;
      const ip = this.state.impactPos || m;
      if (this.impactPhase === 1 && this.impactT > 0.8) {
        this.impactPhase = 2; this.flash = 1; this.scar = 1;
        this.scarDir.set(ip.x - e.x, ip.y - e.y, ip.z - e.z).normalize();
        this.playImpactSound();
        if (!this.state.debrisSpawned) {
          this.spawnDebris(ip, this.state.impactSpeed * 0.4);
          this.state.debrisSpawned = true;
        }
      }
      if (this.impactPhase === 2 && this.impactT > 2.5) this.impactPhase = 3;
      const side = new THREE.Vector3(ip.x - e.x, ip.y - e.y, ip.z - e.z).normalize();
      const up = new THREE.Vector3(0, 0, 1);
      const right = new THREE.Vector3().crossVectors(side, up).normalize();
      const dist = this.impactPhase === 1
        ? 45000 + (1 - this.impactT / 0.8) * 80000
        : 28000 + Math.sin(this.impactT) * 5000;
      const shake = this.impactPhase === 2
        ? (Math.random() - 0.5) * 1200 * Math.max(0, 1 - (this.impactT - 0.8)) : 0;
      this.camera.position.set(
        ip.x + right.x * dist + side.x * dist * 0.3 + shake,
        ip.y + right.y * dist + side.y * dist * 0.3 + shake,
        ip.z + right.z * dist + side.z * dist * 0.3 + 8000 + shake
      );
      this.camera.lookAt(ip.x, ip.y, ip.z);
      this.camera.near = 20; this.camera.far = 5e7;
      this.camera.updateProjectionMatrix();
      return;
    }
    const target = new THREE.Vector3();
    let dist = this.distance;
    switch (this.cameraMode) {
      case "earth":
        target.set(e.x, e.y, e.z);
        dist = Math.max(earthRadius(this.params) * 4, this.distance * 0.08);
        break;
      case "moon":
        target.set(m.x, m.y, m.z);
        dist = Math.max(moonRadius(this.params) * 5, this.distance * 0.04);
        break;
      case "totality": {
        const sunD = sunDirection(this.params.sunAzimuth);
        target.set(e.x, e.y, e.z);
        this.camera.position.set(e.x - sunD.x * 25000, e.y - sunD.y * 25000, e.z - sunD.z * 25000 + 3000);
        this.camera.lookAt(e.x + sunD.x * 1e6, e.y + sunD.y * 1e6, e.z);
        this.camera.near = 10; this.camera.far = 3e8;
        this.camera.updateProjectionMatrix();
        return;
      }
      case "chase": {
        target.set(m.x, m.y, m.z);
        const back = new THREE.Vector3(m.x - e.x, m.y - e.y, m.z - e.z).normalize();
        this.camera.position.set(m.x + back.x * 18000, m.y + back.y * 18000, m.z + back.z * 18000 + 4000);
        this.camera.lookAt(m.x, m.y, m.z);
        this.camera.near = 20; this.camera.far = 5e7;
        this.camera.updateProjectionMatrix();
        return;
      }
      default:
        target.set(mid.x, mid.y, mid.z);
        dist = Math.max(metrics.r * 1.8, 120000);
    }
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      target.x + dist * cp * Math.cos(this.yaw),
      target.y + dist * cp * Math.sin(this.yaw),
      target.z + dist * Math.sin(this.pitch)
    );
    this.camera.lookAt(target);
    this.camera.near = Math.max(10, dist * 0.0002);
    this.camera.far = Math.max(1e7, dist * 40);
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    this.animId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = performance.now() * 0.001;
    let simDt = 0;
    if (!this.paused && !this.state.impacted) {
      const rel = {
        x: this.state.moon.pos.x - this.state.earth.pos.x,
        y: this.state.moon.pos.y - this.state.earth.pos.y,
        z: this.state.moon.pos.z - this.state.earth.pos.z,
      };
      const dist = Math.hypot(rel.x, rel.y, rel.z);
      const sumR = earthRadius(this.params) + moonRadius(this.params);
      let rate = this.params.hoursPerSecond;
      if (dist < sumR * 6) rate = Math.min(rate, 3);
      if (dist < sumR * 2.5) rate = Math.min(rate, 0.8);
      simDt = dt * rate;
      this.state = stepBodies(this.state, this.params, simDt);
    } else if (this.state.impacted) {
      simDt = dt * 0.5;
    }
    const metrics = computeMetrics(this.state, this.params);
    const sunDir = sunDirection(this.params.sunAzimuth);
    const eclipse = classifyEclipse(this.state.earth.pos, this.state.moon.pos, sunDir, this.params);
    const rE = earthRadius(this.params);
    const rM = moonRadius(this.params);
    this.earthMesh.position.set(this.state.earth.pos.x, this.state.earth.pos.y, this.state.earth.pos.z);
    this.earthMesh.scale.setScalar(rE);
    this.atmMesh.position.copy(this.earthMesh.position);
    this.atmMesh.scale.setScalar(rE * 1.035);
    this.moonMesh.position.set(this.state.moon.pos.x, this.state.moon.pos.y, this.state.moon.pos.z);
    this.moonMesh.scale.setScalar(rM);
    const sunPos = { x: sunDir.x * SUN_DIST, y: sunDir.y * SUN_DIST, z: sunDir.z * SUN_DIST };
    this.sunMesh.position.set(sunPos.x, sunPos.y, sunPos.z);
    this.sunMesh.scale.setScalar(REAL.SUN_RADIUS * 2.8);
    this.sunMesh.lookAt(this.camera.position);
    const sd = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z);
    this.earthMat.uniforms.uSunDir.value.copy(sd);
    this.earthMat.uniforms.uMoonPos.value.set(
      this.state.moon.pos.x - this.state.earth.pos.x,
      this.state.moon.pos.y - this.state.earth.pos.y,
      this.state.moon.pos.z - this.state.earth.pos.z
    );
    this.earthMat.uniforms.uMoonRad.value = rM;
    this.earthMat.uniforms.uEarthRad.value = rE;
    this.earthMat.uniforms.uTime.value = t;
    this.earthMat.uniforms.uScar.value = this.scar;
    this.earthMat.uniforms.uScarDir.value.copy(this.scarDir);
    this.moonMat.uniforms.uSunDir.value.copy(sd);
    const lunarE = eclipse.type === "lunar-total" ? 1 : eclipse.type === "lunar-partial" ? eclipse.align : 0;
    this.moonMat.uniforms.uEclipse.value = lunarE;
    this.moonMat.uniforms.uTime.value = t;
    this.atmMat.uniforms.uSunDir.value.copy(sd);
    this.sunMat.uniforms.uTime.value = t;
    const umbraLen = eclipse.umbraLen;
    this.umbraCone.position.copy(this.earthMesh.position);
    this.umbraCone.scale.set(rE * 0.95, rE * 0.95, umbraLen);
    this.umbraCone.lookAt(
      this.earthMesh.position.x - sunDir.x * 1e6,
      this.earthMesh.position.y - sunDir.y * 1e6,
      this.earthMesh.position.z - sunDir.z * 1e6
    );
    this.penumbraCone.position.copy(this.earthMesh.position);
    this.penumbraCone.scale.set(rE * 1.6, rE * 1.6, umbraLen * 1.4);
    this.penumbraCone.lookAt(
      this.earthMesh.position.x - sunDir.x * 1e6,
      this.earthMesh.position.y - sunDir.y * 1e6,
      this.earthMesh.position.z - sunDir.z * 1e6
    );
    if (!this.state.impacted) this.updateTrail();
    this.updateDebris(simDt || dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.scar > 0 && this.impactPhase >= 3) this.scar = Math.max(0.35, this.scar - dt * 0.02);
    this.updateCamera(eclipse, metrics);
    this.renderer.render(this.scene, this.camera);
    if (this.onHud && Math.floor(t * 15) !== Math.floor((t - dt) * 15)) {
      this.onHud({
        metrics, eclipse, elapsedH: this.state.elapsedH,
        impacted: this.state.impacted, impactSpeed: this.state.impactSpeed,
        paused: this.paused, cameraMode: this.cameraMode,
      });
    }
    const flashEl = this.container.querySelector(".impact-flash") as HTMLElement | null;
    if (flashEl) flashEl.style.opacity = String(this.flash * 0.85);
  };

  dispose() {
    cancelAnimationFrame(this.animId);
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.container.innerHTML = "";
  }
}
