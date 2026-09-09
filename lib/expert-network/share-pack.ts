import "server-only";

type RecordValue = Record<string, any>;

export type ExpertSharePackItem = {
  id: string;
  sectionId: string;
  sectionTitle: string;
  label: string;
  value: string;
  recommended: boolean;
};

export type ExpertSharePackVisual = {
  id: string;
  title: string;
  type: string;
  url: string;
  width: number | null;
  height: number | null;
  recommended: boolean;
};

export type ExpertSharePackSection = {
  id: string;
  title: string;
  description: string;
  items: ExpertSharePackItem[];
};

export type ExpertSharePackOptions = {
  sections: ExpertSharePackSection[];
  visuals: ExpertSharePackVisual[];
  recommendedItemIds: string[];
  recommendedVisualIds: string[];
};

const BLOCKED_KEY_PARTS = [
  "email",
  "phone",
  "mobile",
  "contact",
  "billing",
  "payment",
  "stripe",
  "quote",
  "price",
  "amount",
  "margin",
  "user_id",
  "userid",
  "client_id",
  "clientid",
  "auth",
  "token",
  "secret",
  "password",
  "internal_note",
  "admin_note",
];

const NOISY_KEY_PARTS = [
  "created_at",
  "updated_at",
  "deleted_at",
  "storage_path",
  "thumbnail_url",
  "file_url",
  "image_url",
  "preview_url",
  "all_generated_outputs",
  "generated_assets",
  "approved_visuals",
];

function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function cleanText(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isBlockedPath(path: string) {
  const normalized = path.toLowerCase();
  return BLOCKED_KEY_PARTS.some((part) => normalized.includes(part));
}

function isNoisyPath(path: string) {
  const normalized = path.toLowerCase();
  return NOISY_KEY_PARTS.some((part) => normalized.includes(part));
}

function valueText(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return cleanText(value, 3000);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const primitive = value
      .map((item) => {
        if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
          return cleanText(item, 500);
        }
        if (item && typeof item === "object") {
          const record = asRecord(item);
          return cleanText(
            record.label || record.title || record.name || record.value || record.id,
            500,
          );
        }
        return "";
      })
      .filter(Boolean)
      .slice(0, 20);
    return primitive.join(" · ");
  }
  if (typeof value === "object" && depth < 2) {
    const record = asRecord(value);
    return Object.entries(record)
      .filter(([key]) => !isBlockedPath(key) && !isNoisyPath(key))
      .map(([key, nested]) => {
        const rendered = valueText(nested, depth + 1);
        return rendered ? `${humanize(key)}: ${rendered}` : "";
      })
      .filter(Boolean)
      .slice(0, 12)
      .join("\n");
  }
  return "";
}

function parseProjectBrief(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const rendered = valueText(value);
    if (rendered) return rendered;
  }
  return "";
}

function readAssetPayload(asset: any) {
  const source = asset?.output_payload || asset?.payload || {};
  if (typeof source === "string") {
    try {
      return asRecord(JSON.parse(source));
    } catch {
      return {};
    }
  }
  return asRecord(source);
}

function addVisual(
  list: ExpertSharePackVisual[],
  seen: Set<string>,
  input: {
    id?: unknown;
    title?: unknown;
    type?: unknown;
    url?: unknown;
    width?: unknown;
    height?: unknown;
    recommended?: boolean;
  },
  fallbackId: string,
) {
  const url = cleanText(input.url, 4000);
  if (!url || seen.has(url)) return;
  seen.add(url);
  list.push({
    id: cleanText(input.id, 160) || fallbackId,
    title: cleanText(input.title, 300) || "Generated visual",
    type: cleanText(input.type, 160) || "Project reference",
    url,
    width: Number.isFinite(Number(input.width)) ? Number(input.width) : null,
    height: Number.isFinite(Number(input.height)) ? Number(input.height) : null,
    recommended: Boolean(input.recommended),
  });
}

function visualOptions(row: RecordValue): ExpertSharePackVisual[] {
  const metadata = asRecord(row.metadata);
  const generatedAssets = Array.isArray(metadata.generated_assets)
    ? metadata.generated_assets
    : [];
  const visuals: ExpertSharePackVisual[] = [];
  const seen = new Set<string>();

  generatedAssets.forEach((asset: any, assetIndex: number) => {
    const payload = readAssetPayload(asset);
    const title =
      cleanText(asset?.title, 300) ||
      cleanText(payload?.applicationLabel, 300) ||
      humanize(cleanText(asset?.asset_type, 160) || `Asset ${assetIndex + 1}`);
    const type = humanize(
      cleanText(asset?.visual_type, 160) ||
        cleanText(asset?.asset_type, 160) ||
        cleanText(payload?.applicationId, 160) ||
        "Project reference",
    );
    const recommended =
      asset?.is_approved === true ||
      asset?.approved === true ||
      asRecord(asset?.metadata).approved === true ||
      assetIndex < 2;

    addVisual(
      visuals,
      seen,
      {
        id: asset?.id,
        title,
        type,
        url:
          asset?.file_url ||
          asset?.image_url ||
          asset?.thumbnail_url ||
          payload?.imageUrl ||
          payload?.image_url,
        width: payload?.width,
        height: payload?.height,
        recommended,
      },
      `asset-${assetIndex}`,
    );

    const outputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
    outputs.forEach((output: any, outputIndex: number) => {
      addVisual(
        visuals,
        seen,
        {
          id: output?.id,
          title: output?.label || output?.title || `${title} ${outputIndex + 1}`,
          type,
          url: output?.imageUrl || output?.image_url || output?.file_url,
          width: output?.width,
          height: output?.height,
          recommended: recommended && outputIndex === 0,
        },
        `asset-${assetIndex}-output-${outputIndex}`,
      );
    });

    const concepts = [
      ...(Array.isArray(payload?.conceptsByDirection) ? payload.conceptsByDirection : []),
      ...(Array.isArray(payload?.directions) ? payload.directions : []),
      ...(Array.isArray(payload?.moodboards) ? payload.moodboards : []),
      ...(Array.isArray(payload?.logos) ? payload.logos : []),
    ];
    concepts.forEach((concept: any, conceptIndex: number) => {
      addVisual(
        visuals,
        seen,
        {
          id: concept?.id,
          title:
            concept?.title ||
            concept?.conceptName ||
            `${title} ${conceptIndex + 1}`,
          type,
          url: concept?.imageUrl || concept?.image_url || concept?.file_url,
          recommended: recommended && conceptIndex === 0,
        },
        `asset-${assetIndex}-concept-${conceptIndex}`,
      );
    });
  });

  addVisual(
    visuals,
    seen,
    {
      id: "request-preview",
      title: `${cleanText(row.service, 200) || "Production"} preview`,
      type: "Request preview",
      url: row.preview_image,
      recommended: visuals.length === 0,
    },
    "request-preview",
  );

  const trimmed = visuals.slice(0, 24);
  if (trimmed.length && !trimmed.some((item) => item.recommended)) {
    trimmed[0] = { ...trimmed[0], recommended: true };
  }
  return trimmed;
}

function addItem(
  map: Map<string, ExpertSharePackSection>,
  sectionId: string,
  sectionTitle: string,
  description: string,
  label: string,
  value: unknown,
  options?: { id?: string; recommended?: boolean },
) {
  const rendered = valueText(value);
  if (!rendered) return;
  const id = options?.id || `${sectionId}.${safeId(label)}`;
  if (isBlockedPath(id)) return;

  if (!map.has(sectionId)) {
    map.set(sectionId, {
      id: sectionId,
      title: sectionTitle,
      description,
      items: [],
    });
  }
  const section = map.get(sectionId)!;
  if (section.items.some((item) => item.id === id)) return;
  section.items.push({
    id,
    sectionId,
    sectionTitle,
    label,
    value: rendered,
    recommended: options?.recommended !== false,
  });
}

function flattenContextSection(
  map: Map<string, ExpertSharePackSection>,
  topKey: string,
  source: unknown,
  recommended: boolean,
) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return;
  const sectionId = `context-${safeId(topKey)}`;
  const sectionTitle = humanize(topKey);
  const description = `Selected ${sectionTitle.toLowerCase()} information from the client project context.`;
  let count = 0;

  for (const [key, value] of Object.entries(asRecord(source))) {
    if (count >= 10) break;
    const path = `${topKey}.${key}`;
    if (isBlockedPath(path) || isNoisyPath(path)) continue;
    const rendered = valueText(value);
    if (!rendered || rendered.length > 3000) continue;
    addItem(
      map,
      sectionId,
      sectionTitle,
      description,
      humanize(key),
      rendered,
      { id: `context.${safeId(topKey)}.${safeId(key)}`, recommended },
    );
    count += 1;
  }
}

function contextTopKeysForStudio(studio: string) {
  if (studio === "brand_studio") {
    return [
      "brandStrategy",
      "foundation",
      "brandVoice",
      "personality",
      "colourPalette",
      "typography",
      "projectJourney",
      "production_scope",
    ];
  }
  if (studio === "architecture_studio") {
    return [
      "project",
      "site",
      "planning",
      "selected_direction",
      "architecture_concept",
      "concept_plan_set",
      "design_pack",
    ];
  }
  if (studio === "interior_studio") {
    return [
      "project_brief",
      "layout_plan",
      "material_palette",
      "furniture_schedule",
      "lighting_strategy",
      "selected_direction",
      "design_pack",
    ];
  }
  if (studio === "marketing_studio") {
    return [
      "project_brief",
      "audience_segments",
      "strategy",
      "big_idea",
      "key_message",
      "copy_bank",
      "channel_plan",
      "content_calendar",
      "testing_plan",
      "measurement_plan",
    ];
  }
  return [];
}

export function buildExpertSharePackOptions(row: RecordValue): ExpertSharePackOptions {
  const metadata = asRecord(row.metadata);
  const metadataContext = asRecord(metadata.project_context);
  const briefJson = parseProjectBrief(row.project_brief);
  const context = Object.keys(metadataContext).length ? metadataContext : briefJson;
  const studio = cleanText(row.studio, 100).toLowerCase();
  const sections = new Map<string, ExpertSharePackSection>();

  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Requested service",
    row.service,
    { id: "scope.service", recommended: true },
  );
  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Scope description",
    firstText(metadata.description, asRecord(context.production_scope).description),
    { id: "scope.description", recommended: true },
  );
  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Best used for",
    metadata.usage,
    { id: "scope.usage", recommended: true },
  );
  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Required final files",
    firstText(context.final_file_requirements, asRecord(context.production_scope).outputs),
    { id: "scope.final-files", recommended: true },
  );
  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Selected deliverables",
    asRecord(context.projectJourney).selectedDeliverables,
    { id: "scope.deliverables", recommended: true },
  );
  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Selected applications",
    context.selected_brand_applications,
    { id: "scope.applications", recommended: true },
  );
  addItem(
    sections,
    "scope",
    "Production scope",
    "The exact service, requested outcome and final production requirements.",
    "Expert production note",
    metadata.expertNote,
    { id: "scope.expert-note", recommended: true },
  );

  addItem(
    sections,
    "project-overview",
    "Project overview",
    "High-level client project context that helps an Expert understand the direction before pricing.",
    "Project summary",
    context.summary,
    { id: "overview.summary", recommended: true },
  );

  addItem(
    sections,
    "project-overview",
    "Project overview",
    "High-level client project context that helps an Expert understand the direction before pricing.",
    "Personality / style",
    firstText(context.personality, asRecord(context.project).architectural_style, asRecord(context.project_brief).style),
    { id: "overview.style", recommended: true },
  );

  const knownTopKeys = contextTopKeysForStudio(studio);
  knownTopKeys.forEach((key, index) => {
    flattenContextSection(sections, key, context[key], index < 4);
  });

  // Guided/legacy requests can store useful structured input/output under the
  // project brief instead of metadata.project_context. Surface only safe fields
  // and still require Admin selection before anything reaches an Expert.
  if (!Object.keys(metadataContext).length && Object.keys(briefJson).length) {
    flattenContextSection(sections, "input", briefJson.input, true);
    flattenContextSection(sections, "output", briefJson.output, false);
  }

  addItem(
    sections,
    "client-notes",
    "Client notes",
    "Optional client wording. Review carefully before sharing because it may include context that is not needed for pricing.",
    "Client request note",
    row.notes,
    { id: "client-notes.request", recommended: false },
  );

  const sectionList = Array.from(sections.values())
    .map((section) => ({ ...section, items: section.items.slice(0, 12) }))
    .filter((section) => section.items.length > 0)
    .slice(0, 12);
  const visuals = visualOptions(row);
  const recommendedItemIds = sectionList.flatMap((section) =>
    section.items.filter((item) => item.recommended).map((item) => item.id),
  );
  const recommendedVisualIds = visuals
    .filter((visual) => visual.recommended)
    .slice(0, 6)
    .map((visual) => visual.id);

  return {
    sections: sectionList,
    visuals,
    recommendedItemIds,
    recommendedVisualIds,
  };
}

export function buildExpertSharedScope(input: {
  row: RecordValue;
  sharedBrief?: string;
  selectedItemIds?: string[];
  selectedVisualIds?: string[];
}) {
  const metadata = asRecord(input.row.metadata);
  const projectContext = asRecord(metadata.project_context);
  const selectedApplication = asRecord(
    projectContext.selected_application || metadata.selected_application,
  );
  const options = buildExpertSharePackOptions(input.row);
  const allowedItems = new Map(
    options.sections.flatMap((section) => section.items).map((item) => [item.id, item]),
  );
  const allowedVisuals = new Map(options.visuals.map((visual) => [visual.id, visual]));

  const requestedItems = Array.from(new Set(input.selectedItemIds || []))
    .map((id) => allowedItems.get(id))
    .filter((item): item is ExpertSharePackItem => Boolean(item))
    .slice(0, 80);
  const requestedVisuals = Array.from(new Set(input.selectedVisualIds || []))
    .map((id) => allowedVisuals.get(id))
    .filter((visual): visual is ExpertSharePackVisual => Boolean(visual))
    .slice(0, 24);

  const items = input.selectedItemIds === undefined
    ? options.sections
        .flatMap((section) => section.items)
        .filter((item) => options.recommendedItemIds.includes(item.id))
    : requestedItems;
  const visuals = input.selectedVisualIds === undefined
    ? options.visuals.filter((visual) => options.recommendedVisualIds.includes(visual.id))
    : requestedVisuals;

  const brief =
    cleanText(input.sharedBrief, 12000) ||
    cleanText(metadata.expertNote, 12000) ||
    cleanText(input.row.notes, 12000) ||
    cleanText(selectedApplication.description, 12000) ||
    "Please review the selected project context and references and quote the requested production scope.";

  return {
    projectName: cleanText(input.row.project_name, 300) || "Untitled Project",
    service: cleanText(input.row.service, 300) || "Production",
    studio: cleanText(input.row.studio, 100),
    brief,
    previewImage: visuals[0]?.url || cleanText(input.row.preview_image, 4000) || null,
    requestedDeadline:
      cleanText(metadata.deadline, 120) ||
      cleanText(metadata.due_date, 120) ||
      cleanText(projectContext.deadline, 120) ||
      null,
    quotePack: {
      version: 1,
      sharedAt: new Date().toISOString(),
      items: items.map(({ recommended: _recommended, ...item }) => item),
      visuals: visuals.map(({ recommended: _recommended, ...visual }) => visual),
    },
  };
}
