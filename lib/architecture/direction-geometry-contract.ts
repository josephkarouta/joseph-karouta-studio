export type DirectionGeometryEdge = "north" | "south" | "east" | "west";

export type DirectionGeometryPoint = { x: number; y: number };

export type DirectionGeometryRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DirectionGeometryContract = {
  version: 1;
  coordinate_system: "site_grid_0_100";
  front_edge: DirectionGeometryEdge;
  storeys: number;
  massing_summary: string;
  site_relationship_summary: string;
  ground_outline: DirectionGeometryPoint[];
  upper_level_outlines: Array<{
    level_index: number;
    relationship: string;
    points: DirectionGeometryPoint[];
  }>;
  entry: {
    edge: DirectionGeometryEdge;
    position_0_100: number;
    x: number;
    y: number;
    description: string;
  };
  garage: {
    present: boolean;
    edge: DirectionGeometryEdge;
    position_0_100: number;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  };
  driveway: {
    present: boolean;
    access_edge: DirectionGeometryEdge;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  };
  pool: {
    present: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    relationship_to_entry: "left" | "right" | "front" | "rear" | "none";
    description: string;
  };
  outdoor_living: {
    present: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  };
  vertical_core: {
    required: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    description: string;
  };
  must_preserve: string[];
};

type PlanPoint = { x: number; y: number };
type PlanRoom = { id?: string; name?: string; zone?: string; x: number; y: number; width: number; height: number };
type PlanOpening = {
  type?: "door" | "window" | "sliding_door" | "garage_door" | string;
  room_id?: string;
  wall?: "north" | "south" | "east" | "west" | string;
  position?: number;
  width_m?: number;
  connects_to?: string;
};
type PlanLevel = {
  id?: string;
  label?: string;
  outline?: PlanPoint[];
  rooms?: PlanRoom[];
  stairs?: Array<{ x: number; y: number; width: number; height: number }>;
  openings?: PlanOpening[];
};
type PlanLike = {
  building_outline?: { points?: PlanPoint[] };
  footprint?: DirectionGeometryRect;
  levels?: PlanLevel[];
  entry?: { x: number; y: number; label?: string };
  pool?: { present: boolean; x: number; y: number; width: number; height: number };
  driveway?: { present: boolean; x: number; y: number; width: number; height: number };
  vertical_cores?: Array<{ type?: string; x: number; y: number; width: number; height: number; serves_level_ids?: string[] }>;
};

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value: unknown, min = 0, max = 100) {
  return Math.max(min, Math.min(max, numberValue(value, min)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pointsFrom(value: unknown): DirectionGeometryPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((point) => ({ x: clamp(point.x), y: clamp(point.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function edgeFrom(value: unknown): DirectionGeometryEdge | null {
  return value === "north" || value === "south" || value === "east" || value === "west" ? value : null;
}

function rectFrom(value: unknown) {
  if (!isRecord(value)) return null;
  return {
    x: clamp(value.x),
    y: clamp(value.y),
    width: clamp(value.width, 0, 100),
    height: clamp(value.height, 0, 100),
  };
}

export function directionGeometryContractFromUnknown(value: unknown): DirectionGeometryContract | null {
  if (!isRecord(value)) return null;
  const frontEdge = edgeFrom(value.front_edge);
  const entry = isRecord(value.entry) ? value.entry : null;
  const garage = isRecord(value.garage) ? value.garage : null;
  const driveway = isRecord(value.driveway) ? value.driveway : null;
  const pool = isRecord(value.pool) ? value.pool : null;
  const outdoorLiving = isRecord(value.outdoor_living) ? value.outdoor_living : null;
  const verticalCore = isRecord(value.vertical_core) ? value.vertical_core : null;
  const groundOutline = pointsFrom(value.ground_outline);
  if (!frontEdge || !entry || !garage || !driveway || !pool || !outdoorLiving || !verticalCore || groundOutline.length < 4) {
    return null;
  }

  const entryEdge = edgeFrom(entry.edge);
  const garageEdge = edgeFrom(garage.edge);
  const drivewayEdge = edgeFrom(driveway.access_edge);
  const relationship = pool.relationship_to_entry;
  if (!entryEdge || !garageEdge || !drivewayEdge || !["left", "right", "front", "rear", "none"].includes(String(relationship))) {
    return null;
  }

  const upperLevelOutlines = Array.isArray(value.upper_level_outlines)
    ? value.upper_level_outlines.filter(isRecord).map((item) => ({
        level_index: Math.max(1, Math.round(numberValue(item.level_index, 1))),
        relationship: String(item.relationship || "Upper level coordinated with the selected massing."),
        points: pointsFrom(item.points),
      })).filter((item) => item.points.length >= 4)
    : [];

  const contract: DirectionGeometryContract = {
    version: 1,
    coordinate_system: "site_grid_0_100",
    front_edge: frontEdge,
    storeys: Math.max(1, Math.min(12, Math.round(numberValue(value.storeys, 1)))),
    massing_summary: String(value.massing_summary || ""),
    site_relationship_summary: String(value.site_relationship_summary || ""),
    ground_outline: groundOutline,
    upper_level_outlines: upperLevelOutlines,
    entry: {
      edge: entryEdge,
      position_0_100: clamp(entry.position_0_100),
      x: clamp(entry.x),
      y: clamp(entry.y),
      description: String(entry.description || ""),
    },
    garage: {
      present: garage.present === true,
      edge: garageEdge,
      position_0_100: clamp(garage.position_0_100),
      x: clamp(garage.x),
      y: clamp(garage.y),
      width: clamp(garage.width, 0, 100),
      height: clamp(garage.height, 0, 100),
      description: String(garage.description || ""),
    },
    driveway: {
      present: driveway.present === true,
      access_edge: drivewayEdge,
      x: clamp(driveway.x),
      y: clamp(driveway.y),
      width: clamp(driveway.width, 0, 100),
      height: clamp(driveway.height, 0, 100),
      description: String(driveway.description || ""),
    },
    pool: {
      present: pool.present === true,
      x: clamp(pool.x),
      y: clamp(pool.y),
      width: clamp(pool.width, 0, 100),
      height: clamp(pool.height, 0, 100),
      relationship_to_entry: relationship as DirectionGeometryContract["pool"]["relationship_to_entry"],
      description: String(pool.description || ""),
    },
    outdoor_living: {
      present: outdoorLiving.present === true,
      x: clamp(outdoorLiving.x),
      y: clamp(outdoorLiving.y),
      width: clamp(outdoorLiving.width, 0, 100),
      height: clamp(outdoorLiving.height, 0, 100),
      description: String(outdoorLiving.description || ""),
    },
    vertical_core: {
      required: verticalCore.required === true,
      x: clamp(verticalCore.x),
      y: clamp(verticalCore.y),
      width: clamp(verticalCore.width, 0, 100),
      height: clamp(verticalCore.height, 0, 100),
      description: String(verticalCore.description || ""),
    },
    must_preserve: Array.isArray(value.must_preserve) ? value.must_preserve.map((item) => String(item)).filter(Boolean).slice(0, 16) : [],
  };

  // relationship_to_entry is derived data. The model occasionally supplies a
  // correct pool rectangle but an inconsistent word such as "rear" instead of
  // "left". Normalize the label from the locked coordinates so a harmless
  // prose mismatch does not waste an entire Direction generation/correction.
  if (contract.pool.present) {
    contract.pool.relationship_to_entry = poolRelationshipToEntry(contract);
  } else {
    contract.pool.relationship_to_entry = "none";
  }

  return contract;
}

function bounds(points: PlanPoint[]) {
  const safe = points.length ? points : [{ x: 0, y: 0 }];
  return {
    minX: Math.min(...safe.map((point) => numberValue(point.x))),
    minY: Math.min(...safe.map((point) => numberValue(point.y))),
    maxX: Math.max(...safe.map((point) => numberValue(point.x))),
    maxY: Math.max(...safe.map((point) => numberValue(point.y))),
  };
}

function fallbackOutline(plan: PlanLike) {
  if (Array.isArray(plan.building_outline?.points) && plan.building_outline!.points!.length >= 4) {
    return plan.building_outline!.points!;
  }
  const footprint = plan.footprint || { x: 15, y: 15, width: 70, height: 70 };
  return [
    { x: footprint.x, y: footprint.y },
    { x: footprint.x + footprint.width, y: footprint.y },
    { x: footprint.x + footprint.width, y: footprint.y + footprint.height },
    { x: footprint.x, y: footprint.y + footprint.height },
  ];
}

function levelOutline(plan: PlanLike, level: PlanLevel | undefined) {
  return Array.isArray(level?.outline) && level!.outline!.length >= 4 ? level!.outline! : fallbackOutline(plan);
}

function rectCenter(rect: DirectionGeometryRect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rectDistance(a: DirectionGeometryRect, b: DirectionGeometryRect) {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return Math.hypot(dx, dy);
}

function pointInPolygon(point: PlanPoint, polygon: PlanPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const dy = yj - yi;
    const denominator = Math.abs(dy) < 0.000001 ? (dy < 0 ? -0.000001 : 0.000001) : dy;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && point.x < ((xj - xi) * (point.y - yi)) / denominator + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a: PlanPoint, b: PlanPoint, c: PlanPoint) {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function segmentsIntersect(a1: PlanPoint, a2: PlanPoint, b1: PlanPoint, b2: PlanPoint) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function rectOverlapsPolygon(rect: DirectionGeometryRect, polygon: PlanPoint[]) {
  if (rect.width <= 0 || rect.height <= 0 || polygon.length < 3) return false;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  if (corners.some((corner) => pointInPolygon(corner, polygon))) return true;
  if (polygon.some((point) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height)) return true;
  for (let i = 0; i < corners.length; i += 1) {
    const a1 = corners[i];
    const a2 = corners[(i + 1) % corners.length];
    for (let j = 0; j < polygon.length; j += 1) {
      const b1 = polygon[j];
      const b2 = polygon[(j + 1) % polygon.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function nearestEdge(point: PlanPoint, outline: PlanPoint[]): DirectionGeometryEdge {
  const box = bounds(outline);
  const candidates: Array<{ edge: DirectionGeometryEdge; distance: number }> = [
    { edge: "north", distance: Math.abs(point.y - box.minY) },
    { edge: "south", distance: Math.abs(point.y - box.maxY) },
    { edge: "west", distance: Math.abs(point.x - box.minX) },
    { edge: "east", distance: Math.abs(point.x - box.maxX) },
  ];
  return candidates.sort((a, b) => a.distance - b.distance)[0]?.edge || "south";
}

function distanceToEdge(point: PlanPoint, outline: PlanPoint[], edge: DirectionGeometryEdge) {
  const box = bounds(outline);
  if (edge === "north") return Math.abs(point.y - box.minY);
  if (edge === "south") return Math.abs(point.y - box.maxY);
  if (edge === "west") return Math.abs(point.x - box.minX);
  return Math.abs(point.x - box.maxX);
}

function polygonArea(points: PlanPoint[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function outlineSimilarityIssues(actual: PlanPoint[], expected: PlanPoint[], label: string) {
  const issues: string[] = [];
  const actualBounds = bounds(actual);
  const expectedBounds = bounds(expected);
  const actualCenter = { x: (actualBounds.minX + actualBounds.maxX) / 2, y: (actualBounds.minY + actualBounds.maxY) / 2 };
  const expectedCenter = { x: (expectedBounds.minX + expectedBounds.maxX) / 2, y: (expectedBounds.minY + expectedBounds.maxY) / 2 };
  const actualWidth = actualBounds.maxX - actualBounds.minX;
  const actualHeight = actualBounds.maxY - actualBounds.minY;
  const expectedWidth = expectedBounds.maxX - expectedBounds.minX;
  const expectedHeight = expectedBounds.maxY - expectedBounds.minY;
  const actualArea = polygonArea(actual);
  const expectedArea = polygonArea(expected);

  if (distance(actualCenter, expectedCenter) > 14 || Math.abs(actualWidth - expectedWidth) > 18 || Math.abs(actualHeight - expectedHeight) > 18) {
    issues.push(`${label} moved or resized too far from the selected Direction Geometry Contract.`);
  }
  if (expectedArea > 1) {
    const ratio = actualArea / expectedArea;
    if (ratio < 0.68 || ratio > 1.32) {
      issues.push(`${label} footprint area/shape no longer resembles the selected Direction Geometry Contract.`);
    }
  }
  return issues;
}

function poolRelationshipToEntry(contract: DirectionGeometryContract) {
  if (!contract.pool.present) return "none" as const;
  const poolCenter = rectCenter(contractRect(contract.pool));
  const entry = contract.entry;
  const dx = poolCenter.x - entry.x;
  const dy = poolCenter.y - entry.y;
  const front = contract.front_edge;

  // Left/right are interpreted from a person standing outside the front facade
  // and looking toward the building.
  if (front === "south") {
    if (Math.abs(dx) >= Math.abs(dy) * 0.65) return dx < 0 ? "left" : "right";
    return dy > 0 ? "front" : "rear";
  }
  if (front === "north") {
    if (Math.abs(dx) >= Math.abs(dy) * 0.65) return dx > 0 ? "left" : "right";
    return dy < 0 ? "front" : "rear";
  }
  if (front === "east") {
    if (Math.abs(dy) >= Math.abs(dx) * 0.65) return dy > 0 ? "left" : "right";
    return dx > 0 ? "front" : "rear";
  }
  if (Math.abs(dy) >= Math.abs(dx) * 0.65) return dy < 0 ? "left" : "right";
  return dx < 0 ? "front" : "rear";
}

function positionAlongEdge(point: PlanPoint, outline: PlanPoint[], edge: DirectionGeometryEdge) {
  const box = bounds(outline);
  if (edge === "north" || edge === "south") {
    return 100 * (point.x - box.minX) / Math.max(1, box.maxX - box.minX);
  }
  return 100 * (point.y - box.minY) / Math.max(1, box.maxY - box.minY);
}

function rectFromRoom(room: PlanRoom): DirectionGeometryRect {
  return { x: numberValue(room.x), y: numberValue(room.y), width: numberValue(room.width), height: numberValue(room.height) };
}

function contractRect(value: { x: number; y: number; width: number; height: number }): DirectionGeometryRect {
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function isPoolRoom(room: PlanRoom) {
  const text = `${room.name || ""} ${room.zone || ""}`.toLowerCase();
  return /\bpool\b/.test(text) && !/pool (?:plant|equipment|pump)|plant room|equipment room|pool bath|pool change|pool locker/.test(text);
}

function isGarageRoom(room: PlanRoom) {
  return /garage|carport|vehicle bay/i.test(`${room.name || ""} ${room.zone || ""}`);
}

function openingPoint(room: PlanRoom, opening: PlanOpening): PlanPoint | null {
  const wall = String(opening.wall || "").toLowerCase();
  if (!["north", "south", "east", "west"].includes(wall)) return null;
  const fraction = clamp(opening.position, 0, 100) / 100;
  if (wall === "north") return { x: room.x + room.width * fraction, y: room.y };
  if (wall === "south") return { x: room.x + room.width * fraction, y: room.y + room.height };
  if (wall === "west") return { x: room.x, y: room.y + room.height * fraction };
  return { x: room.x + room.width, y: room.y + room.height * fraction };
}

function isExteriorConnection(opening: PlanOpening) {
  return /outside|exterior|external|site|entry|porch|terrace|verand|garden|yard|street/i.test(String(opening.connects_to || ""));
}

export function validateDirectionGeometryContract(contract: DirectionGeometryContract) {
  const issues: string[] = [];
  const ground = contract.ground_outline;
  if (ground.length < 4) issues.push("Direction contract must define a ground-floor outline with at least four points.");
  if (contract.storeys > 1 && contract.upper_level_outlines.length < contract.storeys - 1) {
    issues.push(`Direction contract requires ${contract.storeys} storeys but defines only ${contract.upper_level_outlines.length} upper-level outline${contract.upper_level_outlines.length === 1 ? "" : "s"}.`);
  }
  const upperIndexes = contract.upper_level_outlines.map((level) => level.level_index).sort((a, b) => a - b);
  const expectedIndexes = Array.from({ length: Math.max(0, contract.storeys - 1) }, (_, index) => index + 1);
  if (upperIndexes.length !== expectedIndexes.length || upperIndexes.some((value, index) => value !== expectedIndexes[index])) {
    issues.push("Direction contract upper-level outlines must contain exactly one sequential outline for every upper storey.");
  }
  const edge = nearestEdge(contract.entry, ground);
  if (edge !== contract.entry.edge) {
    issues.push(`Direction contract entry is tagged ${contract.entry.edge} but its coordinates sit nearest the ${edge} edge.`);
  }
  if (distanceToEdge(contract.entry, ground, contract.entry.edge) > 5) {
    issues.push("Direction contract main-entry anchor is not located on the stated building facade edge.");
  }
  const position = positionAlongEdge(contract.entry, ground, contract.entry.edge);
  if (Math.abs(position - contract.entry.position_0_100) > 18) {
    issues.push("Direction contract entry coordinate and facade position disagree.");
  }
  if (contract.pool.present && rectOverlapsPolygon(contractRect(contract.pool), ground)) {
    issues.push("Direction contract places the pool inside or across the building footprint. Pool must be outside the building.");
  }
  if (contract.pool.present && contract.pool.relationship_to_entry !== "none") {
    const geometricRelationship = poolRelationshipToEntry(contract);
    if (geometricRelationship !== contract.pool.relationship_to_entry) {
      issues.push(`Direction contract describes the pool as ${contract.pool.relationship_to_entry} of the main entry, but its coordinates place it ${geometricRelationship}.`);
    }
  }
  if (contract.garage.present && !rectOverlapsPolygon(contractRect(contract.garage), ground)) {
    issues.push("Direction contract garage must intersect the ground-floor building footprint.");
  }
  if (contract.garage.present && contract.driveway.present && rectDistance(contractRect(contract.garage), contractRect(contract.driveway)) > 12) {
    issues.push("Direction contract driveway is disconnected from the garage zone.");
  }
  if (contract.vertical_core.required && (contract.vertical_core.width < 2 || contract.vertical_core.height < 2)) {
    issues.push("Direction contract vertical core is too small to act as a shared stair/lift zone.");
  }
  if (contract.vertical_core.required && !pointInPolygon(rectCenter(contractRect(contract.vertical_core)), ground)) {
    issues.push("Direction contract primary vertical core must sit within the ground-floor massing outline.");
  }
  return issues;
}

export function validateCanonicalPlanAgainstDirectionContract(plan: PlanLike, contract: DirectionGeometryContract) {
  const issues: string[] = [];
  const levels = Array.isArray(plan.levels) ? plan.levels : [];
  const ground = levels[0];
  const groundOutline = levelOutline(plan, ground);

  if (levels.length !== contract.storeys) {
    issues.push(`Direction contract requires exactly ${contract.storeys} storey${contract.storeys === 1 ? "" : "s"}, but the plan contains ${levels.length}.`);
  }

  issues.push(...outlineSimilarityIssues(groundOutline, contract.ground_outline, "Ground-floor massing"));

  const poolRooms = levels.flatMap((level) => (level.rooms || []).filter(isPoolRoom));
  if (poolRooms.length) {
    issues.push(`Pool is modeled as an internal floor-plan room (${poolRooms.map((room) => room.name || "Pool").join(", ")}). Pool must exist only as an exterior site element.`);
  }

  const planEntry = plan.entry ? { x: numberValue(plan.entry.x), y: numberValue(plan.entry.y) } : null;
  if (!planEntry) {
    issues.push("Canonical Plan is missing the main entry anchor required by the selected Direction.");
  } else {
    const edge = nearestEdge(planEntry, groundOutline);
    if (edge !== contract.entry.edge) {
      issues.push(`Main entry moved to the ${edge} edge; selected Direction locks it to the ${contract.entry.edge} edge.`);
    }
    if (distanceToEdge(planEntry, groundOutline, contract.entry.edge) > 5) {
      issues.push("Main entry is floating away from the facade instead of sitting on the locked Direction entry edge.");
    }
    const position = positionAlongEdge(planEntry, groundOutline, contract.entry.edge);
    if (Math.abs(position - contract.entry.position_0_100) > 18 || distance(planEntry, contract.entry) > 22) {
      issues.push("Main entry moved too far from the selected Direction's locked facade position.");
    }

    const roomById = new Map((ground?.rooms || []).map((room) => [String(room.id || ""), room]));
    const exteriorDoors = (ground?.openings || [])
      .filter((opening) => /door/i.test(String(opening.type || "")) && !/garage/i.test(String(opening.type || "")) && isExteriorConnection(opening))
      .map((opening) => {
        const room = roomById.get(String(opening.room_id || ""));
        const point = room ? openingPoint(room, opening) : null;
        return point ? { point, wall: String(opening.wall || "").toLowerCase() } : null;
      })
      .filter((item): item is { point: PlanPoint; wall: string } => Boolean(item));

    const matchingEntryDoor = exteriorDoors.some(({ point, wall }) => {
      const wallMatches = wall === contract.entry.edge;
      return wallMatches && distance(point, planEntry) <= 12 && distance(point, contract.entry) <= 24;
    });
    if (!matchingEntryDoor) {
      issues.push("Ground-floor openings do not include an exterior main door at the selected Direction's locked entry position.");
    }
  }

  const garages = levels.flatMap((level, levelIndex) => (level.rooms || []).filter(isGarageRoom).map((room) => ({ room, levelIndex })));
  if (contract.garage.present) {
    if (!garages.length) {
      issues.push("Selected Direction includes a garage, but the Canonical Plan contains no garage/carport room.");
    } else {
      const groundGarage = garages.find((item) => item.levelIndex === 0) || garages[0];
      if (groundGarage.levelIndex !== 0) issues.push("Garage is not located on the ground/entry level.");
      const garageRect = rectFromRoom(groundGarage.room);
      if (distance(rectCenter(garageRect), rectCenter(contractRect(contract.garage))) > 24) {
        issues.push("Garage moved to a different part of the building than the selected Direction Geometry Contract.");
      }
      const garageEdge = nearestEdge(rectCenter(garageRect), groundOutline);
      if (garageEdge !== contract.garage.edge && rectDistance(garageRect, contractRect(contract.garage)) > 10) {
        issues.push(`Garage no longer follows the selected Direction's ${contract.garage.edge}-side relationship.`);
      }
      if (contract.driveway.present) {
        if (!plan.driveway?.present) {
          issues.push("Selected Direction requires a driveway serving the garage, but the Plan has no driveway.");
        } else if (rectDistance(garageRect, contractRect(plan.driveway)) > 12) {
          issues.push("Driveway does not connect to the garage zone in the Canonical Plan.");
        }
      }
    }
  }

  if (contract.pool.present) {
    if (!plan.pool?.present) {
      issues.push("Selected Direction includes a pool, but the Canonical Plan removed it.");
    } else {
      const poolRect = contractRect(plan.pool);
      if (rectOverlapsPolygon(poolRect, groundOutline)) {
        issues.push("Pool overlaps the ground-floor building footprint. It must remain outside the house.");
      }
      if (distance(rectCenter(poolRect), rectCenter(contractRect(contract.pool))) > 25) {
        issues.push("Pool moved to a different site position than the selected Direction Geometry Contract.");
      }
    }
  } else if (plan.pool?.present) {
    issues.push("Canonical Plan introduced a pool that is not part of the selected Direction Geometry Contract.");
  }

  if (contract.driveway.present && plan.driveway?.present) {
    if (distance(rectCenter(contractRect(plan.driveway)), rectCenter(contractRect(contract.driveway))) > 28) {
      issues.push("Driveway moved to a different site access zone than the selected Direction Geometry Contract.");
    }
  }

  if (contract.vertical_core.required) {
    const core = (plan.vertical_cores || []).find((item) => item.type === "stair" || item.type === "lift" || item.type === "service_lift");
    if (!core) {
      issues.push("Selected Direction requires shared vertical circulation, but the Canonical Plan has no master stair/lift core.");
    } else if (distance(rectCenter(contractRect(core)), rectCenter(contractRect(contract.vertical_core))) > 22) {
      issues.push("Primary vertical core moved too far from the selected Direction's coordinated core zone.");
    }
  }

  contract.upper_level_outlines.forEach((expected) => {
    const level = levels[expected.level_index];
    if (!level) return;
    issues.push(...outlineSimilarityIssues(
      levelOutline(plan, level),
      expected.points,
      level.label || `Level ${expected.level_index + 1}`,
    ));
  });

  return issues;
}

export function directionGeometryContractPrompt(contract: DirectionGeometryContract) {
  const pool = contract.pool.present
    ? `Pool: exterior site element at x=${contract.pool.x.toFixed(1)}, y=${contract.pool.y.toFixed(1)}, w=${contract.pool.width.toFixed(1)}, h=${contract.pool.height.toFixed(1)}; ${contract.pool.relationship_to_entry} of the main entry; ${contract.pool.description}`
    : "Pool: none. Do not invent a pool.";
  const garage = contract.garage.present
    ? `Garage anchor zone: ${contract.garage.edge} side, facade position ${contract.garage.position_0_100.toFixed(0)}%, approximate zone x=${contract.garage.x.toFixed(1)}, y=${contract.garage.y.toFixed(1)}, w=${contract.garage.width.toFixed(1)}, h=${contract.garage.height.toFixed(1)}. This is a facade/site relationship anchor, NOT an exact room rectangle; the actual garage room may resize or shift modestly within this side/zone to fit the programme without overlaps and must connect to the driveway. ${contract.garage.description}`
    : "Garage: none. Do not invent a garage.";
  const driveway = contract.driveway.present
    ? `Driveway: access from ${contract.driveway.access_edge}, zone x=${contract.driveway.x.toFixed(1)}, y=${contract.driveway.y.toFixed(1)}, w=${contract.driveway.width.toFixed(1)}, h=${contract.driveway.height.toFixed(1)}; ${contract.driveway.description}`
    : "Driveway: none unless required by the brief.";
  const upper = contract.upper_level_outlines.map((level) => `Level ${level.level_index + 1}: ${level.relationship}; outline ${JSON.stringify(level.points)}`).join(" | ");
  return [
    "DIRECTION GEOMETRY CONTRACT — NON-NEGOTIABLE SPATIAL ANCHORS.",
    "Coordinates are one shared 0–100 site grid; x increases west→east and y increases north→south.",
    `Street/front edge: ${contract.front_edge}. Storeys: ${contract.storeys}.`,
    `Ground massing outline: ${JSON.stringify(contract.ground_outline)}.`,
    upper ? `Upper massing: ${upper}.` : "Upper massing: none; single-storey building.",
    `Main entry: ${contract.entry.edge} edge at facade position ${contract.entry.position_0_100.toFixed(0)}%, anchor x=${contract.entry.x.toFixed(1)}, y=${contract.entry.y.toFixed(1)}; ${contract.entry.description}`,
    garage,
    driveway,
    pool,
    contract.outdoor_living.present
      ? `Outdoor living: x=${contract.outdoor_living.x.toFixed(1)}, y=${contract.outdoor_living.y.toFixed(1)}, w=${contract.outdoor_living.width.toFixed(1)}, h=${contract.outdoor_living.height.toFixed(1)}; ${contract.outdoor_living.description}`
      : "Outdoor living: no dedicated zone unless required by the brief.",
    contract.vertical_core.required
      ? `Primary shared vertical core: x=${contract.vertical_core.x.toFixed(1)}, y=${contract.vertical_core.y.toFixed(1)}, w=${contract.vertical_core.width.toFixed(1)}, h=${contract.vertical_core.height.toFixed(1)}; ${contract.vertical_core.description}`
      : "Primary shared vertical core: not required for this direction.",
    `Massing intent: ${contract.massing_summary}`,
    `Site relationship: ${contract.site_relationship_summary}`,
    `Must preserve: ${contract.must_preserve.join("; ")}.`,
    "Do not mirror, rotate, swap sides, move the entry, move the garage, move the pool, move the driveway, change the level count, or invent another site composition.",
  ].join("\n");
}
