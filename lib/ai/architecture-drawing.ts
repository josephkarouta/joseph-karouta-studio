import type {
  ArchitectureDna,
  CanonicalPlanLevel,
  CanonicalPlanRoom,
  CanonicalPlanSectionCut,
  CanonicalPlanSpec,
} from "@/lib/ai/architecture";

type Rect = { x: number; y: number; width: number; height: number };
type ScreenRoom = Rect & { room: CanonicalPlanRoom };
type Edge = "top" | "right" | "bottom" | "left";

type DrawingArgs = {
  plan: CanonicalPlanSpec;
  visualType: string;
  title: string;
  projectName: string;
  architectureDna?: ArchitectureDna | null;
};

const WIDTH = 1536;
const HEIGHT = 1024;
const INK = "#111111";
const MID = "#60656f";
const LIGHT = "#d8dde5";
const BLUE = "#2563eb";

const zoneFill: Record<string, string> = {
  public: "#e9f2ff",
  private: "#f2edff",
  service: "#eef1f4",
  outdoor: "#ecf9ef",
  circulation: "#f4f2ff",
  flexible: "#fff8e8",
  wellness: "#e8fbf8",
  entertainment: "#fff0f7",
};

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value: number, min = 0, max = 100) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
}

function zoneKey(zone: string) {
  const lower = String(zone || "").toLowerCase();
  return Object.keys(zoneFill).find((key) => lower.includes(key)) || "flexible";
}

function levelForType(plan: CanonicalPlanSpec, visualType: string) {
  const levels = Array.isArray(plan.levels) ? plan.levels : [];
  const value = String(visualType || "").toLowerCase();
  if (/^level_\d+$/.test(value)) {
    const requested = Number(value.replace("level_", ""));
    return levels[requested]
      || levels.find((level) => new RegExp(`level\s*${requested}`, "i").test(`${level.id} ${level.label}`))
      || levels[requested - 1]
      || levels[0];
  }
  if (value === "upper_floor") {
    return levels.find((level) => /upper|first|second|level\s*[12]/i.test(`${level.id} ${level.label}`))
      || levels[1]
      || levels[0];
  }
  return levels.find((level) => /ground|lower|level\s*0/i.test(`${level.id} ${level.label}`))
    || levels[0];
}

function fallbackOutline(plan: CanonicalPlanSpec) {
  const footprint = plan.footprint || { x: 20, y: 20, width: 60, height: 55 };
  return [
    { x: footprint.x, y: footprint.y },
    { x: footprint.x + footprint.width, y: footprint.y },
    { x: footprint.x + footprint.width, y: footprint.y + footprint.height },
    { x: footprint.x, y: footprint.y + footprint.height },
  ];
}

function masterOutline(plan: CanonicalPlanSpec) {
  return Array.isArray(plan.building_outline?.points) && plan.building_outline!.points.length >= 4
    ? plan.building_outline!.points
    : fallbackOutline(plan);
}

function levelOutline(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined) {
  return level && Array.isArray(level.outline) && level.outline.length >= 4
    ? level.outline
    : masterOutline(plan);
}

function pointBounds(points: Array<{ x: number; y: number }>) {
  const safe = points.length ? points : [{ x: 0, y: 0 }];
  return {
    minX: Math.min(...safe.map((point) => clamp(point.x))),
    minY: Math.min(...safe.map((point) => clamp(point.y))),
    maxX: Math.max(...safe.map((point) => clamp(point.x))),
    maxY: Math.max(...safe.map((point) => clamp(point.y))),
  };
}

function lockedTransform(plan: CanonicalPlanSpec, target: Rect) {
  const outlinePoints = masterOutline(plan);
  const contextPoints = [
    ...outlinePoints,
    ...(plan.pool?.present
      ? [
          { x: plan.pool.x, y: plan.pool.y },
          { x: plan.pool.x + plan.pool.width, y: plan.pool.y + plan.pool.height },
        ]
      : []),
    ...(plan.driveway?.present
      ? [
          { x: plan.driveway.x, y: plan.driveway.y },
          { x: plan.driveway.x + plan.driveway.width, y: plan.driveway.y + plan.driveway.height },
        ]
      : []),
    ...((plan.site_features || []).flatMap((feature) => [
      { x: feature.x, y: feature.y },
      { x: feature.x + feature.width, y: feature.y + feature.height },
    ])),
  ];
  const bounds = pointBounds(contextPoints.length ? contextPoints : outlinePoints);
  const sourceWidth = Math.max(12, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(12, bounds.maxY - bounds.minY);
  const scale = Math.min(target.width / sourceWidth, target.height / sourceHeight);
  const fittedWidth = sourceWidth * scale;
  const fittedHeight = sourceHeight * scale;
  const offsetX = target.x + (target.width - fittedWidth) / 2;
  const offsetY = target.y + (target.height - fittedHeight) / 2;
  return { bounds, scale, offsetX, offsetY };
}

function mapPoint(plan: CanonicalPlanSpec, target: Rect, point: { x: number; y: number }) {
  const transform = lockedTransform(plan, target);
  return {
    x: transform.offsetX + (clamp(point.x) - transform.bounds.minX) * transform.scale,
    y: transform.offsetY + (clamp(point.y) - transform.bounds.minY) * transform.scale,
  };
}

function mapRect(plan: CanonicalPlanSpec, target: Rect, rect: { x: number; y: number; width: number; height: number }) {
  const transform = lockedTransform(plan, target);
  return {
    x: transform.offsetX + (clamp(rect.x) - transform.bounds.minX) * transform.scale,
    y: transform.offsetY + (clamp(rect.y) - transform.bounds.minY) * transform.scale,
    width: Math.max(8, Math.max(1, clamp(rect.width, 0, 100)) * transform.scale),
    height: Math.max(8, Math.max(1, clamp(rect.height, 0, 100)) * transform.scale),
  };
}

function siteFeaturesSvg(plan: CanonicalPlanSpec, target: Rect) {
  const features = Array.isArray(plan.site_features) ? plan.site_features : [];
  return features.map((feature) => {
    const box = mapRect(plan, target, feature);
    const label = esc(feature.label || feature.type.replace(/_/g, " "));
    if (feature.type === "steps") {
      const count = Math.max(3, Math.min(12, Math.round(box.height / 15)));
      const lines = Array.from({ length: count + 1 }, (_, index) => {
        const y = box.y + box.height * index / count;
        return `<line x1="${box.x}" y1="${y}" x2="${box.x + box.width}" y2="${y}" stroke="${MID}" stroke-width="2"/>`;
      }).join("");
      return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#f8fafc" stroke="${INK}" stroke-width="2"/>${lines}<text x="${box.x + box.width / 2}" y="${box.y + box.height / 2 + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="800" fill="${INK}">${label}</text></g>`;
    }
    const fill = feature.type === "garden" ? "#f2f8f1" : feature.type === "outdoor_living" ? "#fffaf0" : "#f8fafc";
    const dash = feature.type === "path" ? ' stroke-dasharray="8 6"' : "";
    return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${fill}" stroke="${MID}" stroke-width="2"${dash}/><text x="${box.x + box.width / 2}" y="${box.y + box.height / 2 + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="${MID}">${label}</text></g>`;
  }).join("");
}

function mapRooms(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined, target: Rect): ScreenRoom[] {
  if (!level?.rooms?.length) return [];
  const transform = lockedTransform(plan, target);
  return level.rooms.map((room) => ({
    room,
    x: transform.offsetX + (clamp(room.x) - transform.bounds.minX) * transform.scale,
    y: transform.offsetY + (clamp(room.y) - transform.bounds.minY) * transform.scale,
    width: Math.max(28, Math.max(2, clamp(room.width, 0, 100)) * transform.scale),
    height: Math.max(28, Math.max(2, clamp(room.height, 0, 100)) * transform.scale),
  }));
}

function polygonSvg(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined, target: Rect) {
  const points = levelOutline(plan, level).map((point) => mapPoint(plan, target, point));
  return `<polygon points="${points.map((point) => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="${INK}" stroke-width="12" stroke-linejoin="miter"/>`;
}


type ResolvedSectionCut = CanonicalPlanSectionCut & { letter: string };

function resolveSectionCuts(plan: CanonicalPlanSpec): ResolvedSectionCut[] {
  const level = levelForType(plan, "ground_floor") || plan.levels?.[0];
  const rooms = level?.rooms || [];
  const stair = level?.stairs?.[0];
  const stairRoom = rooms.find((room) => /stair|vertical circulation|hall|landing/i.test(room.name));
  const focusX = clamp(stair ? stair.x + stair.width / 2 : stairRoom ? stairRoom.x + stairRoom.width / 2 : 50);
  const focusY = clamp(stair ? stair.y + stair.height / 2 : stairRoom ? stairRoom.y + stairRoom.height / 2 : 50);

  const roomIdsAt = (orientation: "longitudinal" | "transverse", axis: number) => rooms
    .filter((room) => orientation === "longitudinal"
      ? room.x <= axis && room.x + room.width >= axis
      : room.y <= axis && room.y + room.height >= axis)
    .map((room) => room.id);

  const fallback: ResolvedSectionCut[] = [
    {
      id: "section-a-a",
      label: "A—A",
      letter: "A",
      orientation: "longitudinal",
      axis: focusX,
      direction: "east",
      level_id: level?.id || "ground",
      passes_through_room_ids: roomIdsAt("longitudinal", focusX),
      passes_through_stair: Boolean(stair || stairRoom),
    },
    {
      id: "section-b-b",
      label: "B—B",
      letter: "B",
      orientation: "transverse",
      axis: focusY,
      direction: "north",
      level_id: level?.id || "ground",
      passes_through_room_ids: roomIdsAt("transverse", focusY),
      passes_through_stair: Boolean(stair || stairRoom),
    },
  ];

  const explicit = Array.isArray(plan.section_cuts) ? plan.section_cuts : [];
  return fallback.map((base) => {
    const match = explicit.find((cut) => cut.orientation === base.orientation);
    return match
      ? {
          ...base,
          ...match,
          letter: String(match.label || base.label).replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase() || base.letter,
        }
      : base;
  });
}

function mapCanonicalAxisToScreen(
  rooms: ScreenRoom[],
  orientation: "longitudinal" | "transverse",
  axis: number,
) {
  const sourceMin = Math.min(...rooms.map((item) => orientation === "longitudinal" ? item.room.x : item.room.y));
  const sourceMax = Math.max(...rooms.map((item) => orientation === "longitudinal" ? item.room.x + item.room.width : item.room.y + item.room.height));
  const screenMin = Math.min(...rooms.map((item) => orientation === "longitudinal" ? item.x : item.y));
  const screenMax = Math.max(...rooms.map((item) => orientation === "longitudinal" ? item.x + item.width : item.y + item.height));
  const ratio = (clamp(axis, sourceMin, sourceMax) - sourceMin) / Math.max(1, sourceMax - sourceMin);
  return screenMin + ratio * (screenMax - screenMin);
}

function sectionBubbleSvg(x: number, y: number, letter: string, direction: "north" | "south" | "east" | "west") {
  const arrow = direction === "east"
    ? `<path d="M ${x + 20} ${y} l18 -10 v20 z" fill="${INK}"/>`
    : direction === "west"
      ? `<path d="M ${x - 20} ${y} l-18 -10 v20 z" fill="${INK}"/>`
      : direction === "south"
        ? `<path d="M ${x} ${y + 20} l-10 18 h20 z" fill="${INK}"/>`
        : `<path d="M ${x} ${y - 20} l-10 -18 h20 z" fill="${INK}"/>`;
  return `<g><circle cx="${x}" cy="${y}" r="18" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="${INK}">${esc(letter)}</text>${arrow}</g>`;
}

function sectionCutMarkersSvg(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined, rooms: ScreenRoom[]) {
  if (!level || !rooms.length) return "";
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  const maxX = Math.max(...rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...rooms.map((room) => room.y + room.height));
  return resolveSectionCuts(plan).map((cut) => {
    const axis = mapCanonicalAxisToScreen(rooms, cut.orientation, cut.axis);
    if (cut.orientation === "longitudinal") {
      return `<g class="section-cut-marker"><line x1="${axis}" y1="${minY - 20}" x2="${axis}" y2="${maxY + 20}" stroke="${INK}" stroke-width="2.5" stroke-dasharray="15 8"/>${sectionBubbleSvg(axis, minY - 30, cut.letter, cut.direction)}${sectionBubbleSvg(axis, maxY + 30, cut.letter, cut.direction)}<text x="${axis + 10}" y="${minY + 18}" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="${INK}">${esc(cut.label)}</text></g>`;
    }
    return `<g class="section-cut-marker"><line x1="${minX - 20}" y1="${axis}" x2="${maxX + 20}" y2="${axis}" stroke="${INK}" stroke-width="2.5" stroke-dasharray="15 8"/>${sectionBubbleSvg(minX - 30, axis, cut.letter, cut.direction)}${sectionBubbleSvg(maxX + 30, axis, cut.letter, cut.direction)}<text x="${minX + 12}" y="${axis - 10}" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="${INK}">${esc(cut.label)}</text></g>`;
  }).join("");
}

function overlapLength(a1: number, a2: number, b1: number, b2: number) {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

function isExteriorEdge(room: ScreenRoom, edge: Edge, rooms: ScreenRoom[]) {
  const tolerance = 12;
  return !rooms.some((other) => {
    if (other === room) return false;
    if (edge === "top") {
      return Math.abs(other.y + other.height - room.y) <= tolerance
        && overlapLength(room.x, room.x + room.width, other.x, other.x + other.width) > Math.min(room.width, other.width) * 0.22;
    }
    if (edge === "bottom") {
      return Math.abs(room.y + room.height - other.y) <= tolerance
        && overlapLength(room.x, room.x + room.width, other.x, other.x + other.width) > Math.min(room.width, other.width) * 0.22;
    }
    if (edge === "left") {
      return Math.abs(other.x + other.width - room.x) <= tolerance
        && overlapLength(room.y, room.y + room.height, other.y, other.y + other.height) > Math.min(room.height, other.height) * 0.22;
    }
    return Math.abs(room.x + room.width - other.x) <= tolerance
      && overlapLength(room.y, room.y + room.height, other.y, other.y + other.height) > Math.min(room.height, other.height) * 0.22;
  });
}

function sharedBoundary(a: ScreenRoom, b: ScreenRoom) {
  const tolerance = 22;
  const verticalOverlap = overlapLength(a.y, a.y + a.height, b.y, b.y + b.height);
  const horizontalOverlap = overlapLength(a.x, a.x + a.width, b.x, b.x + b.width);
  const candidates: Array<{ edge: Edge; x: number; y: number; length: number; distance: number }> = [];

  if (verticalOverlap > 25) {
    candidates.push({ edge: "right", x: a.x + a.width, y: Math.max(a.y, b.y), length: verticalOverlap, distance: Math.abs(a.x + a.width - b.x) });
    candidates.push({ edge: "left", x: a.x, y: Math.max(a.y, b.y), length: verticalOverlap, distance: Math.abs(b.x + b.width - a.x) });
  }
  if (horizontalOverlap > 25) {
    candidates.push({ edge: "bottom", x: Math.max(a.x, b.x), y: a.y + a.height, length: horizontalOverlap, distance: Math.abs(a.y + a.height - b.y) });
    candidates.push({ edge: "top", x: Math.max(a.x, b.x), y: a.y, length: horizontalOverlap, distance: Math.abs(b.y + b.height - a.y) });
  }

  const close = candidates.filter((candidate) => candidate.distance <= tolerance).sort((one, two) => one.distance - two.distance)[0];
  if (close) return close;

  const dx = (b.x + b.width / 2) - (a.x + a.width / 2);
  const dy = (b.y + b.height / 2) - (a.y + a.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0
      ? { edge: "right" as Edge, x: a.x + a.width, y: a.y + a.height / 2 - 30, length: 60, distance: Math.max(0, b.x - (a.x + a.width)) }
      : { edge: "left" as Edge, x: a.x, y: a.y + a.height / 2 - 30, length: 60, distance: Math.max(0, a.x - (b.x + b.width)) };
  }
  return dy > 0
    ? { edge: "bottom" as Edge, x: a.x + a.width / 2 - 30, y: a.y + a.height, length: 60, distance: Math.max(0, b.y - (a.y + a.height)) }
    : { edge: "top" as Edge, x: a.x + a.width / 2 - 30, y: a.y, length: 60, distance: Math.max(0, a.y - (b.y + b.height)) };
}

function roomMetric(plan: CanonicalPlanSpec, room: CanonicalPlanRoom) {
  const siteWidth = Math.max(8, Number(plan.site?.width_m || 24));
  const siteDepth = Math.max(8, Number(plan.site?.depth_m || 30));
  return {
    width: Math.max(1.5, siteWidth * clamp(room.width) / 100),
    depth: Math.max(1.5, siteDepth * clamp(room.height) / 100),
  };
}

function labelLines(value: string, max = 18) {
  const words = String(value || "ROOM").trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function roomLabelSvg(plan: CanonicalPlanSpec, item: ScreenRoom) {
  const metric = roomMetric(plan, item.room);
  const lines = labelLines(item.room.name, Math.max(10, Math.floor(item.width / 10)));
  const fontSize = Math.max(11, Math.min(19, item.width / 8.5, item.height / 4.5));
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  const labelY = centerY - (lines.length - 1) * fontSize * 0.52;
  return `<g pointer-events="none">
    <text x="${centerX}" y="${labelY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="${INK}">
      ${lines.map((line, index) => `<tspan x="${centerX}" dy="${index ? fontSize * 1.02 : 0}">${esc(line.toUpperCase())}</tspan>`).join("")}
    </text>
    <text x="${centerX}" y="${labelY + lines.length * fontSize + 10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(9, fontSize - 4)}" fill="${MID}">${metric.width.toFixed(1)} × ${metric.depth.toFixed(1)} m</text>
  </g>`;
}

function bedSvg(item: ScreenRoom) {
  const w = Math.min(item.width * 0.54, 126);
  const h = Math.min(item.height * 0.55, 105);
  const x = item.x + (item.width - w) / 2;
  const y = item.y + item.height * 0.16;
  return `<g stroke="${MID}" fill="none" stroke-width="2">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>
    <rect x="${x + 8}" y="${y + 8}" width="${w / 2 - 12}" height="${Math.min(22, h * 0.22)}" rx="5"/>
    <rect x="${x + w / 2 + 4}" y="${y + 8}" width="${w / 2 - 12}" height="${Math.min(22, h * 0.22)}" rx="5"/>
    <line x1="${x}" y1="${y + h * 0.33}" x2="${x + w}" y2="${y + h * 0.33}"/>
  </g>`;
}

function livingSvg(item: ScreenRoom) {
  const x = item.x + item.width * 0.14;
  const y = item.y + item.height * 0.15;
  const w = item.width * 0.52;
  const h = Math.min(42, item.height * 0.22);
  return `<g stroke="${MID}" fill="none" stroke-width="2">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
    <line x1="${x + w * 0.18}" y1="${y}" x2="${x + w * 0.18}" y2="${y + h}"/>
    <line x1="${x + w * 0.82}" y1="${y}" x2="${x + w * 0.82}" y2="${y + h}"/>
    <rect x="${item.x + item.width * 0.33}" y="${item.y + item.height * 0.55}" width="${item.width * 0.32}" height="${Math.min(32, item.height * 0.15)}" rx="5"/>
  </g>`;
}

function diningSvg(item: ScreenRoom) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height * 0.28;
  const w = Math.min(item.width * 0.56, 120);
  const h = Math.min(item.height * 0.24, 48);
  const chairs = [-0.38, 0, 0.38].map((ratio) => `<circle cx="${cx + ratio * w}" cy="${cy - h * 0.82}" r="5"/><circle cx="${cx + ratio * w}" cy="${cy + h * 0.82}" r="5"/>`).join("");
  return `<g stroke="${MID}" fill="none" stroke-width="2"><rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="16"/>${chairs}</g>`;
}

function kitchenSvg(item: ScreenRoom) {
  const inset = 13;
  const counter = Math.max(16, Math.min(28, item.height * 0.16));
  return `<g stroke="${MID}" fill="none" stroke-width="2">
    <path d="M ${item.x + inset} ${item.y + inset} H ${item.x + item.width - inset} V ${item.y + inset + counter}"/>
    <rect x="${item.x + item.width * 0.34}" y="${item.y + item.height * 0.2}" width="${item.width * 0.32}" height="${Math.min(32, item.height * 0.18)}" rx="3"/>
    <circle cx="${item.x + item.width * 0.46}" cy="${item.y + inset + counter / 2}" r="6"/>
    <circle cx="${item.x + item.width * 0.74}" cy="${item.y + inset + counter / 2}" r="5"/>
    <line x1="${item.x + item.width * 0.7}" y1="${item.y + inset + counter / 2 - 8}" x2="${item.x + item.width * 0.78}" y2="${item.y + inset + counter / 2 + 8}"/>
    <line x1="${item.x + item.width * 0.78}" y1="${item.y + inset + counter / 2 - 8}" x2="${item.x + item.width * 0.7}" y2="${item.y + inset + counter / 2 + 8}"/>
  </g>`;
}

function bathroomSvg(item: ScreenRoom) {
  const x = item.x + 11;
  const y = item.y + 12;
  const w = Math.max(24, item.width * 0.28);
  const h = Math.max(32, item.height * 0.38);
  return `<g stroke="${MID}" fill="none" stroke-width="2">
    <rect x="${x}" y="${y}" width="${w}" height="${Math.min(32, h)}" rx="10"/>
    <ellipse cx="${item.x + item.width - 25}" cy="${item.y + 28}" rx="11" ry="15"/>
    <rect x="${item.x + item.width - 44}" y="${item.y + item.height - 45}" width="34" height="34"/>
    <line x1="${item.x + item.width - 42}" y1="${item.y + item.height - 43}" x2="${item.x + item.width - 12}" y2="${item.y + item.height - 13}"/>
    <line x1="${item.x + item.width - 12}" y1="${item.y + item.height - 43}" x2="${item.x + item.width - 42}" y2="${item.y + item.height - 13}"/>
  </g>`;
}

function garageSvg(item: ScreenRoom) {
  const carW = Math.min(item.width * 0.32, 70);
  const carH = Math.min(item.height * 0.62, 120);
  const count = item.width > 180 ? 2 : 1;
  return Array.from({ length: count }, (_, index) => {
    const gap = item.width / (count + 1);
    const cx = item.x + gap * (index + 1);
    const y = item.y + item.height * 0.13;
    return `<g stroke="${MID}" fill="none" stroke-width="2"><rect x="${cx - carW / 2}" y="${y}" width="${carW}" height="${carH}" rx="18"/><rect x="${cx - carW * 0.32}" y="${y + carH * 0.18}" width="${carW * 0.64}" height="${carH * 0.23}" rx="5"/><circle cx="${cx - carW / 2}" cy="${y + carH * 0.27}" r="4"/><circle cx="${cx + carW / 2}" cy="${y + carH * 0.27}" r="4"/><circle cx="${cx - carW / 2}" cy="${y + carH * 0.76}" r="4"/><circle cx="${cx + carW / 2}" cy="${y + carH * 0.76}" r="4"/></g>`;
  }).join("");
}

function stairSvg(item: ScreenRoom) {
  const x = item.x + item.width * 0.2;
  const y = item.y + item.height * 0.13;
  const w = item.width * 0.6;
  const h = item.height * 0.58;
  const steps = 7;
  return `<g stroke="${MID}" fill="none" stroke-width="2"><rect x="${x}" y="${y}" width="${w}" height="${h}"/>${Array.from({ length: steps }, (_, index) => `<line x1="${x}" y1="${y + h * index / steps}" x2="${x + w}" y2="${y + h * index / steps}"/>`).join("")}<path d="M ${x + w / 2} ${y + h - 8} V ${y + 16}" marker-end="url(#arrowBlack)"/></g>`;
}

function fixtureSvg(item: ScreenRoom) {
  const name = item.room.name.toLowerCase();
  if (/garage|carport/.test(name)) return garageSvg(item);
  if (/kitchen|pantry/.test(name)) return kitchenSvg(item);
  if (/bath|toilet|powder|ensuite|wc/.test(name)) return bathroomSvg(item);
  if (/bed/.test(name)) return bedSvg(item);
  if (/dining|nook/.test(name)) return diningSvg(item);
  if (/living|family|lounge|sitting/.test(name)) return livingSvg(item);
  if (/stair/.test(name)) return stairSvg(item);
  if (/study|office/.test(name)) {
    return `<g stroke="${MID}" fill="none" stroke-width="2"><rect x="${item.x + item.width * 0.18}" y="${item.y + item.height * 0.16}" width="${item.width * 0.58}" height="${Math.min(32, item.height * 0.2)}"/><circle cx="${item.x + item.width * 0.48}" cy="${item.y + item.height * 0.48}" r="11"/></g>`;
  }
  if (/utility|laundry/.test(name)) {
    return `<g stroke="${MID}" fill="none" stroke-width="2"><rect x="${item.x + 10}" y="${item.y + 10}" width="34" height="40"/><circle cx="${item.x + 27}" cy="${item.y + 31}" r="11"/><rect x="${item.x + 51}" y="${item.y + 10}" width="34" height="40"/><circle cx="${item.x + 68}" cy="${item.y + 31}" r="11"/></g>`;
  }
  return "";
}

function windowSvg(room: ScreenRoom, edge: Edge) {
  const width = edge === "top" || edge === "bottom"
    ? Math.max(28, Math.min(room.width * 0.46, 105))
    : Math.max(28, Math.min(room.height * 0.46, 105));
  if (edge === "top" || edge === "bottom") {
    const x = room.x + room.width / 2 - width / 2;
    const y = edge === "top" ? room.y : room.y + room.height;
    return `<g><line x1="${x}" y1="${y}" x2="${x + width}" y2="${y}" stroke="#fff" stroke-width="13"/><line x1="${x}" y1="${y - 3}" x2="${x + width}" y2="${y - 3}" stroke="${INK}" stroke-width="2"/><line x1="${x}" y1="${y + 3}" x2="${x + width}" y2="${y + 3}" stroke="${INK}" stroke-width="2"/><line x1="${x + width / 2}" y1="${y - 4}" x2="${x + width / 2}" y2="${y + 4}" stroke="${INK}" stroke-width="1.5"/></g>`;
  }
  const x = edge === "left" ? room.x : room.x + room.width;
  const y = room.y + room.height / 2 - width / 2;
  return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y + width}" stroke="#fff" stroke-width="13"/><line x1="${x - 3}" y1="${y}" x2="${x - 3}" y2="${y + width}" stroke="${INK}" stroke-width="2"/><line x1="${x + 3}" y1="${y}" x2="${x + 3}" y2="${y + width}" stroke="${INK}" stroke-width="2"/><line x1="${x - 4}" y1="${y + width / 2}" x2="${x + 4}" y2="${y + width / 2}" stroke="${INK}" stroke-width="1.5"/></g>`;
}

function doorSvg(boundary: ReturnType<typeof sharedBoundary>, width = 42) {
  const opening = Math.min(width, Math.max(28, boundary.length * 0.56));
  if (boundary.edge === "left" || boundary.edge === "right") {
    const x = boundary.x;
    const y = boundary.y + boundary.length / 2 - opening / 2;
    const direction = boundary.edge === "right" ? 1 : -1;
    return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y + opening}" stroke="#fff" stroke-width="14"/><line x1="${x}" y1="${y}" x2="${x + direction * opening}" y2="${y}" stroke="${INK}" stroke-width="2.5"/><path d="M ${x} ${y + opening} A ${opening} ${opening} 0 0 ${direction > 0 ? 0 : 1} ${x + direction * opening} ${y}" fill="none" stroke="${MID}" stroke-width="1.5"/></g>`;
  }
  const x = boundary.x + boundary.length / 2 - opening / 2;
  const y = boundary.y;
  const direction = boundary.edge === "bottom" ? 1 : -1;
  return `<g><line x1="${x}" y1="${y}" x2="${x + opening}" y2="${y}" stroke="#fff" stroke-width="14"/><line x1="${x}" y1="${y}" x2="${x}" y2="${y + direction * opening}" stroke="${INK}" stroke-width="2.5"/><path d="M ${x + opening} ${y} A ${opening} ${opening} 0 0 ${direction > 0 ? 1 : 0} ${x} ${y + direction * opening}" fill="none" stroke="${MID}" stroke-width="1.5"/></g>`;
}

function entryDoorSvg(plan: CanonicalPlanSpec, rooms: ScreenRoom[]) {
  if (!rooms.length) return "";
  const entryX = clamp(plan.entry?.x || 50);
  const entryY = clamp(plan.entry?.y || 95);
  const sourceRooms = rooms.map((item) => item.room);
  const minX = Math.min(...sourceRooms.map((room) => room.x));
  const maxX = Math.max(...sourceRooms.map((room) => room.x + room.width));
  const minY = Math.min(...sourceRooms.map((room) => room.y));
  const maxY = Math.max(...sourceRooms.map((room) => room.y + room.height));
  const nearest = rooms.reduce((best, item) => {
    const centerX = item.room.x + item.room.width / 2;
    const centerY = item.room.y + item.room.height / 2;
    const distance = Math.hypot(centerX - entryX, centerY - entryY);
    return !best || distance < best.distance ? { item, distance } : best;
  }, null as { item: ScreenRoom; distance: number } | null)?.item;
  if (!nearest) return "";
  const distances = {
    left: Math.abs(entryX - minX),
    right: Math.abs(entryX - maxX),
    top: Math.abs(entryY - minY),
    bottom: Math.abs(entryY - maxY),
  };
  const edge = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] || "bottom") as Edge;
  const boundary = edge === "left" || edge === "right"
    ? { edge, x: edge === "left" ? nearest.x : nearest.x + nearest.width, y: nearest.y + nearest.height * 0.38, length: Math.max(48, nearest.height * 0.25), distance: 0 }
    : { edge, x: nearest.x + nearest.width * 0.38, y: edge === "top" ? nearest.y : nearest.y + nearest.height, length: Math.max(48, nearest.width * 0.25), distance: 0 };
  return `${doorSvg(boundary, 48)}<text x="${nearest.x + nearest.width / 2}" y="${nearest.y + nearest.height - 13}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="${BLUE}">${esc(plan.entry?.label || "ENTRY")}</text>`;
}

function dimensionLine(x1: number, y1: number, x2: number, y2: number, label: string, vertical = false) {
  if (vertical) {
    const mid = (y1 + y2) / 2;
    return `<g stroke="${MID}" fill="none" stroke-width="1.4"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line x1="${x1 - 7}" y1="${y1}" x2="${x1 + 7}" y2="${y1}"/><line x1="${x2 - 7}" y1="${y2}" x2="${x2 + 7}" y2="${y2}"/></g><text x="${x1 - 10}" y="${mid}" text-anchor="middle" transform="rotate(-90 ${x1 - 10} ${mid})" font-family="Arial, sans-serif" font-size="12" fill="${MID}">${esc(label)}</text>`;
  }
  const mid = (x1 + x2) / 2;
  return `<g stroke="${MID}" fill="none" stroke-width="1.4"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line x1="${x1}" y1="${y1 - 7}" x2="${x1}" y2="${y1 + 7}"/><line x1="${x2}" y1="${y2 - 7}" x2="${x2}" y2="${y2 + 7}"/></g><text x="${mid}" y="${y1 - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="${MID}">${esc(label)}</text>`;
}


function scheduledOpeningSvg(room: ScreenRoom, opening: NonNullable<CanonicalPlanLevel["openings"]>[number]) {
  const position = clamp(opening.position) / 100;
  const wall = opening.wall;
  const segmentLength = 64;
  const boundary = wall === "north"
    ? { edge: "top" as Edge, x: room.x + room.width * position - segmentLength / 2, y: room.y, length: segmentLength, distance: 0 }
    : wall === "south"
      ? { edge: "bottom" as Edge, x: room.x + room.width * position - segmentLength / 2, y: room.y + room.height, length: segmentLength, distance: 0 }
      : wall === "west"
        ? { edge: "left" as Edge, x: room.x, y: room.y + room.height * position - segmentLength / 2, length: segmentLength, distance: 0 }
        : { edge: "right" as Edge, x: room.x + room.width, y: room.y + room.height * position - segmentLength / 2, length: segmentLength, distance: 0 };

  if (opening.type === "door" || opening.type === "sliding_door" || opening.type === "garage_door") {
    return doorSvg(boundary, Math.max(34, Math.min(72, Number(opening.width_m || 0.9) * 24)));
  }

  const lineWidth = Math.max(28, Math.min(92, Number(opening.width_m || 1.5) * 28));
  if (wall === "north" || wall === "south") {
    const x = room.x + room.width * position - lineWidth / 2;
    const y = wall === "north" ? room.y : room.y + room.height;
    return `<g><line x1="${x}" y1="${y}" x2="${x + lineWidth}" y2="${y}" stroke="#fff" stroke-width="13"/><line x1="${x}" y1="${y - 3}" x2="${x + lineWidth}" y2="${y - 3}" stroke="${INK}" stroke-width="2"/><line x1="${x}" y1="${y + 3}" x2="${x + lineWidth}" y2="${y + 3}" stroke="${INK}" stroke-width="2"/></g>`;
  }
  const x = wall === "west" ? room.x : room.x + room.width;
  const y = room.y + room.height * position - lineWidth / 2;
  return `<g><line x1="${x}" y1="${y}" x2="${x}" y2="${y + lineWidth}" stroke="#fff" stroke-width="13"/><line x1="${x - 3}" y1="${y}" x2="${x - 3}" y2="${y + lineWidth}" stroke="${INK}" stroke-width="2"/><line x1="${x + 3}" y1="${y}" x2="${x + 3}" y2="${y + lineWidth}" stroke="${INK}" stroke-width="2"/></g>`;
}

function verticalCoresSvg(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined, target: Rect) {
  if (!level) return "";
  return (plan.vertical_cores || [])
    .filter((core) => (core.serves_level_ids || []).includes(level.id))
    .map((core) => {
      const p = mapPoint(plan, target, { x: core.x, y: core.y });
      const transform = lockedTransform(plan, target);
      const width = Math.max(38, core.width * transform.scale);
      const height = Math.max(38, core.height * transform.scale);
      const box = { x: p.x, y: p.y, width, height };
      if (core.type === "stair") {
        return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#fff" stroke="${INK}" stroke-width="5"/>${stairSvg({ ...box, room: { id: core.id, name: "Stair", zone: "circulation", x: core.x, y: core.y, width: core.width, height: core.height } })}<text x="${box.x + box.width / 2}" y="${box.y + box.height - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="800" fill="${BLUE}">CORE ${esc(core.id)}</text></g>`;
      }
      const label = core.type === "service_lift" ? "SERVICE LIFT" : core.type === "lift" ? "LIFT" : "SHAFT";
      return `<g><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#f8fafc" stroke="${INK}" stroke-width="5"/><line x1="${box.x}" y1="${box.y}" x2="${box.x + box.width}" y2="${box.y + box.height}" stroke="${MID}" stroke-width="2"/><line x1="${box.x + box.width}" y1="${box.y}" x2="${box.x}" y2="${box.y + box.height}" stroke="${MID}" stroke-width="2"/><text x="${box.x + box.width / 2}" y="${box.y + box.height / 2 + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" font-weight="800">${label}</text></g>`;
    }).join("");
}

function canonicalCirculationSvg(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined, target: Rect) {
  if (!level) return "";
  const routes = (plan.circulation_routes || []).filter((route) => (route.serves_level_ids || []).includes(level.id));
  const routeColours: Record<string, string> = {
    public: "#2563eb",
    private: "#7c3aed",
    staff: "#0f766e",
    service: "#ea580c",
    clinical: "#dc2626",
    emergency: "#b91c1c",
    mixed: "#475569",
  };
  return routes.map((route) => {
    const points = route.points.map((point) => mapPoint(plan, target, point));
    if (points.length < 2) return "";
    const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    const colour = routeColours[route.type] || BLUE;
    return `<g><path d="${d}" fill="none" stroke="#fff" stroke-width="${Math.max(10, route.width_m * 6)}" stroke-linejoin="round" stroke-linecap="round" opacity="0.92"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="4" stroke-dasharray="12 7" marker-end="url(#arrowBlue)"/><text x="${points[0].x + 8}" y="${points[0].y - 8}" font-family="Arial, sans-serif" font-size="9" font-weight="800" fill="${colour}">${esc(route.type.toUpperCase())}</text></g>`;
  }).join("");
}

function renderFloorPlan(plan: CanonicalPlanSpec, level: CanonicalPlanLevel | undefined, visualType: string) {
  const zoning = visualType === "functional_zoning";
  const circulation = visualType === "circulation";
  const target = { x: 150, y: 170, width: 1160, height: 650 };
  const rooms = mapRooms(plan, level, target);
  if (!rooms.length) return `<text x="768" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="${MID}">No coordinated rooms returned for this level.</text>`;

  const mappedOutline = levelOutline(plan, level).map((point) => mapPoint(plan, target, point));
  const minX = Math.min(...mappedOutline.map((point) => point.x));
  const minY = Math.min(...mappedOutline.map((point) => point.y));
  const maxX = Math.max(...mappedOutline.map((point) => point.x));
  const maxY = Math.max(...mappedOutline.map((point) => point.y));
  const outlineBounds = pointBounds(levelOutline(plan, level));
  const planWidthM = Math.max(4, Number(plan.site?.width_m || 24) * (outlineBounds.maxX - outlineBounds.minX) / 100);
  const planDepthM = Math.max(4, Number(plan.site?.depth_m || 30) * (outlineBounds.maxY - outlineBounds.minY) / 100);

  const roomBodies = rooms.map((item) => `<g opacity="${circulation ? 0.36 : 1}"><rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" fill="${zoning ? zoneFill[zoneKey(item.room.zone)] : "#fff"}" stroke="${INK}" stroke-width="9" stroke-linejoin="miter"/>${!zoning && !circulation ? fixtureSvg(item) : ""}${roomLabelSvg(plan, item)}</g>`).join("");

  const scheduledOpenings = (level?.openings || []).map((opening) => {
    const room = rooms.find((item) => item.room.id === opening.room_id);
    return room ? scheduledOpeningSvg(room, opening) : "";
  }).join("");

  const fallbackDoors = !level?.openings?.length ? (level?.circulation || []).map((link) => {
    const from = rooms.find((room) => room.room.id === link.from_room_id);
    const to = rooms.find((room) => room.room.id === link.to_room_id);
    if (!from || !to) return "";
    return doorSvg(sharedBoundary(from, to));
  }).join("") : "";

  const fallbackWindows = !zoning && !circulation && !level?.openings?.length ? rooms.map((room) => {
    const name = room.room.name.toLowerCase();
    if (/garage|storage|pantry|closet/.test(name)) return "";
    return (["top", "right", "bottom", "left"] as Edge[])
      .filter((edge) => isExteriorEdge(room, edge, rooms))
      .slice(0, /living|dining|master/.test(name) ? 2 : 1)
      .map((edge) => windowSvg(room, edge))
      .join("");
  }).join("") : "";

  const circulationPaths = circulation
    ? canonicalCirculationSvg(plan, level, target) || (level?.circulation || []).map((link, index) => {
        const from = rooms.find((room) => room.room.id === link.from_room_id);
        const to = rooms.find((room) => room.room.id === link.to_room_id);
        if (!from || !to) return "";
        const x1 = from.x + from.width / 2;
        const y1 = from.y + from.height / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + to.height / 2;
        const bend = index % 2 ? 34 : -34;
        return `<path d="M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2 + bend}, ${x2} ${(y1 + y2) / 2 + bend}, ${x2} ${y2}" fill="none" stroke="${BLUE}" stroke-width="5" marker-end="url(#arrowBlue)"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + bend - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="${BLUE}">${esc(link.label)}</text>`;
      }).join("")
    : "";

  const poolBox = plan.pool?.present ? mapRect(plan, target, plan.pool) : null;
  const pool = poolBox && (visualType === "ground_floor" || zoning)
    ? `<g><rect x="${poolBox.x}" y="${poolBox.y}" width="${poolBox.width}" height="${poolBox.height}" fill="#eef8ff" stroke="${INK}" stroke-width="4"/><line x1="${poolBox.x + 10}" y1="${poolBox.y + poolBox.height / 2}" x2="${poolBox.x + poolBox.width - 10}" y2="${poolBox.y + poolBox.height / 2}" stroke="#8cc8eb" stroke-width="2"/><text x="${poolBox.x + poolBox.width / 2}" y="${poolBox.y + poolBox.height / 2 + 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="800">POOL</text></g>`
    : "";
  const siteFeatures = level === plan.levels?.[0] && !circulation ? siteFeaturesSvg(plan, target) : "";

  const legend = zoning ? Array.from(new Set(rooms.map((room) => zoneKey(room.room.zone)))).map((key, index) => `<rect x="${160 + index * 160}" y="900" width="18" height="18" fill="${zoneFill[key]}" stroke="${INK}" stroke-width="1"/><text x="${186 + index * 160}" y="914" font-family="Arial, sans-serif" font-size="11" font-weight="700">${esc(key.toUpperCase())}</text>`).join("") : "";

  return `<g>
    <rect x="115" y="145" width="1305" height="735" fill="#fff" stroke="#cfd5de" stroke-width="2"/>
    ${siteFeatures}${pool}
    ${polygonSvg(plan, level, target)}
    ${roomBodies}${scheduledOpenings}${fallbackDoors}${fallbackWindows}${verticalCoresSvg(plan, level, target)}${level === plan.levels?.[0] ? entryDoorSvg(plan, rooms) : ""}${circulationPaths}
    ${!zoning && !circulation ? sectionCutMarkersSvg(plan, level, rooms) : ""}
    ${dimensionLine(minX, maxY + 60, maxX, maxY + 60, `APPROX. ${planWidthM.toFixed(1)} m`)}
    ${dimensionLine(minX - 60, minY, minX - 60, maxY, `APPROX. ${planDepthM.toFixed(1)} m`, true)}
    <g transform="translate(1340 170)"><path d="M0 68 L26 0 L52 68 L26 51 Z" fill="${INK}"/><text x="26" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800">${esc(plan.site?.north_label || "N")}</text></g>
    ${legend}
  </g>`;
}

function facadeRooms(level: CanonicalPlanLevel, orientation: string) {
  const rooms = level.rooms || [];
  if (!rooms.length) return [];
  const minX = Math.min(...rooms.map((room) => room.x));
  const minY = Math.min(...rooms.map((room) => room.y));
  const maxX = Math.max(...rooms.map((room) => room.x + room.width));
  const maxY = Math.max(...rooms.map((room) => room.y + room.height));
  const tolerance = 6;
  if (orientation === "north") return rooms.filter((room) => Math.abs(room.y - minY) <= tolerance).sort((a, b) => a.x - b.x);
  if (orientation === "south") return rooms.filter((room) => Math.abs(room.y + room.height - maxY) <= tolerance).sort((a, b) => a.x - b.x);
  if (orientation === "east") return rooms.filter((room) => Math.abs(room.x + room.width - maxX) <= tolerance).sort((a, b) => a.y - b.y);
  return rooms.filter((room) => Math.abs(room.x - minX) <= tolerance).sort((a, b) => a.y - b.y);
}

function renderElevation(plan: CanonicalPlanSpec, visualType: string, dna?: ArchitectureDna | null) {
  const orientation = visualType.replace("_elevation", "");
  const levels = (plan.levels || []).slice(0, 12);
  const storeys = Math.max(1, levels.length || Number(dna?.storeys || 1));
  const x = 180;
  const width = 1170;
  const baseY = 820;
  const floorHeight = Math.min(205, 560 / storeys);
  const roofBase = baseY - floorHeight * storeys;
  const floorSvgs = levels.map((level, levelIndex) => {
    const rooms = facadeRooms(level, orientation);
    const axisTotal = Math.max(1, rooms.reduce((sum, room) => sum + (orientation === "north" || orientation === "south" ? room.width : room.height), 0));
    let cursor = x;
    const y = baseY - (levelIndex + 1) * floorHeight;
    const openings = rooms.map((room) => {
      const axis = orientation === "north" || orientation === "south" ? room.width : room.height;
      const segment = width * axis / axisTotal;
      const name = room.name.toLowerCase();
      const margin = Math.max(12, segment * 0.14);
      const openingX = cursor + margin;
      const openingW = Math.max(30, segment - margin * 2);
      const result = /garage|carport/.test(name) && levelIndex === 0
        ? `<rect x="${openingX}" y="${y + floorHeight * 0.22}" width="${openingW}" height="${floorHeight * 0.68}" fill="#fff" stroke="${INK}" stroke-width="4"/>${Array.from({ length: 5 }, (_, index) => `<line x1="${openingX}" y1="${y + floorHeight * (0.28 + index * 0.11)}" x2="${openingX + openingW}" y2="${y + floorHeight * (0.28 + index * 0.11)}" stroke="${MID}" stroke-width="1"/>`).join("")}`
        : /entry|foyer|hall/.test(name) && levelIndex === 0
          ? `<rect x="${openingX + openingW * 0.25}" y="${y + floorHeight * 0.28}" width="${openingW * 0.5}" height="${floorHeight * 0.62}" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="${openingX + openingW * 0.66}" cy="${y + floorHeight * 0.61}" r="3" fill="${INK}"/>`
          : `<rect x="${openingX}" y="${y + floorHeight * (/bath|toilet|utility/.test(name) ? 0.38 : 0.24)}" width="${openingW}" height="${floorHeight * (/bath|toilet|utility/.test(name) ? 0.34 : 0.48)}" fill="#fff" stroke="${INK}" stroke-width="3"/><line x1="${openingX + openingW / 2}" y1="${y + floorHeight * (/bath|toilet|utility/.test(name) ? 0.38 : 0.24)}" x2="${openingX + openingW / 2}" y2="${y + floorHeight * (/bath|toilet|utility/.test(name) ? 0.72 : 0.72)}" stroke="${MID}" stroke-width="1.5"/>`;
      const balcony = levelIndex > 0 && /master|living|family|lounge/.test(name)
        ? `<line x1="${cursor + 5}" y1="${y + floorHeight * 0.76}" x2="${cursor + segment - 5}" y2="${y + floorHeight * 0.76}" stroke="${INK}" stroke-width="4"/>${Array.from({ length: Math.max(3, Math.floor(segment / 25)) }, (_, index) => `<line x1="${cursor + 10 + index * ((segment - 20) / Math.max(2, Math.floor(segment / 25) - 1))}" y1="${y + floorHeight * 0.76}" x2="${cursor + 10 + index * ((segment - 20) / Math.max(2, Math.floor(segment / 25) - 1))}" y2="${y + floorHeight * 0.91}" stroke="${MID}" stroke-width="1.5"/>`).join("")}`
        : "";
      cursor += segment;
      return `<g>${result}${balcony}</g>`;
    }).join("");
    return `<g><rect x="${x}" y="${y}" width="${width}" height="${floorHeight}" fill="#fff" stroke="${INK}" stroke-width="5"/>${openings}<text x="${x - 26}" y="${y + floorHeight / 2}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" font-weight="700">LEVEL ${levelIndex + 1}</text></g>`;
  }).join("");
  const roofText = String(dna?.roof_form || "flat").toLowerCase();
  const roof = /gable|pitch|hip/.test(roofText)
    ? `<path d="M ${x - 20} ${roofBase + 20} L ${x + width * 0.5} ${roofBase - 70} L ${x + width + 20} ${roofBase + 20}" fill="#fff" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`
    : `<rect x="${x - 18}" y="${roofBase - 20}" width="${width + 36}" height="36" fill="#fff" stroke="${INK}" stroke-width="6"/>`;
  return `<g><rect x="115" y="145" width="1305" height="735" fill="#fff" stroke="#cfd5de" stroke-width="2"/><line x1="120" y1="${baseY}" x2="1410" y2="${baseY}" stroke="${INK}" stroke-width="7"/>${floorSvgs}${roof}${dimensionLine(100, roofBase - 20, 100, baseY, `${(storeys * 3.2 + 0.8).toFixed(1)} m`, true)}<text x="180" y="858" font-family="Arial, sans-serif" font-size="17" font-weight="800">${esc(orientation.toUpperCase())} ELEVATION</text><text x="1350" y="858" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="${MID}">${esc(dna?.facade_rhythm || "Openings coordinated to the canonical floor plans")}</text></g>`;
}

function roomsAcrossCut(level: CanonicalPlanLevel, cut: ResolvedSectionCut) {
  const rooms = level.rooms || [];
  if (!rooms.length) return [];
  const axis = clamp(cut.axis);
  const intersecting = rooms.filter((room) => cut.orientation === "longitudinal"
    ? room.x <= axis && room.x + room.width >= axis
    : room.y <= axis && room.y + room.height >= axis);
  const candidates = intersecting.length
    ? intersecting
    : [...rooms].sort((a, b) => {
        const distanceA = cut.orientation === "longitudinal"
          ? Math.abs(a.x + a.width / 2 - axis)
          : Math.abs(a.y + a.height / 2 - axis);
        const distanceB = cut.orientation === "longitudinal"
          ? Math.abs(b.x + b.width / 2 - axis)
          : Math.abs(b.y + b.height / 2 - axis);
        return distanceA - distanceB;
      }).slice(0, Math.min(5, rooms.length));
  return candidates
    .sort((a, b) => cut.orientation === "longitudinal" ? a.y - b.y : a.x - b.x)
    .slice(0, 8);
}

function sectionLevelMarkerSvg(y: number, label: string, value: string) {
  return `<g><path d="M 138 ${y} l18 -9 v18 z" fill="${BLUE}"/><line x1="156" y1="${y}" x2="180" y2="${y}" stroke="${BLUE}" stroke-width="2"/><text x="128" y="${y - 8}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="${BLUE}">${esc(label)}</text><text x="128" y="${y + 8}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="${MID}">${esc(value)}</text></g>`;
}

function sectionStairSvg(x: number, floorY: number, nextFloorY: number, width: number) {
  const steps = 12;
  const rise = (floorY - nextFloorY) / steps;
  const run = width / steps;
  const lines = Array.from({ length: steps + 1 }, (_, index) => {
    const sx = x + index * run;
    const sy = floorY - index * rise;
    return `<path d="M ${sx} ${floorY} V ${sy} H ${x + Math.min(width, (index + 1) * run)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  }).join("");
  return `<g>${lines}<path d="M ${x} ${floorY} L ${x + width} ${nextFloorY}" stroke="${INK}" stroke-width="5" fill="none"/><line x1="${x + width * 0.2}" y1="${floorY - (floorY - nextFloorY) * 0.2}" x2="${x + width * 0.75}" y2="${nextFloorY + (floorY - nextFloorY) * 0.18}" stroke="${BLUE}" stroke-width="2" marker-end="url(#arrowBlue)"/><text x="${x + width * 0.5}" y="${(floorY + nextFloorY) / 2 - 16}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="${BLUE}">STAIR UP</text></g>`;
}

function renderSection(plan: CanonicalPlanSpec, visualType: string, dna?: ArchitectureDna | null) {
  const longitudinal = visualType === "section_longitudinal";
  const cuts = resolveSectionCuts(plan);
  const cut = cuts.find((item) => item.orientation === (longitudinal ? "longitudinal" : "transverse")) || cuts[0];
  const levels = (plan.levels || []).slice(0, 12);
  const storeys = Math.max(1, levels.length);
  const x = 205;
  const width = 1080;
  const baseY = 815;
  const floorToFloorM = 3.2;
  const slabM = 0.25;
  const clearHeightM = 2.75;
  const pixelsPerMetre = Math.min(58, 520 / Math.max(3.8, storeys * floorToFloorM + 1.1));
  const floorHeight = floorToFloorM * pixelsPerMetre;
  const slabThickness = Math.max(10, slabM * pixelsPerMetre);
  const roofBase = baseY - floorHeight * storeys;

  const floorDrawings = levels.map((level, levelIndex) => {
    const rooms = roomsAcrossCut(level, cut);
    const weights = rooms.map((room) => cut.orientation === "longitudinal" ? room.height : room.width);
    const total = Math.max(1, weights.reduce((sum, value) => sum + value, 0));
    const floorY = baseY - levelIndex * floorHeight;
    const ceilingY = floorY - clearHeightM * pixelsPerMetre;
    let cursor = x;
    const stairIndex = rooms.findIndex((room) => /stair|vertical circulation|hall|landing/i.test(room.name));
    const spaces = rooms.map((room, roomIndex) => {
      const segment = width * weights[roomIndex] / total;
      const segmentX = cursor;
      const name = room.name.toLowerCase();
      const wall = `<line x1="${segmentX}" y1="${floorY}" x2="${segmentX}" y2="${ceilingY}" stroke="${INK}" stroke-width="8"/>`;
      const projection = /bath|toilet|utility|kitchen/.test(name)
        ? `<rect x="${segmentX + segment * 0.22}" y="${floorY - 62}" width="${Math.max(30, segment * 0.42)}" height="54" fill="none" stroke="${MID}" stroke-width="2"/><line x1="${segmentX + segment * 0.22}" y1="${floorY - 34}" x2="${segmentX + segment * 0.64}" y2="${floorY - 34}" stroke="${MID}" stroke-width="1.5"/>`
        : `<rect x="${segmentX + segment * 0.22}" y="${floorY - 82}" width="${Math.max(34, segment * 0.5)}" height="72" fill="none" stroke="${MID}" stroke-width="2"/>`;
      const door = roomIndex > 0 && roomIndex % 2 === 1
        ? `<rect x="${segmentX - 7}" y="${floorY - 2.1 * pixelsPerMetre}" width="14" height="${2.1 * pixelsPerMetre}" fill="#fff" stroke="none"/><line x1="${segmentX}" y1="${floorY}" x2="${segmentX}" y2="${floorY - 2.1 * pixelsPerMetre}" stroke="${MID}" stroke-width="2"/>`
        : "";
      const window = (roomIndex === 0 || roomIndex === rooms.length - 1) && !/storage|closet|utility/.test(name)
        ? `<rect x="${roomIndex === 0 ? segmentX - 5 : segmentX + segment - 5}" y="${floorY - 2.25 * pixelsPerMetre}" width="10" height="${1.25 * pixelsPerMetre}" fill="#fff" stroke="${BLUE}" stroke-width="2"/><line x1="${roomIndex === 0 ? segmentX - 10 : segmentX + segment - 10}" y1="${floorY - 1.62 * pixelsPerMetre}" x2="${roomIndex === 0 ? segmentX + 10 : segmentX + segment + 10}" y2="${floorY - 1.62 * pixelsPerMetre}" stroke="${BLUE}" stroke-width="2"/>`
        : "";
      const label = `<text x="${segmentX + segment / 2}" y="${floorY - 24}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="${INK}">${esc(room.name.toUpperCase())}</text>`;
      cursor += segment;
      return `<g>${wall}${projection}${door}${window}${label}</g>`;
    }).join("");
    const lastWall = `<line x1="${x + width}" y1="${floorY}" x2="${x + width}" y2="${ceilingY}" stroke="${INK}" stroke-width="8"/>`;
    const slab = `<rect x="${x - 8}" y="${floorY - slabThickness / 2}" width="${width + 16}" height="${slabThickness}" fill="#c9cdd3" stroke="${INK}" stroke-width="3"/>`;
    const ceiling = `<line x1="${x}" y1="${ceilingY}" x2="${x + width}" y2="${ceilingY}" stroke="${MID}" stroke-width="2" stroke-dasharray="8 5"/>`;
    const stairRoomIndex = stairIndex >= 0 ? stairIndex : cut.passes_through_stair && levelIndex < storeys - 1 ? Math.floor(rooms.length / 2) : -1;
    let stair = "";
    if (stairRoomIndex >= 0 && levelIndex < storeys - 1) {
      const before = weights.slice(0, stairRoomIndex).reduce((sum, value) => sum + value, 0);
      const stairX = x + width * before / total + 12;
      const stairWidth = Math.max(105, width * weights[stairRoomIndex] / total - 24);
      stair = sectionStairSvg(stairX, floorY - slabThickness / 2, floorY - floorHeight + slabThickness / 2, stairWidth);
    }
    return `${spaces}${lastWall}${ceiling}${slab}${stair}${sectionLevelMarkerSvg(floorY, levelIndex === 0 ? "GROUND FFL" : `${level.label || `LEVEL ${levelIndex + 1}`} FFL`, `+${(levelIndex * floorToFloorM).toFixed(2)} m`)}`;
  }).join("");

  const roofText = String(dna?.roof_form || "flat").toLowerCase();
  const roofTopY = /gable|pitch|hip/.test(roofText) ? roofBase - 74 : roofBase - 24;
  const roof = /gable|pitch|hip/.test(roofText)
    ? `<path d="M ${x - 22} ${roofBase + 6} L ${x + width * 0.5} ${roofTopY} L ${x + width + 22} ${roofBase + 6}" fill="#fff" stroke="${INK}" stroke-width="9"/><line x1="${x}" y1="${roofBase + 6}" x2="${x + width}" y2="${roofBase + 6}" stroke="${INK}" stroke-width="5"/>`
    : `<rect x="${x - 18}" y="${roofBase - 24}" width="${width + 36}" height="32" fill="#c9cdd3" stroke="${INK}" stroke-width="6"/>`;
  const footings = Array.from({ length: 6 }, (_, index) => `<path d="M ${x + index * width / 5 - 16} ${baseY + 7} h32 l18 28 h-68 z" fill="#fff" stroke="${INK}" stroke-width="3"/>`).join("");
  const ground = `<path d="M 105 ${baseY + 20} C 410 ${baseY + 4}, 930 ${baseY + 38}, 1420 ${baseY + 8}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  const rightX = 1340;
  const overallHeightM = storeys * floorToFloorM + (/gable|pitch|hip/.test(roofText) ? 1.2 : 0.45);
  const floorDims = Array.from({ length: storeys }, (_, index) => {
    const yBottom = baseY - index * floorHeight;
    const yTop = yBottom - floorHeight;
    return `${dimensionLine(rightX, yTop, rightX, yBottom, `${floorToFloorM.toFixed(2)} m F-F`, true)}<text x="${rightX - 24}" y="${yBottom - clearHeightM * pixelsPerMetre / 2}" text-anchor="end" font-family="Arial, sans-serif" font-size="10" fill="${MID}">${clearHeightM.toFixed(2)} m clear</text>`;
  }).join("");
  const title = cut.label || (longitudinal ? "A—A" : "B—B");
  const sectionNotes = `<g transform="translate(1015 170)"><rect width="345" height="112" rx="10" fill="#f8fafc" stroke="${LIGHT}" stroke-width="2"/><text x="18" y="25" font-family="Arial, sans-serif" font-size="10" font-weight="800" letter-spacing="1.2" fill="${BLUE}">SECTION DATUM · CONCEPT HEIGHTS</text><text x="18" y="48" font-family="Arial, sans-serif" font-size="10" fill="${MID}">Door head: +2.10 m AFFL · window sill: +0.90 m</text><text x="18" y="67" font-family="Arial, sans-serif" font-size="10" fill="${MID}">Window head: +2.25 m · clear ceiling: ${clearHeightM.toFixed(2)} m</text><text x="18" y="86" font-family="Arial, sans-serif" font-size="10" fill="${MID}">R.C. floor slab: ${slabM.toFixed(2)} m · stair waist slab: approx. 0.15 m</text><text x="18" y="104" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="${INK}">Heavy lines = cut elements · light lines = elements beyond</text></g>`;
  return `<g><rect x="115" y="145" width="1305" height="735" fill="#fff" stroke="#cfd5de" stroke-width="2"/>${ground}${floorDrawings}${roof}${footings}${sectionNotes}${sectionLevelMarkerSvg(roofTopY, "ROOF", `+${overallHeightM.toFixed(2)} m`)}${dimensionLine(1390, roofTopY, 1390, baseY, `${overallHeightM.toFixed(2)} m overall`, true)}${floorDims}<text x="205" y="862" font-family="Arial, sans-serif" font-size="18" font-weight="800">SECTION ${esc(title)} · ${esc(cut.orientation.toUpperCase())}</text><text x="1285" y="862" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="${MID}">Cut direction: ${esc(cut.direction.toUpperCase())} · section line marked on plans</text></g>`;
}

function normaliseSiteElement(element: { x: number; y: number; width: number; height: number }, target: Rect) {
  return {
    x: target.x + clamp(element.x) / 100 * target.width,
    y: target.y + clamp(element.y) / 100 * target.height,
    width: Math.max(28, clamp(element.width) / 100 * target.width),
    height: Math.max(24, clamp(element.height) / 100 * target.height),
  };
}

function renderSitePlan(plan: CanonicalPlanSpec) {
  const site = { x: 190, y: 165, width: 1120, height: 660 };
  const footprint = normaliseSiteElement(plan.footprint || { x: 20, y: 20, width: 60, height: 55 }, site);
  const outline = masterOutline(plan).map((point) => ({
    x: site.x + clamp(point.x) / 100 * site.width,
    y: site.y + clamp(point.y) / 100 * site.height,
  }));
  const outlineBounds = {
    minX: Math.min(...outline.map((point) => point.x)),
    minY: Math.min(...outline.map((point) => point.y)),
    maxX: Math.max(...outline.map((point) => point.x)),
    maxY: Math.max(...outline.map((point) => point.y)),
  };
  const pool = normaliseSiteElement(plan.pool || { x: 68, y: 28, width: 18, height: 35 }, site);
  const driveway = normaliseSiteElement(plan.driveway || { x: 8, y: 66, width: 22, height: 25 }, site);
  return `<g><rect x="115" y="145" width="1305" height="735" fill="#fff" stroke="#cfd5de" stroke-width="2"/><rect x="${site.x}" y="${site.y}" width="${site.width}" height="${site.height}" fill="#fff" stroke="${INK}" stroke-width="5"/><rect x="${site.x + 45}" y="${site.y + 45}" width="${site.width - 90}" height="${site.height - 90}" fill="none" stroke="${MID}" stroke-width="2" stroke-dasharray="9 7"/><text x="${site.x + 55}" y="${site.y + 72}" font-family="Arial, sans-serif" font-size="11" fill="${MID}">CONCEPTUAL SETBACK</text><polygon points="${outline.map((point) => `${point.x},${point.y}`).join(" ")}" fill="#f7f7f7" stroke="${INK}" stroke-width="6" stroke-linejoin="miter"/><text x="${(outlineBounds.minX + outlineBounds.maxX) / 2}" y="${(outlineBounds.minY + outlineBounds.maxY) / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800">BUILDING FOOTPRINT</text>${plan.pool?.present ? `<rect x="${pool.x}" y="${pool.y}" width="${pool.width}" height="${pool.height}" fill="#eef8ff" stroke="${INK}" stroke-width="3"/><text x="${pool.x + pool.width / 2}" y="${pool.y + pool.height / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700">POOL</text>` : ""}${plan.driveway?.present ? `<rect x="${driveway.x}" y="${driveway.y}" width="${driveway.width}" height="${driveway.height}" fill="#f2f2f2" stroke="${INK}" stroke-width="3"/><text x="${driveway.x + driveway.width / 2}" y="${driveway.y + driveway.height / 2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700">DRIVEWAY</text>` : ""}${dimensionLine(site.x, site.y + site.height + 35, site.x + site.width, site.y + site.height + 35, `${Number(plan.site?.width_m || 0).toFixed(1)} m`)}${dimensionLine(site.x - 36, site.y, site.x - 36, site.y + site.height, `${Number(plan.site?.depth_m || 0).toFixed(1)} m`, true)}<g transform="translate(1330 180)"><path d="M0 68 L26 0 L52 68 L26 51 Z" fill="${INK}"/><text x="26" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800">${esc(plan.site?.north_label || "N")}</text></g></g>`;
}

function renderPerspectiveGuide(plan: CanonicalPlanSpec, visualType: string) {
  const footprint = normaliseSiteElement(plan.footprint || { x: 20, y: 20, width: 60, height: 55 }, { x: 370, y: 230, width: 800, height: 500 });
  const label = visualType.replace(/_/g, " ").toUpperCase();
  return `<g><rect x="115" y="145" width="1305" height="735" fill="#fff" stroke="#cfd5de" stroke-width="2"/><path d="M ${footprint.x} ${footprint.y + 90} L ${footprint.x + footprint.width * 0.52} ${footprint.y} L ${footprint.x + footprint.width} ${footprint.y + 90} L ${footprint.x + footprint.width * 0.48} ${footprint.y + 180} Z" fill="#f4f4f4" stroke="${INK}" stroke-width="5"/><path d="M ${footprint.x} ${footprint.y + 90} V ${footprint.y + 90 + footprint.height * 0.45} L ${footprint.x + footprint.width * 0.48} ${footprint.y + 180 + footprint.height * 0.45} V ${footprint.y + 180} Z" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M ${footprint.x + footprint.width} ${footprint.y + 90} V ${footprint.y + 90 + footprint.height * 0.45} L ${footprint.x + footprint.width * 0.48} ${footprint.y + 180 + footprint.height * 0.45} V ${footprint.y + 180} Z" fill="#fafafa" stroke="${INK}" stroke-width="5"/><text x="768" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800">${esc(label)} · CAMERA / MASSING GUIDE</text></g>`;
}

export function renderArchitecturalDrawingSvg(args: DrawingArgs) {
  const isElevation = /_elevation$/.test(args.visualType);
  const isSection = /^section_/.test(args.visualType);
  const isPerspective = /^perspective_/.test(args.visualType);
  const level = levelForType(args.plan, args.visualType);
  const body = args.visualType === "site_plan"
    ? renderSitePlan(args.plan)
    : isElevation
      ? renderElevation(args.plan, args.visualType, args.architectureDna)
      : isSection
        ? renderSection(args.plan, args.visualType, args.architectureDna)
        : isPerspective
          ? renderPerspectiveGuide(args.plan, args.visualType)
          : renderFloorPlan(args.plan, level, args.visualType);
  const subtitle = args.visualType === "site_plan"
    ? "Coordinated site plan"
    : isElevation
      ? "Orthographic concept elevation derived from the floor plans"
      : isSection
        ? "Vertical architectural cut derived from the marked floor-plan section line"
        : isPerspective
          ? "Connected camera guide"
          : `${level?.label || "Coordinated level"} · technical concept plan`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="headerTechnical" x1="0" x2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#eaf2ff"/></linearGradient>
    <marker id="arrowBlack" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="${INK}"/></marker>
    <marker id="arrowBlue" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="${BLUE}"/></marker>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fff"/>
  <rect width="${WIDTH}" height="120" fill="url(#headerTechnical)"/>
  <text x="70" y="40" font-family="Arial, sans-serif" font-size="15" font-weight="800" letter-spacing="1.8" fill="${BLUE}">HEYY STUDIO · CONNECTED CONCEPT TECHNICAL DRAWING</text>
  <text x="70" y="88" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="${INK}">${esc(args.title)}</text>
  <text x="1466" y="45" text-anchor="end" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="${INK}">${esc(args.projectName)}</text>
  <text x="1466" y="78" text-anchor="end" font-family="Arial, sans-serif" font-size="13" fill="${MID}">${esc(subtitle)}</text>
  ${body}
  <line x1="70" y1="954" x2="1466" y2="954" stroke="${LIGHT}" stroke-width="2"/>
  <text x="70" y="985" font-family="Arial, sans-serif" font-size="12" fill="${MID}">Connected conceptual source · dimensions indicative · not for permit, construction, measurement or professional reliance.</text>
  <text x="1466" y="985" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="${MID}">${esc(args.architectureDna?.identity_name || "Architecture identity connected")}</text>
</svg>`;
}
