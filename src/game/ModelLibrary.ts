import '@babylonjs/loaders/glTF';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { VehicleClass } from './contracts';

export type ModelKey =
  | 'car-race'
  | 'car-sedan-sports'
  | 'car-hatchback-sports'
  | 'car-suv-luxury'
  | 'car-police'
  | 'car-sedan'
  | 'car-van'
  | 'car-truck'
  | 'road-straight'
  | 'road-crossroad'
  | 'building-a'
  | 'building-c'
  | 'building-f'
  | 'building-l'
  | 'building-skyscraper-a'
  | 'building-skyscraper-c';

interface ModelSource {
  rootUrl: string;
  fileName: string;
}

const MODEL_SOURCES: Record<ModelKey, ModelSource> = {
  'car-race': { rootUrl: '/assets/kenney/car-kit/', fileName: 'race.glb' },
  'car-sedan-sports': { rootUrl: '/assets/kenney/car-kit/', fileName: 'sedan-sports.glb' },
  'car-hatchback-sports': { rootUrl: '/assets/kenney/car-kit/', fileName: 'hatchback-sports.glb' },
  'car-suv-luxury': { rootUrl: '/assets/kenney/car-kit/', fileName: 'suv-luxury.glb' },
  'car-police': { rootUrl: '/assets/kenney/car-kit/', fileName: 'police.glb' },
  'car-sedan': { rootUrl: '/assets/kenney/car-kit/', fileName: 'sedan.glb' },
  'car-van': { rootUrl: '/assets/kenney/car-kit/', fileName: 'van.glb' },
  'car-truck': { rootUrl: '/assets/kenney/car-kit/', fileName: 'truck.glb' },
  'road-straight': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'road-straight.glb' },
  'road-crossroad': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'road-crossroad-path.glb' },
  'building-a': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-a.glb' },
  'building-c': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-c.glb' },
  'building-f': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-f.glb' },
  'building-l': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-l.glb' },
  'building-skyscraper-a': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-skyscraper-a.glb' },
  'building-skyscraper-c': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-skyscraper-c.glb' }
};

export const ALL_MODEL_KEYS = Object.keys(MODEL_SOURCES) as ModelKey[];

const PLAYER_MODEL_BY_ID: Record<string, ModelKey> = {
  'kaze-s1': 'car-race',
  'raijin-r': 'car-sedan-sports',
  'hibiki-3': 'car-hatchback-sports',
  'oni-v8': 'car-sedan-sports',
  'mako-x': 'car-race'
};

const VEHICLE_MODEL_BY_CLASS: Partial<Record<VehicleClass, ModelKey>> = {
  'tuner-coupe': 'car-race',
  'sports-sedan': 'car-sedan-sports',
  hatch: 'car-hatchback-sports',
  muscle: 'car-sedan-sports',
  exotic: 'car-race',
  'traffic-sedan': 'car-sedan',
  'traffic-van': 'car-van',
  'utility-truck': 'car-truck',
  'police-interceptor': 'car-police',
  'police-suv': 'car-suv-luxury'
};

export const playerModelForVehicle = (vehicleId: string): ModelKey => PLAYER_MODEL_BY_ID[vehicleId] ?? 'car-race';
export const modelForVehicleClass = (vehicleClass: VehicleClass): ModelKey => VEHICLE_MODEL_BY_CLASS[vehicleClass] ?? 'car-sedan';

export class ModelLibrary {
  private readonly containers = new Map<ModelKey, AssetContainer>();

  constructor(private readonly scene: Scene) {}

  async preload(keys: readonly ModelKey[] = ALL_MODEL_KEYS): Promise<void> {
    await Promise.all(keys.map((key) => this.load(key)));
  }

  instantiate(key: ModelKey, name: string, cloneMaterials = false): TransformNode {
    const container = this.containers.get(key);
    if (!container) throw new Error(`Model was not preloaded: ${key}`);
    const holder = new TransformNode(name, this.scene);
    const instance = container.instantiateModelsToScene(
      (sourceName) => `${name}-${sourceName}`,
      cloneMaterials
    );
    for (const root of instance.rootNodes) root.parent = holder;
    return holder;
  }

  dispose(): void {
    for (const container of this.containers.values()) container.dispose();
    this.containers.clear();
  }

  private async load(key: ModelKey): Promise<void> {
    if (this.containers.has(key)) return;
    const source = MODEL_SOURCES[key];
    const container = await SceneLoader.LoadAssetContainerAsync(source.rootUrl, source.fileName, this.scene);
    this.containers.set(key, container);
  }
}
