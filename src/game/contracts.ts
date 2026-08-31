export type DistrictId = 'shibuya-core' | 'bay-industrial' | 'elevated-loop' | 'old-town';
export type RoadClass = 'expressway' | 'arterial' | 'street' | 'alley' | 'service' | 'parking' | 'tunnel';
export type VehicleClass = 'tuner-coupe' | 'sports-sedan' | 'hatch' | 'muscle' | 'exotic' | 'police-interceptor' | 'police-suv' | 'traffic-sedan' | 'traffic-van' | 'utility-truck';
export type PursuitState = 'patrol' | 'investigate' | 'engage' | 'chase' | 'intercept' | 'search' | 'cooldown';
export type QualityTier = 'desktop' | 'mobile-high' | 'mobile-low';
export type ControlMode = 'analog' | 'tap' | 'gyro';

export interface RoadPoint {
  x: number;
  z: number;
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  roadClass: RoadClass;
  district: DistrictId;
  width: number;
  speedKph: number;
  lanes: number;
  oneWay?: boolean;
  shortcut?: boolean;
  policeAccess?: 'full' | 'interceptor-only' | 'restricted';
  trafficDensity?: number;
  points: RoadPoint[];
}

export interface RoadNode {
  id: string;
  position: RoadPoint;
  district: DistrictId;
  tags?: Array<'intersection' | 'checkpoint' | 'escape' | 'spawn' | 'landmark' | 'roadblock'>;
}

export interface RoadGraphDefinition {
  nodes: RoadNode[];
  edges: RoadEdge[];
}

export interface VehicleDefinition {
  id: string;
  name: string;
  vehicleClass: VehicleClass;
  massKg: number;
  powerKw: number;
  maxSpeedKph: number;
  grip: number;
  driftBias: number;
  steeringResponse: number;
  brakeStrength: number;
  nitrousPower: number;
  wheelbaseM: number;
  color: string;
}

export interface VehicleTelemetry {
  speedKph: number;
  gear: number;
  nitrous: number;
  heat: number;
  slip: number;
  driftScore: number;
}

export interface VehicleInput {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  nitro: boolean;
}

export interface ShortcutDefinition {
  id: string;
  edgeId: string;
  risk: number;
  rewardSeconds: number;
  minimumSkill: number;
}

export interface RaceRoute {
  id: string;
  name: string;
  edgeIds: string[];
  laps: number;
  targetTimeSeconds: number;
}

export interface CustomizationState {
  paint: string;
  wheelStyle: 'mesh' | 'five-spoke' | 'deep-dish' | 'aero';
  spoiler: 'none' | 'lip' | 'street' | 'track';
  rideHeight: number;
  bodyKit: 'stock' | 'street' | 'widebody';
}

export interface QualityProfile {
  tier: QualityTier;
  targetDpr: number;
  cityRadius: number;
  buildingSlots: number;
  bloom: boolean;
  trafficBudget: number;
  policeBudget: number;
}
