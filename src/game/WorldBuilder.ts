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

type BuildingArchetype = 'retail' | 'office' | 'residential' | 'warehouse';

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
  const materials = createMaterialLibrary(scene);
  const ground = MeshBuilder.CreateGround('city-base', { width: 1900, height: 1500 }, scene);
  ground.position.set(90, -0.07, -20);
  ground.material = materials.cityBase;

  let roadCount = 0;
  for (const road of ROAD_GRAPH.edges) {
    for (let index = 1; index < road.points.length; index += 1) {
      createRoadSegment(scene, road, road.points[index - 1], road.points[index], materials);
      roadCount += 1;
    }
  }

  const buildingBudget = qualityTier === 'desktop' ? 165 : qualityTier === 'mobile-high' ? 108 : 66;
  let buildingCount = 0;
  let attempts = 0;
  while (buildingCount < buildingBudget && attempts < buildingBudget * 11) {
    attempts += 1;
    const seed = hash(attempts * 923 + 41);
    const x = -650 + pseudo(seed) * 1450;
    const z = -500 + pseudo(seed + 37) * 1000;
    const road = closestRoad({ x, z });
    const roadDistance = distanceToRoad({ x, z }, road);
    if (roadDistance < road.width * 0.85 + 13) continue;
    if (isReservedLandmarkZone(x, z)) continue;

    const district = inferDistrict(x, z, road.district);
    const style = DISTRICT_STYLES[district];
    const width = lerp(style.footprint[0], style.footprint[1], pseudo(seed + 11));
    const depth = lerp(style.footprint[0], style.footprint[1] * 1.15, pseudo(seed + 17));
    const height = lerp(style.minHeight, style.maxHeight, Math.pow(pseudo(seed + 23), 1.3));
    const archetype = chooseArchetype(district, seed);
    createBuilding(scene, buildingCount, { x, z, width, depth, height, district, archetype, seed }, materials);
    buildingCount += 1;
  }

  buildParkingGarage(scene, materials);
  buildConvenienceStore(scene, materials);
  buildIndustrialDepot(scene, materials);
  buildTunnelPortals(scene, materials);
  if (qualityTier !== 'mobile-low') buildStreetFurniture(scene, materials, qualityTier);

  let shortcutMarkers = 0;
  for (const road of ROAD_GRAPH.edges.filter((entry) => entry.shortcut)) {
    const first = road.points[0];
    const marker = MeshBuilder.CreateBox(`shortcut-marker-${road.id}`, { width: 0.22, height: 0.07, depth: Math.max(4, road.width * 0.7) }, scene);
    marker.position.set(first.x, 0.11, first.z);
    marker.rotation.y = segmentYaw(road.points[0], road.points[1]);
    marker.material = materials.shortcutAccent;
    shortcutMarkers += 1;
  }

  return { roads: roadCount, buildings: buildingCount, shortcutMarkers };
}

interface BuildingParams {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  district: DistrictId;
  archetype: BuildingArchetype;
  seed: number;
}

interface MaterialLibrary {
  cityBase: StandardMaterial;
  asphalt: StandardMaterial;
  lane: StandardMaterial;
  shoulder: StandardMaterial;
  concrete: StandardMaterial;
  darkConcrete: StandardMaterial;
  glass: StandardMaterial;
  tunnelWall: StandardMaterial;
  shortcutAccent: StandardMaterial;
  signCyan: StandardMaterial;
  signMagenta: StandardMaterial;
  signAmber: StandardMaterial;
  warmWindow: StandardMaterial;
  coolWindow: StandardMaterial;
  industrial: StandardMaterial;
  facades: Record<DistrictId, StandardMaterial[]>;
}

function createMaterialLibrary(scene: Scene): MaterialLibrary {
  const facades = {} as Record<DistrictId, StandardMaterial[]>;
  for (const [district, style] of Object.entries(DISTRICT_STYLES) as Array<[DistrictId, DistrictStyle]>) {
    facades[district] = style.buildingPalette.map((color, index) => {
      const facade = material(scene, `facade-${district}-${index}`, color, '#000000');
      facade.specularColor = Color3.FromHexString(district === 'shibuya-core' ? '#242a2d' : '#17191b');
      return facade;
    });
  }

  const asphalt = material(scene, 'asphalt', '#1c1f22', '#030404');
  asphalt.specularColor = Color3.FromHexString('#3b4144');
  const glass = material(scene, 'shared-glass', '#13191c', '#050708');
  glass.specularColor = Color3.FromHexString('#4d5b60');
  const warmWindow = material(scene, 'warm-window', '#75684d', '#332817');
  const coolWindow = material(scene, 'cool-window', '#53686c', '#172b2f');

  return {
    cityBase: material(scene, 'city-base-material', '#101215', '#000000'),
    asphalt,
    lane: material(scene, 'lane-paint', '#aaa99f', '#000000'),
    shoulder: material(scene, 'shoulder-paint', '#555b5c', '#000000'),
    concrete: material(scene, 'concrete', '#303238', '#000000'),
    darkConcrete: material(scene, 'dark-concrete', '#212427', '#000000'),
    glass,
    tunnelWall: material(scene, 'tunnel-wall', '#34373a', '#000000'),
    shortcutAccent: material(scene, 'shortcut-reflector', '#c7d4d2', '#18383b'),
    signCyan: material(scene, 'sign-cyan', '#6ca4a6', '#17484b'),
    signMagenta: material(scene, 'sign-magenta', '#9a546e', '#4a1d2e'),
    signAmber: material(scene, 'sign-amber', '#a68f63', '#4a3917'),
    warmWindow,
    coolWindow,
    industrial: material(scene, 'industrial-metal', '#353532', '#000000'),
    facades
  };
}

function createBuilding(scene: Scene, index: number, params: BuildingParams, materials: MaterialLibrary): void {
  const facadeChoices = materials.facades[params.district];
  const facade = facadeChoices[Math.floor(pseudo(params.seed + 31) * facadeChoices.length)];
  const building = MeshBuilder.CreateBox(`building-${index}`, { width: params.width, depth: params.depth, height: params.height }, scene);
  building.position.set(params.x, params.height * 0.5, params.z);
  building.rotation.y = (pseudo(params.seed + 29) - 0.5) * 0.18;
  building.material = facade;

  if (params.archetype === 'office') {
    const crownHeight = Math.min(5.5, params.height * 0.08);
    const crown = MeshBuilder.CreateBox(`office-crown-${index}`, { width: params.width * 0.78, depth: params.depth * 0.78, height: crownHeight }, scene);
    crown.position.set(params.x, params.height + crownHeight * 0.5, params.z);
    crown.rotation.y = building.rotation.y;
    crown.material = materials.glass;
    addWindowBands(scene, index, params, building.rotation.y, materials.coolWindow);
  } else if (params.archetype === 'retail') {
    const canopy = MeshBuilder.CreateBox(`retail-canopy-${index}`, { width: params.width * 0.9, height: 0.35, depth: 2.6 }, scene);
    canopy.position.set(params.x, 3.1, params.z - params.depth * 0.53);
    canopy.rotation.y = building.rotation.y;
    canopy.material = materials.darkConcrete;
    const storefront = MeshBuilder.CreateBox(`retail-window-${index}`, { width: params.width * 0.72, height: 2.1, depth: 0.12 }, scene);
    storefront.position.set(params.x, 1.65, params.z - params.depth * 0.506);
    storefront.rotation.y = building.rotation.y;
    storefront.material = pseudo(params.seed + 5) > 0.5 ? materials.warmWindow : materials.coolWindow;
  } else if (params.archetype === 'residential') {
    const rooftop = MeshBuilder.CreateBox(`residential-rooftop-${index}`, { width: Math.min(7, params.width * 0.34), height: 2.3, depth: Math.min(6, params.depth * 0.3) }, scene);
    rooftop.position.set(params.x, params.height + 1.15, params.z);
    rooftop.rotation.y = building.rotation.y;
    rooftop.material = materials.darkConcrete;
    addWindowBands(scene, index, params, building.rotation.y, materials.warmWindow);
  } else {
    const roofVent = MeshBuilder.CreateBox(`warehouse-vent-${index}`, { width: params.width * 0.28, height: 1.3, depth: params.depth * 0.22 }, scene);
    roofVent.position.set(params.x, params.height + 0.65, params.z);
    roofVent.rotation.y = building.rotation.y;
    roofVent.material = materials.industrial;
  }

  const style = DISTRICT_STYLES[params.district];
  if (pseudo(params.seed + 43) < style.signChance) {
    const signMaterials = [materials.signCyan, materials.signMagenta, materials.signAmber];
    const sign = MeshBuilder.CreateBox(`sign-${index}`, { width: Math.min(params.width * 0.72, 18), height: 1.5 + pseudo(params.seed + 47) * 2.8, depth: 0.16 }, scene);
    sign.position.set(params.x, Math.min(params.height - 3, 7 + pseudo(params.seed + 53) * 18), params.z - params.depth * 0.505);
    sign.rotation.y = building.rotation.y;
    sign.material = signMaterials[Math.floor(pseudo(params.seed + 59) * signMaterials.length)];
  }
}

function addWindowBands(scene: Scene, index: number, params: BuildingParams, rotation: number, windowMaterial: StandardMaterial): void {
  const bandCount = Math.min(5, Math.max(1, Math.floor(params.height / 20)));
  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const band = MeshBuilder.CreateBox(`window-band-${index}-${bandIndex}`, { width: params.width * 0.76, height: 0.55, depth: 0.08 }, scene);
    band.position.set(params.x, 7 + bandIndex * Math.max(6, params.height / (bandCount + 1)), params.z - params.depth * 0.504);
    band.rotation.y = rotation;
    band.material = windowMaterial;
  }
}

function buildParkingGarage(scene: Scene, materials: MaterialLibrary): void {
  const center = new Vector3(210, 0, -128);
  const width = 128;
  const depth = 72;
  for (let level = 0; level < 4; level += 1) {
    const slab = MeshBuilder.CreateBox(`parking-slab-${level}`, { width, height: 0.5, depth }, scene);
    slab.position.set(center.x, 1.2 + level * 4.1, center.z);
    slab.material = materials.concrete;
  }
  for (const x of [-54, -18, 18, 54]) {
    for (const z of [-28, 28]) {
      const column = MeshBuilder.CreateBox(`parking-column-${x}-${z}`, { width: 1.7, height: 13, depth: 1.7 }, scene);
      column.position.set(center.x + x, 6.7, center.z + z);
      column.material = materials.darkConcrete;
    }
  }
  const ramp = MeshBuilder.CreateBox('parking-visible-ramp', { width: 15, height: 0.5, depth: 62 }, scene);
  ramp.position.set(center.x + 34, 7, center.z);
  ramp.rotation.x = -0.16;
  ramp.material = materials.asphalt;
}

function buildConvenienceStore(scene: Scene, materials: MaterialLibrary): void {
  const base = MeshBuilder.CreateBox('corner-store', { width: 28, height: 5.5, depth: 18 }, scene);
  base.position.set(-68, 2.75, 54);
  base.material = materials.facades['shibuya-core'][1];
  const windows = MeshBuilder.CreateBox('corner-store-windows', { width: 22, height: 2.5, depth: 0.12 }, scene);
  windows.position.set(-68, 2.05, 44.95);
  windows.material = materials.warmWindow;
  const canopy = MeshBuilder.CreateBox('corner-store-canopy', { width: 30, height: 0.35, depth: 3.2 }, scene);
  canopy.position.set(-68, 4.4, 44.2);
  canopy.material = materials.signCyan;
}

function buildIndustrialDepot(scene: Scene, materials: MaterialLibrary): void {
  const warehouse = MeshBuilder.CreateBox('bay-depot', { width: 92, height: 17, depth: 58 }, scene);
  warehouse.position.set(600, 8.5, -405);
  warehouse.material = materials.industrial;
  for (let doorIndex = 0; doorIndex < 4; doorIndex += 1) {
    const door = MeshBuilder.CreateBox(`bay-depot-door-${doorIndex}`, { width: 13, height: 8, depth: 0.15 }, scene);
    door.position.set(568 + doorIndex * 21, 4.2, -375.9);
    door.material = materials.darkConcrete;
  }
}

function buildTunnelPortals(scene: Scene, materials: MaterialLibrary): void {
  for (const [name, x, z, yaw] of [
    ['tunnel-west', -260, -170, -0.35],
    ['tunnel-east', 180, -300, -0.15]
  ] as Array<[string, number, number, number]>) {
    const top = MeshBuilder.CreateBox(`${name}-top`, { width: 19, height: 1.2, depth: 2.2 }, scene);
    top.position.set(x, 5.1, z);
    top.rotation.y = yaw;
    top.material = materials.concrete;
    for (const side of [-1, 1]) {
      const pillar = MeshBuilder.CreateBox(`${name}-pillar-${side}`, { width: 1.2, height: 5.2, depth: 2.2 }, scene);
      pillar.position.set(x + side * 8.7, 2.6, z);
      pillar.rotation.y = yaw;
      pillar.material = materials.concrete;
    }
  }
}

function buildStreetFurniture(scene: Scene, materials: MaterialLibrary, qualityTier: QualityTier): void {
  const interval = qualityTier === 'desktop' ? 55 : 85;
  for (let x = -330; x <= 330; x += interval) {
    for (const z of [-16, 16]) {
      const pole = MeshBuilder.CreateCylinder(`street-pole-${x}-${z}`, { diameter: 0.18, height: 5.5, tessellation: 8 }, scene);
      pole.position.set(x, 2.75, z);
      pole.material = materials.darkConcrete;
      const lamp = MeshBuilder.CreateBox(`street-lamp-${x}-${z}`, { width: 1.3, height: 0.14, depth: 0.42 }, scene);
      lamp.position.set(x, 5.35, z);
      lamp.material = materials.warmWindow;
    }
  }
}

function createRoadSegment(scene: Scene, road: RoadEdge, a: RoadPoint, b: RoadPoint, materials: MaterialLibrary): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const elevated = road.roadClass === 'expressway';
  const y = elevated ? 4.2 : 0;
  const strip = MeshBuilder.CreateBox(`road-${road.id}-${a.x}-${a.z}`, { width: road.width, height: 0.12, depth: length + 1 }, scene);
  strip.position.set((a.x + b.x) * 0.5, y, (a.z + b.z) * 0.5);
  strip.rotation.y = yaw;
  strip.material = materials.asphalt;

  if (road.roadClass !== 'alley' && road.roadClass !== 'parking') {
    const marking = MeshBuilder.CreateBox(`marking-${road.id}-${a.x}-${a.z}`, { width: 0.2, height: 0.025, depth: Math.max(4, length * 0.72) }, scene);
    marking.position.set(strip.position.x, y + 0.075, strip.position.z);
    marking.rotation.y = yaw;
    marking.material = materials.lane;
  }

  if (road.width >= 16) {
    for (const side of [-1, 1]) {
      const shoulder = MeshBuilder.CreateBox(`shoulder-${road.id}-${side}-${a.x}`, { width: 0.12, height: 0.02, depth: Math.max(4, length * 0.9) }, scene);
      const normal = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      shoulder.position.set(strip.position.x + normal.x * road.width * 0.43 * side, y + 0.075, strip.position.z + normal.z * road.width * 0.43 * side);
      shoulder.rotation.y = yaw;
      shoulder.material = materials.shoulder;
    }
  }

  if (elevated) {
    const supports = Math.max(1, Math.floor(length / 90));
    for (let i = 0; i < supports; i += 1) {
      const t = (i + 0.5) / supports;
      const support = MeshBuilder.CreateBox(`support-${road.id}-${i}-${a.x}`, { width: 2.2, height: 4.2, depth: 2.2 }, scene);
      support.position.set(a.x + dx * t, 2.05, a.z + dz * t);
      support.material = materials.concrete;
    }
  }

  if (road.roadClass === 'tunnel') {
    const normal = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    for (const side of [-1, 1]) {
      const wall = MeshBuilder.CreateBox(`tunnel-wall-${road.id}-${side}-${a.x}`, { width: 0.75, height: 4.8, depth: length + 1 }, scene);
      wall.position.set(strip.position.x + normal.x * road.width * 0.55 * side, 2.35, strip.position.z + normal.z * road.width * 0.55 * side);
      wall.rotation.y = yaw;
      wall.material = materials.tunnelWall;
    }
    const ceiling = MeshBuilder.CreateBox(`tunnel-ceiling-${road.id}-${a.x}`, { width: road.width + 1.2, height: 0.55, depth: length + 1 }, scene);
    ceiling.position.set(strip.position.x, 4.8, strip.position.z);
    ceiling.rotation.y = yaw;
    ceiling.material = materials.darkConcrete;
  }
}

function chooseArchetype(district: DistrictId, seed: number): BuildingArchetype {
  const value = pseudo(seed + 83);
  if (district === 'bay-industrial') return value < 0.72 ? 'warehouse' : 'office';
  if (district === 'old-town') return value < 0.58 ? 'retail' : 'residential';
  if (district === 'shibuya-core') return value < 0.38 ? 'retail' : value < 0.78 ? 'office' : 'residential';
  return value < 0.6 ? 'office' : 'residential';
}

function isReservedLandmarkZone(x: number, z: number): boolean {
  const zones = [
    { x: 210, z: -128, radius: 82 },
    { x: -68, z: 54, radius: 38 },
    { x: 600, z: -405, radius: 70 }
  ];
  return zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius);
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
