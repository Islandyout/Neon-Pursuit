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

export const NIGHT_LOOP_SHORTCUT: RaceRoute = {
  id: 'night-loop-parking-cut',
  name: 'Midnight Loop · Parking Cut',
  edgeIds: ['parking-entry', 'parking-cut', 'parking-exit', 'dock-run', 'express-ne', 'express-north', 'express-west', 'old-quarter', 'arterial-west'],
  laps: 2,
  targetTimeSeconds: 147
};

interface RivalState {
  routeIndex: number;
  distance: number;
  speed: number;
  completedEdges: number;
  completedLaps: number;
  activeRoute: 'main' | 'shortcut';
}

export class RaceSystem {
  private readonly rival: Mesh;
  private readonly routes: Record<'main' | 'shortcut', RoadEdge[]>;
  private readonly state: RivalState = { routeIndex: 0, distance: 0, speed: 0, completedEdges: 0, completedLaps: 0, activeRoute: 'main' };
  private readonly rivalSkill = 0.72;

  constructor(scene: Scene) {
    this.routes = {
      main: NIGHT_LOOP.edgeIds.map(getRoadEdge),
      shortcut: NIGHT_LOOP_SHORTCUT.edgeIds.map(getRoadEdge)
    };
    this.rival = MeshBuilder.CreateBox('rival-car', { width: 1.96, height: 1.08, depth: 4.45 }, scene);
    const material = new StandardMaterial('rival-material', scene);
    material.diffuseColor = Color3.FromHexString('#8b5a45');
    material.specularColor = Color3.FromHexString('#55585b');
    this.rival.material = material;
    const start = sampleEdge(this.currentRoute()[0], 18);
    this.rival.position.set(start.position.x, this.currentRoute()[0].roadClass === 'expressway' ? 4.75 : 0.64, start.position.z);
    this.rival.rotation.y = start.yaw;
  }

  update(dt: number, playerPosition: Vector3): void {
    const safeDt = Math.min(dt, 0.05);
    const route = this.currentRoute();
    const road = route[this.state.routeIndex];
    const targetSpeed = this.computeTargetSpeed(road);
    const playerDistance = Vector3.Distance(this.rival.position, playerPosition);
    const catchupLimiter = playerDistance > 300 ? 1.06 : playerDistance < 42 ? 0.97 : 1;
    this.state.speed += (targetSpeed * catchupLimiter - this.state.speed) * Math.min(1, safeDt * 1.4);
    this.state.distance += this.state.speed * safeDt;

    const length = edgeLength(road);
    if (this.state.distance >= length) {
      this.state.distance -= length;
      this.state.routeIndex += 1;
      this.state.completedEdges += 1;
      if (this.state.routeIndex >= route.length) {
        this.state.routeIndex = 0;
        this.state.completedLaps += 1;
        this.chooseNextLapRoute();
      }
    }

    const activeRoad = this.currentRoute()[this.state.routeIndex];
    const sample = sampleEdge(activeRoad, this.state.distance);
    const laneOffset = activeRoad.lanes > 1 ? (playerDistance < 18 ? -2.2 : -1.25) : 0;
    const rightX = Math.cos(sample.yaw);
    const rightZ = -Math.sin(sample.yaw);
    this.rival.position.set(
      sample.position.x + rightX * laneOffset,
      activeRoad.roadClass === 'expressway' ? 4.75 : 0.64,
      sample.position.z + rightZ * laneOffset
    );
    this.rival.rotation.y = sample.yaw;
  }

  getProgress01(): number {
    const route = this.currentRoute();
    const total = route.reduce((sum, road) => sum + edgeLength(road), 0);
    const completed = route.slice(0, this.state.routeIndex).reduce((sum, road) => sum + edgeLength(road), 0) + this.state.distance;
    return total === 0 ? 0 : completed / total;
  }

  getActiveRouteName(): string {
    return this.state.activeRoute === 'shortcut' ? NIGHT_LOOP_SHORTCUT.name : NIGHT_LOOP.name;
  }

  dispose(): void {
    this.rival.dispose(false, true);
  }

  private currentRoute(): RoadEdge[] {
    return this.routes[this.state.activeRoute];
  }

  private chooseNextLapRoute(): void {
    const deterministicDecision = ((this.state.completedLaps * 37 + 17) % 100) / 100;
    this.state.activeRoute = deterministicDecision < this.rivalSkill ? 'shortcut' : 'main';
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
    const shortcutConfidence = road.shortcut ? 0.92 + this.rivalSkill * 0.08 : 1;
    return Math.max(18, (road.speedKph / 3.6) * 0.72 * cornerPenalty * shortcutConfidence);
  }
}
