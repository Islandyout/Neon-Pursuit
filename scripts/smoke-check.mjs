import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');
const failures = [];
const requireIncludes = (name, content, needles) => {
  for (const needle of needles) if (!content.includes(needle)) failures.push(`${name} missing ${needle}`);
};

const [html, contracts, roads, vehicles, game, pwa, models, car, world, stream] = await Promise.all([
  read('index.html'),
  read('src/game/contracts.ts'),
  read('src/game/RoadNetwork.ts'),
  read('src/game/VehicleCatalog.ts'),
  read('src/game/NeonPursuitGame.ts'),
  read('vite.config.ts'),
  read('src/game/ModelLibrary.ts'),
  read('src/game/ArcadeCar.ts'),
  read('src/game/WorldBuilder.ts'),
  read('src/game/AssetStreamManager.ts')
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
  "@babylonjs/loaders/glTF", 'LoadAssetContainerAsync', 'instantiateModelsToScene', 'road-straight', 'building-skyscraper-a', 'car-police'
]);
requireIncludes('ArcadeCar.ts', car, ['models.instantiate', 'playerModelForVehicle']);
requireIncludes('WorldBuilder.ts', world, ["models.instantiate('road-straight'", 'building-skyscraper-a', 'createImportedRoadSegment']);
requireIncludes('AssetStreamManager.ts', stream, ['race.glb', 'road-straight.glb', 'building-a.glb']);
requireIncludes('vite.config.ts', pwa, ['VitePWA', "display: 'fullscreen'", "orientation: 'landscape'", 'navigateFallback', 'glb']);

if (car.includes("MeshBuilder.CreateBox('car-body'")) failures.push('ArcadeCar.ts still contains the old procedural box car renderer');
if (world.includes('function createBuilding(')) failures.push('WorldBuilder.ts still contains the old procedural building generator');

if (failures.length > 0) {
  console.error('Neon Pursuit smoke checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Neon Pursuit smoke checks passed. Imported GLB art pipeline, gameplay systems and PWA hooks are present.');
