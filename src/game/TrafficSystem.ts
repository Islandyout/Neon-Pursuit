import { Color3, Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { QualityTier, RoadEdge, RoadPoint } from './contracts';
import { ROAD_GRAPH, getConnectedEdges } from './RoadNetwork';

interface TrafficAgent {
  mesh: Mesh;
  road: RoadEdge;
  distance: number;
  speed: number;
  seed: number;
}

const COLORS = ['#7b7f83', '#b5b2a8', '#4e5960', '#61565a', '#a2a6a0', '#363a3e'];

export class TrafficSystem {
  private readonly agents: TrafficAgent[] = [];

  constructor(private readonly scene: Scene, qualityTier: QualityTier) {
    const budget = qualityTier === 'desktop' ? 22 : qualityTier === 'mobile-high' ? 14 : 8;
    const roads = ROAD_GRAPH.edges.filter((road) => !road.shortcut && road.trafficDensity !== 0 && road.roadClass !== 'parking');
    for (let index = 0; index < budget; index += 1) {
      const road = roads[index % roads.length];
      const seed = index * 97 + 13;
      this.agents.push(this.createAgent(road, seed, (edgeLength(road) * ((index * 0.37) % 1))));
    }
  }

  update(dt: number, playerPosition: Vector3): void {
    const safeDt = Math.min(dt, 0.05);
    for (const agent of this.agents) {
      const playerDistance = Vector3.Distance(agent.mesh.position, playerPosition);
      const targetSpeed = Math.min(agent.road.speedKph * 0.48, agent.road.roadClass === 'expressway' ? 42 : 26);
      const proximitySlowdown = playerDistance < 18 ? 0.35 : playerDistance < 35 ? 0.72 : 1;
      agent.speed += (targetSpeed * proximitySlowdown - agent.speed) * Math.min(1, safeDt * 2.2);
      agent.distance += agent.speed * safeDt;

      const length = edgeLength(agent.road);
      if (agent.distance > length) {
        const overflow = agent.distance - length;
        const connected = getConnectedEdges(agent.road.to).filter((road) => !road.shortcut && road.id !== agent.road.id);
        if (connected.length > 0) agent.road = connected[(agent.seed + Math.floor(performance.now() / 8000)) % connected.length];
        agent.distance = Math.min(overflow, edgeLength(agent.road) * 0.25);
      }

      const sample = sampleEdge(agent.road, agent.distance);
      agent.mesh.position.set(sample.position.x, agent.road.roadClass === 'expressway' ? 4.75 : 0.62, sample.position.z);
      agent.mesh.rotation.y = sample.yaw;
      agent.mesh.setEnabled(playerDistance < 700);
    }
  }

  dispose(): void {
    for (const agent of this.agents) agent.mesh.dispose();
    this.agents.length = 0;
  }

  private createAgent(road: RoadEdge, seed: number, distance: number): TrafficAgent {
    const isVan = seed % 4 === 0;
    const mesh = MeshBuilder.CreateBox(`traffic-${seed}`, {
      width: isVan ? 2.05 : 1.82,
      height: isVan ? 1.75 : 1.18,
      depth: isVan ? 4.8 : 4.15
    }, this.scene);
    const paint = new StandardMaterial(`traffic-paint-${seed}`, this.scene);
    paint.diffuseColor = Color3.FromHexString(COLORS[seed % COLORS.length]);
    paint.specularColor = Color3.FromHexString('#31363a');
    mesh.material = paint;
    const sample = sampleEdge(road, distance);
    mesh.position.set(sample.position.x, road.roadClass === 'expressway' ? 4.75 : 0.62, sample.position.z);
    mesh.rotation.y = sample.yaw;
    return { mesh, road, distance, speed: 8 + (seed % 9), seed };
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

function pointDistance(a: RoadPoint, b: RoadPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}
