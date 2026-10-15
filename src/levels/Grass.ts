import { Color3, Effect, Matrix, Mesh, Quaternion, ShaderMaterial, Vector3, VertexData } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { rng } from './Materials';

const VERT = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 world0; attribute vec4 world1; attribute vec4 world2; attribute vec4 world3;
attribute vec4 instanceColor;
uniform mat4 viewProjection; uniform mat4 view; uniform float time; uniform float wind;
varying vec2 vUV; varying vec4 vColor; varying float vDist;
void main() {
  mat4 world = mat4(world0, world1, world2, world3);
  vec4 wp = world * vec4(position, 1.0);
  float h = uv.y;
  float hs = length(world1.xyz);
  float s1 = sin(time * 1.3 + wp.x * 0.23 + wp.z * 0.17);
  float s2 = sin(time * 2.7 + wp.x * 0.7 + wp.z * 0.5);
  float bend = h * h * hs * 0.09 * wind;
  wp.x += (s1 * 0.8 + s2 * 0.25) * bend;
  wp.z += (s1 * 0.4 - s2 * 0.2) * bend;
  vec4 vp = view * wp;
  vDist = length(vp.xyz);
  vUV = uv; vColor = instanceColor;
  gl_Position = viewProjection * wp;
}`;
const FRAG = `
precision highp float;
varying vec2 vUV; varying vec4 vColor; varying float vDist;
uniform vec3 fogColor; uniform float fogDensity; uniform float manualTone;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
void main() {
  float t = vUV.y;
  vec3 base = vColor.rgb * 0.38;
  vec3 tip = vColor.rgb * 1.25 + vec3(0.10, 0.12, 0.0);
  vec3 c = mix(base, tip, smoothstep(0.0, 1.0, t));
  c *= 0.85 + 0.3 * smoothstep(0.35, 0.5, abs(vUV.x - 0.5) * 2.0 + 0.4);
  c += vec3(0.07, 0.06, 0.0) * pow(t, 4.0);
  if (manualTone > 0.5) c = pow(aces(c * 1.1), vec3(1.0/2.2));
  float f = 1.0 - exp(-pow(fogDensity * vDist, 2.0));
  gl_FragColor = vec4(mix(c, fogColor, clamp(f, 0.0, 1.0)), 1.0);
}`;

export interface GrassOptions { avoid?: (x: number, z: number) => boolean; max: number; bounds: [number, number, number, number]; safe: { x: number; z: number; r: number }[]; wallZ: number }

/** Relva instanciada com balanço pelo vento (shader próprio). */
export class Grass {
  readonly mesh: Mesh;
  readonly material: ShaderMaterial;

  constructor(scene: Scene, world: CollisionWorld, opt: GrassOptions) {
    Effect.ShadersStore['grassVertexShader'] = VERT;
    Effect.ShadersStore['grassFragmentShader'] = FRAG;
    this.material = new ShaderMaterial('grass', scene, 'grass', {
      attributes: ['position', 'uv', 'world0', 'world1', 'world2', 'world3', 'instanceColor'],
      uniforms: ['viewProjection', 'view', 'time', 'wind', 'fogColor', 'fogDensity', 'manualTone'],
    });
    this.material.backFaceCulling = false;
    this.material.setFloat('time', 0);
    this.material.setFloat('wind', 1);
    this.material.setColor3('fogColor', scene.fogColor);
    this.material.setFloat('fogDensity', scene.fogDensity);
    this.material.setFloat('manualTone', 1);

    // Lâmina unitária: 4 segmentos, afilada, levemente curvada
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], nor: number[] = [];
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const w = 0.5 * (1 - Math.pow(t, 1.6)) + (i === rows - 1 ? 0 : 0.0);
      const z = t * t * 0.18;
      pos.push(-w, t, z, w, t, z); uv.push(0, t, 1, t); nor.push(0, 0, -1, 0, 0, -1);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const blade = new Mesh('blade', scene);
    const vd = new VertexData(); vd.positions = pos; vd.uvs = uv; vd.indices = idx; vd.normals = nor; vd.applyToMesh(blade);
    blade.material = this.material;
    blade.alwaysSelectAsActiveMesh = true;
    blade.isPickable = false;
    this.mesh = blade;

    const r = rng(2024);
    const [minX, maxX, minZ, maxZ] = opt.bounds;
    const mats = new Float32Array(opt.max * 16);
    const cols = new Float32Array(opt.max * 4);
    const palette = [new Color3(0.22, 0.5, 0.16), new Color3(0.3, 0.58, 0.18), new Color3(0.18, 0.42, 0.2), new Color3(0.42, 0.6, 0.2), new Color3(0.26, 0.5, 0.3)];
    let n = 0, guard = 0;
    const m = new Matrix(), q = new Quaternion(), sc = new Vector3(), tr = new Vector3();
    while (n < opt.max && guard++ < opt.max * 20) {
      const x = minX + r() * (maxX - minX), z = minZ + r() * (maxZ - minZ);
      const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z);
      const nearWall = Math.abs(z - opt.wallZ) < 5;
      let tall = 0;
      if (edge < 9 || nearWall) tall = 1; else if (r() < 0.06) tall = 0.35;
      // densidade: muito mais lâminas nas bordas
      if (tall === 0 && r() < 0.25) continue;
      if (opt.avoid?.(x, z)) continue;
      if (opt.safe.some((s) => Math.hypot(x - s.x, z - s.z) < s.r)) continue;
      if (world.shapes.some((s) => (s.kind === 'cyl' ? Math.hypot(x - s.x, z - s.z) < s.r + 0.4 : Math.hypot(x - s.x, z - s.z) < Math.max(s.hx, s.hz) + 0.4) && s.yBase < 1)) continue;
      // Perto da muralha da folha-portão só no corredor central não aparece (hedge denso nos lados)
      if (nearWall && Math.abs(x) < 6) continue;
      const height = tall === 1 ? 7 + r() * (nearWall ? 14 : 10) : tall > 0 ? 3 + r() * 4 : 0.5 + r() * 1.8;
      const width = 0.1 + r() * 0.14 + height * 0.014;
      Quaternion.RotationYawPitchRollToRef(r() * Math.PI * 2, (r() - 0.5) * 0.25, 0, q);
      sc.set(width, height, 1); tr.set(x, 0, z);
      Matrix.ComposeToRef(sc, q, tr, m);
      m.copyToArray(mats, n * 16);
      const c = palette[Math.floor(r() * palette.length)], v = 0.85 + r() * 0.3;
      cols[n * 4] = c.r * v; cols[n * 4 + 1] = c.g * v; cols[n * 4 + 2] = c.b * v; cols[n * 4 + 3] = 1;
      n++;
    }
    blade.thinInstanceSetBuffer('matrix', mats.subarray(0, n * 16), 16, true);
    blade.thinInstanceSetBuffer('instanceColor', cols.subarray(0, n * 4), 4, true);
    this.total = n;
  }
  total = 0;

  setFog(color: Color3, density: number): void { this.material.setColor3('fogColor', color); this.material.setFloat('fogDensity', density); }
  /** Intensidade do vento nas lâminas (1 = brisa; ~3 = tempestade). */
  setWind(w: number): void { this.material.setFloat('wind', w); }
  setCount(n: number): void { this.mesh.thinInstanceCount = Math.min(n, this.total); }
  update(time: number, manualTone: boolean): void {
    this.material.setFloat('time', time);
    this.material.setFloat('manualTone', manualTone ? 1 : 0);
  }
}
