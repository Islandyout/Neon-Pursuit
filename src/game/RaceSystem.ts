import { Color3, Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { RaceRoute, RoadEdge } from './contracts';
import { getRoadEdge } from './RoadNetwork';
import { edgeLength, sampleEdge } from './TrafficSystem';

export const NIGHT_LOOP: RaceRoute = {
  id: 'night-loop',
  name: 'Midnight Loop',
  edgeIds: ['arterial-east', 'bay-connector', 'dock-run', 'express-ne', 'express-north', 'express-west', 'old-quarter', 'arterial-west'],
  laps: 2,
  targetTimeSeconds: 155
};

interface RivalState {
  routeIndex: number;
  distance: number;
  speed: number;
  completedEdges: number;
}

export class RaceSystem {
  private readonly rival: Mesh;
  private readonly route: RoadEdge[];
  private readonly state: RivalState = { routeIndex: 0, distance: 0, speed: 0, completedEdges: 0 };

  constructor(private readonly scene: Scene, routeDefinition: RaceRoute = NIGHT_LOOP) {
    this.route = routeDefinition.edgeIds.map(getRoadEdge);
    this.rival = MeshBuilder.CreateBox('rival-car', { width: 1.96, height: 1.08, depth: 4.45 }, scene);
    const material = new StandardMaterial('rival-material', scene);
    material.diffuseColor = Color3.FromHexString('#8b5a45');
    material.specularColor = Color3.FromHexString('#55585b');
    this.rival.material = material;
    const start = sampleEdge(this.route[0], 18);
    this.rival.position.set(start.position.x, this.route[0].roadClass === 'expressway' ? 4.75 : 0.64, start.position.z);
    this.rival.rotation.y = start.yaw;
  }

  update(dt: number, playerPosition: Vector3): void {
    const safeDt = Math.min(dt, 0.05);
    const road = this.route[this.state.routeIndex];
    const targetSpeed = this.computeTargetSpeed(road);
    const playerDistance = Vector3.Distance(this.rival.position, playerPosition);
    const catchupLimiter = playerDistance > 300 ? 1.08 : playerDistance < 45 ? 0.96 : 1;
    this.state.speed += (targetSpeed * catchupLimiter - this.state.speed) * Math.min(1, safeDt * 1.4);
    this.state.distance += this.state.speed * safeDt;

    const length = edgeLength(road);
    if (this.state.distance >= length) {
      this.state.distance -= length;
      this.state.routeIndex = (this.state.routeIndex + 1) % this.route.length;
      this.state.completedEdges += 1;
    }

    const activeRoad = this.route[this.state.routeIndex];
    const sample = sampleEdge(activeRoad, this.state.distance);
    this.rival.position.set(sample.position.x, activeRoad.roadClass === 'expressway' ? 4.75 : 0.64, sample.position.z);
    this.rival.rotation.y = sample.yaw;
  }

  getProgress01(): number {
    const total = this.route.reduce((sum, road) => sum + edgeLength(road), 0);
    const completed = this.route.slice(0, this.state.routeIndex).reduce((sum, road) => sum + edgeLength(road), 0) + this.state.distance;
    return total === 0 ? 0 : completed / total;
  }

  dispose(): void {
    this.rival.dispose();
  }

  private computeTargetSpeed(road: RoadEdge): number {
    const points = road.points;
    let cornerPenalty = 1;
    for (let index = 2; index < points.length; index += 1) {
      const a = Math.atan2(points[index - 1].x - points[index - 2].x, points[index - 1].z - points[index - 2].z);
      const b = Math.atan2(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z);
      let delta = Math.abs(a - b);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      cornerPenalty = Math.min(cornerPenalty, Math.max(0.48, 1 - delta / Math.PI));
    }
    return Math.max(18, (road.speedKph / 3.6) * 0.72 * cornerPenalty);
  }
}
