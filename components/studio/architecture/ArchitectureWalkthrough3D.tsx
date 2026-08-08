"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import {
  MathUtils,
  Vector3,
  type MeshStandardMaterialParameters,
} from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, DoorOpen, Footprints, Map as MapIcon, Maximize2, MousePointer2, RotateCcw } from "lucide-react";

type CanonicalRoom = {
  id?: string;
  name?: string;
  zone?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

type CanonicalOpening = {
  id?: string;
  type?: "door" | "window" | "sliding_door" | "garage_door";
  room_id?: string;
  wall?: "north" | "south" | "east" | "west";
  position?: number;
  width_m?: number;
  connects_to?: string;
};

type CanonicalStair = {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  connects_to_level_id?: string;
};

type CanonicalLevel = {
  id?: string;
  label?: string;
  rooms?: CanonicalRoom[];
  circulation?: Array<{ from_room_id?: string; to_room_id?: string; label?: string }>;
  openings?: CanonicalOpening[];
  stairs?: CanonicalStair[];
  fixtures?: Array<{ room_id?: string; fixture_type?: string; count?: number }>;
};

type CanonicalPlan = {
  entry?: { x?: number; y?: number; label?: string };
  pool?: { present?: boolean; x?: number; y?: number; width?: number; height?: number };
  levels?: CanonicalLevel[];
};

type RoomWorld = {
  id: string;
  name: string;
  zone: string;
  levelId: string;
  levelLabel: string;
  levelIndex: number;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  indoor: boolean;
};

type OpeningWorld = {
  id: string;
  type: "door" | "window" | "sliding_door" | "garage_door";
  orientation: "horizontal" | "vertical";
  axis: number;
  start: number;
  end: number;
  levelIndex: number;
  connectsTo: string;
};

type SolidWall = {
  id: string;
  orientation: "horizontal" | "vertical";
  axis: number;
  start: number;
  end: number;
  levelIndex: number;
};

type StairWorld = {
  id: string;
  levelIndex: number;
  targetLevelIndex: number;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
  along: "x" | "z";
};

type FixtureWorld = {
  roomId: string;
  type: string;
  count: number;
};

type PlayerState = {
  x: number;
  z: number;
  heading: number;
  levelIndex: number;
};

type WalkthroughModel = {
  levels: Array<{ id: string; label: string; index: number }>;
  rooms: RoomWorld[];
  walls: SolidWall[];
  openings: OpeningWorld[];
  stairs: StairWorld[];
  fixtures: FixtureWorld[];
  spawn: [number, number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  pool: null | { x: number; z: number; width: number; depth: number };
};

type Props = {
  projectName: string;
  canonicalPlan: unknown;
};

const FLOOR_HEIGHT = 3.2;
const EYE_HEIGHT = 1.62;
const WALL_HEIGHT = 3.0;
const WALL_THICKNESS = 0.16;
const PLAYER_RADIUS = 0.28;
const TARGET_MODEL_SPAN = 24;
const ENTER_BUTTON_ID = "heyy-walkthrough-enter";

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isOutdoorZone(zone: string) {
  return /outdoor|garden|terrace|patio|pool|balcony|veranda|yard|landscape/i.test(zone);
}

function normalizedOpeningPosition(value: unknown) {
  const position = numberValue(value, 0.5);
  if (position >= 0 && position <= 1) return position;
  if (position >= 0 && position <= 100) return position / 100;
  return 0.5;
}

function quantize(value: number, step = 0.05) {
  return Math.round(value / step) * step;
}

function wallKey(
  levelIndex: number,
  orientation: "horizontal" | "vertical",
  axis: number,
) {
  return `${levelIndex}:${orientation}:${quantize(axis).toFixed(2)}`;
}

function rangeOverlap(a1: number, a2: number, b1: number, b2: number) {
  const start = Math.max(Math.min(a1, a2), Math.min(b1, b2));
  const end = Math.min(Math.max(a1, a2), Math.max(b1, b2));
  return { start, end, length: Math.max(0, end - start) };
}

function roomColor(zone: string) {
  if (/bath|powder|toilet|wc|utility|laundry/i.test(zone)) return "#d9d7d1";
  if (/kitchen|service/i.test(zone)) return "#d8cfbf";
  if (/private|bed|suite|study|office/i.test(zone)) return "#c8ad89";
  if (/garage|parking/i.test(zone)) return "#c9ced2";
  if (isOutdoorZone(zone)) return "#abc69f";
  return "#c99f72";
}

function openingPriority(type: OpeningWorld["type"]) {
  if (type === "sliding_door") return 4;
  if (type === "door") return 3;
  if (type === "garage_door") return 2;
  return 1;
}

function mergeOpenings(openings: OpeningWorld[]) {
  const sorted = [...openings].sort((a, b) => a.start - b.start || openingPriority(b.type) - openingPriority(a.type));
  const merged: OpeningWorld[] = [];

  for (const opening of sorted) {
    const existing = merged.find(
      (candidate) =>
        candidate.levelIndex === opening.levelIndex &&
        candidate.orientation === opening.orientation &&
        Math.abs(candidate.axis - opening.axis) < 0.08 &&
        Math.max(candidate.start, opening.start) < Math.min(candidate.end, opening.end),
    );

    if (!existing) {
      merged.push({ ...opening });
      continue;
    }

    existing.start = Math.min(existing.start, opening.start);
    existing.end = Math.max(existing.end, opening.end);
    if (openingPriority(opening.type) > openingPriority(existing.type)) {
      existing.type = opening.type;
    }
    existing.connectsTo ||= opening.connectsTo;
  }

  return merged;
}

function buildWalkthroughModel(input: unknown): WalkthroughModel | null {
  const plan = (input && typeof input === "object" ? input : {}) as CanonicalPlan;
  const canonicalLevels = Array.isArray(plan.levels) ? plan.levels : [];
  const roomEntries = canonicalLevels.flatMap((level, levelIndex) =>
    (Array.isArray(level.rooms) ? level.rooms : []).map((room, roomIndex) => ({
      room,
      level,
      levelIndex,
      roomIndex,
    })),
  );

  if (!roomEntries.length) return null;

  const rawMinX = Math.min(...roomEntries.map(({ room }) => numberValue(room.x)));
  const rawMinZ = Math.min(...roomEntries.map(({ room }) => numberValue(room.y)));
  const rawMaxX = Math.max(...roomEntries.map(({ room }) => numberValue(room.x) + Math.max(1, numberValue(room.width, 8))));
  const rawMaxZ = Math.max(...roomEntries.map(({ room }) => numberValue(room.y) + Math.max(1, numberValue(room.height, 8))));
  const rawSpanX = Math.max(1, rawMaxX - rawMinX);
  const rawSpanZ = Math.max(1, rawMaxZ - rawMinZ);
  const scale = TARGET_MODEL_SPAN / Math.max(rawSpanX, rawSpanZ);
  const worldSpanX = rawSpanX * scale;
  const worldSpanZ = rawSpanZ * scale;

  const tx = (value: unknown) => (numberValue(value) - rawMinX) * scale - worldSpanX / 2;
  const tz = (value: unknown) => (numberValue(value) - rawMinZ) * scale - worldSpanZ / 2;

  const rooms: RoomWorld[] = roomEntries.map(({ room, level, levelIndex, roomIndex }) => {
    const x1 = tx(room.x);
    const z1 = tz(room.y);
    const width = Math.max(1.4, numberValue(room.width, 8) * scale);
    const depth = Math.max(1.4, numberValue(room.height, 8) * scale);
    const zone = stringValue(room.zone, "public");
    return {
      id: stringValue(room.id, `room-${levelIndex + 1}-${roomIndex + 1}`),
      name: stringValue(room.name, `Room ${roomIndex + 1}`),
      zone,
      levelId: stringValue(level.id, `level-${levelIndex + 1}`),
      levelLabel: stringValue(level.label, levelIndex === 0 ? "Ground Floor" : `Level ${levelIndex + 1}`),
      levelIndex,
      x1,
      x2: x1 + width,
      z1,
      z2: z1 + depth,
      centerX: x1 + width / 2,
      centerZ: z1 + depth / 2,
      width,
      depth,
      indoor: !isOutdoorZone(zone),
    };
  });

  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const rawWalls = new Map<string, Array<{ start: number; end: number }>>();
  const openingGroups = new Map<string, OpeningWorld[]>();

  function addRawWall(
    levelIndex: number,
    orientation: "horizontal" | "vertical",
    axis: number,
    start: number,
    end: number,
  ) {
    const key = wallKey(levelIndex, orientation, axis);
    const rows = rawWalls.get(key) || [];
    rows.push({ start: Math.min(start, end), end: Math.max(start, end) });
    rawWalls.set(key, rows);
  }

  function addOpening(opening: OpeningWorld) {
    const key = wallKey(opening.levelIndex, opening.orientation, opening.axis);
    const rows = openingGroups.get(key) || [];
    rows.push({ ...opening, start: Math.min(opening.start, opening.end), end: Math.max(opening.start, opening.end) });
    openingGroups.set(key, rows);
  }

  for (const room of rooms.filter((candidate) => candidate.indoor)) {
    addRawWall(room.levelIndex, "horizontal", room.z1, room.x1, room.x2);
    addRawWall(room.levelIndex, "horizontal", room.z2, room.x1, room.x2);
    addRawWall(room.levelIndex, "vertical", room.x1, room.z1, room.z2);
    addRawWall(room.levelIndex, "vertical", room.x2, room.z1, room.z2);
  }

  canonicalLevels.forEach((level, levelIndex) => {
    const openings = Array.isArray(level.openings) ? level.openings : [];
    for (const opening of openings) {
      const room = roomById.get(stringValue(opening.room_id));
      if (!room || room.levelIndex !== levelIndex) continue;
      const wall = opening.wall || "south";
      const orientation = wall === "north" || wall === "south" ? "horizontal" : "vertical";
      const axis = wall === "north" ? room.z1 : wall === "south" ? room.z2 : wall === "west" ? room.x1 : room.x2;
      const wallStart = orientation === "horizontal" ? room.x1 : room.z1;
      const wallEnd = orientation === "horizontal" ? room.x2 : room.z2;
      const wallLength = Math.max(0.8, wallEnd - wallStart);
      const width = Math.min(Math.max(numberValue(opening.width_m, 1), 0.75), wallLength * 0.75);
      const center = wallStart + normalizedOpeningPosition(opening.position) * wallLength;
      addOpening({
        id: stringValue(opening.id, `${room.id}-${wall}-${center}`),
        type: opening.type || "door",
        orientation,
        axis,
        start: Math.max(wallStart + 0.18, center - width / 2),
        end: Math.min(wallEnd - 0.18, center + width / 2),
        levelIndex,
        connectsTo: stringValue(opening.connects_to),
      });
    }
  });

  function addConnectionDoor(roomA: RoomWorld, roomB: RoomWorld, label: string) {
    if (roomA.levelIndex !== roomB.levelIndex) return;
    const tolerance = 0.22;

    if (Math.abs(roomA.x2 - roomB.x1) < tolerance || Math.abs(roomB.x2 - roomA.x1) < tolerance) {
      const axis = Math.abs(roomA.x2 - roomB.x1) < tolerance ? (roomA.x2 + roomB.x1) / 2 : (roomB.x2 + roomA.x1) / 2;
      const overlap = rangeOverlap(roomA.z1, roomA.z2, roomB.z1, roomB.z2);
      if (overlap.length > 1.1) {
        const center = (overlap.start + overlap.end) / 2;
        const width = Math.min(1.35, overlap.length * 0.7);
        addOpening({
          id: `circulation-${roomA.id}-${roomB.id}`,
          type: /wide|open|sliding/i.test(label) ? "sliding_door" : "door",
          orientation: "vertical",
          axis,
          start: center - width / 2,
          end: center + width / 2,
          levelIndex: roomA.levelIndex,
          connectsTo: roomB.id,
        });
      }
      return;
    }

    if (Math.abs(roomA.z2 - roomB.z1) < tolerance || Math.abs(roomB.z2 - roomA.z1) < tolerance) {
      const axis = Math.abs(roomA.z2 - roomB.z1) < tolerance ? (roomA.z2 + roomB.z1) / 2 : (roomB.z2 + roomA.z1) / 2;
      const overlap = rangeOverlap(roomA.x1, roomA.x2, roomB.x1, roomB.x2);
      if (overlap.length > 1.1) {
        const center = (overlap.start + overlap.end) / 2;
        const width = Math.min(1.35, overlap.length * 0.7);
        addOpening({
          id: `circulation-${roomA.id}-${roomB.id}`,
          type: /wide|open|sliding/i.test(label) ? "sliding_door" : "door",
          orientation: "horizontal",
          axis,
          start: center - width / 2,
          end: center + width / 2,
          levelIndex: roomA.levelIndex,
          connectsTo: roomB.id,
        });
      }
    }
  }

  canonicalLevels.forEach((level) => {
    for (const connection of Array.isArray(level.circulation) ? level.circulation : []) {
      const from = roomById.get(stringValue(connection.from_room_id));
      const to = roomById.get(stringValue(connection.to_room_id));
      if (from && to) addConnectionDoor(from, to, stringValue(connection.label));
    }
  });

  const groundRooms = rooms.filter((room) => room.levelIndex === 0 && room.indoor);
  const entryRoom = groundRooms.find((room) => /entry|foyer|lobby|arrival/i.test(room.name)) || groundRooms[0];
  if (entryRoom) {
    const rawEntryX = numberValue(plan.entry?.x, NaN);
    const rawEntryZ = numberValue(plan.entry?.y, NaN);
    const entryX = Number.isFinite(rawEntryX) ? tx(rawEntryX) : entryRoom.centerX;
    const entryZ = Number.isFinite(rawEntryZ) ? tz(rawEntryZ) : entryRoom.z2;
    const candidates = [
      { wall: "north", distance: Math.abs(entryZ - entryRoom.z1), axis: entryRoom.z1, orientation: "horizontal" as const, center: MathUtils.clamp(entryX, entryRoom.x1 + 0.7, entryRoom.x2 - 0.7) },
      { wall: "south", distance: Math.abs(entryZ - entryRoom.z2), axis: entryRoom.z2, orientation: "horizontal" as const, center: MathUtils.clamp(entryX, entryRoom.x1 + 0.7, entryRoom.x2 - 0.7) },
      { wall: "west", distance: Math.abs(entryX - entryRoom.x1), axis: entryRoom.x1, orientation: "vertical" as const, center: MathUtils.clamp(entryZ, entryRoom.z1 + 0.7, entryRoom.z2 - 0.7) },
      { wall: "east", distance: Math.abs(entryX - entryRoom.x2), axis: entryRoom.x2, orientation: "vertical" as const, center: MathUtils.clamp(entryZ, entryRoom.z1 + 0.7, entryRoom.z2 - 0.7) },
    ].sort((a, b) => a.distance - b.distance);
    const candidate = candidates[0];
    addOpening({
      id: "main-entry-door",
      type: "door",
      orientation: candidate.orientation,
      axis: candidate.axis,
      start: candidate.center - 0.62,
      end: candidate.center + 0.62,
      levelIndex: 0,
      connectsTo: "outside",
    });
  }

  const walls: SolidWall[] = [];
  const allOpenings: OpeningWorld[] = [];

  for (const [key, wallRanges] of rawWalls.entries()) {
    const groupOpenings = mergeOpenings(openingGroups.get(key) || []);
    allOpenings.push(...groupOpenings);
    const [levelText, orientationText, axisText] = key.split(":");
    const levelIndex = Number(levelText);
    const orientation = orientationText as "horizontal" | "vertical";
    const axis = Number(axisText);
    const boundaries = new Set<number>();
    wallRanges.forEach((range) => {
      boundaries.add(range.start);
      boundaries.add(range.end);
    });
    groupOpenings.forEach((opening) => {
      boundaries.add(opening.start);
      boundaries.add(opening.end);
    });
    const values = [...boundaries].sort((a, b) => a - b);

    for (let index = 0; index < values.length - 1; index += 1) {
      const start = values[index];
      const end = values[index + 1];
      if (end - start < 0.02) continue;
      const midpoint = (start + end) / 2;
      const covered = wallRanges.some((range) => midpoint >= range.start - 0.01 && midpoint <= range.end + 0.01);
      const open = groupOpenings.some((opening) => midpoint > opening.start + 0.01 && midpoint < opening.end - 0.01);
      if (covered && !open) {
        walls.push({ id: `${key}:${index}`, orientation, axis, start, end, levelIndex });
      }
    }
  }

  const stairs: StairWorld[] = [];
  canonicalLevels.forEach((level, levelIndex) => {
    const nextLevel = canonicalLevels.findIndex((candidate) => stringValue(candidate.id) === stringValue(level.stairs?.[0]?.connects_to_level_id));
    for (const [stairIndex, stair] of (Array.isArray(level.stairs) ? level.stairs : []).entries()) {
      const x1 = tx(stair.x);
      const z1 = tz(stair.y);
      const width = Math.max(1.1, numberValue(stair.width, 5) * scale);
      const depth = Math.max(1.8, numberValue(stair.height, 10) * scale);
      const targetLevelIndex = canonicalLevels.findIndex((candidate) => stringValue(candidate.id) === stringValue(stair.connects_to_level_id));
      stairs.push({
        id: stringValue(stair.id, `stair-${levelIndex}-${stairIndex}`),
        levelIndex,
        targetLevelIndex: targetLevelIndex >= 0 ? targetLevelIndex : nextLevel >= 0 ? nextLevel : Math.min(levelIndex + 1, canonicalLevels.length - 1),
        x1,
        x2: x1 + width,
        z1,
        z2: z1 + depth,
        along: depth >= width ? "z" : "x",
      });
    }
  });

  const fixtures: FixtureWorld[] = canonicalLevels.flatMap((level) =>
    (Array.isArray(level.fixtures) ? level.fixtures : []).map((fixture) => ({
      roomId: stringValue(fixture.room_id),
      type: stringValue(fixture.fixture_type, "fixture"),
      count: Math.max(1, Math.min(12, Math.round(numberValue(fixture.count, 1)))),
    })),
  ).filter((fixture) => roomById.has(fixture.roomId));

  const spawnRoom = entryRoom || rooms.find((room) => room.indoor) || rooms[0];
  const spawn: [number, number, number] = [
    spawnRoom.centerX,
    spawnRoom.levelIndex * FLOOR_HEIGHT + EYE_HEIGHT,
    spawnRoom.centerZ,
  ];

  const transformedPool = plan.pool?.present
    ? {
        x: tx(plan.pool.x),
        z: tz(plan.pool.y),
        width: Math.max(1.8, numberValue(plan.pool.width, 8) * scale),
        depth: Math.max(1.8, numberValue(plan.pool.height, 4) * scale),
      }
    : null;

  return {
    levels: canonicalLevels.map((level, index) => ({
      id: stringValue(level.id, `level-${index + 1}`),
      label: stringValue(level.label, index === 0 ? "Ground Floor" : `Level ${index + 1}`),
      index,
    })),
    rooms,
    walls,
    openings: allOpenings,
    stairs,
    fixtures,
    spawn,
    bounds: {
      minX: -worldSpanX / 2 - 2,
      maxX: worldSpanX / 2 + 2,
      minZ: -worldSpanZ / 2 - 2,
      maxZ: worldSpanZ / 2 + 2,
    },
    pool: transformedPool,
  };
}

function BoxMesh({
  position,
  size,
  color,
  opacity = 1,
  transparent = false,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  opacity?: number;
  transparent?: boolean;
}) {
  const material: MeshStandardMaterialParameters = {
    color,
    roughness: 0.82,
    metalness: 0.02,
    transparent,
    opacity,
  };
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial {...material} />
    </mesh>
  );
}

function CylinderMesh({
  position,
  radius,
  height,
  color,
}: {
  position: [number, number, number];
  radius: number;
  height: number;
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, height, 24]} />
      <meshStandardMaterial color={color} roughness={0.72} metalness={0.04} />
    </mesh>
  );
}

function LivingFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  const sofaWidth = Math.max(1.45, Math.min(3.15, room.width - 1.15));
  const sofaZ = room.z2 - Math.min(0.72, room.depth * 0.2);
  const tableWidth = Math.max(0.8, Math.min(1.35, room.width * 0.3));
  return (
    <group>
      <BoxMesh position={[room.centerX, floorY + 0.28, sofaZ]} size={[sofaWidth, 0.42, 0.72]} color="#c9b9a7" />
      <BoxMesh position={[room.centerX, floorY + 0.72, sofaZ + 0.28]} size={[sofaWidth, 0.72, 0.16]} color="#b9a48e" />
      <BoxMesh position={[room.centerX - sofaWidth / 2 + 0.12, floorY + 0.58, sofaZ]} size={[0.18, 0.62, 0.78]} color="#b9a48e" />
      <BoxMesh position={[room.centerX + sofaWidth / 2 - 0.12, floorY + 0.58, sofaZ]} size={[0.18, 0.62, 0.78]} color="#b9a48e" />
      <BoxMesh position={[room.centerX, floorY + 0.28, room.centerZ]} size={[tableWidth, 0.18, 0.72]} color="#8b6548" />
      <BoxMesh position={[room.centerX, floorY + 0.12, room.centerZ]} size={[0.12, 0.25, 0.12]} color="#3f4650" />
      {room.width > 3.4 && (
        <>
          <BoxMesh position={[room.x1 + 0.72, floorY + 0.34, room.centerZ - 0.2]} size={[0.72, 0.42, 0.72]} color="#d7cabc" />
          <BoxMesh position={[room.x1 + 0.72, floorY + 0.72, room.centerZ + 0.08]} size={[0.72, 0.62, 0.15]} color="#c3b3a0" />
        </>
      )}
    </group>
  );
}

function DiningFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  const tableWidth = Math.max(1.25, Math.min(2.45, room.width - 1.15));
  const tableDepth = Math.max(0.72, Math.min(1.05, room.depth * 0.32));
  const chairOffsetX = tableWidth / 2 + 0.33;
  const chairOffsetZ = tableDepth / 2 + 0.34;
  return (
    <group>
      <BoxMesh position={[room.centerX, floorY + 0.72, room.centerZ]} size={[tableWidth, 0.1, tableDepth]} color="#9a714f" />
      <BoxMesh position={[room.centerX - tableWidth * 0.34, floorY + 0.36, room.centerZ]} size={[0.12, 0.68, 0.12]} color="#4b4d53" />
      <BoxMesh position={[room.centerX + tableWidth * 0.34, floorY + 0.36, room.centerZ]} size={[0.12, 0.68, 0.12]} color="#4b4d53" />
      {[-1, 1].map((direction) => (
        <group key={`dining-x-${direction}`}>
          <BoxMesh position={[room.centerX + direction * chairOffsetX, floorY + 0.34, room.centerZ - tableDepth * 0.22]} size={[0.42, 0.42, 0.42]} color="#d1c1b1" />
          <BoxMesh position={[room.centerX + direction * chairOffsetX, floorY + 0.72, room.centerZ - tableDepth * 0.22 + direction * 0.02]} size={[0.42, 0.55, 0.12]} color="#bea991" />
          <BoxMesh position={[room.centerX + direction * chairOffsetX, floorY + 0.34, room.centerZ + tableDepth * 0.22]} size={[0.42, 0.42, 0.42]} color="#d1c1b1" />
          <BoxMesh position={[room.centerX + direction * chairOffsetX, floorY + 0.72, room.centerZ + tableDepth * 0.22 + direction * 0.02]} size={[0.42, 0.55, 0.12]} color="#bea991" />
        </group>
      ))}
      <BoxMesh position={[room.centerX - tableWidth * 0.25, floorY + 0.34, room.centerZ - chairOffsetZ]} size={[0.42, 0.42, 0.42]} color="#d1c1b1" />
      <BoxMesh position={[room.centerX + tableWidth * 0.25, floorY + 0.34, room.centerZ - chairOffsetZ]} size={[0.42, 0.42, 0.42]} color="#d1c1b1" />
      <BoxMesh position={[room.centerX - tableWidth * 0.25, floorY + 0.34, room.centerZ + chairOffsetZ]} size={[0.42, 0.42, 0.42]} color="#d1c1b1" />
      <BoxMesh position={[room.centerX + tableWidth * 0.25, floorY + 0.34, room.centerZ + chairOffsetZ]} size={[0.42, 0.42, 0.42]} color="#d1c1b1" />
    </group>
  );
}

function KitchenFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  const cabinetLength = Math.max(1.4, room.width - 0.7);
  const islandWidth = Math.max(1.2, Math.min(2.25, room.width * 0.48));
  return (
    <group>
      <BoxMesh position={[room.centerX, floorY + 0.45, room.z1 + 0.34]} size={[cabinetLength, 0.9, 0.58]} color="#9b7658" />
      <BoxMesh position={[room.centerX, floorY + 0.93, room.z1 + 0.34]} size={[cabinetLength, 0.08, 0.64]} color="#ded8cf" />
      <BoxMesh position={[room.centerX, floorY + 0.47, room.centerZ + 0.25]} size={[islandWidth, 0.92, 0.82]} color="#7e5c43" />
      <BoxMesh position={[room.centerX, floorY + 0.96, room.centerZ + 0.25]} size={[islandWidth + 0.12, 0.08, 0.92]} color="#ece8e1" />
      <BoxMesh position={[room.x2 - 0.38, floorY + 1.05, room.z1 + 0.38]} size={[0.62, 2.1, 0.66]} color="#b6bec7" />
    </group>
  );
}

function BedroomFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  const bedWidth = Math.max(1.25, Math.min(2.05, room.width - 1));
  const bedDepth = Math.max(1.65, Math.min(2.25, room.depth - 1.05));
  const bedZ = room.z1 + bedDepth / 2 + 0.34;
  return (
    <group>
      <BoxMesh position={[room.centerX, floorY + 0.28, bedZ]} size={[bedWidth, 0.36, bedDepth]} color="#8c6e58" />
      <BoxMesh position={[room.centerX, floorY + 0.52, bedZ]} size={[bedWidth - 0.08, 0.24, bedDepth - 0.08]} color="#e7e2dc" />
      <BoxMesh position={[room.centerX, floorY + 1.05, room.z1 + 0.28]} size={[bedWidth + 0.18, 1.12, 0.18]} color="#b6a38e" />
      <BoxMesh position={[room.centerX - bedWidth / 2 - 0.28, floorY + 0.31, room.z1 + 0.52]} size={[0.44, 0.62, 0.42]} color="#8a674c" />
      <BoxMesh position={[room.centerX + bedWidth / 2 + 0.28, floorY + 0.31, room.z1 + 0.52]} size={[0.44, 0.62, 0.42]} color="#8a674c" />
      <BoxMesh position={[room.x2 - 0.34, floorY + 1.05, room.centerZ]} size={[0.52, 2.1, Math.max(1.1, room.depth * 0.48)]} color="#d4cabf" />
    </group>
  );
}

function BathroomFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  return (
    <group>
      <BoxMesh position={[room.centerX, floorY + 0.44, room.z1 + 0.35]} size={[Math.max(0.9, room.width * 0.48), 0.82, 0.5]} color="#d7d9dc" />
      <BoxMesh position={[room.centerX, floorY + 1.35, room.z1 + 0.24]} size={[Math.max(0.8, room.width * 0.42), 0.75, 0.04]} color="#9ecde8" opacity={0.35} transparent />
      <CylinderMesh position={[room.x1 + 0.52, floorY + 0.27, room.z2 - 0.58]} radius={0.25} height={0.45} color="#f3f5f7" />
      <BoxMesh position={[room.x2 - 0.58, floorY + 0.06, room.z2 - 0.72]} size={[0.9, 0.12, 1.15]} color="#e9ecef" />
      <BoxMesh position={[room.x2 - 0.58, floorY + 1.0, room.z2 - 1.18]} size={[0.95, 1.95, 0.03]} color="#a7d9ef" opacity={0.25} transparent />
    </group>
  );
}

function OfficeFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  return (
    <group>
      <BoxMesh position={[room.centerX, floorY + 0.73, room.z1 + 0.72]} size={[Math.max(1.2, Math.min(2.2, room.width - 1)), 0.1, 0.68]} color="#88664c" />
      <BoxMesh position={[room.centerX - 0.62, floorY + 0.36, room.z1 + 0.72]} size={[0.1, 0.7, 0.1]} color="#3f4650" />
      <BoxMesh position={[room.centerX + 0.62, floorY + 0.36, room.z1 + 0.72]} size={[0.1, 0.7, 0.1]} color="#3f4650" />
      <BoxMesh position={[room.centerX, floorY + 0.36, room.z1 + 1.4]} size={[0.55, 0.48, 0.55]} color="#c6b6a4" />
      <BoxMesh position={[room.x2 - 0.3, floorY + 1.2, room.centerZ]} size={[0.42, 2.4, Math.max(1.4, room.depth * 0.7)]} color="#a17c5e" />
    </group>
  );
}

function UtilityFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  return (
    <group>
      <BoxMesh position={[room.x1 + 0.55, floorY + 0.55, room.z1 + 0.5]} size={[0.72, 1.1, 0.72]} color="#d9dde2" />
      <BoxMesh position={[room.x1 + 1.35, floorY + 0.55, room.z1 + 0.5]} size={[0.72, 1.1, 0.72]} color="#cfd5dc" />
      <CylinderMesh position={[room.x1 + 0.55, floorY + 0.58, room.z1 + 0.12]} radius={0.22} height={0.03} color="#6f7a86" />
      <CylinderMesh position={[room.x1 + 1.35, floorY + 0.58, room.z1 + 0.12]} radius={0.22} height={0.03} color="#6f7a86" />
      <BoxMesh position={[room.x2 - 0.34, floorY + 1.05, room.centerZ]} size={[0.55, 2.1, Math.max(1.2, room.depth * 0.72)]} color="#b8a38d" />
    </group>
  );
}

function GarageFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  const carLength = Math.max(2.4, Math.min(4.1, room.depth - 0.8));
  const carWidth = Math.max(1.15, Math.min(1.65, room.width * 0.38));
  const positions = room.width > 4.2
    ? [room.centerX - carWidth * 0.63, room.centerX + carWidth * 0.63]
    : [room.centerX];
  return (
    <group>
      {positions.map((x, index) => (
        <group key={`car-${room.id}-${index}`}>
          <BoxMesh position={[x, floorY + 0.42, room.centerZ]} size={[carWidth, 0.55, carLength]} color={index % 2 ? "#d8dadc" : "#737d88"} />
          <BoxMesh position={[x, floorY + 0.83, room.centerZ - 0.1]} size={[carWidth * 0.78, 0.45, carLength * 0.48]} color="#8eb8d4" opacity={0.45} transparent />
        </group>
      ))}
    </group>
  );
}

function EntryFurniture({ room }: { room: RoomWorld }) {
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  return (
    <group>
      <BoxMesh position={[room.x1 + 0.34, floorY + 0.48, room.centerZ]} size={[0.48, 0.96, Math.max(1, Math.min(1.8, room.depth * 0.5))]} color="#8b674b" />
      <BoxMesh position={[room.centerX, floorY + 0.28, room.z2 - 0.56]} size={[Math.max(0.9, Math.min(1.5, room.width * 0.45)), 0.45, 0.5]} color="#c7b39d" />
      <CylinderMesh position={[room.x2 - 0.42, floorY + 0.42, room.z1 + 0.48]} radius={0.28} height={0.62} color="#a08360" />
      <CylinderMesh position={[room.x2 - 0.42, floorY + 0.94, room.z1 + 0.48]} radius={0.42} height={0.58} color="#6d8f62" />
    </group>
  );
}

function RoomContents({ room, fixtureTypes }: { room: RoomWorld; fixtureTypes: string[] }) {
  if (!room.indoor) return null;
  const descriptor = `${room.name} ${room.zone} ${fixtureTypes.join(" ")}`.toLowerCase();
  const floorY = room.levelIndex * FLOOR_HEIGHT;
  const isLiving = /living|lounge|family|retreat|sitting|sofa|seating/.test(descriptor);
  const isDining = /dining|breakfast|table.*chair/.test(descriptor);
  const isKitchen = /kitchen|pantry|cook|cabinet|island/.test(descriptor);
  const isBedroom = /bed|bedroom|master|guest suite|nursery/.test(descriptor);
  const isBathroom = /bath|powder|toilet|wc|shower|vanity/.test(descriptor);
  const isOffice = /office|study|library|desk/.test(descriptor);
  const isUtility = /laundry|utility|service|washer|dryer/.test(descriptor);
  const isGarage = /garage|parking|car/.test(descriptor);
  const isEntry = /entry|foyer|lobby|arrival|entrance/.test(descriptor);

  return (
    <group>
      {isLiving && <LivingFurniture room={room} />}
      {isDining && !isLiving && <DiningFurniture room={room} />}
      {isKitchen && <KitchenFurniture room={room} />}
      {isBedroom && <BedroomFurniture room={room} />}
      {isBathroom && <BathroomFurniture room={room} />}
      {isOffice && <OfficeFurniture room={room} />}
      {isUtility && <UtilityFurniture room={room} />}
      {isGarage && <GarageFurniture room={room} />}
      {isEntry && !isLiving && <EntryFurniture room={room} />}
      {!isLiving && !isDining && !isKitchen && !isBedroom && !isBathroom && !isOffice && !isUtility && !isGarage && !isEntry && (
        <BoxMesh position={[room.centerX, floorY + 0.25, room.centerZ]} size={[Math.max(0.9, Math.min(1.5, room.width * 0.4)), 0.42, 0.55]} color="#c6b7a6" />
      )}
      <pointLight position={[room.centerX, floorY + 2.45, room.centerZ]} intensity={0.85} distance={7} color="#fff1d7" />
      <CylinderMesh position={[room.centerX, floorY + 2.78, room.centerZ]} radius={0.12} height={0.06} color="#fff4d5" />
    </group>
  );
}

function WallMesh({ wall }: { wall: SolidWall }) {
  const length = Math.max(0.02, wall.end - wall.start);
  const floorY = wall.levelIndex * FLOOR_HEIGHT;
  const position: [number, number, number] = wall.orientation === "horizontal"
    ? [(wall.start + wall.end) / 2, floorY + WALL_HEIGHT / 2, wall.axis]
    : [wall.axis, floorY + WALL_HEIGHT / 2, (wall.start + wall.end) / 2];
  const size: [number, number, number] = wall.orientation === "horizontal"
    ? [length, WALL_HEIGHT, WALL_THICKNESS]
    : [WALL_THICKNESS, WALL_HEIGHT, length];
  return <BoxMesh position={position} size={size} color="#eef2f7" />;
}

function OpeningMesh({ opening }: { opening: OpeningWorld }) {
  const length = Math.max(0.15, opening.end - opening.start);
  const floorY = opening.levelIndex * FLOOR_HEIGHT;
  const center = (opening.start + opening.end) / 2;
  const isHorizontal = opening.orientation === "horizontal";
  const frameThickness = 0.075;
  const depth = WALL_THICKNESS + 0.035;

  const makePosition = (along: number, y: number): [number, number, number] =>
    isHorizontal ? [along, y, opening.axis] : [opening.axis, y, along];
  const makeSize = (along: number, height: number, thickness = depth): [number, number, number] =>
    isHorizontal ? [along, height, thickness] : [thickness, height, along];

  if (opening.type === "window") {
    const sillHeight = 0.88;
    const windowHeight = 1.32;
    const headHeight = sillHeight + windowHeight;
    const upperHeight = Math.max(0.12, WALL_HEIGHT - headHeight);
    return (
      <group>
        <BoxMesh position={makePosition(center, floorY + sillHeight / 2)} size={makeSize(length, sillHeight)} color="#eef2f7" />
        <BoxMesh position={makePosition(center, floorY + headHeight + upperHeight / 2)} size={makeSize(length, upperHeight)} color="#eef2f7" />
        <BoxMesh position={makePosition(center, floorY + sillHeight + windowHeight / 2)} size={makeSize(Math.max(0.1, length - 0.08), windowHeight, 0.035)} color="#8fd3ff" opacity={0.34} transparent />
        <BoxMesh position={makePosition(opening.start + frameThickness / 2, floorY + sillHeight + windowHeight / 2)} size={makeSize(frameThickness, windowHeight)} color="#425466" />
        <BoxMesh position={makePosition(opening.end - frameThickness / 2, floorY + sillHeight + windowHeight / 2)} size={makeSize(frameThickness, windowHeight)} color="#425466" />
      </group>
    );
  }

  if (opening.type === "garage_door") {
    return (
      <group>
        <BoxMesh position={makePosition(center, floorY + 1.28)} size={makeSize(length, 2.56)} color="#dfe6ee" />
        <BoxMesh position={makePosition(center, floorY + 2.82)} size={makeSize(length, 0.36)} color="#eef2f7" />
      </group>
    );
  }

  const doorHeight = opening.type === "sliding_door" ? 2.45 : 2.18;
  const headerHeight = Math.max(0.12, WALL_HEIGHT - doorHeight);
  return (
    <group>
      <BoxMesh position={makePosition(center, floorY + doorHeight + headerHeight / 2)} size={makeSize(length, headerHeight)} color="#eef2f7" />
      <BoxMesh position={makePosition(opening.start + frameThickness / 2, floorY + doorHeight / 2)} size={makeSize(frameThickness, doorHeight)} color="#425466" />
      <BoxMesh position={makePosition(opening.end - frameThickness / 2, floorY + doorHeight / 2)} size={makeSize(frameThickness, doorHeight)} color="#425466" />
      {opening.type === "sliding_door" && (
        <BoxMesh position={makePosition(center, floorY + doorHeight / 2)} size={makeSize(Math.max(0.1, length - 0.15), doorHeight - 0.08, 0.025)} color="#9ddcff" opacity={0.2} transparent />
      )}
    </group>
  );
}

type HorizontalRect = { x1: number; x2: number; z1: number; z2: number };

function subtractHorizontalRect(rect: HorizontalRect, hole: HorizontalRect) {
  const overlapX1 = Math.max(rect.x1, hole.x1);
  const overlapX2 = Math.min(rect.x2, hole.x2);
  const overlapZ1 = Math.max(rect.z1, hole.z1);
  const overlapZ2 = Math.min(rect.z2, hole.z2);
  if (overlapX2 <= overlapX1 || overlapZ2 <= overlapZ1) return [rect];

  const pieces: HorizontalRect[] = [];
  if (overlapX1 > rect.x1) pieces.push({ x1: rect.x1, x2: overlapX1, z1: rect.z1, z2: rect.z2 });
  if (overlapX2 < rect.x2) pieces.push({ x1: overlapX2, x2: rect.x2, z1: rect.z1, z2: rect.z2 });
  if (overlapZ1 > rect.z1) pieces.push({ x1: overlapX1, x2: overlapX2, z1: rect.z1, z2: overlapZ1 });
  if (overlapZ2 < rect.z2) pieces.push({ x1: overlapX1, x2: overlapX2, z1: overlapZ2, z2: rect.z2 });
  return pieces.filter((piece) => piece.x2 - piece.x1 > 0.05 && piece.z2 - piece.z1 > 0.05);
}

function roomHorizontalSegments(room: RoomWorld, holes: HorizontalRect[]) {
  let segments: HorizontalRect[] = [{ x1: room.x1, x2: room.x2, z1: room.z1, z2: room.z2 }];
  for (const hole of holes) segments = segments.flatMap((segment) => subtractHorizontalRect(segment, hole));
  return segments;
}

function StairMesh({ stair }: { stair: StairWorld }) {
  const stepCount = 14;
  const floorY = stair.levelIndex * FLOOR_HEIGHT;
  const targetY = stair.targetLevelIndex * FLOOR_HEIGHT;
  const rise = Math.max(0.12, (targetY - floorY) / stepCount);
  const width = stair.x2 - stair.x1;
  const depth = stair.z2 - stair.z1;
  const going = stair.along === "z" ? depth / stepCount : width / stepCount;

  return (
    <group>
      {Array.from({ length: stepCount }).map((_, index) => {
        const stepHeight = rise * (index + 1);
        const x = stair.along === "x"
          ? stair.x1 + going * index + going / 2
          : (stair.x1 + stair.x2) / 2;
        const z = stair.along === "z"
          ? stair.z1 + going * index + going / 2
          : (stair.z1 + stair.z2) / 2;
        const size: [number, number, number] = stair.along === "z"
          ? [width, stepHeight, going]
          : [going, stepHeight, depth];
        return (
          <BoxMesh
            key={`${stair.id}-${index}`}
            position={[x, floorY + stepHeight / 2, z]}
            size={size}
            color={index % 2 ? "#dce4ee" : "#e8edf4"}
          />
        );
      })}
    </group>
  );
}

function WhiteModel({ model }: { model: WalkthroughModel }) {
  return (
    <group>
      {model.rooms.map((room) => {
        const floorY = room.levelIndex * FLOOR_HEIGHT;
        const incomingStairHoles = model.stairs
          .filter((stair) => stair.targetLevelIndex === room.levelIndex)
          .map((stair) => ({ x1: stair.x1 - 0.08, x2: stair.x2 + 0.08, z1: stair.z1 - 0.08, z2: stair.z2 + 0.08 }));
        const outgoingStairHoles = model.stairs
          .filter((stair) => stair.levelIndex === room.levelIndex)
          .map((stair) => ({ x1: stair.x1 - 0.08, x2: stair.x2 + 0.08, z1: stair.z1 - 0.08, z2: stair.z2 + 0.08 }));
        const floorSegments = roomHorizontalSegments(room, incomingStairHoles);
        const ceilingSegments = room.indoor ? roomHorizontalSegments(room, outgoingStairHoles) : [];
        return (
          <group key={room.id}>
            {floorSegments.map((segment, index) => (
              <BoxMesh
                key={`${room.id}-floor-${index}`}
                position={[(segment.x1 + segment.x2) / 2, floorY - 0.055, (segment.z1 + segment.z2) / 2]}
                size={[segment.x2 - segment.x1, 0.11, segment.z2 - segment.z1]}
                color={roomColor(room.zone)}
              />
            ))}
            {ceilingSegments.map((segment, index) => (
              <BoxMesh
                key={`${room.id}-ceiling-${index}`}
                position={[(segment.x1 + segment.x2) / 2, floorY + WALL_HEIGHT, (segment.z1 + segment.z2) / 2]}
                size={[segment.x2 - segment.x1, 0.08, segment.z2 - segment.z1]}
                color="#f6f8fb"
              />
            ))}
            <RoomContents
              room={room}
              fixtureTypes={model.fixtures.filter((fixture) => fixture.roomId === room.id).map((fixture) => fixture.type)}
            />
          </group>
        );
      })}

      {model.walls.map((wall) => <WallMesh key={wall.id} wall={wall} />)}
      {model.openings.map((opening) => <OpeningMesh key={opening.id} opening={opening} />)}
      {model.stairs.map((stair) => <StairMesh key={stair.id} stair={stair} />)}

      {model.pool && (
        <group>
          <BoxMesh
            position={[model.pool.x + model.pool.width / 2, -0.18, model.pool.z + model.pool.depth / 2]}
            size={[model.pool.width + 0.22, 0.28, model.pool.depth + 0.22]}
            color="#d9e0e8"
          />
          <BoxMesh
            position={[model.pool.x + model.pool.width / 2, -0.01, model.pool.z + model.pool.depth / 2]}
            size={[model.pool.width, 0.08, model.pool.depth]}
            color="#4cc3ef"
            opacity={0.68}
            transparent
          />
        </group>
      )}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#dfe6dd" roughness={1} />
      </mesh>
    </group>
  );
}

function distanceToWall(
  x: number,
  z: number,
  wall: Pick<SolidWall, "orientation" | "axis" | "start" | "end">,
) {
  if (wall.orientation === "horizontal") {
    const clampedX = MathUtils.clamp(x, wall.start, wall.end);
    return Math.hypot(x - clampedX, z - wall.axis);
  }
  const clampedZ = MathUtils.clamp(z, wall.start, wall.end);
  return Math.hypot(x - wall.axis, z - clampedZ);
}

function roomAt(model: WalkthroughModel, x: number, z: number, levelIndex: number) {
  return model.rooms.find(
    (room) =>
      room.levelIndex === levelIndex &&
      x >= room.x1 - 0.2 && x <= room.x2 + 0.2 &&
      z >= room.z1 - 0.2 && z <= room.z2 + 0.2,
  ) || null;
}

function stairAt(model: WalkthroughModel, x: number, z: number) {
  return model.stairs.find(
    (stair) => x >= stair.x1 - 0.15 && x <= stair.x2 + 0.15 && z >= stair.z1 - 0.15 && z <= stair.z2 + 0.15,
  ) || null;
}

function stairEyeY(stair: StairWorld, x: number, z: number) {
  const progress = stair.along === "z"
    ? MathUtils.clamp((z - stair.z1) / Math.max(0.01, stair.z2 - stair.z1), 0, 1)
    : MathUtils.clamp((x - stair.x1) / Math.max(0.01, stair.x2 - stair.x1), 0, 1);
  const startY = stair.levelIndex * FLOOR_HEIGHT;
  const endY = stair.targetLevelIndex * FLOOR_HEIGHT;
  return MathUtils.lerp(startY, endY, progress) + EYE_HEIGHT;
}

function nearestLevelIndex(model: WalkthroughModel, eyeY: number) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  model.levels.forEach((level) => {
    const distance = Math.abs(level.index * FLOOR_HEIGHT + EYE_HEIGHT - eyeY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = level.index;
    }
  });
  return bestIndex;
}

function collisionWalls(model: WalkthroughModel, levelIndex: number) {
  const blockingOpenings: SolidWall[] = model.openings
    .filter((opening) => opening.levelIndex === levelIndex && (opening.type === "window" || opening.type === "garage_door"))
    .map((opening) => ({
      id: `blocking-${opening.id}`,
      orientation: opening.orientation,
      axis: opening.axis,
      start: opening.start,
      end: opening.end,
      levelIndex,
    }));
  return [...model.walls.filter((wall) => wall.levelIndex === levelIndex), ...blockingOpenings];
}

function isNavigable(model: WalkthroughModel, x: number, z: number, levelIndex: number) {
  if (stairAt(model, x, z)) return true;
  if (roomAt(model, x, z, levelIndex)) return true;
  return (
    x >= model.bounds.minX && x <= model.bounds.maxX &&
    z >= model.bounds.minZ && z <= model.bounds.maxZ &&
    levelIndex === 0
  );
}

function FirstPersonController({
  model,
  resetToken,
  selectedLevel,
  onLockChange,
  onRoomChange,
  onPlayerChange,
}: {
  model: WalkthroughModel;
  resetToken: number;
  selectedLevel: number;
  onLockChange: (locked: boolean) => void;
  onRoomChange: (room: RoomWorld | null) => void;
  onPlayerChange: (player: PlayerState) => void;
}) {
  const { camera } = useThree();
  const keyState = useRef<Record<string, boolean>>({});
  const velocity = useRef(new Vector3());
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const movement = useMemo(() => new Vector3(), []);
  const lastRoomId = useRef<string | null>(null);
  const lockedRef = useRef(false);
  const publishElapsed = useRef(0);

  const levelSpawn = useCallback((levelIndex: number): [number, number, number] => {
    const room = model.rooms.find((candidate) => candidate.levelIndex === levelIndex && candidate.indoor)
      || model.rooms.find((candidate) => candidate.levelIndex === levelIndex)
      || model.rooms[0];
    return [room.centerX, levelIndex * FLOOR_HEIGHT + EYE_HEIGHT, room.centerZ];
  }, [model]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keyState.current[event.code] = true;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => {
      keyState.current[event.code] = false;
    };
    window.addEventListener("keydown", down, { passive: false });
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const spawn = selectedLevel === 0 ? model.spawn : levelSpawn(selectedLevel);
    camera.position.set(...spawn);
    camera.rotation.set(0, 0, 0);
    velocity.current.set(0, 0, 0);
    onPlayerChange({ x: spawn[0], z: spawn[2], heading: 0, levelIndex: selectedLevel });
  }, [camera, levelSpawn, model, onPlayerChange, resetToken, selectedLevel]);

  useFrame((_, delta) => {
    if (!lockedRef.current) {
      velocity.current.multiplyScalar(Math.max(0, 1 - delta * 12));
      return;
    }
    const keys = keyState.current;
    const accelerating = keys.KeyW || keys.ArrowUp || keys.KeyS || keys.ArrowDown || keys.KeyA || keys.ArrowLeft || keys.KeyD || keys.ArrowRight;
    const speed = keys.ShiftLeft || keys.ShiftRight ? 5.8 : 3.15;
    const damping = Math.min(1, delta * 12);

    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();
    movement.set(0, 0, 0);

    if (keys.KeyW || keys.ArrowUp) movement.add(forward);
    if (keys.KeyS || keys.ArrowDown) movement.sub(forward);
    if (keys.KeyD || keys.ArrowRight) movement.add(right);
    if (keys.KeyA || keys.ArrowLeft) movement.sub(right);
    if (movement.lengthSq() > 0) movement.normalize().multiplyScalar(speed);

    velocity.current.lerp(movement, accelerating ? Math.min(1, delta * 16) : damping);
    if (!accelerating) velocity.current.multiplyScalar(Math.max(0, 1 - delta * 8));

    const currentLevel = nearestLevelIndex(model, camera.position.y);
    const stepX = velocity.current.x * delta;
    const stepZ = velocity.current.z * delta;
    const walls = collisionWalls(model, currentLevel);

    const tryMove = (candidateX: number, candidateZ: number) => {
      const stair = stairAt(model, candidateX, candidateZ);
      const candidateLevel = stair ? nearestLevelIndex(model, stairEyeY(stair, candidateX, candidateZ)) : currentLevel;
      if (!isNavigable(model, candidateX, candidateZ, candidateLevel)) return false;
      const blocked = walls.some((wall) => distanceToWall(candidateX, candidateZ, wall) < PLAYER_RADIUS + WALL_THICKNESS / 2);
      return !blocked;
    };

    const nextX = camera.position.x + stepX;
    if (tryMove(nextX, camera.position.z)) camera.position.x = nextX;
    const nextZ = camera.position.z + stepZ;
    if (tryMove(camera.position.x, nextZ)) camera.position.z = nextZ;

    camera.position.x = MathUtils.clamp(camera.position.x, model.bounds.minX, model.bounds.maxX);
    camera.position.z = MathUtils.clamp(camera.position.z, model.bounds.minZ, model.bounds.maxZ);

    const activeStair = stairAt(model, camera.position.x, camera.position.z);
    const resolvedLevel = nearestLevelIndex(model, camera.position.y);
    const targetEyeY = activeStair
      ? stairEyeY(activeStair, camera.position.x, camera.position.z)
      : resolvedLevel * FLOOR_HEIGHT + EYE_HEIGHT;
    camera.position.y = MathUtils.lerp(camera.position.y, targetEyeY, Math.min(1, delta * 10));

    const roomLevel = nearestLevelIndex(model, camera.position.y);
    const activeRoom = roomAt(model, camera.position.x, camera.position.z, roomLevel);
    const roomId = activeRoom?.id || null;
    if (roomId !== lastRoomId.current) {
      lastRoomId.current = roomId;
      onRoomChange(activeRoom);
    }

    publishElapsed.current += delta;
    if (publishElapsed.current >= 0.08) {
      publishElapsed.current = 0;
      const heading = Math.atan2(forward.x, -forward.z);
      onPlayerChange({
        x: camera.position.x,
        z: camera.position.z,
        heading,
        levelIndex: roomLevel,
      });
    }
  });

  return (
    <PointerLockControls
      selector={`#${ENTER_BUTTON_ID}`}
      onLock={() => {
        lockedRef.current = true;
        onLockChange(true);
      }}
      onUnlock={() => {
        lockedRef.current = false;
        onLockChange(false);
      }}
    />
  );
}

function WalkthroughScene({
  model,
  resetToken,
  selectedLevel,
  onLockChange,
  onRoomChange,
  onPlayerChange,
}: {
  model: WalkthroughModel;
  resetToken: number;
  selectedLevel: number;
  onLockChange: (locked: boolean) => void;
  onRoomChange: (room: RoomWorld | null) => void;
  onPlayerChange: (player: PlayerState) => void;
}) {
  return (
    <>
      <color attach="background" args={["#dce7f3"]} />
      <fog attach="fog" args={["#dce7f3", 30, 72]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#ffffff", "#8191a5", 1.15]} />
      <directionalLight
        castShadow
        intensity={2.2}
        position={[12, 24, 10]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <WhiteModel model={model} />
      <FirstPersonController
        model={model}
        resetToken={resetToken}
        selectedLevel={selectedLevel}
        onLockChange={onLockChange}
        onRoomChange={onRoomChange}
        onPlayerChange={onPlayerChange}
      />
    </>
  );
}

function WalkthroughMiniMap({ model, player, room }: { model: WalkthroughModel; player: PlayerState; room: RoomWorld | null }) {
  const width = 250;
  const height = 184;
  const padding = 14;
  const floorRooms = model.rooms.filter((candidate) => candidate.levelIndex === player.levelIndex);
  const floorWalls = model.walls.filter((wall) => wall.levelIndex === player.levelIndex);
  const minX = floorRooms.length ? Math.min(...floorRooms.map((candidate) => candidate.x1)) : model.bounds.minX;
  const maxX = floorRooms.length ? Math.max(...floorRooms.map((candidate) => candidate.x2)) : model.bounds.maxX;
  const minZ = floorRooms.length ? Math.min(...floorRooms.map((candidate) => candidate.z1)) : model.bounds.minZ;
  const maxZ = floorRooms.length ? Math.max(...floorRooms.map((candidate) => candidate.z2)) : model.bounds.maxZ;
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanZ);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanZ * scale) / 2;
  const mx = (x: number) => offsetX + (x - minX) * scale;
  const my = (z: number) => offsetY + (z - minZ) * scale;
  const playerX = mx(player.x);
  const playerY = my(player.z);
  const directionLength = 15;
  const directionX = playerX + Math.sin(player.heading) * directionLength;
  const directionY = playerY - Math.cos(player.heading) * directionLength;
  const levelLabel = model.levels.find((level) => level.index === player.levelIndex)?.label || `Level ${player.levelIndex + 1}`;

  return (
    <div className="walkthrough-minimap" aria-label="Walkthrough navigation map">
      <div className="walkthrough-minimap-header">
        <div><MapIcon size={14} /><span>{levelLabel}</span></div>
        <strong>{room?.name || "Circulation"}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${levelLabel} current position`}>
        <rect x="0" y="0" width={width} height={height} rx="14" fill="rgba(6,16,30,.84)" />
        {floorRooms.map((candidate) => (
          <g key={`map-room-${candidate.id}`}>
            <rect
              x={mx(candidate.x1)}
              y={my(candidate.z1)}
              width={Math.max(1, candidate.width * scale)}
              height={Math.max(1, candidate.depth * scale)}
              rx="2"
              fill={candidate.id === room?.id ? "rgba(65,145,255,.34)" : candidate.indoor ? "rgba(255,255,255,.12)" : "rgba(110,190,120,.18)"}
              stroke={candidate.id === room?.id ? "#6eb0ff" : "rgba(255,255,255,.18)"}
              strokeWidth={candidate.id === room?.id ? 1.5 : 0.7}
            />
            {candidate.width * scale > 42 && candidate.depth * scale > 24 && (
              <text
                x={mx(candidate.centerX)}
                y={my(candidate.centerZ)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,.7)"
                fontSize="6.5"
                fontWeight="700"
              >
                {candidate.name.length > 18 ? `${candidate.name.slice(0, 16)}…` : candidate.name}
              </text>
            )}
          </g>
        ))}
        {floorWalls.map((wall) => (
          <line
            key={`map-wall-${wall.id}`}
            x1={wall.orientation === "horizontal" ? mx(wall.start) : mx(wall.axis)}
            y1={wall.orientation === "horizontal" ? my(wall.axis) : my(wall.start)}
            x2={wall.orientation === "horizontal" ? mx(wall.end) : mx(wall.axis)}
            y2={wall.orientation === "horizontal" ? my(wall.axis) : my(wall.end)}
            stroke="rgba(255,255,255,.65)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        ))}
        <line x1={playerX} y1={playerY} x2={directionX} y2={directionY} stroke="#77b7ff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={playerX} cy={playerY} r="5.2" fill="#2e7cf6" stroke="#fff" strokeWidth="2" />
        <circle cx={playerX} cy={playerY} r="9" fill="none" stroke="rgba(74,151,255,.4)" strokeWidth="1.5" />
      </svg>
      <small>Live position · floor and room update as you move</small>
    </div>
  );
}

export default function ArchitectureWalkthrough3D({ projectName, canonicalPlan }: Props) {
  const model = useMemo(() => buildWalkthroughModel(canonicalPlan), [canonicalPlan]);
  const [locked, setLocked] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [room, setRoom] = useState<RoomWorld | null>(null);
  const [player, setPlayer] = useState<PlayerState>({
    x: model?.spawn[0] || 0,
    z: model?.spawn[2] || 0,
    heading: 0,
    levelIndex: 0,
  });
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const listener = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", listener);
    return () => document.removeEventListener("fullscreenchange", listener);
  }, []);

  useEffect(() => {
    if (!model) return;
    setPlayer({ x: model.spawn[0], z: model.spawn[2], heading: 0, levelIndex: 0 });
  }, [model]);

  if (!model) {
    return (
      <div className="walkthrough-unavailable">
        <Box size={25} />
        <strong>3D model data is not ready</strong>
        <span>Regenerate the connected concept plans so the walkthrough can read rooms, walls, openings and levels.</span>
      </div>
    );
  }

  async function toggleFullscreen() {
    if (!shellRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await shellRef.current.requestFullscreen();
  }

  return (
    <div className="walkthrough-shell" ref={shellRef} data-fullscreen={fullscreen ? "true" : "false"}>
      <div className="walkthrough-canvas-wrap">
        <Canvas
          shadows
          dpr={[1, 1.65]}
          camera={{ position: model.spawn, fov: 72, near: 0.05, far: 160 }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <WalkthroughScene
            model={model}
            resetToken={resetToken}
            selectedLevel={selectedLevel}
            onLockChange={setLocked}
            onRoomChange={setRoom}
            onPlayerChange={setPlayer}
          />
        </Canvas>

        <div className="walkthrough-crosshair" aria-hidden="true"><span /><span /></div>

        <div className="walkthrough-enter-card" data-visible={locked ? "false" : "true"}>
          <div className="walkthrough-enter-icon"><Footprints size={26} /></div>
          <p>Real-time furnished concept model</p>
          <h3>Walk through {projectName}</h3>
          <span>Move forward and backward, pass through door openings, change floors and use the stair where the connected plan includes one.</span>
          <button id={ENTER_BUTTON_ID} type="button" className="walkthrough-enter-button">
            <MousePointer2 size={16} /> Enter Walkthrough
          </button>
          <small>Mouse to look · W A S D to move · Shift to move faster · Esc to release the cursor</small>
        </div>

        <div className="walkthrough-status-bar">
          <div>
            <span>{room?.levelLabel || model.levels[selectedLevel]?.label || "Connected model"}</span>
            <strong>{room?.name || "Circulation / exterior"}</strong>
          </div>
          <div className="walkthrough-status-actions">
            <button type="button" onClick={() => setResetToken((value) => value + 1)} title="Reset position">
              <RotateCcw size={15} />
            </button>
            <button type="button" onClick={toggleFullscreen} title="Full screen">
              <Maximize2 size={15} />
            </button>
          </div>
        </div>

        <WalkthroughMiniMap model={model} player={player} room={room} />

        <div className="walkthrough-floor-switcher" aria-label="Walkthrough floors">
          {model.levels.map((level) => (
            <button
              key={level.id}
              type="button"
              data-active={level.index === selectedLevel}
              onClick={() => {
                setSelectedLevel(level.index);
                setResetToken((value) => value + 1);
              }}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="walkthrough-footnote">
        <DoorOpen size={17} />
        <div>
          <strong>Walkable furnished concept model</strong>
          <span>Rooms, openings, stairs, conceptual furniture and the live minimap come from the connected plan data. Furniture and finishes are indicative and remain subject to professional coordination.</span>
        </div>
      </div>

      <style jsx>{`
        .walkthrough-shell {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 26px;
          background: var(--surface);
          box-shadow: var(--shadow-soft);
        }
        .walkthrough-shell[data-fullscreen="true"] {
          width: 100vw;
          height: 100vh;
          border: 0;
          border-radius: 0;
          background: #07101d;
        }
        .walkthrough-canvas-wrap {
          position: relative;
          height: min(72vh, 760px);
          min-height: 560px;
          overflow: hidden;
          background: #dce7f3;
        }
        .walkthrough-shell[data-fullscreen="true"] .walkthrough-canvas-wrap {
          height: calc(100vh - 76px);
          min-height: 0;
        }
        .walkthrough-canvas-wrap :global(canvas) {
          display: block;
          width: 100% !important;
          height: 100% !important;
          outline: none;
        }
        .walkthrough-crosshair {
          pointer-events: none;
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 18px;
          transform: translate(-50%, -50%);
          opacity: ${locked ? 0.72 : 0};
          transition: opacity .2s ease;
        }
        .walkthrough-crosshair span {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 99px;
          background: rgba(9, 22, 41, .75);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, .62);
          transform: translate(-50%, -50%);
        }
        .walkthrough-crosshair span:first-child { width: 14px; height: 2px; }
        .walkthrough-crosshair span:last-child { width: 2px; height: 14px; }
        .walkthrough-enter-card {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(430px, calc(100% - 40px));
          padding: 28px;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255, 255, 255, .58);
          border-radius: 25px;
          background: rgba(7, 18, 34, .83);
          color: #fff;
          text-align: center;
          backdrop-filter: blur(18px);
          box-shadow: 0 25px 80px rgba(5, 13, 27, .3);
          z-index: 4;
          opacity: 1;
          pointer-events: auto;
          transition: opacity .2s ease, visibility .2s ease;
        }
        .walkthrough-enter-card[data-visible="false"] {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .walkthrough-enter-icon {
          display: grid;
          place-items: center;
          width: 58px;
          height: 58px;
          margin: 0 auto 16px;
          border-radius: 18px;
          background: linear-gradient(145deg, #2e7cf6, #705cff);
          box-shadow: 0 15px 34px rgba(46, 124, 246, .3);
        }
        .walkthrough-enter-card p {
          margin: 0;
          color: #8fc3ff;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: .17em;
          text-transform: uppercase;
        }
        .walkthrough-enter-card h3 {
          margin: 8px 0 10px;
          font-size: clamp(24px, 3vw, 36px);
          line-height: 1;
          letter-spacing: -.045em;
        }
        .walkthrough-enter-card > span {
          display: block;
          color: rgba(255, 255, 255, .74);
          font-size: 13px;
          line-height: 1.6;
        }
        .walkthrough-enter-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          width: 100%;
          margin-top: 20px;
          padding: 14px 18px;
          border: 0;
          border-radius: 15px;
          background: #2e7cf6;
          color: #fff;
          font: inherit;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 12px 30px rgba(46, 124, 246, .28);
        }
        .walkthrough-enter-button:hover { background: #176be3; transform: translateY(-1px); }
        .walkthrough-enter-card small {
          display: block;
          margin-top: 12px;
          color: rgba(255, 255, 255, .52);
          font-size: 10px;
          line-height: 1.5;
        }
        .walkthrough-status-bar {
          position: absolute;
          left: 18px;
          top: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          min-width: min(330px, calc(100% - 36px));
          padding: 12px 13px 12px 15px;
          border: 1px solid rgba(255, 255, 255, .55);
          border-radius: 16px;
          background: rgba(7, 18, 34, .78);
          color: #fff;
          backdrop-filter: blur(16px);
          z-index: 3;
        }
        .walkthrough-status-bar span {
          display: block;
          color: #83baff;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .walkthrough-status-bar strong {
          display: block;
          margin-top: 3px;
          font-size: 13px;
        }
        .walkthrough-status-actions { display: flex; gap: 7px; }
        .walkthrough-status-actions button {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 1px solid rgba(255, 255, 255, .22);
          border-radius: 10px;
          background: rgba(255, 255, 255, .1);
          color: #fff;
          cursor: pointer;
        }
        .walkthrough-status-actions button:hover { background: rgba(255, 255, 255, .18); }
        .walkthrough-minimap {
          position: absolute;
          left: 18px;
          bottom: 18px;
          width: 250px;
          padding: 10px;
          border: 1px solid rgba(255, 255, 255, .48);
          border-radius: 17px;
          background: rgba(7, 18, 34, .8);
          color: #fff;
          backdrop-filter: blur(16px);
          box-shadow: 0 16px 40px rgba(4, 12, 24, .24);
          z-index: 3;
          pointer-events: none;
        }
        .walkthrough-minimap-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 1px 3px 8px;
        }
        .walkthrough-minimap-header > div { display: flex; align-items: center; gap: 6px; }
        .walkthrough-minimap-header span {
          color: #8fc3ff;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .walkthrough-minimap-header strong {
          overflow: hidden;
          max-width: 120px;
          color: #fff;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .walkthrough-minimap svg { display: block; width: 100%; height: auto; border-radius: 13px; }
        .walkthrough-minimap small {
          display: block;
          padding: 7px 3px 1px;
          color: rgba(255, 255, 255, .52);
          font-size: 8px;
          line-height: 1.4;
        }
        .walkthrough-floor-switcher {
          position: absolute;
          right: 18px;
          top: 18px;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 7px;
          max-width: 45%;
          z-index: 3;
        }
        .walkthrough-floor-switcher button {
          padding: 9px 12px;
          border: 1px solid rgba(255, 255, 255, .52);
          border-radius: 999px;
          background: rgba(7, 18, 34, .74);
          color: rgba(255, 255, 255, .78);
          font: inherit;
          font-size: 10px;
          font-weight: 850;
          cursor: pointer;
          backdrop-filter: blur(14px);
        }
        .walkthrough-floor-switcher button[data-active="true"] {
          border-color: #74afff;
          background: #2e7cf6;
          color: #fff;
        }
        .walkthrough-footnote {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 16px 18px;
          border-top: 1px solid var(--border);
          color: var(--text-secondary);
        }
        .walkthrough-footnote :global(svg) { flex: 0 0 auto; margin-top: 2px; color: var(--blue); }
        .walkthrough-footnote strong { display: block; color: var(--text-primary); font-size: 12px; }
        .walkthrough-footnote span { display: block; margin-top: 3px; font-size: 11px; line-height: 1.55; }
        .walkthrough-unavailable {
          display: grid;
          place-items: center;
          min-height: 440px;
          padding: 40px;
          border: 1px dashed var(--border-strong);
          border-radius: 24px;
          background: var(--surface);
          color: var(--text-secondary);
          text-align: center;
        }
        .walkthrough-unavailable :global(svg) { color: var(--blue); }
        .walkthrough-unavailable strong { margin-top: 15px; color: var(--text-primary); font-size: 18px; }
        .walkthrough-unavailable span { max-width: 560px; margin-top: 7px; font-size: 12px; line-height: 1.6; }
        @media (max-width: 760px) {
          .walkthrough-canvas-wrap { min-height: 520px; height: 68vh; }
          .walkthrough-status-bar { min-width: 0; width: calc(100% - 36px); }
          .walkthrough-floor-switcher { top: auto; right: 18px; bottom: 18px; max-width: calc(100% - 36px); }
          .walkthrough-minimap { width: 190px; bottom: 70px; }
          .walkthrough-minimap-header strong { max-width: 82px; }
          .walkthrough-enter-card { padding: 22px; }
        }
      `}</style>
    </div>
  );
}
