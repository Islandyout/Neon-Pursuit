import { Color3, Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { DistrictId, QualityTier, RoadEdge, RoadPoint } from './contracts';
import { ROAD_GRAPH } from './RoadNetwork';

interface DistrictStyle {
  buildingPalette: string[];
  minHeight: number;
  maxHeight: number;
  footprint: [number, number];
  signChance: number;
}

const DISTRICT_STYLES: Record<DistrictId, DistrictStyle> = {
  'shibuya-core': {
    buildingPalette: ['#202226', '#282a2e', '#313237', '#1a1c20'],
    minHeight: 28, maxHeight: 120, footprint: [18, 34], signChance: 0.28
  },
  'bay-industrial': {
    buildingPalette: ['#292b2c', '#343332', '#25282a', '#3b3934'],
    minHeight: 12, maxHeight: 42, footprint: [28, 54], signChance: 0.08
  },
  'elevated-loop': {
    buildingPalette: ['#222529', '#2e3134', '#191b1e'],
    minHeight: 22, maxHeight: 88, footprint: [20, 42], signChance: 0.08
  },
  'old-town': {
    buildingPalette: ['#282725', '#33302b', '#212224', '#393631'],
    minHeight: 10, maxHeight: 48, footprint: [14, 28], signChance: 0.16
  }
};

export interface WorldBuildStats {
  roads: number;
  buildings: number;
  shortcutMarkers: number;
}

export function buildWorld(scene: Scene, qualityTier: QualityTier): WorldBuildStats {
  const asphalt = material(scene, 'asphalt', '#1d2024', '#050505');
  asphalt.specularColor = Color3.FromHexString('#383d42');
  const lane = material(scene, 'lane-paint', '#b8b7ad', '#000000');
  const concrete = material(scene, 'concrete', '#303238', '#000000');
  const tunnelWall = material(scene, 'tunnel-wall', '#34373a', '#000000');
  const shortcutAccent = material(scene, 'shortcut-reflector', '#c7d4d2', '#18383b');
  const signMaterials = [
    material(scene, 'sign-cyan', '#6ca4a6', '#17484b'),
    material(scene, 'sign-magenta', '#9a546e', '#4a1d2e'),
    material(scene, 'sign-amber', '#a68f63', '#4a3917')
  ];

  const ground = MeshBuilder.CreateGround('city-base', { width: 1900, height: 1500 }, scene);
  ground.position.set(90, -0.07, -20);
  ground.material = material(scene, 'city-base-material', '#111316', '#000000');

  let roadCount = 0;
  for (const road of ROAD_GRAPH.edges) {
    for (let index = 1; index < road.points.length; index += 1) {
      createRoadSegment(scene, road, road.points[index - 1], road.points[index], asphalt, lane, concrete, tunnelWall);
      roadCount += 1;
    }
  }

  const buildingBudget = qualityTier === 'desktop' ? 170 : qualityTier === 'mobile-high' ? 115 : 70;
  let buildingCount = 0;
  let attempts = 0;
  while (buildingCount < buildingBudget && attempts < buildingBudget * 10) {
    attempts += 1;
    const seed = hash(attempts * 923 + 41);
    const x = -650 + pseudo(seed) * 1450;
    const z = -500 + pseudo(seed + 37) * 1000;
    const road = closestRoad({ x, z });
    const roadDistance = distanceToRoad({ x, z }, road);
    if (roadDistance < road.width * 0.85 + 13) continue;

    const district = inferDistrict(x, z, road.district);
    const style = DISTRICT_STYLES[district];
    const width = lerp(style.footprint[0], style.footprint[1], pseudo(seed + 11));
    const depth = lerp(style.footprint[0], style.footprint[1] * 1.15, pseudo(seed + 17));
    const height = lerp(style.minHeight, style.maxHeight, Math.pow(pseudo(seed + 23), 1.3));

    const building = MeshBuilder.CreateBox(`building-${buildingCount}`, { width, depth, height }, scene);
    building.position.set(x, height * 0.5, z);
    building.rotation.y = (pseudo(seed + 29) - 0.5) * 0.24;
    const facade = material(scene, `facade-${buildingCount}`, style.buildingPalette[Math.floor(pseudo(seed + 31) * style.buildingPalette.length)], '#000000');
    facade.specularColor = Color3.FromHexString(district === 'shibuya-core' ? '#242a2d' : '#17191b');
    building.material = facade;

    if (pseudo(seed + 43) < style.signChance) {
      const sign = MeshBuilder.CreateBox(`sign-${buildingCount}`, { width: Math.min(width * 0.72, 18), height: 1.5 + pseudo(seed + 47) * 2.8, depth: 0.16 }, scene);
      sign.position.set(building.position.x, Math.min(height - 3, 7 + pseudo(seed + 53) * 18), building.position.z - depth * 0.505);
      sign.rotation.y = building.rotation.y;
      sign.material = signMaterials[Math.floor(pseudo(seed + 59) * signMaterials.length)];
    }

    buildingCount += 1;
  }

  let shortcutMarkers = 0;
  for (const road of ROAD_GRAPH.edges.filter((entry) => entry.shortcut)) {
    const first = road.points[0];
    const marker = MeshBuilder.CreateBox(`shortcut-marker-${road.id}`, { width: 0.22, height: 0.08, depth: Math.max(4, road.width * 0.7) }, scene);
    marker.position.set(first.x, 0.11, first.z);
    marker.rotation.y = segmentYaw(road.points[0], road.points[1]);
    marker.material = shortcutAccent;
    shortcutMarkers += 1;
  }

  return { roads: roadCount, buildings: buildingCount, shortcutMarkers };
}

function createRoadSegment(
  scene: Scene,
  road: RoadEdge,
  a: RoadPoint,
  b: RoadPoint,
  asphalt: StandardMaterial,
  lane: StandardMaterial,
  concrete: StandardMaterial,
  tunnelWall: StandardMaterial
): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const elevated = road.roadClass === 'expressway';
  const y = elevated ? 4.2 : 0;
  const strip = MeshBuilder.CreateBox(`road-${road.id}-${a.x}-${a.z}`, { width: road.width, height: 0.12, depth: length + 1 }, scene);
  strip.position.set((a.x + b.x) * 0.5, y, (a.z + b.z) * 0.5);
  strip.rotation.y = yaw;
  strip.material = asphalt;

  if (road.roadClass !== 'alley' && road.roadClass !== 'parking') {
    const marking = MeshBuilder.CreateBox(`marking-${road.id}-${a.x}-${a.z}`, { width: 0.22, height: 0.025, depth: Math.max(4, length * 0.72) }, scene);
    marking.position.set(strip.position.x, y + 0.075, strip.position.z);
    marking.rotation.y = yaw;
    marking.material = lane;
  }

  if (elevated) {
    const supports = Math.max(1, Math.floor(length / 90));
    for (let i = 0; i < supports; i += 1) {
      const t = (i + 0.5) / supports;
      const support = MeshBuilder.CreateBox(`support-${road.id}-${i}-${a.x}`, { width: 2.2, height: 4.2, depth: 2.2 }, scene);
      support.position.set(a.x + dx * t, 2.05, a.z + dz * t);
      support.material = concrete;
    }
  }

  if (road.roadClass === 'tunnel') {
    const normal = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox(`tunnel-wall-${road.id}-${side}-${a.x}`, { width: 0.75, height: 4.8, depth: length + 1 }, scene);
      wall.position.set(strip.position.x + normal.x * road.width * 0.55 * side, 2.35, strip.position.z + normal.z * road.width * 0.55 * side);
      wall.rotation.y = yaw;
      wall.material = tunnelWall;
    }
  }
}

function inferDistrict(x: number, z: number, fallback: DistrictId): DistrictId {
  if (x > 360 && z < -120) return 'bay-industrial';
  if (z > 280 || Math.abs(x) > 520) return 'elevated-loop';
  if (x < -120 && z < -120) return 'old-town';
  return fallback === 'elevated-loop' ? 'shibuya-core' : fallback;
}

function closestRoad(point: RoadPoint): RoadEdge {
  let best = ROAD_GRAPH.edges[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const road of ROAD_GRAPH.edges) {
    const candidate = distanceToRoad(point, road);
    if (candidate < distance) {
      distance = candidate;
      best = road;
    }
  }
  return best;
}

function distanceToRoad(point: RoadPoint, road: RoadEdge): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < road.points.length; index += 1) {
    const a = road.points[index - 1];
    const b = road.points[index];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    best = Math.min(best, Math.hypot(point.x - px, point.z - pz));
  }
  return best;
}

function material(scene: Scene, name: string, diffuse: string, emissive: string): StandardMaterial {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(diffuse);
  result.emissiveColor = Color3.FromHexString(emissive);
  result.specularColor = Color3.FromHexString('#101113');
  return result;
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
  return (hash(seed) % 10000) / 10000;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
