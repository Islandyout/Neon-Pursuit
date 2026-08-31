import type { RaceRoute } from './contracts';

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

export const RACE_ROUTES: RaceRoute[] = [NIGHT_LOOP, NIGHT_LOOP_SHORTCUT];
