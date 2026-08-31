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
  setback: number;
}

const DISTRICT_ART: Record<DistrictId, DistrictArtProfile> = {
  'shibuya-core': {
    models: ['building-a', 'building-b', 'building-c', 'building-d', 'building-g', 'building-h', 'building-l', 'building-m', 'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d'],
    minScale: 9,
    maxScale: 17,
    setback: 9
  },
  'bay-industrial': {
    models: ['building-f', 'building-l', 'building-m', 'building-n', 'building-d'],
    minScale: 8,
    maxScale: 13,
    setback: 13
  },
  'elevated-loop': {
    models: ['building-c', 'building-l', 'building-m', 'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c', 'building-skyscraper-d'],
    minScale: 10,
    maxScale: 18,
    setback: 15
  },
  'old-town': {
    models: ['suburban-b', 'suburban-d', 'suburban-f', 'suburban-h', 'suburban-l', 'suburban-o', 'building-a', 'building-c'],
    minScale: 7,
    maxScale: 11,
    setback: 8
  }
};

export interface WorldBuildStats {
  roads: number;
  buildings: number;
  shortcutMarkers: number;
  props: number;
}

export function buildWorld(scene: Scene, qualityTier: QualityTier, models: ModelLibrary): WorldBuildStats {
  const groundMaterial = new StandardMaterial('city-ground-material', scene);
  groundMaterial.diffuseColor = Color3.FromHexString('#26282a');
  groundMaterial.specularColor = Color3.FromHexString('#111315');
  const ground = MeshBuilder.CreateGround('city-base', { width: 1900, height: 1500 }, scene);
  ground.position.set(90, -0.11, -20);
  ground.material = groundMaterial;

  let roadCount = 0;
  let propCount = 0;
  for (const road of ROAD_GRAPH.edges) {
    for (let index = 1; index < road.points.length; index += 1) {
      createImportedRoadSegment(models, road, road.points[index - 1], road.points[index], index);
      roadCount += 1;
      propCount += decorateRoadSegment(models, road, road.points[index - 1], road.points[index], index, qualityTier);
    }
  }

  for (const node of ROAD_GRAPH.nodes.filter((entry) => entry.tags?.includes('intersection'))) {
    const crossroad = models.instantiate('road-crossroad', `intersection-${node.id}`);
    crossroad.position.set(node.position.x, roadHeightAt(node.position) + 0.01, node.position.z);
    crossroad.scaling.setAll(Math.max(9, roadWidthAtNode(node.id)));
  }

  const buildingLimit = qualityTier === 'desktop' ? 360 : qualityTier === 'mobile-high' ? 230 : 145;
  const spacing = qualityTier === 'desktop' ? 34 : qualityTier === 'mobile-high' ? 46 : 62;
  let buildingCount = 0;

  for (const road of ROAD_GRAPH.edges) {
    if (buildingCount >= buildingLimit) break;
    if (road.shortcut || road.roadClass === 'parking' || road.roadClass === 'tunnel') continue;
    for (let segmentIndex = 1; segmentIndex < road.points.length && buildingCount < buildingLimit; segmentIndex += 1) {
      const a = road.points[segmentIndex - 1];
      const b = road.points[segmentIndex];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const count = Math.max(1, Math.floor(length / spacing));
      const yaw = segmentYaw(a, b);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      for (let slot = 0; slot < count && buildingCount < buildingLimit; slot += 1) {
        const t = (slot + 0.5) / count;
        const cx = a.x + (b.x - a.x) * t;
        const cz = a.z + (b.z - a.z) * t;
        const district = inferDistrict(cx, cz, road.district);
        const profile = DISTRICT_ART[district];
        const seed = hash(buildingCount * 197 + segmentIndex * 47 + road.id.length * 31);
        const sides = qualityTier === 'mobile-low' && (slot + segmentIndex) % 2 === 0 ? [1] : [-1, 1];

        for (const side of sides) {
          if (buildingCount >= buildingLimit) break;
          const scale = lerp(profile.minScale, profile.maxScale, pseudo(seed + side * 17 + slot * 11));
          const setback = road.width * 0.5 + profile.setback + scale * 0.45 + pseudo(seed + side * 29) * 7;
          const x = cx + rightX * setback * side;
          const z = cz + rightZ * setback * side;
          if (isReservedRouteSpace(x, z)) continue;

          const modelKey = profile.models[Math.floor(pseudo(seed + side * 37 + 3) * profile.models.length)];
          const building = models.instantiate(modelKey, `building-${district}-${buildingCount}`);
          building.scaling.setAll(scale);
          building.position.set(x, 0, z);
          building.rotation.y = yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (pseudo(seed + side * 41) - 0.5) * 0.08;
          buildingCount += 1;
        }
      }
    }
  }

  // Fill a few skyline gaps away from the road corridors so the horizon never collapses
  // into an empty base plane on desktop/high-end phones.
  if (qualityTier !== 'mobile-low') {
    const skylineBudget = qualityTier === 'desktop' ? 70 : 36;
    for (let i = 0; i < skylineBudget && buildingCount < buildingLimit; i += 1) {
      const seed = hash(88000 + i * 131);
      const x = -620 + pseudo(seed) * 1400;
      const z = -470 + pseudo(seed + 7) * 940;
      const nearest = closestRoad({ x, z });
      if (distanceToRoad({ x, z }, nearest) < nearest.width * 0.5 + 45 || isReservedRouteSpace(x, z)) continue;
      const key: ModelKey = pseudo(seed + 11) > 0.45 ? 'building-skyscraper-c' : 'building-skyscraper-a';
      const building = models.instantiate(key, `skyline-${i}`);
      const scale = 12 + pseudo(seed + 13) * 10;
      building.scaling.setAll(scale);
      building.position.set(x, 0, z);
      building.rotation.y = Math.floor(pseudo(seed + 17) * 4) * Math.PI * 0.5;
      buildingCount += 1;
    }
  }

  let shortcutMarkers = 0;
  for (const road of ROAD_GRAPH.edges.filter((entry) => entry.shortcut)) {
    const start = road.points[0];
    const yaw = segmentYaw(road.points[0], road.points[Math.min(1, road.points.length - 1)]);
    for (const side of [-1, 1]) {
      const barrier = models.instantiate('construction-barrier', `shortcut-entry-${road.id}-${side}`);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      barrier.position.set(start.x + rightX * side * (road.width * 0.55 + 1.2), roadHeight(road) + 0.02, start.z + rightZ * side * (road.width * 0.55 + 1.2));
      barrier.rotation.y = yaw;
      barrier.scaling.setAll(1.8);
      propCount += 1;
    }
    shortcutMarkers += 1;
  }

  return { roads: roadCount, buildings: buildingCount, shortcutMarkers, props: propCount };
}

function createImportedRoadSegment(models: ModelLibrary, road: RoadEdge, a: RoadPoint, b: RoadPoint, index: number): void {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 0.1) return;
  const roadVisual = models.instantiate(road.roadClass === 'expressway' ? 'road-straight-barrier' : 'road-straight', `road-${road.id}-${index}`);
  roadVisual.position.set((a.x + b.x) * 0.5, roadHeight(road), (a.z + b.z) * 0.5);
  roadVisual.rotation.y = segmentYaw(a, b);
  // Kenney road tiles are authored as 1x1 metre modules. Width and segment length can
  // therefore be applied directly. The previous /4 scaling exposed most of the base plane.
  roadVisual.scaling.set(Math.max(3.5, road.width), 1, Math.max(2, length));
}

function decorateRoadSegment(models: ModelLibrary, road: RoadEdge, a: RoadPoint, b: RoadPoint, segmentIndex: number, qualityTier: QualityTier): number {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 18 || road.shortcut || road.roadClass === 'parking' || road.roadClass === 'tunnel') return 0;
  const yaw = segmentYaw(a, b);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const lightSpacing = qualityTier === 'desktop' ? 42 : qualityTier === 'mobile-high' ? 58 : 78;
  const count = Math.floor(length / lightSpacing);
  let props = 0;

  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / Math.max(1, count);
    const cx = a.x + (b.x - a.x) * t;
    const cz = a.z + (b.z - a.z) * t;
    const side = (i + segmentIndex) % 2 === 0 ? -1 : 1;
    const edgeOffset = road.width * 0.5 + 1.4;
    const light = models.instantiate('street-light', `light-${road.id}-${segmentIndex}-${i}`);
    light.position.set(cx + rightX * edgeOffset * side, roadHeight(road) + 0.02, cz + rightZ * edgeOffset * side);
    light.rotation.y = yaw + (side > 0 ? Math.PI : 0);
    light.scaling.setAll(3.2);
    props += 1;

    if (road.district === 'old-town' && i % 2 === 0) {
      const tree = models.instantiate(i % 4 === 0 ? 'tree-large' : 'tree-small', `tree-${road.id}-${segmentIndex}-${i}`);
      tree.position.set(cx + rightX * (edgeOffset + 6) * side, 0, cz + rightZ * (edgeOffset + 6) * side);
      tree.scaling.setAll(i % 4 === 0 ? 6.5 : 5.2);
      props += 1;
    }
  }

  if (road.roadClass === 'expressway' && length > 90) {
    const sign = models.instantiate('highway-sign', `sign-${road.id}-${segmentIndex}`);
    sign.position.set((a.x + b.x) * 0.5, roadHeight(road) + 0.04, (a.z + b.z) * 0.5);
    sign.rotation.y = yaw;
    sign.scaling.setAll(3.8);
    props += 1;
  }

  if (road.district === 'bay-industrial' && length > 55) {
    const fenceCount = Math.min(4, Math.floor(length / 55));
    for (let i = 0; i < fenceCount; i += 1) {
      const t = (i + 1) / (fenceCount + 1);
      const fence = models.instantiate('fence', `fence-${road.id}-${segmentIndex}-${i}`);
      const side = i % 2 === 0 ? 1 : -1;
      const offset = road.width * 0.5 + 11;
      fence.position.set(a.x + (b.x - a.x) * t + rightX * offset * side, 0, a.z + (b.z - a.z) * t + rightZ * offset * side);
      fence.rotation.y = yaw;
      fence.scaling.setAll(3.5);
      props += 1;
    }
  }

  return props;
}

function roadHeight(road: RoadEdge): number {
  return road.roadClass === 'expressway' ? 4.35 : road.roadClass === 'tunnel' ? 0.02 : 0;
}

function roadHeightAt(point: RoadPoint): number {
  const road = closestRoad(point);
  return roadHeight(road) + 0.015;
}

function roadWidthAtNode(nodeId: string): number {
  const widths = ROAD_GRAPH.edges
    .filter((road) => road.from === nodeId || road.to === nodeId)
    .map((road) => road.width);
  return widths.length ? Math.max(...widths) : 10;
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
  if (x > 155 && x < 260 && z > -165 && z < -90) return true;
  if (x > -265 && x < 195 && z > -315 && z < -165) return true;
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
