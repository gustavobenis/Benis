import {
  ColorCurves, SSAO2RenderingPipeline, Color3, Color4, DefaultRenderingPipeline, DirectionalLight, DynamicTexture, HemisphericLight, MeshBuilder, ParticleSystem, ReflectionProbe,
  RenderTargetTexture, Scene, ShadowGenerator, StandardMaterial, Texture, Vector3,
} from '@babylonjs/core';
import type { Camera, Mesh } from '@babylonjs/core';
import type { QualityProfile } from '../engine/Quality';

/** Ajustes de iluminação por fase. */
export interface LightPreset {
  dir: [number, number, number]; sun: [number, number, number]; sunI: number;
  sky: [number, number, number]; ground: [number, number, number]; hemiI: number;
  exposure: number; contrast: number; saturation: number; shadowHue?: number;
}

/** Céu, luz solar, sombras, névoa, partículas atmosféricas e pós-processamento. */
export class Environment {
  readonly sun: DirectionalLight;
  readonly shadows: ShadowGenerator;
  readonly sky: Mesh;
  private pollen: ParticleSystem;
  private follow = new Vector3();
  private pipeline: DefaultRenderingPipeline | null = null;
  private probe!: ReflectionProbe;
  private shafts: StandardMaterial[] = [];
  private shaftMeshes: Mesh[] = [];
  private shaftTex!: DynamicTexture;
  private dir = new Vector3(-0.45, -0.72, 0.5).normalize();
  private hemi!: HemisphericLight;
  private ssao: SSAO2RenderingPipeline | null = null;
  private rain: ParticleSystem | null = null;
  private rainAmount = 0; private rainRate = 400;
  private baseExposure = 1.15;
  private t = 0;

  constructor(private scene: Scene, private camera: Camera) {
    scene.clearColor = new Color4(0.78, 0.86, 0.7, 1);
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.76, 0.84, 0.66);
    scene.fogDensity = 0.0105;
    scene.ambientColor = new Color3(0.3, 0.35, 0.3);
    const ip = scene.imageProcessingConfiguration;
    ip.toneMappingEnabled = true; ip.toneMappingType = 1; // ACES
    ip.exposure = 1.15; ip.contrast = 1.18;

    const hemi = this.hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.75; hemi.diffuse = new Color3(0.85, 0.95, 1); hemi.groundColor = new Color3(0.3, 0.38, 0.2);
    this.sun = new DirectionalLight('sun', this.dir.clone(), scene);
    this.sun.intensity = 3.2; this.sun.diffuse = new Color3(1, 0.93, 0.78); this.sun.specular = new Color3(1, 0.95, 0.85);
    this.sun.autoUpdateExtends = false;
    this.sun.orthoLeft = -50; this.sun.orthoRight = 50; this.sun.orthoTop = 50; this.sun.orthoBottom = -50;
    this.sun.shadowMinZ = 1; this.sun.shadowMaxZ = 260;

    this.shadows = new ShadowGenerator(2048, this.sun);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = 0.0008; this.shadows.normalBias = 0.03; this.shadows.setDarkness(0.25);

    // Céu em gradiente
    const sky = MeshBuilder.CreateSphere('sky', { diameter: 900, segments: 16, sideOrientation: 1 }, scene);
    const mat = new StandardMaterial('skyMat', scene);
    const tex = new DynamicTexture('skyTex', { width: 8, height: 512 }, scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#6fa9d6'); g.addColorStop(0.42, '#a9d3dd'); g.addColorStop(0.5, '#f4e6b8'); g.addColorStop(0.56, '#dfe8b8'); g.addColorStop(1, '#6a8b4e');
    c.fillStyle = g; c.fillRect(0, 0, 8, 512); tex.update();
    mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false; mat.fogEnabled = false;
    sky.material = mat; sky.infiniteDistance = true; sky.isPickable = false;
    this.sky = sky;

    // Partículas de pólen / poeira dourada
    const dot = new DynamicTexture('dot', { width: 64, height: 64 }, scene, false);
    const dc = dot.getContext() as CanvasRenderingContext2D;
    const rg = dc.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,245,200,1)'); rg.addColorStop(0.4, 'rgba(255,230,150,0.5)'); rg.addColorStop(1, 'rgba(255,230,150,0)');
    dc.fillStyle = rg; dc.fillRect(0, 0, 64, 64); dot.update();
    const ps = new ParticleSystem('pollen', 240, scene);
    ps.particleTexture = dot as unknown as Texture;
    ps.emitter = this.follow;
    ps.minEmitBox = new Vector3(-26, 0.3, -26); ps.maxEmitBox = new Vector3(26, 12, 26);
    ps.minLifeTime = 5; ps.maxLifeTime = 9; ps.emitRate = 40;
    ps.minSize = 0.08; ps.maxSize = 0.26;
    ps.color1 = new Color4(1, 0.95, 0.6, 0.9); ps.color2 = new Color4(1, 0.85, 0.5, 0.7); ps.colorDead = new Color4(1, 0.9, 0.6, 0);
    ps.direction1 = new Vector3(-0.3, 0.1, -0.3); ps.direction2 = new Vector3(0.3, 0.35, 0.3);
    ps.minEmitPower = 0.2; ps.maxEmitPower = 0.7; ps.gravity = new Vector3(0.1, 0.02, 0.05);
    ps.blendMode = ParticleSystem.BLENDMODE_ADD; ps.start();
    this.pollen = ps;
    this.buildProbe();
  }

  /** Probe de reflexo (só o céu) para brilho das carapaças e gotas: IBL procedural. */
  private buildProbe(): void {
    this.probe = new ReflectionProbe('probe', 128, this.scene);
    this.probe.renderList!.push(this.sky);
    this.probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.probe.position.set(0, 3, 0);
    // Só liga como ambiente depois do primeiro render do cubo: evita "feedback loop" (ler e escrever a mesma textura).
    const cube = this.probe.cubeTexture;
    cube.onAfterRenderObservable.addOnce(() => {
      this.scene.environmentTexture = cube;
      this.scene.environmentIntensity = 0.85;
    });
  }

  /** Luz solar, ambiente e gradação de cor de cada fase (hora do dia e clima). */
  setLighting(l: LightPreset): void {
    this.dir = new Vector3(...l.dir).normalize();
    this.sun.direction.copyFrom(this.dir);
    this.sun.diffuse = new Color3(...l.sun); this.sun.intensity = l.sunI;
    this.hemi.intensity = l.hemiI; this.hemi.diffuse = new Color3(...l.sky); this.hemi.groundColor = new Color3(...l.ground);
    const ip = this.scene.imageProcessingConfiguration;
    ip.exposure = l.exposure; this.baseExposure = l.exposure; ip.contrast = l.contrast;
    ip.colorCurvesEnabled = true;
    const cc = new ColorCurves(); cc.globalSaturation = l.saturation; cc.shadowsHue = l.shadowHue ?? 220; cc.shadowsSaturation = l.shadowHue ? 25 : 0; ip.colorCurves = cc;
  }

  /** Chuva (0 = sem chuva). Reaproveita um único sistema de partículas que acompanha Marieta. */
  setRain(amount: number): void {
    this.rainAmount = amount;
    if (amount <= 0) { this.rain?.stop(); return; }
    if (!this.rain) {
      const tex = new DynamicTexture('drop', { width: 8, height: 64 }, this.scene, false);
      const c = tex.getContext() as CanvasRenderingContext2D;
      const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(200,225,255,0)'); g.addColorStop(1, 'rgba(210,230,255,0.9)');
      c.fillStyle = g; c.fillRect(3, 0, 2, 64); tex.update();
      const ps = new ParticleSystem('rain', 2200, this.scene);
      ps.particleTexture = tex as unknown as Texture; ps.emitter = this.follow;
      ps.minEmitBox = new Vector3(-28, 22, -28); ps.maxEmitBox = new Vector3(28, 24, 28);
      ps.direction1 = new Vector3(-0.15, -1, 0.05); ps.direction2 = new Vector3(-0.05, -1, 0.15);
      ps.minEmitPower = 42; ps.maxEmitPower = 55; ps.minLifeTime = 0.55; ps.maxLifeTime = 0.6;
      ps.minSize = 0.5; ps.maxSize = 1.2; ps.minScaleY = 7; ps.maxScaleY = 11;
      ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
      ps.color1 = new Color4(0.8, 0.9, 1, 0.55); ps.color2 = new Color4(0.7, 0.82, 1, 0.4); ps.colorDead = new Color4(0.7, 0.8, 1, 0);
      ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
      this.rain = ps;
    }
    this.rain.emitRate = this.rainRate * amount;
    this.rain.start();
  }
  /** Relâmpago: clareia a cena brevemente (0..1). */
  setFlash(v: number): void { this.scene.imageProcessingConfiguration.exposure = this.baseExposure + 2.2 * v; }

  /** Névoa e cor de fundo de cada fase. */
  setAtmosphere(color: [number, number, number], density: number): void {
    this.scene.fogColor = new Color3(...color);
    this.scene.fogDensity = density;
    this.scene.clearColor = new Color4(color[0], color[1], color[2], 1);
  }

  /** Feixes de luz de cada fase. */
  setShafts(spots: [number, number][]): void {
    for (const m of this.shaftMeshes) m.dispose(false, true);
    this.shaftMeshes = []; this.shafts = [];
    if (!this.shaftTex) {
      const tex = new DynamicTexture('shaft', { width: 64, height: 256 }, this.scene, false);
      const c = tex.getContext() as CanvasRenderingContext2D;
      const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,240,190,0.9)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 256);
      const h = c.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 64, 256); tex.update();
      this.shaftTex = tex;
    }
    spots.forEach(([x, z], i) => {
      const m = new StandardMaterial('shaftM' + i, this.scene);
      m.emissiveColor = new Color3(1, 0.93, 0.7); m.opacityTexture = this.shaftTex; m.disableLighting = true; m.backFaceCulling = false;
      m.alpha = 0.16; m.alphaMode = 1; m.fogEnabled = false;
      const p = MeshBuilder.CreatePlane('shaft', { width: 7, height: 46 }, this.scene);
      p.material = m; p.isPickable = false; p.position.set(x, 22, z);
      p.rotation.set(0.45, i * 1.1, 0.35);
      this.shafts.push(m); this.shaftMeshes.push(p);
    });
  }

  applyQuality(q: QualityProfile, engineScale: (n: number) => void): void {
    engineScale(q.scaling);
    this.sun.setEnabled(true);
    this.shadows.getShadowMap()!.refreshRate = q.shadows ? RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    if (!q.shadows) { this.shadows.getShadowMap()!.renderList = []; }
    this.pollen.emitRate = Math.round(q.particles / 6);
    this.rainRate = q.level === 'high' ? 1800 : q.level === 'balanced' ? 1000 : 450;
    if (this.rain && this.rainAmount > 0) this.rain.emitRate = this.rainRate * this.rainAmount;
    this.pollen.manualEmitCount = 0;
    if (q.postFx) {
      if (!this.pipeline) this.pipeline = new DefaultRenderingPipeline('dr', true, this.scene, [this.camera]);
      this.pipeline.fxaaEnabled = q.msaa === 0;
      this.pipeline.samples = q.msaa || 1;
      this.pipeline.bloomEnabled = true; this.pipeline.bloomThreshold = 0.85; this.pipeline.bloomWeight = q.level === 'high' ? 0.3 : 0.18; this.pipeline.bloomKernel = 48;
      this.pipeline.imageProcessingEnabled = true;
    } else if (this.pipeline) { this.pipeline.dispose(); this.pipeline = null; }
    // Oclusão ambiente em tela: só no perfil alto (custo extra)
    if (q.level === 'high' && !this.ssao) {
      try {
        this.ssao = new SSAO2RenderingPipeline('ssao', this.scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [this.camera]);
        this.ssao.radius = 2.2; this.ssao.totalStrength = 0.9; this.ssao.samples = 12; this.ssao.expensiveBlur = false;
      } catch (e) { console.warn('[gfx] SSAO indisponível', e); this.ssao = null; }
    } else if (q.level !== 'high' && this.ssao) { this.ssao.dispose(); this.ssao = null; }
  }
  get hasPipeline(): boolean { return !!this.pipeline; }

  update(dt: number, focus: Vector3): void {
    this.t += dt;
    this.follow.copyFrom(focus);
    // A janela de sombras segue o jogador (mapa nítido onde importa)
    this.sun.position.set(focus.x - this.dir.x * 110, focus.y - this.dir.y * 110, focus.z - this.dir.z * 110);
    this.sun.setDirectionToTarget(focus);
    this.shafts.forEach((m, i) => { m.alpha = 0.1 + 0.07 * Math.sin(this.t * 0.4 + i * 1.7); });
  }

  /** Efeito de observação: contraste e vinheta suaves. */
  setObserve(on: boolean): void {
    const ip = this.scene.imageProcessingConfiguration;
    ip.vignetteEnabled = on; ip.vignetteWeight = 2.2; ip.vignetteColor = new Color4(0.05, 0.12, 0.2, 0);
  }
}
