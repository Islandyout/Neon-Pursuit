import { Color3, Quaternion, Vector3 } from '@babylonjs/core/Maths/math';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { CustomizationState, VehicleDefinition, VehicleInput, VehicleTelemetry } from './contracts';
import { getVehicleDefinition } from './VehicleCatalog';
import { ModelLibrary, playerModelForVehicle } from './ModelLibrary';

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
  private visualRoot: TransformNode | null = null;
  private readonly wheelNodes: TransformNode[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly models: ModelLibrary,
    vehicleId = 'kaze-s1',
    customization: Partial<CustomizationState> = {}
  ) {
    this.definition = getVehicleDefinition(vehicleId);
    this.customization = { ...DEFAULT_CUSTOMIZATION, paint: this.definition.color, ...customization };
    this.root = new TransformNode('player-car', scene);
    this.root.position.set(0, 0.08, 0);
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
    this.root.position.y = 0.08 - this.customization.rideHeight;
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

    if (speedRatio > 0.82) this.heat = Math.min(5, this.heat + 0.035 * safeDt);

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
    this.root.position.y = 0.08 - this.customization.rideHeight;
    this.applyPaint();
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
    this.visualRoot?.dispose(false);
    this.visualRoot = null;
    this.wheelNodes.length = 0;
    this.buildVisual();
  }

  private buildVisual(): void {
    const visual = this.models.instantiate(playerModelForVehicle(this.definition.id), `player-${this.definition.id}`, true);
    visual.parent = this.root;
    visual.scaling.setAll(this.definition.vehicleClass === 'exotic' ? 1.72 : 1.68);
    visual.rotation.y = Math.PI;
    visual.position.y = 0;
    this.visualRoot = visual;

    for (const node of visual.getChildTransformNodes(false)) {
      if (node.name.toLowerCase().includes('wheel')) this.wheelNodes.push(node);
    }
    this.applyPaint();
  }

  private applyPaint(): void {
    if (!this.visualRoot) return;
    const paint = Color3.FromHexString(this.customization.paint);
    for (const mesh of this.visualRoot.getChildMeshes(false)) {
      const material = mesh.material;
      if (material instanceof PBRMaterial) {
        material.albedoColor = Color3.Lerp(Color3.White(), paint, 0.28);
        material.metallic = Math.max(material.metallic ?? 0, 0.08);
        material.roughness = Math.min(material.roughness ?? 0.6, 0.62);
      } else if (material instanceof StandardMaterial) {
        material.diffuseColor = Color3.Lerp(Color3.White(), paint, 0.28);
      }
    }
  }
}
