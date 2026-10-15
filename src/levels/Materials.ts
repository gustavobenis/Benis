import { Color3, DynamicTexture, FresnelParameters, PBRMaterial, StandardMaterial, Texture } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';

/** Gerador de números pseudoaleatórios determinístico (mesma mata em toda partida). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function tex(scene: Scene, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, repeat?: [number, number]): DynamicTexture {
  const t = new DynamicTexture('t', { width: size, height: size }, scene, true);
  const ctx = t.getContext() as CanvasRenderingContext2D;
  draw(ctx, size);
  t.update();
  t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE;
  if (repeat) { t.uScale = repeat[0]; t.vScale = repeat[1]; }
  t.anisotropicFilteringLevel = 4;
  return t;
}

function speckle(c: CanvasRenderingContext2D, s: number, n: number, colors: string[], rmin: number, rmax: number, rand: () => number): void {
  for (let i = 0; i < n; i++) {
    c.fillStyle = colors[Math.floor(rand() * colors.length)];
    c.globalAlpha = 0.15 + rand() * 0.5;
    const r = rmin + rand() * (rmax - rmin);
    c.beginPath(); c.arc(rand() * s, rand() * s, r, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

export class Materials {
  soil: PBRMaterial; stone: PBRMaterial; bark: PBRMaterial; mushCap: PBRMaterial; mushStem: PBRMaterial;
  shell: PBRMaterial; black: PBRMaterial; white: PBRMaterial; snailBody: PBRMaterial; snailShell: PBRMaterial;
  dew: StandardMaterial; water: StandardMaterial; glow: StandardMaterial; seed: PBRMaterial;
  leaves: PBRMaterial[] = [];

  constructor(private scene: Scene) {
    const r = rng(7);
    // Solo: terra úmida com cascalho e pedacinhos de folha
    this.soil = this.pbr('soil', new Color3(1, 1, 1), 0.95);
    this.soil.albedoTexture = tex(scene, 1024, (c, s) => {
      c.fillStyle = '#5b4630'; c.fillRect(0, 0, s, s);
      speckle(c, s, 2600, ['#4a3827', '#6d553a', '#3d2f20', '#7a6244', '#58652f'], 1, 5, r);
      speckle(c, s, 160, ['#8a8a7e', '#6e6e63'], 3, 8, r);
      speckle(c, s, 90, ['#4f7a35', '#3f6a2c'], 4, 10, r);
    }, [34, 52]);

    this.stone = this.pbr('stone', new Color3(1, 1, 1), 0.85);
    this.stone.albedoTexture = tex(scene, 512, (c, s) => {
      c.fillStyle = '#8b8a80'; c.fillRect(0, 0, s, s);
      speckle(c, s, 900, ['#6f6e66', '#a09f94', '#77766c', '#5b6b4a'], 2, 16, r);
      speckle(c, s, 60, ['#5f8a3d'], 10, 26, r);
    }, [2, 2]);

    this.bark = this.pbr('bark', new Color3(1, 1, 1), 0.9);
    this.bark.albedoTexture = tex(scene, 512, (c, s) => {
      c.fillStyle = '#6a4d33'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 90; i++) { c.strokeStyle = r() > 0.5 ? '#4d3724' : '#82633f'; c.lineWidth = 1 + r() * 4; c.globalAlpha = 0.6; c.beginPath(); const x = r() * s; c.moveTo(x, 0); c.bezierCurveTo(x + 20, s / 3, x - 20, (2 * s) / 3, x + 8, s); c.stroke(); }
      c.globalAlpha = 1;
    }, [1, 3]);

    this.mushCap = this.pbr('cap', new Color3(1, 1, 1), 0.55);
    this.mushCap.albedoTexture = tex(scene, 512, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s * 0.7);
      g.addColorStop(0, '#e2552f'); g.addColorStop(1, '#b02a22');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
      c.fillStyle = '#fff3dc';
      for (let i = 0; i < 46; i++) { c.globalAlpha = 0.9; c.beginPath(); c.arc(r() * s, r() * s, 6 + r() * 16, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    });
    this.mushStem = this.pbr('stem', new Color3(0.93, 0.88, 0.76), 0.7);

    // Folhas: 3 variações de tom com nervuras
    const tints = ['#3f8f3a', '#4f9d3f', '#2f7a3c'];
    for (let i = 0; i < tints.length; i++) {
      const m = this.pbr('leaf' + i, new Color3(1, 1, 1), 0.5);
      m.albedoTexture = tex(scene, 512, (c, s) => {
        const g = c.createLinearGradient(0, 0, 0, s); g.addColorStop(0, tints[i]); g.addColorStop(1, '#255f2f');
        c.fillStyle = g; c.fillRect(0, 0, s, s);
        c.strokeStyle = 'rgba(210,240,150,0.55)'; c.lineWidth = 7;
        c.beginPath(); c.moveTo(s / 2, 0); c.lineTo(s / 2, s); c.stroke();
        c.lineWidth = 3;
        for (let k = 1; k < 12; k++) {
          const y = (k / 12) * s;
          c.beginPath(); c.moveTo(s / 2, y); c.quadraticCurveTo(s * 0.75, y + s * 0.02, s * 0.98, y + s * 0.12); c.stroke();
          c.beginPath(); c.moveTo(s / 2, y); c.quadraticCurveTo(s * 0.25, y + s * 0.02, s * 0.02, y + s * 0.12); c.stroke();
        }
        speckle(c, s, 220, ['#1f5a2b', '#5fb04a', '#8fcf5a'], 1, 6, r);
      });
      m.backFaceCulling = false; m.twoSidedLighting = true;
      this.leaves.push(m);
    }

    // Marieta
    this.shell = this.pbr('shell', new Color3(0.86, 0.1, 0.13), 0.22);
    this.shell.clearCoat.isEnabled = true; this.shell.clearCoat.intensity = 1; this.shell.clearCoat.roughness = 0.04;
    this.black = this.pbr('black', new Color3(0.03, 0.03, 0.04), 0.35);
    this.white = this.pbr('white', new Color3(0.97, 0.97, 0.95), 0.2);
    this.snailBody = this.pbr('snailBody', new Color3(0.82, 0.72, 0.5), 0.6);
    this.snailShell = this.pbr('snailShell', new Color3(1, 1, 1), 0.4);
    this.snailShell.albedoTexture = tex(scene, 256, (c, s) => {
      c.fillStyle = '#9a6a3a'; c.fillRect(0, 0, s, s);
      c.strokeStyle = '#5e3a1e'; c.lineWidth = 12;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, (i + 0.5) * (s / 6)); c.bezierCurveTo(s * 0.3, (i + 0.1) * (s / 6), s * 0.7, (i + 0.9) * (s / 6), s, (i + 0.5) * (s / 6)); c.stroke(); }
    });
    this.seed = this.pbr('seed', new Color3(0.55, 0.34, 0.14), 0.4);

    // Gota de orvalho: translúcida com brilho de borda (fresnel)
    this.dew = new StandardMaterial('dew', scene);
    this.dew.diffuseColor = new Color3(0.55, 0.85, 0.95);
    this.dew.emissiveColor = new Color3(0.12, 0.3, 0.36);
    this.dew.specularColor = new Color3(1, 1, 1); this.dew.specularPower = 160;
    this.dew.alpha = 0.55;
    this.dew.emissiveFresnelParameters = new FresnelParameters({ bias: 0.25, power: 2, leftColor: new Color3(0.05, 0.15, 0.2), rightColor: new Color3(0.8, 1, 1) });
    this.dew.opacityFresnelParameters = new FresnelParameters({ bias: 0.3, power: 1.5, leftColor: Color3.White(), rightColor: new Color3(0.4, 0.4, 0.4) });

    this.water = new StandardMaterial('water', scene);
    this.water.diffuseColor = new Color3(0.2, 0.45, 0.5); this.water.specularColor = new Color3(1, 1, 0.9); this.water.specularPower = 90;
    this.water.alpha = 0.6; this.water.emissiveColor = new Color3(0.05, 0.14, 0.17);

    this.glow = new StandardMaterial('glow', scene);
    this.glow.emissiveColor = new Color3(1, 0.85, 0.4); this.glow.disableLighting = true; this.glow.alpha = 0.55;
  }

  private pbr(name: string, albedo: Color3, rough: number): PBRMaterial {
    const m = new PBRMaterial(name, this.scene);
    m.albedoColor = albedo; m.metallic = 0; m.roughness = rough;
    m.environmentIntensity = 0.9;
    return m;
  }
}
