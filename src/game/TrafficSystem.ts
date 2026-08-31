import { Vector3 } from '@babylonjs/core/Maths/math';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { QualityTier, RoadEdge, RoadPoint, VehicleClass } from './contracts';
import { ROAD_GRAPH, getConnectedEdges } from './RoadNetwork';
import { ModelLibrary, modelForVehicleClass } from './ModelLibrary';

interface TrafficAgent {
  mesh: TransformNode;
  road: RoadEdge;
  distance: number;
  speed: number;
  seed: number;
  laneOffset: number;
}

const TRAFFIC_CLASSES: VehicleClass[] = ['traffic-sedan', 'traffic-sedan', 'traffic-van', 'utility-truck'];

export class TrafficSystem {
  private readonly agents: TrafficAgent[] = [];

  constructor(private readonly models: ModelLibrary, qualityTier: QualityTier) {
    const budget = qualityTier === 'desktop' ? 22 : qualityTier === 'mobile-high' ? 14 : 8;
    const roads = ROAD_GRAPH.edges.filter((road) => !road.shortcut && road.trafficDensity !== 0 && road.roadClass !== 'parking');
    for (let index = 0; index < budget; index += 1) {
      const road = roads[index % roads.length];
      const seed = index * 97 + 13;
      this.agents.push(this.createAgent(road, seed, edgeLength(road) * ((index * 0.37) % 1)));
    }
  }

  update(dt: number, playerPosition: Vector3): void {
    const safeDt = Math.min(dt, 0.05);
    for (const agent of this.agents) {
      const playerDistance = Vector3.Distance(agent.mesh.position, playerPosition);
      const targetSpeed = Math.min(agent.road.speedKph * 0.48, agent.road.roadClass === 'expressway' ? 42 : 26);
      const proximitySlowdown = playerDistance < 14 ? 0.18 : playerDistance < 28 ? 0.55 : playerDistance < 42 ? 0.82 : 1;
      agent.speed += (targetSpeed * proximitySlowdown - agent.speed) * Math.min(1, safeDt * 2.2);
      agent.distance += agent.speed * safeDt;

      const length = edgeLength(agent.road);
      if (agent.distance > length) {
        const overflow = agent.distance - length;
        const connected = getConnectedEdges(agent.road.to).filter((road) => !road.shortcut && road.id !== agent.road.id);
        if (connected.length > 0) {
          agent.road = connected[(agent.seed + Math.floor(performance.now() / 8000)) % connected.length];
          agent.laneOffset = computeLaneOffset(agent.road, agent.seed);
        }
        agent.distance = Math.min(overflow, edgeLength(agent.road) * 0.25);
      }

      const sample = sampleEdge(agent.road, agent.distance);
      const rightX = Math.cos(sample.yaw);
      const rightZ = -Math.sin(sample.yaw);
      const avoid = playerDistance < 20 ? Math.sign(agent.laneOffset || (agent.seed % 2 === 0 ? 1 : -1)) * 0.75 : 0;
      agent.mesh.position.set(
        sample.position.x + rightX * (agent.laneOffset + avoid),
        agent.road.roadClass === 'expressway' ? 4.45 : 0.06,
        sample.position.z + rightZ * (agent.laneOffset + avoid)
      );
      agent.mesh.rotation.y = sample.yaw + Math.PI;
      agent.mesh.setEnabled(playerDistance < 700);
    }
  }

  dispose(): void {
    for (const agent of this.agents) agent.mesh.dispose(false);
    this.agents.length = 0;
  }

  private createAgent(road: RoadEdge, seed: number, distance: number): TrafficAgent {
    const vehicleClass = TRAFFIC_CLASSES[seed % TRAFFIC_CLASSES.length];
    const mesh = this.models.instantiate(modelForVehicleClass(vehicleClass), `traffic-${seed}`);
    const scale = vehicleClass === 'utility-truck' ? 1.72 : vehicleClass === 'traffic-van' ? 1.64 : 1.58;
    mesh.scaling.setAll(scale);
    const laneOffset = computeLaneOffset(road, seed);
    const sample = sampleEdge(road, distance);
    const rightX = Math.cos(sample.yaw);
    const rightZ = -Math.sin(sample.yaw);
    mesh.position.set(
      sample.position.x + rightX * laneOffset,
      road.roadClass === 'expressway' ? 4.45 : 0.06,
      sample.position.z + rightZ * laneOffset
    );
    mesh.rotation.y = sample.yaw + Math.PI;
    return { mesh, road, distance, speed: 8 + (seed % 9), seed, laneOffset };
  }
}

export function edgeLength(road: RoadEdge): number {
  let total = 0;
  for (let index = 1; index < road.points.length; index += 1) total += pointDistance(road.points[index - 1], road.points[index]);
  return total;
}

export function sampleEdge(road: RoadEdge, distance: number): { position: RoadPoint; yaw: number } {
  let remaining = Math.max(0, distance);
  for (let index = 1; index < road.points.length; index += 1) {
    const a = road.points[index - 1];
    const b = road.points[index];
    const length = pointDistance(a, b);
    if (remaining <= length || index === road.points.length - 1) {
      const t = length === 0 ? 0 : Math.min(1, remaining / length);
      return {
        position: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t },
        yaw: Math.atan2(b.x - a.x, b.z - a.z)
      };
    }
    remaining -= length;
  }
  const last = road.points[road.points.length - 1];
  const previous = road.points[Math.max(0, road.points.length - 2)];
  return { position: last, yaw: Math.atan2(last.x - previous.x, last.z - previous.z) };
}

function computeLaneOffset(road: RoadEdge, seed: number): number {
  if (road.lanes <= 1) return 0;
  const usableHalfWidth = Math.max(1.8, road.width * 0.34);
  const laneIndex = seed % Math.min(road.lanes, 3);
  const normalized = road.lanes === 2 ? (laneIndex === 0 ? -0.5 : 0.5) : (laneIndex - 1) / 1.15;
  return normalized * usableHalfWidth;
}

function pointDistance(a: RoadPoint, b: RoadPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}
