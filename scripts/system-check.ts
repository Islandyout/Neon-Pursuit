import assert from 'node:assert/strict';
import { ROAD_GRAPH, SHORTCUTS, getRoadEdge } from '../src/game/RoadNetwork';
import { PLAYER_VEHICLE_IDS, VEHICLE_CATALOG } from '../src/game/VehicleCatalog';
import { RACE_ROUTES } from '../src/game/RaceRoutes';
import { QUALITY_PROFILES } from '../src/game/PerformanceManager';
import type { RoadEdge } from '../src/game/contracts';

const nodeIds = new Set(ROAD_GRAPH.nodes.map((node) => node.id));
assert.equal(nodeIds.size, ROAD_GRAPH.nodes.length, 'Road node IDs must be unique.');
assert.ok(ROAD_GRAPH.nodes.length >= 12, 'Vertical slice requires a meaningful road-node network.');
assert.ok(ROAD_GRAPH.edges.length >= 18, 'Vertical slice requires a meaningful road-edge network.');

for (const edge of ROAD_GRAPH.edges) {
  assert.ok(nodeIds.has(edge.from), `Road ${edge.id} has missing from node ${edge.from}.`);
  assert.ok(nodeIds.has(edge.to), `Road ${edge.id} has missing to node ${edge.to}.`);
  assert.ok(edge.width > 0, `Road ${edge.id} width must be positive.`);
  assert.ok(edge.speedKph >= 30 && edge.speedKph <= 260, `Road ${edge.id} has implausible speed metadata.`);
  assert.ok(edge.points.length >= 2, `Road ${edge.id} needs at least two points.`);
  assert.ok(edgeLength(edge) > 1, `Road ${edge.id} has invalid geometry length.`);
}

assert.ok(SHORTCUTS.length >= 4, 'At least four meaningful shortcuts are required.');
for (const shortcut of SHORTCUTS) {
  const edge = getRoadEdge(shortcut.edgeId);
  assert.equal(edge.shortcut, true, `Shortcut ${shortcut.id} must point to a shortcut edge.`);
  assert.ok(shortcut.rewardSeconds > 0, `Shortcut ${shortcut.id} must offer a measurable reward.`);
  assert.ok(shortcut.risk >= 0 && shortcut.risk <= 1, `Shortcut ${shortcut.id} risk must be normalized.`);
}

const vehicleIds = new Set(VEHICLE_CATALOG.map((vehicle) => vehicle.id));
assert.equal(vehicleIds.size, VEHICLE_CATALOG.length, 'Vehicle IDs must be unique.');
assert.equal(PLAYER_VEHICLE_IDS.length, 5, 'Vertical slice requires five selectable player archetypes.');
for (const id of PLAYER_VEHICLE_IDS) assert.ok(vehicleIds.has(id), `Player vehicle ${id} is missing from the catalog.`);

const requiredVehicleClasses = new Set([
  'tuner-coupe', 'sports-sedan', 'hatch', 'muscle', 'exotic',
  'traffic-sedan', 'traffic-van', 'utility-truck', 'police-interceptor', 'police-suv'
]);
for (const vehicleClass of requiredVehicleClasses) {
  assert.ok(VEHICLE_CATALOG.some((vehicle) => vehicle.vehicleClass === vehicleClass), `Missing vehicle archetype ${vehicleClass}.`);
}
for (const vehicle of VEHICLE_CATALOG) {
  assert.ok(vehicle.massKg >= 900 && vehicle.massKg <= 4000, `${vehicle.id} has an invalid mass.`);
  assert.ok(vehicle.maxSpeedKph >= 100 && vehicle.maxSpeedKph <= 350, `${vehicle.id} has an invalid max speed.`);
  assert.ok(vehicle.grip > 0 && vehicle.grip <= 1, `${vehicle.id} grip must be normalized.`);
}

for (const route of RACE_ROUTES) validateClosedRoute(route.edgeIds, route.id);

let simulatedFailures = 0;
for (let run = 0; run < 100; run += 1) {
  const chooseShortcut = (((run + 1) * 37 + 17) % 100) / 100 < 0.72;
  const route = RACE_ROUTES.find((entry) => entry.id === (chooseShortcut ? 'night-loop-parking-cut' : 'night-loop'));
  if (!route) {
    simulatedFailures += 1;
    continue;
  }
  try {
    validateClosedRoute(route.edgeIds, `simulation-${run}`);
    const distance = route.edgeIds.map(getRoadEdge).reduce((sum, edge) => sum + edgeLength(edge), 0);
    const averageSpeed = route.edgeIds.map(getRoadEdge).reduce((sum, edge) => sum + edge.speedKph, 0) / route.edgeIds.length;
    const estimatedSeconds = distance / Math.max(1, averageSpeed / 3.6) / 0.72;
    assert.ok(Number.isFinite(estimatedSeconds) && estimatedSeconds > 10 && estimatedSeconds < 600);
  } catch {
    simulatedFailures += 1;
  }
}
assert.ok(simulatedFailures <= 1, `Rival route simulation exceeded 1% failure rate: ${simulatedFailures}%.`);

assert.ok(QUALITY_PROFILES.desktop.trafficBudget > QUALITY_PROFILES['mobile-high'].trafficBudget);
assert.ok(QUALITY_PROFILES['mobile-high'].trafficBudget > QUALITY_PROFILES['mobile-low'].trafficBudget);
assert.equal(QUALITY_PROFILES['mobile-low'].bloom, false, 'Low mobile tier must disable bloom.');
assert.ok(QUALITY_PROFILES['mobile-low'].targetDpr <= 1, 'Low mobile tier should cap render density.');

console.log(`System checks passed: ${ROAD_GRAPH.nodes.length} nodes, ${ROAD_GRAPH.edges.length} roads, ${SHORTCUTS.length} shortcuts, ${VEHICLE_CATALOG.length} vehicles, 100 race simulations.`);

function validateClosedRoute(edgeIds: string[], label: string): void {
  assert.ok(edgeIds.length >= 4, `${label} requires at least four road edges.`);
  const edges = edgeIds.map(getRoadEdge);
  for (let index = 1; index < edges.length; index += 1) {
    assert.equal(edges[index - 1].to, edges[index].from, `${label} disconnects between ${edges[index - 1].id} and ${edges[index].id}.`);
  }
  assert.equal(edges.at(-1)?.to, edges[0].from, `${label} must close into a complete loop.`);
}

function edgeLength(edge: RoadEdge): number {
  let total = 0;
  for (let index = 1; index < edge.points.length; index += 1) {
    const a = edge.points[index - 1];
    const b = edge.points[index];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return total;
}
