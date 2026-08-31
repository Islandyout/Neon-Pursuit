import { Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { VehicleClass } from './contracts';

interface VehicleVisualOptions {
  vehicleClass: VehicleClass;
  paint: string;
  name: string;
  policeLights?: boolean;
}

interface ShapeSpec {
  width: number;
  length: number;
  bodyHeight: number;
  cabinWidth: number;
  cabinLength: number;
  cabinHeight: number;
  cabinZ: number;
  wheelDiameter: number;
  wheelWidth: number;
  axleZ: number;
}

const SHAPES: Partial<Record<VehicleClass, ShapeSpec>> = {
  'traffic-sedan': { width: 1.82, length: 4.25, bodyHeight: 0.48, cabinWidth: 1.5, cabinLength: 2.05, cabinHeight: 0.55, cabinZ: -0.18, wheelDiameter: 0.7, wheelWidth: 0.26, axleZ: 1.28 },
  'traffic-van': { width: 2.02, length: 4.75, bodyHeight: 0.7, cabinWidth: 1.82, cabinLength: 2.8, cabinHeight: 1.1, cabinZ: -0.2, wheelDiameter: 0.74, wheelWidth: 0.28, axleZ: 1.46 },
  'utility-truck': { width: 2.18, length: 5.5, bodyHeight: 0.75, cabinWidth: 1.95, cabinLength: 1.8, cabinHeight: 1.15, cabinZ: 1.15, wheelDiameter: 0.82, wheelWidth: 0.32, axleZ: 1.7 },
  'police-interceptor': { width: 1.98, length: 4.75, bodyHeight: 0.5, cabinWidth: 1.62, cabinLength: 2.2, cabinHeight: 0.58, cabinZ: -0.2, wheelDiameter: 0.74, wheelWidth: 0.3, axleZ: 1.45 },
  'police-suv': { width: 2.12, length: 4.95, bodyHeight: 0.72, cabinWidth: 1.85, cabinLength: 2.45, cabinHeight: 0.92, cabinZ: -0.12, wheelDiameter: 0.86, wheelWidth: 0.34, axleZ: 1.5 }
};

const DEFAULT_SHAPE: ShapeSpec = {
  width: 1.94, length: 4.4, bodyHeight: 0.5, cabinWidth: 1.58, cabinLength: 1.95,
  cabinHeight: 0.58, cabinZ: -0.2, wheelDiameter: 0.76, wheelWidth: 0.3, axleZ: 1.36
};

export function createVehicleVisual(scene: Scene, options: VehicleVisualOptions): Mesh {
  const spec = SHAPES[options.vehicleClass] ?? DEFAULT_SHAPE;
  const body = MeshBuilder.CreateBox(`${options.name}-body`, { width: spec.width, height: spec.bodyHeight, depth: spec.length }, scene);
  body.position.y = spec.wheelDiameter * 0.48;

  const paint = new StandardMaterial(`${options.name}-paint`, scene);
  paint.diffuseColor = Color3.FromHexString(options.paint);
  paint.specularColor = Color3.FromHexString('#4c5154');
  body.material = paint;

  const glass = new StandardMaterial(`${options.name}-glass`, scene);
  glass.diffuseColor = Color3.FromHexString('#11171b');
  glass.specularColor = Color3.FromHexString('#596268');

  const rubber = new StandardMaterial(`${options.name}-rubber`, scene);
  rubber.diffuseColor = Color3.FromHexString('#08090a');
  rubber.specularColor = Color3.FromHexString('#1c1d1e');

  const cabin = MeshBuilder.CreateBox(`${options.name}-cabin`, {
    width: spec.cabinWidth,
    height: spec.cabinHeight,
    depth: spec.cabinLength
  }, scene);
  cabin.parent = body;
  cabin.position.set(0, spec.bodyHeight * 0.5 + spec.cabinHeight * 0.47, spec.cabinZ);
  cabin.material = glass;

  if (options.vehicleClass === 'utility-truck') {
    const bed = MeshBuilder.CreateBox(`${options.name}-cargo`, { width: spec.width * 0.96, height: 1.15, depth: 2.7 }, scene);
    bed.parent = body;
    bed.position.set(0, 0.72, -1.15);
    bed.material = paint;
  }

  if (options.vehicleClass === 'police-suv') {
    const bumper = MeshBuilder.CreateBox(`${options.name}-pushbar`, { width: spec.width * 0.78, height: 0.45, depth: 0.16 }, scene);
    bumper.parent = body;
    bumper.position.set(0, 0.05, spec.length * 0.52);
    bumper.material = rubber;
  }

  const wheelX = spec.width * 0.51;
  for (const [x, z] of [[-wheelX, spec.axleZ], [wheelX, spec.axleZ], [-wheelX, -spec.axleZ], [wheelX, -spec.axleZ]] as Array<[number, number]>) {
    const wheel = MeshBuilder.CreateCylinder(`${options.name}-wheel-${x}-${z}`, {
      diameter: spec.wheelDiameter,
      height: spec.wheelWidth,
      tessellation: 14
    }, scene);
    wheel.parent = body;
    wheel.position.set(x, -spec.bodyHeight * 0.32, z);
    wheel.rotation.z = Math.PI / 2;
    wheel.material = rubber;
  }

  const lamp = new StandardMaterial(`${options.name}-lamp`, scene);
  lamp.diffuseColor = Color3.FromHexString('#d4d8cf');
  lamp.emissiveColor = Color3.FromHexString('#6c736d');
  for (const x of [-spec.width * 0.28, spec.width * 0.28]) {
    const headlight = MeshBuilder.CreateBox(`${options.name}-headlight-${x}`, { width: 0.34, height: 0.11, depth: 0.06 }, scene);
    headlight.parent = body;
    headlight.position.set(x, 0.08, spec.length * 0.505);
    headlight.material = lamp;
  }

  if (options.policeLights) {
    const red = new StandardMaterial(`${options.name}-red`, scene);
    red.diffuseColor = Color3.FromHexString('#70434d');
    red.emissiveColor = Color3.FromHexString('#48101b');
    const blue = new StandardMaterial(`${options.name}-blue`, scene);
    blue.diffuseColor = Color3.FromHexString('#466271');
    blue.emissiveColor = Color3.FromHexString('#102f42');
    for (const [x, lightMaterial] of [[-0.34, red], [0.34, blue]] as const) {
      const bar = MeshBuilder.CreateBox(`${options.name}-bar-${x}`, { width: 0.58, height: 0.11, depth: 0.18 }, scene);
      bar.parent = body;
      bar.position.set(x, spec.bodyHeight * 0.5 + spec.cabinHeight + 0.02, spec.cabinZ);
      bar.material = lightMaterial;
    }
  }

  return body;
}
