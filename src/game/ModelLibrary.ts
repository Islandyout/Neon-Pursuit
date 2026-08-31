import '@babylonjs/loaders/glTF';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { VehicleClass } from './contracts';

export type ModelKey =
  | 'car-sedan-sports'
  | 'car-hatchback-sports'
  | 'car-suv-luxury'
  | 'car-police'
  | 'car-sedan'
  | 'car-van'
  | 'car-truck'
  | 'road-straight'
  | 'road-straight-barrier'
  | 'road-crossroad'
  | 'road-crossroad-plain'
  | 'street-light'
  | 'highway-sign'
  | 'construction-barrier'
  | 'building-a'
  | 'building-b'
  | 'building-c'
  | 'building-d'
  | 'building-f'
  | 'building-g'
  | 'building-h'
  | 'building-l'
  | 'building-m'
  | 'building-n'
  | 'building-skyscraper-a'
  | 'building-skyscraper-b'
  | 'building-skyscraper-c'
  | 'building-skyscraper-d'
  | 'suburban-b'
  | 'suburban-d'
  | 'suburban-f'
  | 'suburban-h'
  | 'suburban-l'
  | 'suburban-o'
  | 'tree-small'
  | 'tree-large'
  | 'fence';

interface ModelSource {
  rootUrl: string;
  fileName: string;
}

const MODEL_SOURCES: Record<ModelKey, ModelSource> = {
  'car-sedan-sports': { rootUrl: '/assets/kenney/car-kit/', fileName: 'sedan-sports.glb' },
  'car-hatchback-sports': { rootUrl: '/assets/kenney/car-kit/', fileName: 'hatchback-sports.glb' },
  'car-suv-luxury': { rootUrl: '/assets/kenney/car-kit/', fileName: 'suv-luxury.glb' },
  'car-police': { rootUrl: '/assets/kenney/car-kit/', fileName: 'police.glb' },
  'car-sedan': { rootUrl: '/assets/kenney/car-kit/', fileName: 'sedan.glb' },
  'car-van': { rootUrl: '/assets/kenney/car-kit/', fileName: 'van.glb' },
  'car-truck': { rootUrl: '/assets/kenney/car-kit/', fileName: 'truck.glb' },
  'road-straight': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'road-straight.glb' },
  'road-straight-barrier': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'road-straight-barrier.glb' },
  'road-crossroad': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'road-crossroad-path.glb' },
  'road-crossroad-plain': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'road-crossroad.glb' },
  'street-light': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'light-curved.glb' },
  'highway-sign': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'sign-highway-detailed.glb' },
  'construction-barrier': { rootUrl: '/assets/kenney/city-kit-roads/', fileName: 'construction-barrier.glb' },
  'building-a': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-a.glb' },
  'building-b': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-b.glb' },
  'building-c': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-c.glb' },
  'building-d': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-d.glb' },
  'building-f': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-f.glb' },
  'building-g': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-g.glb' },
  'building-h': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-h.glb' },
  'building-l': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-l.glb' },
  'building-m': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-m.glb' },
  'building-n': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-n.glb' },
  'building-skyscraper-a': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-skyscraper-a.glb' },
  'building-skyscraper-b': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-skyscraper-b.glb' },
  'building-skyscraper-c': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-skyscraper-c.glb' },
  'building-skyscraper-d': { rootUrl: '/assets/kenney/city-kit-commercial/', fileName: 'building-skyscraper-d.glb' },
  'suburban-b': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'building-type-b.glb' },
  'suburban-d': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'building-type-d.glb' },
  'suburban-f': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'building-type-f.glb' },
  'suburban-h': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'building-type-h.glb' },
  'suburban-l': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'building-type-l.glb' },
  'suburban-o': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'building-type-o.glb' },
  'tree-small': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'tree-small.glb' },
  'tree-large': { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'tree-large.glb' },
  fence: { rootUrl: '/assets/kenney/city-kit-suburban/', fileName: 'fence-1x4.glb' }
};

export const ALL_MODEL_KEYS = Object.keys(MODEL_SOURCES) as ModelKey[];

const PLAYER_MODEL_BY_ID: Record<string, ModelKey> = {
  'kaze-s1': 'car-sedan-sports',
  'raijin-r': 'car-sedan-sports',
  'hibiki-3': 'car-hatchback-sports',
  'oni-v8': 'car-sedan-sports',
  'mako-x': 'car-hatchback-sports'
};

const VEHICLE_MODEL_BY_CLASS: Partial<Record<VehicleClass, ModelKey>> = {
  'tuner-coupe': 'car-sedan-sports',
  'sports-sedan': 'car-sedan-sports',
  hatch: 'car-hatchback-sports',
  muscle: 'car-sedan-sports',
  exotic: 'car-hatchback-sports',
  'traffic-sedan': 'car-sedan',
  'traffic-van': 'car-van',
  'utility-truck': 'car-truck',
  'police-interceptor': 'car-police',
  'police-suv': 'car-suv-luxury'
};

export const playerModelForVehicle = (vehicleId: string): ModelKey => PLAYER_MODEL_BY_ID[vehicleId] ?? 'car-sedan-sports';
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
