import type { RoadEdge, RoadGraphDefinition, RoadNode, RoadPoint, ShortcutDefinition } from './contracts';

const node = (id: string, x: number, z: number, district: RoadNode['district'], tags?: RoadNode['tags']): RoadNode => ({
  id, position: { x, z }, district, tags
});

const edge = (
  id: string,
  from: string,
  to: string,
  roadClass: RoadEdge['roadClass'],
  district: RoadEdge['district'],
  points: RoadPoint[],
  options: Partial<Omit<RoadEdge, 'id' | 'from' | 'to' | 'roadClass' | 'district' | 'points'>> = {}
): RoadEdge => ({
  id, from, to, roadClass, district, points,
  width: options.width ?? (roadClass === 'expressway' ? 28 : roadClass === 'arterial' ? 22 : roadClass === 'alley' ? 7 : 13),
  speedKph: options.speedKph ?? (roadClass === 'expressway' ? 220 : roadClass === 'arterial' ? 140 : roadClass === 'alley' ? 70 : 105),
  lanes: options.lanes ?? (roadClass === 'expressway' ? 4 : roadClass === 'arterial' ? 3 : 2),
  oneWay: options.oneWay,
  shortcut: options.shortcut,
  policeAccess: options.policeAccess ?? 'full',
  trafficDensity: options.trafficDensity ?? (roadClass === 'expressway' ? 0.65 : roadClass === 'alley' ? 0.12 : 0.45)
});

export const ROAD_GRAPH: RoadGraphDefinition = {
  nodes: [
    node('central-west', -360, 30, 'shibuya-core', ['intersection', 'spawn']),
    node('central', 0, 0, 'shibuya-core', ['intersection', 'landmark']),
    node('central-east', 380, 20, 'shibuya-core', ['intersection']),
    node('north', 40, 350, 'shibuya-core', ['intersection']),
    node('south', -30, -340, 'old-town', ['intersection', 'escape']),
    node('bay-west', 430, -330, 'bay-industrial', ['intersection', 'spawn']),
    node('bay-east', 780, -280, 'bay-industrial', ['intersection', 'roadblock']),
    node('loop-ne', 650, 300, 'elevated-loop', ['checkpoint']),
    node('loop-nw', -420, 390, 'elevated-loop', ['checkpoint']),
    node('old-west', -520, -310, 'old-town', ['intersection']),
    node('parking-in', 120, -120, 'shibuya-core'),
    node('parking-out', 290, -160, 'shibuya-core'),
    node('alley-in', -130, 110, 'shibuya-core'),
    node('alley-out', 130, 180, 'shibuya-core'),
    node('tunnel-in', -260, -170, 'old-town'),
    node('tunnel-out', 180, -300, 'old-town')
  ],
  edges: [
    edge('arterial-west', 'central-west', 'central', 'arterial', 'shibuya-core', [{ x: -360, z: 30 }, { x: -180, z: 5 }, { x: 0, z: 0 }]),
    edge('arterial-east', 'central', 'central-east', 'arterial', 'shibuya-core', [{ x: 0, z: 0 }, { x: 180, z: 30 }, { x: 380, z: 20 }]),
    edge('north-spine', 'central', 'north', 'street', 'shibuya-core', [{ x: 0, z: 0 }, { x: -20, z: 165 }, { x: 40, z: 350 }], { width: 16 }),
    edge('south-spine', 'central', 'south', 'street', 'old-town', [{ x: 0, z: 0 }, { x: 25, z: -160 }, { x: -30, z: -340 }], { width: 15 }),
    edge('bay-connector', 'central-east', 'bay-west', 'arterial', 'bay-industrial', [{ x: 380, z: 20 }, { x: 460, z: -130 }, { x: 430, z: -330 }], { speedKph: 155 }),
    edge('dock-run', 'bay-west', 'bay-east', 'service', 'bay-industrial', [{ x: 430, z: -330 }, { x: 610, z: -360 }, { x: 780, z: -280 }], { width: 17, speedKph: 125 }),
    edge('express-ne', 'bay-east', 'loop-ne', 'expressway', 'elevated-loop', [{ x: 780, z: -280 }, { x: 820, z: 20 }, { x: 650, z: 300 }], { oneWay: true }),
    edge('express-north', 'loop-ne', 'loop-nw', 'expressway', 'elevated-loop', [{ x: 650, z: 300 }, { x: 130, z: 500 }, { x: -420, z: 390 }], { oneWay: true }),
    edge('express-west', 'loop-nw', 'old-west', 'expressway', 'elevated-loop', [{ x: -420, z: 390 }, { x: -650, z: 40 }, { x: -520, z: -310 }], { oneWay: true }),
    edge('express-south', 'old-west', 'bay-west', 'expressway', 'elevated-loop', [{ x: -520, z: -310 }, { x: -40, z: -520 }, { x: 430, z: -330 }], { oneWay: true }),
    edge('old-quarter', 'old-west', 'central-west', 'street', 'old-town', [{ x: -520, z: -310 }, { x: -470, z: -120 }, { x: -360, z: 30 }], { width: 12, speedKph: 90 }),
    edge('alley-cut', 'alley-in', 'alley-out', 'alley', 'shibuya-core', [{ x: -130, z: 110 }, { x: -15, z: 145 }, { x: 130, z: 180 }], { shortcut: true, policeAccess: 'restricted', lanes: 1 }),
    edge('alley-entry', 'central-west', 'alley-in', 'street', 'shibuya-core', [{ x: -360, z: 30 }, { x: -245, z: 75 }, { x: -130, z: 110 }], { width: 11 }),
    edge('alley-exit', 'alley-out', 'north', 'street', 'shibuya-core', [{ x: 130, z: 180 }, { x: 80, z: 250 }, { x: 40, z: 350 }], { width: 11 }),
    edge('parking-cut', 'parking-in', 'parking-out', 'parking', 'shibuya-core', [{ x: 120, z: -120 }, { x: 190, z: -90 }, { x: 250, z: -115 }, { x: 290, z: -160 }], { shortcut: true, policeAccess: 'interceptor-only', lanes: 1, width: 9, speedKph: 80 }),
    edge('parking-entry', 'central', 'parking-in', 'street', 'shibuya-core', [{ x: 0, z: 0 }, { x: 60, z: -55 }, { x: 120, z: -120 }], { width: 10 }),
    edge('parking-exit', 'parking-out', 'bay-west', 'street', 'shibuya-core', [{ x: 290, z: -160 }, { x: 350, z: -240 }, { x: 430, z: -330 }], { width: 10 }),
    edge('tunnel-cut', 'tunnel-in', 'tunnel-out', 'tunnel', 'old-town', [{ x: -260, z: -170 }, { x: -50, z: -245 }, { x: 180, z: -300 }], { shortcut: true, lanes: 2, width: 14, speedKph: 150 }),
    edge('tunnel-entry', 'central-west', 'tunnel-in', 'street', 'old-town', [{ x: -360, z: 30 }, { x: -320, z: -90 }, { x: -260, z: -170 }], { width: 12 }),
    edge('tunnel-exit', 'tunnel-out', 'bay-west', 'street', 'bay-industrial', [{ x: 180, z: -300 }, { x: 300, z: -320 }, { x: 430, z: -330 }], { width: 12 }),
    edge('market-cut', 'central-west', 'south', 'alley', 'old-town', [{ x: -360, z: 30 }, { x: -250, z: -90 }, { x: -160, z: -220 }, { x: -30, z: -340 }], { shortcut: true, policeAccess: 'restricted', lanes: 1, width: 8, speedKph: 85 })
  ]
};

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'shortcut-alley', edgeId: 'alley-cut', risk: 0.62, rewardSeconds: 5.5, minimumSkill: 0.35 },
  { id: 'shortcut-parking', edgeId: 'parking-cut', risk: 0.78, rewardSeconds: 8, minimumSkill: 0.55 },
  { id: 'shortcut-tunnel', edgeId: 'tunnel-cut', risk: 0.4, rewardSeconds: 10, minimumSkill: 0.45 },
  { id: 'shortcut-market', edgeId: 'market-cut', risk: 0.84, rewardSeconds: 7.5, minimumSkill: 0.7 }
];

export const getRoadEdge = (id: string): RoadEdge => {
  const road = ROAD_GRAPH.edges.find((entry) => entry.id === id);
  if (!road) throw new Error(`Unknown road edge: ${id}`);
  return road;
};

export const getConnectedEdges = (nodeId: string): RoadEdge[] => ROAD_GRAPH.edges.filter((entry) => entry.from === nodeId || (!entry.oneWay && entry.to === nodeId));

export const distanceToSegment = (point: RoadPoint, a: RoadPoint, b: RoadPoint): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
  const px = a.x + t * dx;
  const pz = a.z + t * dz;
  return Math.hypot(point.x - px, point.z - pz);
};

export const findClosestRoad = (point: RoadPoint): RoadEdge => {
  let best = ROAD_GRAPH.edges[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const road of ROAD_GRAPH.edges) {
    for (let index = 1; index < road.points.length; index += 1) {
      const distance = distanceToSegment(point, road.points[index - 1], road.points[index]);
      if (distance < bestDistance) {
        best = road;
        bestDistance = distance;
      }
    }
  }
  return best;
};
