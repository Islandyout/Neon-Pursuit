export interface DistrictAssetManifest {
  id: string;
  required: string[];
  optional: string[];
}

const CAR = '/assets/kenney/car-kit';
const ROAD = '/assets/kenney/city-kit-roads';
const CITY = '/assets/kenney/city-kit-commercial';

export const DISTRICT_ASSETS: DistrictAssetManifest[] = [
  {
    id: 'shibuya-core',
    required: [
      `${CAR}/race.glb`,
      `${CAR}/sedan-sports.glb`,
      `${CAR}/hatchback-sports.glb`,
      `${CAR}/sedan.glb`,
      `${CAR}/van.glb`,
      `${ROAD}/road-straight.glb`,
      `${ROAD}/road-crossroad-path.glb`,
      `${CITY}/building-a.glb`,
      `${CITY}/building-c.glb`,
      `${CITY}/building-f.glb`,
      `${CITY}/building-skyscraper-a.glb`,
      `${CITY}/building-skyscraper-c.glb`
    ],
    optional: [
      `${CAR}/Textures/colormap.png`,
      `${ROAD}/Textures/colormap.png`,
      `${ROAD}/Textures/variation-a.png`,
      `${CITY}/Textures/colormap.png`,
      `${CITY}/Textures/variation-a.png`,
      `${CITY}/Textures/variation-b.png`
    ]
  },
  {
    id: 'bay-industrial',
    required: [
      `${CAR}/truck.glb`,
      `${CAR}/van.glb`,
      `${ROAD}/road-straight.glb`,
      `${CITY}/building-f.glb`,
      `${CITY}/building-l.glb`
    ],
    optional: []
  },
  {
    id: 'elevated-loop',
    required: [
      `${CAR}/police.glb`,
      `${CAR}/suv-luxury.glb`,
      `${ROAD}/road-straight.glb`,
      `${ROAD}/road-crossroad-path.glb`,
      `${CITY}/building-skyscraper-a.glb`,
      `${CITY}/building-skyscraper-c.glb`
    ],
    optional: []
  },
  {
    id: 'old-town',
    required: [
      `${CAR}/hatchback-sports.glb`,
      `${CAR}/sedan.glb`,
      `${ROAD}/road-straight.glb`,
      `${CITY}/building-a.glb`,
      `${CITY}/building-c.glb`
    ],
    optional: []
  }
];

export class AssetStreamManager {
  private readonly cacheName = 'neon-pursuit-runtime-v2';
  private loadedDistricts = new Set<string>();

  async stageDistrict(id: string): Promise<void> {
    if (this.loadedDistricts.has(id)) return;
    const manifest = DISTRICT_ASSETS.find((entry) => entry.id === id);
    if (!manifest) throw new Error(`Unknown district asset manifest: ${id}`);
    if (!('caches' in window)) {
      this.loadedDistricts.add(id);
      return;
    }
    const cache = await caches.open(this.cacheName);
    await Promise.all(manifest.required.map(async (url) => {
      const match = await cache.match(url);
      if (!match) await cache.add(url);
    }));
    this.loadedDistricts.add(id);
    void Promise.all(manifest.optional.map(async (url) => {
      try {
        const match = await cache.match(url);
        if (!match) await cache.add(url);
      } catch {
        // Optional texture/material variants never block district play.
      }
    }));
  }

  isDistrictReady(id: string): boolean {
    return this.loadedDistricts.has(id);
  }

  clearSessionState(): void {
    this.loadedDistricts.clear();
  }
}
