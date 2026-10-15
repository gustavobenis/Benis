import {
  Color3, Color4, DefaultRenderingPipeline, DirectionalLight, DynamicTexture, HemisphericLight, MeshBuilder, ParticleSystem, ReflectionProbe,
  RenderTargetTexture, Scene, ShadowGenerator, StandardMaterial, Texture, Vector3,
} from '@babylonjs/core';
import type { AbstractMesh, Camera, Mesh } from '@babylonjs/core';
import type { QualityProfile } from '../engine/Quality';

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
  private dir = new Vector3(-0.45, -0.72, 0.5).normalize();
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

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), scene);
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
    this.buildShafts();
  }

  /** Probe de reflexo para brilho das carapaças e gotas (IBL procedural). Chamar após construir o nível. */
  buildProbe(renderList: AbstractMesh[]): void {
    this.probe = new ReflectionProbe('probe', 128, this.scene);
    this.probe.renderList!.push(this.sky, ...renderList);
    this.probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.probe.position.set(0, 3, -90);
    // Só liga como ambiente depois do primeiro render do cubo: evita "feedback loop" (ler e escrever a mesma textura).
    const cube = this.probe.cubeTexture;
    cube.onAfterRenderObservable.addOnce(() => {
      this.scene.environmentTexture = cube;
      this.scene.environmentIntensity = 0.85;
    });
  }

  private buildShafts(): void {
    const tex = new DynamicTexture('shaft', { width: 64, height: 256 }, this.scene, false);
    const c = tex.getContext() as CanvasRenderingContext2D;
    const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,240,190,0.9)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 256);
    const h = c.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 64, 256); tex.update();
    const spots: [number, number, number][] = [[-6, -80, 0], [14, -62, 1], [-12, -38, 2], [8, 20, 3], [-2, 62, 4], [10, 86, 5]];
    for (const [x, z, i] of spots) {
      const m = new StandardMaterial('shaftM' + i, this.scene);
      m.emissiveColor = new Color3(1, 0.93, 0.7); m.opacityTexture = tex; m.disableLighting = true; m.backFaceCulling = false;
      m.alpha = 0.16; m.alphaMode = 1; m.fogEnabled = false;
      const p = MeshBuilder.CreatePlane('shaft', { width: 7, height: 46 }, this.scene);
      p.material = m; p.isPickable = false;
      p.position.set(x, 22, z);
      p.rotation.set(Math.atan2(-this.dir.z, 1) * 0.9, Math.atan2(this.dir.x, this.dir.z) + 0.3 * i, 0.5);
      p.rotation.x = 0.45; p.rotation.z = 0.35; p.rotation.y = i * 1.1;
      this.shafts.push(m);
    }
  }

  applyQuality(q: QualityProfile, engineScale: (n: number) => void): void {
    engineScale(q.scaling);
    this.sun.setEnabled(true);
    this.shadows.getShadowMap()!.refreshRate = q.shadows ? RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME : RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    if (!q.shadows) { this.shadows.getShadowMap()!.renderList = []; }
    this.pollen.emitRate = Math.round(q.particles / 6);
    this.pollen.manualEmitCount = 0;
    if (q.postFx) {
      if (!this.pipeline) this.pipeline = new DefaultRenderingPipeline('dr', true, this.scene, [this.camera]);
      this.pipeline.fxaaEnabled = q.msaa === 0;
      this.pipeline.samples = q.msaa || 1;
      this.pipeline.bloomEnabled = true; this.pipeline.bloomThreshold = 0.85; this.pipeline.bloomWeight = q.level === 'high' ? 0.3 : 0.18; this.pipeline.bloomKernel = 48;
      this.pipeline.imageProcessingEnabled = true;
    } else if (this.pipeline) { this.pipeline.dispose(); this.pipeline = null; }
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
