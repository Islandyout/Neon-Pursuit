export interface DistrictAssetManifest {
  id: string;
  required: string[];
  optional: string[];
}

export const DISTRICT_ASSETS: DistrictAssetManifest[] = [
  { id: 'shibuya-core', required: [], optional: [] },
  { id: 'bay-industrial', required: [], optional: [] },
  { id: 'elevated-loop', required: [], optional: [] },
  { id: 'old-town', required: [], optional: [] }
];

export class AssetStreamManager {
  private readonly cacheName = 'neon-pursuit-runtime-v1';
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
        // Optional assets never block district play.
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
