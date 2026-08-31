import type { VehicleDefinition } from './contracts';

export const VEHICLE_CATALOG: VehicleDefinition[] = [
  {
    id: 'kaze-s1', name: 'Kaze S1', vehicleClass: 'tuner-coupe', massKg: 1320, powerKw: 235,
    maxSpeedKph: 272, grip: 0.86, driftBias: 0.58, steeringResponse: 8.8, brakeStrength: 39,
    nitrousPower: 30, wheelbaseM: 2.62, color: '#2c94a7'
  },
  {
    id: 'raijin-r', name: 'Raijin R', vehicleClass: 'sports-sedan', massKg: 1540, powerKw: 280,
    maxSpeedKph: 286, grip: 0.9, driftBias: 0.45, steeringResponse: 8.2, brakeStrength: 42,
    nitrousPower: 32, wheelbaseM: 2.83, color: '#8d1e35'
  },
  {
    id: 'hibiki-3', name: 'Hibiki 3', vehicleClass: 'hatch', massKg: 1240, powerKw: 205,
    maxSpeedKph: 252, grip: 0.88, driftBias: 0.5, steeringResponse: 9.2, brakeStrength: 38,
    nitrousPower: 29, wheelbaseM: 2.51, color: '#706b55'
  },
  {
    id: 'oni-v8', name: 'Oni V8', vehicleClass: 'muscle', massKg: 1720, powerKw: 360,
    maxSpeedKph: 296, grip: 0.81, driftBias: 0.72, steeringResponse: 7.2, brakeStrength: 41,
    nitrousPower: 35, wheelbaseM: 2.88, color: '#5d3f3b'
  },
  {
    id: 'mako-x', name: 'Mako X', vehicleClass: 'exotic', massKg: 1420, powerKw: 405,
    maxSpeedKph: 324, grip: 0.95, driftBias: 0.32, steeringResponse: 7.9, brakeStrength: 46,
    nitrousPower: 36, wheelbaseM: 2.7, color: '#d4c7a4'
  },
  {
    id: 'metro-compact', name: 'Metro Compact', vehicleClass: 'traffic-sedan', massKg: 1280, powerKw: 95,
    maxSpeedKph: 165, grip: 0.78, driftBias: 0.08, steeringResponse: 6.4, brakeStrength: 32,
    nitrousPower: 0, wheelbaseM: 2.55, color: '#7d8589'
  },
  {
    id: 'city-van', name: 'City Van', vehicleClass: 'traffic-van', massKg: 1960, powerKw: 115,
    maxSpeedKph: 145, grip: 0.7, driftBias: 0.03, steeringResponse: 5.2, brakeStrength: 29,
    nitrousPower: 0, wheelbaseM: 3.1, color: '#d0d0c8'
  },
  {
    id: 'dock-hauler', name: 'Dock Hauler', vehicleClass: 'utility-truck', massKg: 3380, powerKw: 145,
    maxSpeedKph: 126, grip: 0.67, driftBias: 0.01, steeringResponse: 4.7, brakeStrength: 27,
    nitrousPower: 0, wheelbaseM: 3.45, color: '#625f58'
  },
  {
    id: 'interceptor-9', name: 'Interceptor 9', vehicleClass: 'police-interceptor', massKg: 1680, powerKw: 340,
    maxSpeedKph: 302, grip: 0.94, driftBias: 0.28, steeringResponse: 8.6, brakeStrength: 45,
    nitrousPower: 26, wheelbaseM: 2.79, color: '#20252b'
  },
  {
    id: 'guardian-x', name: 'Guardian X', vehicleClass: 'police-suv', massKg: 2310, powerKw: 310,
    maxSpeedKph: 250, grip: 0.83, driftBias: 0.16, steeringResponse: 6.7, brakeStrength: 40,
    nitrousPower: 18, wheelbaseM: 3.05, color: '#1b2026'
  }
];

export const PLAYER_VEHICLE_IDS = ['kaze-s1', 'raijin-r', 'hibiki-3', 'oni-v8', 'mako-x'] as const;

export const getVehicleDefinition = (id: string): VehicleDefinition => {
  const vehicle = VEHICLE_CATALOG.find((entry) => entry.id === id);
  if (!vehicle) throw new Error(`Unknown vehicle definition: ${id}`);
  return vehicle;
};
