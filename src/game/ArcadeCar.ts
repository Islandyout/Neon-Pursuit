import { Color3, Quaternion, Vector3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { CustomizationState, VehicleDefinition, VehicleInput, VehicleTelemetry } from './contracts';
import { getVehicleDefinition } from './VehicleCatalog';

const DEFAULT_CUSTOMIZATION: CustomizationState = {
  paint: '#2c94a7',
  wheelStyle: 'five-spoke',
  spoiler: 'lip',
  rideHeight: 0,
  bodyKit: 'street'
};

export class ArcadeCar {
  readonly root: TransformNode;
  private definition: VehicleDefinition;
  private customization: CustomizationState;
  private forwardSpeed = 0;
  private lateralSpeed = 0;
  private yaw = 0;
  private steering = 0;
  private nitrous = 1;
  private heat = 0;
  private driftScore = 0;
  private readonly wheelNodes: TransformNode[] = [];
  private readonly visualMeshes: Mesh[] = [];
  private bodyMaterial: StandardMaterial | null = null;

  constructor(private readonly scene: Scene, vehicleId = 'kaze-s1', customization: Partial<CustomizationState> = {}) {
    this.definition = getVehicleDefinition(vehicleId);
    this.customization = { ...DEFAULT_CUSTOMIZATION, paint: this.definition.color, ...customization };
    this.root = new TransformNode('player-car', scene);
    this.root.position.set(0, 0.72, 0);
    this.root.rotationQuaternion = Quaternion.Identity();
    this.buildVisual();
  }

  update(dt: number, input: VehicleInput): VehicleTelemetry {
    const safeDt = Math.min(dt, 1 / 25);
    const maxSpeed = this.definition.maxSpeedKph / 3.6;
    const speedRatio = Math.min(Math.abs(this.forwardSpeed) / maxSpeed, 1);
    const throttleCurve = 1 - Math.pow(speedRatio, 1.6) * 0.66;
    const powerToWeight = (this.definition.powerKw / this.definition.massKg) * 100;
    const engineAccel = (9.5 + powerToWeight * 0.82) * throttleCurve * input.throttle;
    const brakeAccel = this.definition.brakeStrength * input.brake;
    const aeroDrag = 0.0058 * this.forwardSpeed * Math.abs(this.forwardSpeed);
    const rollingDrag = this.forwardSpeed * 0.16;

    if (this.forwardSpeed > 0.6) this.forwardSpeed -= brakeAccel * safeDt;
    else if (input.brake > 0.08) this.forwardSpeed -= 8.5 * input.brake * safeDt;

    this.forwardSpeed += engineAccel * safeDt;
    this.forwardSpeed -= (aeroDrag + rollingDrag) * safeDt;

    const nitroActive = input.nitro && this.nitrous > 0.015 && this.forwardSpeed > 5;
    if (nitroActive) {
      this.forwardSpeed += this.definition.nitrousPower * safeDt;
      this.nitrous = Math.max(0, this.nitrous - 0.27 * safeDt);
      this.heat = Math.min(5, this.heat + 0.27 * safeDt);
    }

    const steeringTarget = Math.max(-1, Math.min(1, input.steer));
    const steeringResponse = this.definition.steeringResponse * (0.78 + (1 - speedRatio) * 0.35);
    this.steering += (steeringTarget - this.steering) * Math.min(1, steeringResponse * safeDt);

    const grip = Math.max(0.25, this.definition.grip - (input.handbrake ? 0.34 + this.definition.driftBias * 0.12 : 0));
    const lateralInjection = this.steering * this.forwardSpeed * (0.48 + this.definition.driftBias * 0.5) * (input.handbrake ? 1.6 : 0.7);
    this.lateralSpeed += lateralInjection * safeDt;
    const lateralDamping = Math.max(0.4, 5.8 * grip * (input.handbrake ? 0.36 : 1));
    this.lateralSpeed *= Math.exp(-lateralDamping * safeDt);

    const slip = Math.min(1, Math.abs(this.lateralSpeed) / Math.max(5, Math.abs(this.forwardSpeed) * 0.42));
    const movingFactor = Math.min(Math.abs(this.forwardSpeed) / 8, 1);
    const highSpeedStability = 1 - 0.48 * speedRatio;
    const driftYaw = Math.sign(this.lateralSpeed) * slip * (0.35 + this.definition.driftBias * 0.55);
    const yawRate = (this.steering * 1.45 * highSpeedStability + driftYaw) * movingFactor * Math.sign(this.forwardSpeed || 1);
    this.yaw += yawRate * safeDt;

    const forward = this.getForward();
    const right = new Vector3(forward.z, 0, -forward.x);
    this.root.position.addInPlace(forward.scale(this.forwardSpeed * safeDt));
    this.root.position.addInPlace(right.scale(this.lateralSpeed * safeDt));
    this.root.position.y = 0.72 - this.customization.rideHeight;
    this.root.rotationQuaternion = Quaternion.FromEulerAngles(0, this.yaw, -this.steering * 0.025 - this.lateralSpeed * 0.0025);

    const wheelSpin = (this.forwardSpeed / 0.42) * safeDt;
    for (const wheel of this.wheelNodes) wheel.rotate(Vector3.Right(), wheelSpin);

    const drifting = slip > 0.18 && Math.abs(this.forwardSpeed) > 13;
    if (drifting) {
      const driftGain = slip * Math.abs(this.forwardSpeed) * safeDt * 0.05;
      this.driftScore += driftGain;
      this.nitrous = Math.min(1, this.nitrous + driftGain * 0.012);
      this.heat = Math.min(5, this.heat + 0.065 * safeDt);
    } else if (!nitroActive) {
      this.nitrous = Math.min(1, this.nitrous + 0.025 * safeDt);
      this.heat = Math.max(0, this.heat - 0.022 * safeDt);
    }

    const riskySpeed = speedRatio > 0.82;
    if (riskySpeed) this.heat = Math.min(5, this.heat + 0.035 * safeDt);

    const maxForward = nitroActive ? maxSpeed * 1.12 : maxSpeed;
    this.forwardSpeed = Math.max(-18, Math.min(maxForward, this.forwardSpeed));

    return {
      speedKph: Math.abs(this.forwardSpeed) * 3.6,
      gear: this.computeGear(),
      nitrous: this.nitrous,
      heat: this.heat,
      slip,
      driftScore: this.driftScore
    };
  }

  getForward(): Vector3 {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  getSpeedKph(): number {
    return Math.abs(this.forwardSpeed) * 3.6;
  }

  getVehicleDefinition(): VehicleDefinition {
    return this.definition;
  }

  setVehicle(vehicleId: string): void {
    this.definition = getVehicleDefinition(vehicleId);
    this.customization.paint = this.definition.color;
    this.rebuildVisual();
  }

  applyCustomization(next: Partial<CustomizationState>): void {
    this.customization = { ...this.customization, ...next };
    if (this.bodyMaterial) this.bodyMaterial.diffuseColor = Color3.FromHexString(this.customization.paint);
    this.root.position.y = 0.72 - this.customization.rideHeight;
  }

  private computeGear(): number {
    const ratio = Math.abs(this.forwardSpeed) / Math.max(1, this.definition.maxSpeedKph / 3.6);
    if (this.forwardSpeed < -1) return -1;
    if (ratio < 0.15) return 1;
    if (ratio < 0.3) return 2;
    if (ratio < 0.48) return 3;
    if (ratio < 0.67) return 4;
    if (ratio < 0.84) return 5;
    return 6;
  }

  private rebuildVisual(): void {
    for (const mesh of this.visualMeshes) mesh.dispose();
    for (const node of this.wheelNodes) node.dispose();
    this.visualMeshes.length = 0;
    this.wheelNodes.length = 0;
    this.buildVisual();
  }

  private buildVisual(): void {
    const bodyMaterial = new StandardMaterial('car-body-material', this.scene);
    bodyMaterial.diffuseColor = Color3.FromHexString(this.customization.paint);
    bodyMaterial.specularColor = new Color3(0.72, 0.78, 0.8);
    this.bodyMaterial = bodyMaterial;

    const darkMaterial = new StandardMaterial('car-dark-material', this.scene);
    darkMaterial.diffuseColor = Color3.FromHexString('#090b0e');
    darkMaterial.specularColor = new Color3(0.34, 0.38, 0.4);
    const lightMaterial = new StandardMaterial('car-light-material', this.scene);
    lightMaterial.diffuseColor = Color3.FromHexString('#e9f3ef');
    lightMaterial.emissiveColor = Color3.FromHexString('#657b76');

    const isSedan = this.definition.vehicleClass === 'sports-sedan' || this.definition.vehicleClass === 'police-interceptor';
    const isExotic = this.definition.vehicleClass === 'exotic';
    const length = isSedan ? 4.75 : isExotic ? 4.55 : 4.35;
    const width = isExotic ? 2.08 : 1.95;
    const bodyHeight = isExotic ? 0.38 : 0.48;
    const bodyScale = this.customization.bodyKit === 'widebody' ? 1.08 : this.customization.bodyKit === 'street' ? 1.03 : 1;

    const body = MeshBuilder.CreateBox('car-body', { width: width * bodyScale, height: bodyHeight, depth: length }, this.scene);
    body.parent = this.root; body.position.y = 0.34; body.material = bodyMaterial; this.visualMeshes.push(body);
    const cabin = MeshBuilder.CreateBox('car-cabin', { width: width * 0.78, height: isExotic ? 0.45 : 0.6, depth: isSedan ? 2.2 : 1.85 }, this.scene);
    cabin.parent = this.root; cabin.position.set(0, 0.78, -0.2); cabin.scaling.x = 0.94; cabin.material = darkMaterial; this.visualMeshes.push(cabin);
    const splitter = MeshBuilder.CreateBox('front-splitter', { width: width * 1.04 * bodyScale, height: 0.1, depth: 0.38 }, this.scene);
    splitter.parent = this.root; splitter.position.set(0, 0.04, length * 0.5); splitter.material = darkMaterial; this.visualMeshes.push(splitter);

    if (this.customization.spoiler !== 'none') {
      const spoilerWidth = this.customization.spoiler === 'track' ? width * 1.05 : width * 0.9;
      const spoiler = MeshBuilder.CreateBox('spoiler', { width: spoilerWidth, height: 0.09, depth: this.customization.spoiler === 'lip' ? 0.22 : 0.34 }, this.scene);
      spoiler.parent = this.root; spoiler.position.set(0, this.customization.spoiler === 'track' ? 1.12 : 0.95, -length * 0.46); spoiler.material = darkMaterial; this.visualMeshes.push(spoiler);
    }

    for (const x of [-width * 0.32, width * 0.32]) {
      const headlight = MeshBuilder.CreateBox(`headlight-${x}`, { width: 0.42, height: 0.1, depth: 0.07 }, this.scene);
      headlight.parent = this.root; headlight.position.set(x, 0.42, length * 0.505); headlight.material = lightMaterial; this.visualMeshes.push(headlight);
    }

    const axleZ = length * 0.32;
    const wheelX = width * 0.52 * bodyScale;
    const wheelPositions: Array<[number, number]> = [[-wheelX, axleZ], [wheelX, axleZ], [-wheelX, -axleZ], [wheelX, -axleZ]];
    for (const [x, z] of wheelPositions) {
      const wheelNode = new TransformNode(`wheel-node-${x}-${z}`, this.scene);
      wheelNode.parent = this.root; wheelNode.position.set(x, 0.12, z);
      const wheelWidth = this.customization.wheelStyle === 'deep-dish' ? 0.38 : 0.31;
      const wheel = MeshBuilder.CreateCylinder(`wheel-${x}-${z}`, { diameter: 0.78, height: wheelWidth, tessellation: 20 }, this.scene);
      wheel.parent = wheelNode; wheel.rotation.z = Math.PI / 2; wheel.material = darkMaterial; this.visualMeshes.push(wheel);
      this.wheelNodes.push(wheelNode);
    }
    this.root.computeWorldMatrix(true);
  }
}
