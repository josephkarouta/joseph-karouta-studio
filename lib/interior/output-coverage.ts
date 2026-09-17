export type InteriorCoverageTier = "small" | "medium" | "large";

export type InteriorOutputCoverage = {
  tier: InteriorCoverageTier;
  representativeZoneCount: number;
  visualTypes: string[];
  label: string;
};

function text(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function numericArea(value: unknown) {
  const source = String(value || "");
  const match = source.match(/([\d,.]+)\s*(?:m2|m²|sqm|sq\.?\s*m)/i);
  if (!match) return 0;
  const number = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function connectedArchitectureType(input: Record<string, unknown>) {
  const connected = input.connectedArchitecture && typeof input.connectedArchitecture === "object" && !Array.isArray(input.connectedArchitecture)
    ? input.connectedArchitecture as Record<string, unknown>
    : null;
  return text(connected?.project_type || connected?.projectType || input.architectureProjectType);
}

export function getInteriorOutputCoverage(input: Record<string, unknown> | null | undefined): InteriorOutputCoverage {
  const source = input || {};
  const scope = text(source.projectScope || source.scope);
  const roomType = text(source.roomType || source.projectType);
  const floors = text(source.floors || source.levels);
  const dimensions = source.dimensions || source.area;
  const area = numericArea(dimensions);
  const architectureType = connectedArchitectureType(source);
  const combined = [scope, roomType, floors, architectureType].filter(Boolean).join(" ");

  const obviousLarge = /tower|high.?rise|mixed.?use|hotel|resort|campus|multi.?floor|multiple floors|whole building|commercial building|office tower|apartment building/.test(combined);
  const threePlusLevels = /(?:3|three|4|four|5|five|6|six|7|seven|8|eight|9|nine|10|ten)\s*(?:floors?|levels?)/.test(floors)
    || /ground.*first.*second|basement.*ground.*first/i.test(floors);
  const obviousMedium = /multiple rooms|whole apartment|whole house|hospitality venue|retail fit.?out|office fit.?out|restaurant|cafe|club|nightlife|retail|office|whole home/.test(combined);

  const tier: InteriorCoverageTier = obviousLarge || threePlusLevels || area >= 900
    ? "large"
    : obviousMedium || area >= 250
      ? "medium"
      : "small";

  if (tier === "large") {
    return {
      tier,
      representativeZoneCount: 4,
      visualTypes: [
        "main_space",
        "alternate_angle",
        "secondary_space",
        "signature_space",
        "focal_point",
        "material_detail",
        "day_view",
        "evening_view",
      ],
      label: "Large / multi-zone coverage",
    };
  }

  if (tier === "medium") {
    return {
      tier,
      representativeZoneCount: 2,
      visualTypes: [
        "main_space",
        "alternate_angle",
        "secondary_space",
        "focal_point",
        "material_detail",
        "day_view",
        "evening_view",
      ],
      label: "Multi-zone coverage",
    };
  }

  return {
    tier,
    representativeZoneCount: 1,
    visualTypes: [
      "main_space",
      "alternate_angle",
      "focal_point",
      "material_detail",
      "day_view",
      "evening_view",
    ],
    label: "Focused space coverage",
  };
}

export function interiorRepresentativeZoneInstruction(input: Record<string, unknown> | null | undefined) {
  const coverage = getInteriorOutputCoverage(input);
  if (coverage.tier === "large") {
    return "This is a large or multi-level interior project. Do NOT try to document every floor. On this plan board, show 3–4 representative zones/levels from the SAME approved project: prioritise the main arrival/public zone, a typical repeated/private zone, an amenity/shared zone, and one special/premium or operational zone only when the brief supports it. Keep them coordinated as one project and label each zone clearly.";
  }
  if (coverage.tier === "medium") {
    return "This is a multi-zone interior project. On this plan board, show up to 2 representative connected zones from the SAME approved project, chosen from the actual brief. Keep the geometry and design language coordinated; do not invent unrelated rooms merely to fill the board.";
  }
  return "This is a focused interior scope. Keep the plan board centred on the primary designed space and its directly connected circulation/openings.";
}
