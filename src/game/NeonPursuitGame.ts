import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4, Vector3 } from '@babylonjs/core/Maths/math';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { InputManager, type ControlSettings } from './InputManager';
import { ArcadeCar } from './ArcadeCar';
import type { ControlMode, QualityTier, VehicleTelemetry } from './contracts';
import { buildWorld } from './WorldBuilder';
import { TrafficSystem } from './TrafficSystem';
import { PursuitSystem, type PursuitSnapshot } from './PursuitSystem';
import { RaceSystem } from './RaceSystem';
import { AudioDirector } from './AudioDirector';
import { PerformanceManager } from './PerformanceManager';
import { PLAYER_VEHICLE_IDS, getVehicleDefinition } from './VehicleCatalog';
import { GarageSystem, CUSTOMIZATION_PRESETS } from './GarageSystem';
import { AssetStreamManager } from './AssetStreamManager';

export interface GameHudBindings {
  renderer: HTMLElement;
  speed: HTMLElement;
  gear: HTMLElement;
  nitroFill: HTMLElement;
  heatPips: HTMLElement;
  pursuitState: HTMLElement;
  fps: HTMLElement;
  driftScore: HTMLElement;
}

export class NeonPursuitGame {
  private engine: AbstractEngine | null = null;
  private scene: Scene | null = null;
  private input: InputManager | null = null;
  private car: ArcadeCar | null = null;
  private camera: UniversalCamera | null = null;
  private traffic: TrafficSystem | null = null;
  private pursuit: PursuitSystem | null = null;
  private race: RaceSystem | null = null;
  private readonly audio = new AudioDirector();
  private readonly garage = new GarageSystem();
  private readonly assetStream = new AssetStreamManager();
  private lastTime = performance.now();
  private running = false;
  private vehicleIndex = 0;
  private customizationIndex = 0;
  private readonly qualityTier = this.detectQualityTier();
  private readonly performanceManager = new PerformanceManager(this.qualityTier);

  constructor(private readonly canvas: HTMLCanvasElement, private readonly hud: GameHudBindings) {}

  async initialize(): Promise<void> {
    this.engine = await this.createEngine();
    this.configureResolution(this.engine);
    this.scene = this.createScene(this.engine);
    this.input = new InputManager();

    const garageProfile = this.garage.getProfile();
    const savedIndex = PLAYER_VEHICLE_IDS.findIndex((id) => id === garageProfile.activeVehicleId);
    this.vehicleIndex = savedIndex >= 0 ? savedIndex : 0;
    const activeVehicleId = PLAYER_VEHICLE_IDS[this.vehicleIndex];
    const savedCustomization = garageProfile.customization[activeVehicleId];
    this.car = new ArcadeCar(this.scene, activeVehicleId, savedCustomization);

    await this.assetStream.stageDistrict('shibuya-core');
    void this.assetStream.stageDistrict('bay-industrial');
    void this.assetStream.stageDistrict('elevated-loop');
    void this.assetStream.stageDistrict('old-town');

    this.camera = this.createCamera(this.scene);
    buildWorld(this.scene, this.qualityTier);
    this.buildRendering(this.scene, this.camera);
    this.traffic = new TrafficSystem(this.scene, this.qualityTier);
    this.pursuit = new PursuitSystem(this.scene, this.qualityTier);
    this.race = new RaceSystem(this.scene);
    this.populateHeatPips();
    this.engine.resize();
    window.addEventListener('resize', this.resize);
    window.visualViewport?.addEventListener('resize', this.resize);
    this.engine.runRenderLoop(this.renderLoop);
  }

  async start(): Promise<void> {
    this.running = true;
    this.lastTime = performance.now();
    this.canvas.focus({ preventScroll: true });
    await this.audio.start();
  }

  pause(): void {
    this.running = false;
  }

  resume(): void {
    if (!this.scene) return;
    this.running = true;
    this.lastTime = performance.now();
  }

  async cycleControlMode(): Promise<ControlMode | null> {
    return this.input ? this.input.cycleControlMode() : null;
  }

  getControlMode(): ControlMode | null {
    return this.input?.getControlMode() ?? null;
  }

  getControlSettings(): ControlSettings | null {
    return this.input?.getSettings() ?? null;
  }

  updateControlSettings(next: Partial<ControlSettings>): ControlSettings | null {
    return this.input?.updateSettings(next) ?? null;
  }

  getVehicleName(): string | null {
    return this.car?.getVehicleDefinition().name ?? null;
  }

  cycleVehicle(): string | null {
    if (!this.car) return null;
    this.vehicleIndex = (this.vehicleIndex + 1) % PLAYER_VEHICLE_IDS.length;
    const id = PLAYER_VEHICLE_IDS[this.vehicleIndex];
    const profile = this.garage.getProfile();
    const customization = profile.customization[id];
    this.car.setVehicle(id);
    if (customization) this.car.applyCustomization(customization);
    this.garage.setActiveVehicle(id);
    this.customizationIndex = 0;
    return getVehicleDefinition(id).name;
  }

  cycleCustomization(): string | null {
    if (!this.car) return null;
    this.customizationIndex = (this.customizationIndex + 1) % CUSTOMIZATION_PRESETS.length;
    const preset = CUSTOMIZATION_PRESETS[this.customizationIndex];
    this.car.applyCustomization(preset);
    this.garage.setCustomization(this.car.getVehicleDefinition().id, preset);
    return `STYLE ${this.customizationIndex + 1}`;
  }

  dispose(): void {
    this.input?.dispose();
    this.traffic?.dispose();
    this.pursuit?.dispose();
    this.race?.dispose();
    this.audio.dispose();
    this.assetStream.clearSessionState();
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
    const targetDpr = this.performanceManager.getTargetDpr(dpr);
    engine.setHardwareScalingLevel(dpr / Math.max(0.75, targetDpr));
  }

  private createScene(engine: AbstractEngine): Scene {
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString('#080a0dff');
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = this.qualityTier === 'mobile-low' ? 0.002 : 0.00135;
    scene.fogColor = Color3.FromHexString('#101317');
    const ambient = new HemisphericLight('ambient', new Vector3(0.18, 1, -0.08), scene);
    ambient.intensity = 0.5;
    ambient.diffuse = Color3.FromHexString('#9aa7b1');
    ambient.groundColor = Color3.FromHexString('#15181b');
    const cityLight = new DirectionalLight('city-night', new Vector3(-0.28, -1, 0.3), scene);
    cityLight.intensity = 0.78;
    cityLight.diffuse = Color3.FromHexString('#d3d6cf');
    return scene;
  }

  private createCamera(scene: Scene): UniversalCamera {
    const camera = new UniversalCamera('chase-camera', new Vector3(0, 4.1, -9), scene);
    camera.minZ = 0.05;
    camera.fov = 0.88;
    camera.inputs.clear();
    return camera;
  }

  private buildRendering(scene: Scene, camera: UniversalCamera): void {
    if (this.qualityTier !== 'mobile-low') {
      const glow = new GlowLayer('selective-night-glow', scene, { blurKernelSize: this.qualityTier === 'desktop' ? 20 : 14 });
      glow.intensity = this.qualityTier === 'desktop' ? 0.22 : 0.14;
    }
    const pipeline = new DefaultRenderingPipeline('night-pipeline', true, scene, [camera]);
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = this.qualityTier !== 'mobile-low';
    pipeline.bloomThreshold = 0.9;
    pipeline.bloomWeight = this.qualityTier === 'desktop' ? 0.07 : 0.04;
    pipeline.bloomKernel = this.qualityTier === 'desktop' ? 28 : 18;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.08;
    pipeline.imageProcessing.exposure = 0.96;
  }

  private readonly renderLoop = (): void => {
    if (!this.scene || !this.engine || !this.car || !this.camera || !this.input) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.performanceManager.recordFrame(dt)) this.configureResolution(this.engine);

    if (this.running) {
      const telemetry = this.car.update(dt, this.input.read());
      this.traffic?.update(dt, this.car.root.position);
      this.race?.update(dt, this.car.root.position);
      const pursuitSnapshot = this.pursuit?.update(dt, this.car.root.position, telemetry) ?? { state: 'patrol', activeUnits: 0, interceptRoad: null } satisfies PursuitSnapshot;
      this.audio.update(telemetry, pursuitSnapshot.state);
      this.updateCamera(dt, telemetry);
      this.updateHud(telemetry, pursuitSnapshot);
    }
    this.scene.render();
  };

  private updateCamera(dt: number, telemetry: VehicleTelemetry): void {
    if (!this.camera || !this.car) return;
    const forward = this.car.getForward();
    const speedFactor = Math.min(telemetry.speedKph / 300, 1);
    const cameraDistance = 8.6 + speedFactor * 3.1;
    const cameraHeight = 3.35 + speedFactor * 0.72;
    const desired = this.car.root.position.subtract(forward.scale(cameraDistance));
    desired.y += cameraHeight;
    const smooth = 1 - Math.exp(-7.2 * dt);
    this.camera.position = Vector3.Lerp(this.camera.position, desired, smooth);
    const target = this.car.root.position.add(forward.scale(5.4 + speedFactor * 5.5));
    target.y += 0.62;
    this.camera.setTarget(target);
    this.camera.fov += (0.88 + speedFactor * 0.14 - this.camera.fov) * Math.min(1, dt * 4.6);
  }

  private updateHud(telemetry: VehicleTelemetry, pursuit: PursuitSnapshot): void {
    this.hud.speed.textContent = Math.round(telemetry.speedKph).toString().padStart(3, '0');
    this.hud.gear.textContent = telemetry.gear === -1 ? 'R' : String(telemetry.gear);
    this.hud.nitroFill.style.transform = `scaleX(${telemetry.nitrous.toFixed(3)})`;
    this.hud.pursuitState.textContent = pursuit.state.toUpperCase();
    this.hud.fps.textContent = `${this.performanceManager.getFps()} FPS`;
    this.hud.driftScore.textContent = telemetry.slip > 0.18 ? `DRIFT ${Math.round(telemetry.driftScore)}` : '';
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
