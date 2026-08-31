import { Color3, Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { PursuitState, QualityTier, VehicleTelemetry } from './contracts';
import { ROAD_GRAPH, findClosestRoad } from './RoadNetwork';

interface PoliceUnit {
  mesh: Mesh;
  speed: number;
  seed: number;
}

export interface PursuitSnapshot {
  state: PursuitState;
  activeUnits: number;
  interceptRoad: string | null;
}

export class PursuitSystem {
  private state: PursuitState = 'patrol';
  private readonly units: PoliceUnit[] = [];
  private stateClock = 0;
  private lastActiveHeat = 0;
  private readonly maxUnits: number;

  constructor(private readonly scene: Scene, qualityTier: QualityTier) {
    this.maxUnits = qualityTier === 'desktop' ? 5 : qualityTier === 'mobile-high' ? 3 : 2;
  }

  update(dt: number, playerPosition: Vector3, telemetry: VehicleTelemetry): PursuitSnapshot {
    const safeDt = Math.min(dt, 0.05);
    this.stateClock += safeDt;
    if (telemetry.heat > 0.6) this.lastActiveHeat = telemetry.heat;
    const nextState = this.chooseState(telemetry);
    if (nextState !== this.state) {
      this.state = nextState;
      this.stateClock = 0;
    }

    const targetCount = this.targetUnitCount();
    while (this.units.length < targetCount) this.units.push(this.spawnUnit(playerPosition, this.units.length));
    while (this.units.length > targetCount) this.units.pop()?.mesh.dispose();

    const targetRoad = findClosestRoad({ x: playerPosition.x, z: playerPosition.z });
    for (const unit of this.units) this.updateUnit(unit, playerPosition, targetRoad.points, safeDt, telemetry.heat);

    return {
      state: this.state,
      activeUnits: this.units.length,
      interceptRoad: this.state === 'intercept' || this.state === 'chase' ? targetRoad.id : null
    };
  }

  getState(): PursuitState {
    return this.state;
  }

  dispose(): void {
    for (const unit of this.units) unit.mesh.dispose();
    this.units.length = 0;
  }

  private chooseState(telemetry: VehicleTelemetry): PursuitState {
    if (this.state === 'search') {
      if (telemetry.heat > 1.1) return 'chase';
      return this.stateClock > 6 ? 'cooldown' : 'search';
    }
    if (this.state === 'cooldown') {
      if (telemetry.heat > 0.8) return 'investigate';
      if (this.stateClock > 5) {
        this.lastActiveHeat = 0;
        return 'patrol';
      }
      return 'cooldown';
    }

    if (telemetry.heat < 0.16) return this.lastActiveHeat > 1.2 ? 'search' : 'patrol';
    if (telemetry.heat < 0.8) return 'investigate';
    if (telemetry.heat < 1.7) return 'engage';
    if (telemetry.heat < 3.5) return 'chase';
    return 'intercept';
  }

  private targetUnitCount(): number {
    const desired = this.state === 'patrol' || this.state === 'cooldown' ? 0
      : this.state === 'investigate' ? 1
      : this.state === 'engage' ? 1
      : this.state === 'search' ? 1
      : this.state === 'chase' ? 2
      : this.maxUnits;
    return Math.min(this.maxUnits, desired);
  }

  private spawnUnit(playerPosition: Vector3, seed: number): PoliceUnit {
    const spawnNodes = ROAD_GRAPH.nodes.filter((node) => node.tags?.includes('spawn') || node.tags?.includes('roadblock'));
    const sorted = [...spawnNodes].sort((a, b) => {
      const da = Math.hypot(a.position.x - playerPosition.x, a.position.z - playerPosition.z);
      const db = Math.hypot(b.position.x - playerPosition.x, b.position.z - playerPosition.z);
      return db - da;
    });
    const spawn = sorted[seed % Math.max(1, sorted.length)]?.position ?? { x: playerPosition.x - 160, z: playerPosition.z - 80 };
    const mesh = MeshBuilder.CreateBox(`police-${seed}`, { width: 2.05, height: 1.12, depth: 4.65 }, this.scene);
    const material = new StandardMaterial(`police-material-${seed}`, this.scene);
    material.diffuseColor = Color3.FromHexString('#1e2328');
    material.specularColor = Color3.FromHexString('#4c555c');
    mesh.material = material;
    mesh.position.set(spawn.x, 0.66, spawn.z);

    const bar = MeshBuilder.CreateBox(`police-bar-${seed}`, { width: 1.1, height: 0.12, depth: 0.2 }, this.scene);
    bar.parent = mesh;
    bar.position.y = 0.68;
    const barMaterial = new StandardMaterial(`police-bar-material-${seed}`, this.scene);
    barMaterial.diffuseColor = Color3.FromHexString(seed % 2 === 0 ? '#58738a' : '#86515c');
    barMaterial.emissiveColor = Color3.FromHexString(seed % 2 === 0 ? '#153247' : '#41131c');
    bar.material = barMaterial;
    return { mesh, speed: 18, seed };
  }

  private updateUnit(unit: PoliceUnit, playerPosition: Vector3, roadPoints: Array<{ x: number; z: number }>, dt: number, heat: number): void {
    const nearestWaypoint = roadPoints.reduce((best, point) => {
      const currentDistance = Math.hypot(point.x - unit.mesh.position.x, point.z - unit.mesh.position.z);
      const bestDistance = Math.hypot(best.x - unit.mesh.position.x, best.z - unit.mesh.position.z);
      return currentDistance < bestDistance ? point : best;
    }, roadPoints[0]);
    const playerDistance = Vector3.Distance(unit.mesh.position, playerPosition);
    const target = playerDistance < 75 ? playerPosition : new Vector3(nearestWaypoint.x, 0.66, nearestWaypoint.z);
    const delta = target.subtract(unit.mesh.position);
    delta.y = 0;
    const distance = Math.max(0.001, delta.length());
    const direction = delta.scale(1 / distance);
    const desiredSpeed = 24 + heat * 5.2 + (this.state === 'intercept' ? 8 : 0);
    unit.speed += (desiredSpeed - unit.speed) * Math.min(1, dt * 1.7);
    unit.mesh.position.addInPlace(direction.scale(Math.min(distance, unit.speed * dt)));
    unit.mesh.position.y = 0.66;
    unit.mesh.rotation.y = Math.atan2(direction.x, direction.z);
  }
}
