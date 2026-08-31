import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4, Vector3 } from '@babylonjs/core/Maths/math';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { InputManager } from './InputManager';
import { ArcadeCar, type CarTelemetry } from './ArcadeCar';

export interface GameHudBindings {
  renderer: HTMLElement;
  speed: HTMLElement;
  gear: HTMLElement;
  nitroFill: HTMLElement;
  heatPips: HTMLElement;
}

type QualityTier = 'desktop' | 'mobile-high' | 'mobile-low';

export class NeonPursuitGame {
  private engine: AbstractEngine | null = null;
  private scene: Scene | null = null;
  private input: InputManager | null = null;
  private car: ArcadeCar | null = null;
  private camera: UniversalCamera | null = null;
  private lastTime = performance.now();
  private running = false;
  private readonly qualityTier = this.detectQualityTier();

  constructor(private readonly canvas: HTMLCanvasElement, private readonly hud: GameHudBindings) {}

  async initialize(): Promise<void> {
    this.engine = await this.createEngine();
    this.configureResolution(this.engine);
    this.scene = this.createScene(this.engine);
    this.input = new InputManager();
    this.car = new ArcadeCar(this.scene);
    this.camera = this.createCamera(this.scene);
    this.buildWorld(this.scene);
    this.buildRendering(this.scene, this.camera);
    this.populateHeatPips();
    this.engine.resize();
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    this.engine.runRenderLoop(this.renderLoop);
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    this.canvas.focus({ preventScroll: true });
  }

  pause(): void {
    this.running = false;
  }

  resume(): void {
    if (!this.scene) return;
    this.running = true;
    this.lastTime = performance.now();
  }

  dispose(): void {
    this.input?.dispose();
    window.removeEventListener('resize', this.resize);
    window.visualViewport?.removeEventListener('resize', this.resize);
    this.engine?.dispose();
  }

  private detectQualityTier(): QualityTier {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 900;
    if (!coarse && !narrow) return 'desktop';

    const nav = navigator as Navigator & { deviceMemory?: number };
    const memory = nav.deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency || 8;
    return memory <= 4 || cores <= 4 ? 'mobile-low' : 'mobile-high';
  }

  private async createEngine(): Promise<AbstractEngine> {
    try {
      if (await WebGPUEngine.IsSupportedAsync) {
        const engine = new WebGPUEngine(this.canvas, { antialias: true, adaptToDeviceRatio: false, powerPreference: 'high-performance' });
        await engine.initAsync();
        this.hud.renderer.textContent = `WEBGPU · ${this.qualityTier.toUpperCase()}`;
        return engine;
      }
    } catch (error) {
      console.warn('WebGPU initialization failed; using WebGL.', error);
    }
    this.hud.renderer.textContent = `WEBGL · ${this.qualityTier.toUpperCase()}`;
    return new Engine(this.canvas, true, { adaptToDeviceRatio: false, powerPreference: 'high-performance', stencil: true });
  }

  private configureResolution(engine: AbstractEngine): void {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetDpr = this.qualityTier === 'desktop' ? Math.min(dpr, 2) : this.qualityTier === 'mobile-high' ? Math.min(dpr, 1.5) : Math.min(dpr, 1.15);
    engine.setHardwareScalingLevel(dpr / targetDpr);
  }

  private createScene(engine: AbstractEngine): Scene {
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString('#050609ff');
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = this.qualityTier === 'mobile-low' ? 0.0022 : 0.00165;
    scene.fogColor = Color3.FromHexString('#070a12');
    const hemi = new HemisphericLight('ambient', new Vector3(0.2, 1, -0.1), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = Color3.FromHexString('#8ab9ff');
    hemi.groundColor = Color3.FromHexString('#10131e');
    const moon = new DirectionalLight('moon', new Vector3(-0.25, -1, 0.35), scene);
    moon.intensity = 1.2;
    moon.diffuse = Color3.FromHexString('#b8d6ff');
    return scene;
  }

  private createCamera(scene: Scene): UniversalCamera {
    const camera = new UniversalCamera('chase-camera', new Vector3(0, 4.2, -9), scene);
    camera.minZ = 0.05;
    camera.fov = 0.9;
    camera.inputs.clear();
    return camera;
  }

  private buildWorld(scene: Scene): void {
    const groundMaterial = new StandardMaterial('ground-material', scene);
    groundMaterial.diffuseColor = Color3.FromHexString('#07090d');
    groundMaterial.specularColor = new Color3(0.08, 0.1, 0.13);
    const roadMaterial = new StandardMaterial('road-material', scene);
    roadMaterial.diffuseColor = Color3.FromHexString('#171a20');
    roadMaterial.specularColor = new Color3(0.24, 0.28, 0.32);
    const laneMaterial = new StandardMaterial('lane-material', scene);
    laneMaterial.diffuseColor = Color3.FromHexString('#7df6ff');
    laneMaterial.emissiveColor = Color3.FromHexString('#0f6974');
    const neonPink = new StandardMaterial('neon-pink', scene);
    neonPink.diffuseColor = Color3.FromHexString('#ff2ea6');
    neonPink.emissiveColor = Color3.FromHexString('#8d0f5b');
    const neonCyan = new StandardMaterial('neon-cyan', scene);
    neonCyan.diffuseColor = Color3.FromHexString('#1ce9ff');
    neonCyan.emissiveColor = Color3.FromHexString('#086d79');
    const buildingMaterials: StandardMaterial[] = [];

    for (let i = 0; i < 5; i += 1) {
      const material = new StandardMaterial(`building-material-${i}`, scene);
      material.diffuseColor = Color3.FromHSV(0.56 + i * 0.018, 0.28, 0.12 + i * 0.018);
      material.specularColor = new Color3(0.12, 0.16, 0.22);
      buildingMaterials.push(material);
    }

    const ground = MeshBuilder.CreateGround('city-ground', { width: 2400, height: 2400 }, scene);
    ground.material = groundMaterial;
    const roadSpacing = 170;
    const roadWidth = 34;
    const gridRadius = this.qualityTier === 'desktop' ? 6 : this.qualityTier === 'mobile-high' ? 5 : 4;
    const markerRadius = this.qualityTier === 'desktop' ? 10 : 7;

    for (let i = -gridRadius; i <= gridRadius; i += 1) {
      const offset = i * roadSpacing;
      const vertical = MeshBuilder.CreateGround(`road-v-${i}`, { width: roadWidth, height: 2200 }, scene);
      vertical.position.set(offset, 0.012, 0); vertical.material = roadMaterial;
      const horizontal = MeshBuilder.CreateGround(`road-h-${i}`, { width: 2200, height: roadWidth }, scene);
      horizontal.position.set(0, 0.014, offset); horizontal.material = roadMaterial;
      for (let marker = -markerRadius; marker <= markerRadius; marker += 1) {
        const segment = marker * 95;
        const vLine = MeshBuilder.CreateBox(`lane-v-${i}-${marker}`, { width: 0.28, height: 0.025, depth: 14 }, scene);
        vLine.position.set(offset, 0.04, segment); vLine.material = laneMaterial;
        const hLine = MeshBuilder.CreateBox(`lane-h-${i}-${marker}`, { width: 14, height: 0.025, depth: 0.28 }, scene);
        hLine.position.set(segment, 0.04, offset); hLine.material = laneMaterial;
      }
    }

    const buildingSlots = this.qualityTier === 'mobile-low' ? 2 : 3;
    for (let gx = -gridRadius; gx < gridRadius; gx += 1) {
      for (let gz = -gridRadius; gz < gridRadius; gz += 1) {
        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
        const centerX = gx * roadSpacing + roadSpacing * 0.5;
        const centerZ = gz * roadSpacing + roadSpacing * 0.5;
        for (let slot = 0; slot < buildingSlots; slot += 1) {
          const hash = Math.abs((gx * 73856093) ^ (gz * 19349663) ^ (slot * 83492791));
          const width = 28 + (hash % 32);
          const depth = 28 + ((hash >> 3) % 34);
          const height = 28 + ((hash >> 6) % 125);
          const offsetX = ((hash % 3) - 1) * 42;
          const offsetZ = (((hash >> 2) % 3) - 1) * 42;
          const building = MeshBuilder.CreateBox(`building-${gx}-${gz}-${slot}`, { width, depth, height }, scene);
          building.position.set(centerX + offsetX, height * 0.5, centerZ + offsetZ);
          building.material = buildingMaterials[hash % buildingMaterials.length];
          if (slot === 0 && hash % 4 === 0) {
            const sign = MeshBuilder.CreateBox(`sign-${gx}-${gz}`, { width: Math.min(width * 0.8, 34), height: 3.2, depth: 0.25 }, scene);
            sign.position.set(building.position.x, Math.min(height - 5, 28), building.position.z - depth * 0.51);
            sign.material = hash % 2 === 0 ? neonPink : neonCyan;
          }
        }
      }
    }
  }

  private buildRendering(scene: Scene, camera: UniversalCamera): void {
    if (this.qualityTier !== 'mobile-low') {
      const glow = new GlowLayer('neon-glow', scene, { blurKernelSize: this.qualityTier === 'desktop' ? 32 : 18 });
      glow.intensity = this.qualityTier === 'desktop' ? 0.55 : 0.38;
    }

    const pipeline = new DefaultRenderingPipeline('night-pipeline', true, scene, [camera]);
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = this.qualityTier !== 'mobile-low';
    pipeline.bloomThreshold = 0.72;
    pipeline.bloomWeight = this.qualityTier === 'desktop' ? 0.18 : 0.12;
    pipeline.bloomKernel = this.qualityTier === 'desktop' ? 48 : 28;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.18;
    pipeline.imageProcessing.exposure = 1.05;
  }

  private readonly renderLoop = (): void => {
    if (!this.scene || !this.engine || !this.car || !this.camera || !this.input) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (this.running) {
      const telemetry = this.car.update(dt, this.input.read());
      this.updateCamera(dt, telemetry);
      this.updateHud(telemetry);
    }
    this.scene.render();
  };

  private updateCamera(dt: number, telemetry: CarTelemetry): void {
    if (!this.camera || !this.car) return;
    const forward = this.car.getForward();
    const speedFactor = Math.min(telemetry.speedKph / 300, 1);
    const cameraDistance = 8.8 + speedFactor * 2.8;
    const cameraHeight = 3.4 + speedFactor * 0.8;
    const desired = this.car.root.position.subtract(forward.scale(cameraDistance));
    desired.y += cameraHeight;
    const smooth = 1 - Math.exp(-6.5 * dt);
    this.camera.position = Vector3.Lerp(this.camera.position, desired, smooth);
    const target = this.car.root.position.add(forward.scale(4.8 + speedFactor * 4));
    target.y += 0.65;
    this.camera.setTarget(target);
    this.camera.fov += (0.92 + speedFactor * 0.16 - this.camera.fov) * Math.min(1, dt * 4);
  }

  private updateHud(telemetry: CarTelemetry): void {
    this.hud.speed.textContent = Math.round(telemetry.speedKph).toString().padStart(3, '0');
    this.hud.gear.textContent = telemetry.gear === -1 ? 'R' : String(telemetry.gear);
    this.hud.nitroFill.style.transform = `scaleX(${telemetry.nitrous.toFixed(3)})`;
    const activeHeat = Math.ceil(telemetry.heat);
    Array.from(this.hud.heatPips.children).forEach((pip, index) => pip.classList.toggle('active', index < activeHeat));
  }

  private populateHeatPips(): void {
    this.hud.heatPips.replaceChildren();
    for (let i = 0; i < 5; i += 1) this.hud.heatPips.append(document.createElement('span'));
  }

  private readonly resize = (): void => {
    if (!this.engine) return;
    this.configureResolution(this.engine);
    this.engine.resize();
  };
}
