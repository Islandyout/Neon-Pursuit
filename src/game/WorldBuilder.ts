import { Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { DistrictId, QualityTier, RoadEdge, RoadPoint } from './contracts';
import { ROAD_GRAPH } from './RoadNetwork';
import type { ModelKey } from './ModelLibrary';
import { ModelLibrary } from './ModelLibrary';

interface DistrictArtProfile {
  models: ModelKey[];
  minScale: number;
  maxScale: number;
  spread: number;
}

const DISTRICT_ART: Record<DistrictId, DistrictArtProfile> = {
  'shibuya-core': {
    models: ['building-a', 'building-c', 'building-f', 'building-l', 'building-skyscraper-a', 'building-skyscraper-c'],
    minScale: 7.5,
    maxScale: 13.5,
    spread: 1
  },
  'bay-industrial': {
    models: ['building-f', 'building-l', 'building-a'],
    minScale: 6,
    maxScale: 9,
    spread: 1.4
  },
  'elevated-loop': {
    models: ['building-c', 'building-l', 'building-skyscraper-a'],
    minScale: 7,
    maxScale: 11.5,
    spread: 1.2
  },
  'old-town': {
    models: ['building-a', 'building-c', 'building-f'],
    minScale: 5.2,
    maxScale: 8.2,
    spread: 0.82
  }
};

export interface WorldBuildStats {
  roads: number;
  buildings: number;
  shortcutMarkers: number;
}

export function buildWorld(scene: Scene, qualityTier: QualityTier, models: ModelLibrary): WorldBuildStats {
  const groundMaterial = new StandardMaterial('city-ground-material', scene);
  groundMaterial.diffuseColor = Color3.FromHexString('#101215');
  groundMaterial.specularColor = Color3.FromHexString('#1c2022');
  const ground = MeshBuilder.CreateGround('city-base', { width: 1900, height: 1500 }, scene);
  ground.position.set(90, -0.09, -20);
  ground.material = groundMaterial;

  let roadCount = 0;
  for (const road of ROAD_GRAPH.edges) {
    for (let index = 1; index < road.points.length; index += 1) {
      createImportedRoadSegment(models, road, road.points[index - 1], road.points[index], index);
      roadCount += 1;
    }
  }

  for (const node of ROAD_GRAPH.nodes.filter((entry) => entry.tags?.includes('intersection'))) {
    const crossroad = models.instantiate('road-crossroad', `intersection-${node.id}`);
    crossroad.position.set(node.position.x, roadHeightAt(node.position), node.position.z);
    crossroad.scaling.setAll(2.4);
  }

  const buildingBudget = qualityTier === 'desktop' ? 120 : qualityTier === 'mobile-high' ? 82 : 50;
  let buildingCount = 0;
  let attempts = 0;
  while (buildingCount < buildingBudget && attempts < buildingBudget * 14) {
    attempts += 1;
    const seed = hash(attempts * 923 + 41);
    const x = -650 + pseudo(seed) * 1450;
    const z = -500 + pseudo(seed + 37) * 1000;
    const nearest = closestRoad({ x, z });
    const clearance = distanceToRoad({ x, z }, nearest);
    const district = inferDistrict(x, z, nearest.district);
    const profile = DISTRICT_ART[district];
    const requiredClearance = nearest.width * 0.7 + 11 * profile.spread;
    if (clearance < requiredClearance || isReservedRouteSpace(x, z)) continue;

    const modelKey = profile.models[Math.floor(pseudo(seed + 19) * profile.models.length)];
    const building = models.instantiate(modelKey, `building-${district}-${buildingCount}`);
    const scale = lerp(profile.minScale, profile.maxScale, Math.pow(pseudo(seed + 23), 1.2));
    building.scaling.setAll(scale);
    building.position.set(x, 0, z);
    building.rotation.y = Math.floor(pseudo(seed + 29) * 4) * Math.PI * 0.5 + (pseudo(seed + 31) - 0.5) * 0.12;
    buildingCount += 1;
  }

  let shortcutMarkers = 0;
  for (const road of ROAD_GRAPH.edges.filter((entry) => entry.shortcut)) {
    const start = road.points[0];
    const marker = models.instantiate('road-crossroad', `shortcut-entry-${road.id}`);
    marker.position.set(start.x, road.roadClass === 'parking' ? 0.03 : roadHeight(road), start.z);
    marker.rotation.y = segmentYaw(road.points[0], road.points[Math.min(1, road.points.length - 1)]);
    marker.scaling.setAll(Math.max(1.15, road.width / 5.2));
    shortcutMarkers += 1;
  }

  return { roads: roadCount, buildings: buildingCount, shortcutMarkers };
}

function createImportedRoadSegment(models: ModelLibrary, road: RoadEdge, a: RoadPoint, b: RoadPoint, index: number): void {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 0.1) return;
  const roadVisual = models.instantiate('road-straight', `road-${road.id}-${index}`);
  roadVisual.position.set((a.x + b.x) * 0.5, roadHeight(road), (a.z + b.z) * 0.5);
  roadVisual.rotation.y = segmentYaw(a, b);
  // Kenney road modules are authored around a compact square tile. Scale the imported
  // module to the graph segment while preserving its modeled curbs, markings and surface.
  roadVisual.scaling.set(Math.max(1, road.width / 4), 1, Math.max(1, length / 4));
}

function roadHeight(road: RoadEdge): number {
  return road.roadClass === 'expressway' ? 4.35 : road.roadClass === 'tunnel' ? 0.02 : 0;
}

function roadHeightAt(point: RoadPoint): number {
  const road = closestRoad(point);
  return roadHeight(road) + 0.015;
}

function closestRoad(point: RoadPoint): RoadEdge {
  let closest = ROAD_GRAPH.edges[0];
  let best = Number.POSITIVE_INFINITY;
  for (const road of ROAD_GRAPH.edges) {
    const distance = distanceToRoad(point, road);
    if (distance < best) {
      best = distance;
      closest = road;
    }
  }
  return closest;
}

function distanceToRoad(point: RoadPoint, road: RoadEdge): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < road.points.length; index += 1) {
    best = Math.min(best, pointToSegmentDistance(point, road.points[index - 1], road.points[index]));
  }
  return best;
}

function pointToSegmentDistance(point: RoadPoint, a: RoadPoint, b: RoadPoint): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
}

function inferDistrict(x: number, z: number, fallback: DistrictId): DistrictId {
  if (x > 360 && z < -170) return 'bay-industrial';
  if (x < -260) return 'old-town';
  if (Math.abs(x) > 360 || z > 260) return 'elevated-loop';
  return fallback === 'bay-industrial' && x < 260 ? 'shibuya-core' : fallback;
}

function isReservedRouteSpace(x: number, z: number): boolean {
  // Keep the major parking cut, tunnel mouths and central race corridor readable.
  if (x > 135 && x < 285 && z > -180 && z < -70) return true;
  if (x > -295 && x < 220 && z > -335 && z < -135) return true;
  if (Math.abs(x) < 70 && Math.abs(z) < 95) return true;
  return false;
}

function segmentYaw(a: RoadPoint, b: RoadPoint): number {
  return Math.atan2(b.x - a.x, b.z - a.z);
}

function hash(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
