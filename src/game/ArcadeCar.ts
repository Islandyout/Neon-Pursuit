import { Color3, Quaternion, Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { InputSnapshot } from './InputManager';

export interface CarTelemetry {
  speedKph: number;
  gear: number;
  nitrous: number;
  heat: number;
}

export class ArcadeCar {
  readonly root: TransformNode;
  private speed = 0;
  private yaw = 0;
  private steering = 0;
  private nitrous = 1;
  private heat = 0;
  private readonly wheelNodes: TransformNode[] = [];
  private readonly maxForwardSpeed = 82;
  private readonly maxReverseSpeed = 18;

  constructor(scene: Scene) {
    this.root = new TransformNode('player-car', scene);
    this.root.position.set(0, 0.72, 0);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.buildVisual(scene);
  }

  update(dt: number, input: InputSnapshot): CarTelemetry {
    const safeDt = Math.min(dt, 1 / 20);
    const speedRatio = Math.min(Math.abs(this.speed) / this.maxForwardSpeed, 1);
    const engineAccel = 22 * input.throttle * (1 - speedRatio * 0.58);
    const brakeForce = 38 * input.brake;
    const drag = 0.012 * this.speed * Math.abs(this.speed) + 0.6 * this.speed;

    if (this.speed > 0.3) this.speed -= brakeForce * safeDt;
    else if (input.brake > 0.05) this.speed -= 10 * input.brake * safeDt;

    this.speed += engineAccel * safeDt;
    this.speed -= drag * safeDt;

    const nitroActive = input.nitro && this.nitrous > 0.015 && this.speed > 4;
    if (nitroActive) {
      this.speed += 28 * safeDt;
      this.nitrous = Math.max(0, this.nitrous - 0.24 * safeDt);
      this.heat = Math.min(5, this.heat + 0.22 * safeDt);
    } else {
      this.nitrous = Math.min(1, this.nitrous + (Math.abs(input.steer) > 0.45 && speedRatio > 0.35 ? 0.09 : 0.045) * safeDt);
    }

    this.speed = Math.min(this.speed, nitroActive ? 96 : this.maxForwardSpeed);
    this.speed = Math.max(this.speed, -this.maxReverseSpeed);
    const steeringResponse = 8.5;
    this.steering += (input.steer - this.steering) * Math.min(1, steeringResponse * safeDt);

    const movingFactor = Math.min(Math.abs(this.speed) / 7, 1);
    const highSpeedStability = 1 - 0.52 * speedRatio;
    const handbrakeYawBoost = input.handbrake && speedRatio > 0.18 ? 1.85 : 1;
    const direction = this.speed >= 0 ? 1 : -1;
    const yawRate = this.steering * 1.75 * highSpeedStability * movingFactor * handbrakeYawBoost * direction;
    this.yaw += yawRate * safeDt;

    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.root.position.addInPlace(forward.scale(this.speed * safeDt));
    this.root.position.y = 0.72;
    this.root.rotationQuaternion = Quaternion.FromEulerAngles(0, this.yaw, input.handbrake ? -this.steering * 0.035 : -this.steering * 0.015);

    const wheelSpin = (this.speed / 0.42) * safeDt;
    for (const wheel of this.wheelNodes) wheel.rotate(Vector3.Right(), wheelSpin);

    const riskyDriving = speedRatio > 0.78 || (input.handbrake && speedRatio > 0.3);
    this.heat = Math.max(0, Math.min(5, this.heat + (riskyDriving ? 0.055 : -0.018) * safeDt));

    return { speedKph: Math.abs(this.speed) * 3.6, gear: this.computeGear(), nitrous: this.nitrous, heat: this.heat };
  }

  getForward(): Vector3 {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  private computeGear(): number {
    const kph = Math.abs(this.speed) * 3.6;
    if (this.speed < -1) return -1;
    if (kph < 45) return 1;
    if (kph < 85) return 2;
    if (kph < 130) return 3;
    if (kph < 180) return 4;
    if (kph < 235) return 5;
    return 6;
  }

  private buildVisual(scene: Scene): void {
    const bodyMaterial = new StandardMaterial('car-body-material', scene);
    bodyMaterial.diffuseColor = Color3.FromHexString('#00d9ff');
    bodyMaterial.emissiveColor = Color3.FromHexString('#003a45');
    bodyMaterial.specularColor = new Color3(1, 1, 1);
    const darkMaterial = new StandardMaterial('car-dark-material', scene);
    darkMaterial.diffuseColor = Color3.FromHexString('#080b10');
    darkMaterial.specularColor = new Color3(0.4, 0.5, 0.55);
    const lightMaterial = new StandardMaterial('car-light-material', scene);
    lightMaterial.diffuseColor = Color3.FromHexString('#efffff');
    lightMaterial.emissiveColor = Color3.FromHexString('#9af7ff');

    const body = MeshBuilder.CreateBox('car-body', { width: 1.95, height: 0.5, depth: 4.4 }, scene);
    body.parent = this.root; body.position.y = 0.35; body.material = bodyMaterial;
    const cabin = MeshBuilder.CreateBox('car-cabin', { width: 1.62, height: 0.62, depth: 1.9 }, scene);
    cabin.parent = this.root; cabin.position.set(0, 0.84, -0.25); cabin.scaling.x = 0.92; cabin.material = darkMaterial;
    const splitter = MeshBuilder.CreateBox('front-splitter', { width: 2.05, height: 0.12, depth: 0.48 }, scene);
    splitter.parent = this.root; splitter.position.set(0, 0.05, 2.18); splitter.material = darkMaterial;
    const spoiler = MeshBuilder.CreateBox('spoiler', { width: 1.9, height: 0.1, depth: 0.35 }, scene);
    spoiler.parent = this.root; spoiler.position.set(0, 1.05, -1.95); spoiler.material = darkMaterial;

    for (const x of [-0.65, 0.65]) {
      const headlight = MeshBuilder.CreateBox(`headlight-${x}`, { width: 0.45, height: 0.12, depth: 0.08 }, scene);
      headlight.parent = this.root; headlight.position.set(x, 0.43, 2.23); headlight.material = lightMaterial;
    }

    const wheelPositions: Array<[number, number]> = [[-1.02, 1.35], [1.02, 1.35], [-1.02, -1.42], [1.02, -1.42]];
    for (const [x, z] of wheelPositions) {
      const wheelNode = new TransformNode(`wheel-node-${x}-${z}`, scene);
      wheelNode.parent = this.root; wheelNode.position.set(x, 0.12, z);
      const wheel = MeshBuilder.CreateCylinder(`wheel-${x}-${z}`, { diameter: 0.78, height: 0.34, tessellation: 20 }, scene);
      wheel.parent = wheelNode; wheel.rotation.z = Math.PI / 2; wheel.material = darkMaterial;
      this.wheelNodes.push(wheelNode);
    }
    this.root.computeWorldMatrix(true);
  }
}
