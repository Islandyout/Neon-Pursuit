import type { CustomizationState } from './contracts';
import { PLAYER_VEHICLE_IDS } from './VehicleCatalog';

export interface GarageProfile {
  activeVehicleId: string;
  ownedVehicleIds: string[];
  customization: Record<string, CustomizationState>;
}

export const CUSTOMIZATION_PRESETS: CustomizationState[] = [
  { paint: '#2c94a7', wheelStyle: 'five-spoke', spoiler: 'lip', rideHeight: 0.02, bodyKit: 'street' },
  { paint: '#8d1e35', wheelStyle: 'deep-dish', spoiler: 'street', rideHeight: 0.05, bodyKit: 'widebody' },
  { paint: '#b9b4a2', wheelStyle: 'mesh', spoiler: 'none', rideHeight: 0, bodyKit: 'stock' },
  { paint: '#4c4f52', wheelStyle: 'aero', spoiler: 'track', rideHeight: 0.04, bodyKit: 'street' },
  { paint: '#56614f', wheelStyle: 'five-spoke', spoiler: 'street', rideHeight: 0.03, bodyKit: 'widebody' },
  { paint: '#5d3f3b', wheelStyle: 'deep-dish', spoiler: 'lip', rideHeight: 0.01, bodyKit: 'street' },
  { paint: '#d4c7a4', wheelStyle: 'aero', spoiler: 'track', rideHeight: 0.04, bodyKit: 'widebody' },
  { paint: '#26333b', wheelStyle: 'mesh', spoiler: 'none', rideHeight: 0.02, bodyKit: 'stock' },
  { paint: '#6c5d4d', wheelStyle: 'five-spoke', spoiler: 'street', rideHeight: 0.03, bodyKit: 'street' },
  { paint: '#34383b', wheelStyle: 'deep-dish', spoiler: 'track', rideHeight: 0.05, bodyKit: 'widebody' },
  { paint: '#837b69', wheelStyle: 'mesh', spoiler: 'lip', rideHeight: 0.02, bodyKit: 'street' },
  { paint: '#4a4551', wheelStyle: 'aero', spoiler: 'street', rideHeight: 0.03, bodyKit: 'widebody' }
];

const STORAGE_KEY = 'neon-pursuit-garage-v1';

export class GarageSystem {
  private profile: GarageProfile;

  constructor() {
    this.profile = this.load();
  }

  getProfile(): GarageProfile {
    return structuredClone(this.profile);
  }

  setActiveVehicle(vehicleId: string): void {
    if (!this.profile.ownedVehicleIds.includes(vehicleId)) throw new Error(`Vehicle is not owned: ${vehicleId}`);
    this.profile.activeVehicleId = vehicleId;
    this.save();
  }

  setCustomization(vehicleId: string, customization: CustomizationState): void {
    this.profile.customization[vehicleId] = customization;
    this.save();
  }

  private load(): GarageProfile {
    const fallback: GarageProfile = {
      activeVehicleId: PLAYER_VEHICLE_IDS[0],
      ownedVehicleIds: [...PLAYER_VEHICLE_IDS],
      customization: Object.fromEntries(PLAYER_VEHICLE_IDS.map((id, index) => [id, CUSTOMIZATION_PRESETS[index % CUSTOMIZATION_PRESETS.length]]))
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as GarageProfile;
      return parsed.activeVehicleId && Array.isArray(parsed.ownedVehicleIds) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
  }
}
