import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const failures = [];
const requireIncludes = (name, content, needles) => {
  for (const needle of needles) if (!content.includes(needle)) failures.push(`${name} missing ${needle}`);
};

const [html, contracts, roads, vehicles, game, pwa, models, car, world, stream, traffic, pursuit, race, fetchAssets] = await Promise.all([
  read('index.html'),
  read('src/game/contracts.ts'),
  read('src/game/RoadNetwork.ts'),
  read('src/game/VehicleCatalog.ts'),
  read('src/game/NeonPursuitGame.ts'),
  read('vite.config.ts'),
  read('src/game/ModelLibrary.ts'),
  read('src/game/ArcadeCar.ts'),
  read('src/game/WorldBuilder.ts'),
  read('src/game/AssetStreamManager.ts'),
  read('src/game/TrafficSystem.ts'),
  read('src/game/PursuitSystem.ts'),
  read('src/game/RaceSystem.ts'),
  read('scripts/fetch-assets.mjs')
]);

requireIncludes('index.html', html, [
  'game-canvas', 'steering-pad', 'vehicle-button', 'control-mode-button', 'pursuit-state', 'nitro-fill', 'rotate-device'
]);
requireIncludes('contracts.ts', contracts, [
  'RoadGraphDefinition', 'VehicleDefinition', 'VehicleTelemetry', 'PursuitState', 'QualityProfile', 'CustomizationState'
]);
requireIncludes('RoadNetwork.ts', roads, [
  'express-north', 'alley-cut', 'parking-cut', 'tunnel-cut', 'market-cut', 'SHORTCUTS'
]);
requireIncludes('VehicleCatalog.ts', vehicles, [
  'tuner-coupe', 'sports-sedan', 'hatch', 'muscle', 'exotic', 'traffic-sedan', 'traffic-van', 'utility-truck', 'police-interceptor', 'police-suv'
]);
requireIncludes('NeonPursuitGame.ts', game, [
  'TrafficSystem', 'PursuitSystem', 'RaceSystem', 'AudioDirector', 'PerformanceManager', 'buildWorld', 'ModelLibrary', 'models.preload'
]);
requireIncludes('ModelLibrary.ts', models, [
  "@babylonjs/loaders/glTF", 'LoadAssetContainerAsync', 'instantiateModelsToScene', 'road-straight-barrier', 'street-light', 'highway-sign', 'suburban-b', 'car-police'
]);
requireIncludes('ArcadeCar.ts', car, ['models.instantiate', 'playerModelForVehicle', 'visual.rotation.y = 0']);
requireIncludes('WorldBuilder.ts', world, [
  'createImportedRoadSegment', 'decorateRoadSegment', 'road-straight-barrier', 'street-light', 'highway-sign', 'buildingLimit', 'roadVisual.scaling.set(Math.max(3.5, road.width)'
]);
requireIncludes('AssetStreamManager.ts', stream, [
  'sedan-sports.glb', 'road-straight-barrier.glb', 'sign-highway-detailed.glb', 'city-kit-suburban', 'runtime-v3'
]);
requireIncludes('fetch-assets.mjs', fetchAssets, [
  'light-curved.glb', 'sign-highway-detailed.glb', 'building-skyscraper-d.glb', 'building-type-o.glb', 'tree-large.glb'
]);
requireIncludes('vite.config.ts', pwa, ['VitePWA', "display: 'fullscreen'", "orientation: 'landscape'", 'navigateFallback', 'glb']);

if (car.includes("MeshBuilder.CreateBox('car-body'")) failures.push('ArcadeCar.ts still contains the old procedural box car renderer');
if (world.includes('function createBuilding(')) failures.push('WorldBuilder.ts still contains the old procedural building generator');
if (models.includes("'kaze-s1': 'car-race'")) failures.push('Default street car still maps to the open-wheel race model');
if (traffic.includes('sample.yaw + Math.PI')) failures.push('Traffic models are still rotated 180 degrees from travel direction');
if (pursuit.includes('Math.atan2(direction.x, direction.z) + Math.PI')) failures.push('Police models are still rotated 180 degrees from pursuit direction');
if (race.includes('sample.yaw + Math.PI') || race.includes('start.yaw + Math.PI')) failures.push('Rival model is still rotated 180 degrees from route direction');
if (world.includes('road.width / 4') || world.includes('length / 4')) failures.push('Imported 1x1 road modules are still incorrectly scaled as 4x4 tiles');

if (failures.length > 0) {
  console.error('Neon Pursuit smoke checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Neon Pursuit smoke checks passed. Imported GLB art, forward-axis alignment, dense city composition and PWA hooks are present.');
