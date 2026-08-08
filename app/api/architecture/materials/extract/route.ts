import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type ExtractRequest = {
  projectId?: string;
  documentId?: string;
};

type DemoMaterial = {
  key: string;
  name: string;
  image: string;
  category: string;
  finish: string;
  application: string;
  cost: string;
  maintenance: string;
  climate: string;
  sustainability: string;
};

const demoMaterials: DemoMaterial[] = [
  { key: "warm-limestone", name: "Warm Limestone", image: "/architecture/materials/warm-limestone.jpg", category: "Exterior Walls", finish: "Honed", application: "Primary façade", cost: "Premium", maintenance: "Low", climate: "Suitable for warm climates when detailed and sealed correctly", sustainability: "Prefer local responsible sourcing" },
  { key: "travertine", name: "Travertine", image: "/architecture/materials/travertine.jpg", category: "Feature Façade", finish: "Vein cut", application: "Feature walls and entry", cost: "Premium", maintenance: "Medium", climate: "Verify sealing and freeze-thaw exposure", sustainability: "Confirm quarry and transport impact" },
  { key: "board-formed-concrete", name: "Board-Formed Concrete", image: "/architecture/materials/board-formed-concrete.jpg", category: "Structure / Façade", finish: "Textured", application: "Feature massing", cost: "High", maintenance: "Low", climate: "Verify waterproofing, joints and concrete cover", sustainability: "Consider lower-carbon concrete mixes" },
  { key: "natural-oak", name: "Natural Oak", image: "/architecture/materials/natural-oak.jpg", category: "Screens / Soffits", finish: "Oiled", application: "Screens and soffits", cost: "High", maintenance: "Medium", climate: "Protect from direct weather and select a durable species", sustainability: "Specify certified timber" },
  { key: "charred-timber", name: "Charred Timber", image: "/architecture/materials/charred-timber.jpg", category: "Screens / Feature", finish: "Charred", application: "Feature cladding", cost: "High", maintenance: "Medium", climate: "Verify fire, UV and moisture performance", sustainability: "Use certified durable timber" },
  { key: "terracotta-brick", name: "Terracotta Brick", image: "/architecture/materials/terracotta-brick.jpg", category: "Exterior Walls", finish: "Natural", application: "Main wall or screen", cost: "Medium", maintenance: "Low", climate: "Good thermal mass with correct cavity detailing", sustainability: "Prefer local manufacturing" },
  { key: "mineral-render", name: "Mineral Render", image: "/architecture/materials/mineral-render.jpg", category: "Exterior Walls", finish: "Fine texture", application: "Secondary walls", cost: "Controlled", maintenance: "Medium", climate: "Specify a system suitable for local moisture and heat", sustainability: "Can reduce synthetic coating use" },
  { key: "bronze-metal", name: "Bronze Metal", image: "/architecture/materials/bronze-metal.jpg", category: "Feature Details", finish: "Brushed", application: "Entry and trims", cost: "Premium", maintenance: "Low to medium", climate: "Patina behaviour must be accepted", sustainability: "Recycled content can be specified" },
  { key: "black-aluminium", name: "Black Aluminium", image: "/architecture/materials/black-aluminium.jpg", category: "Windows / Frames", finish: "Powder coated", application: "Windows and screens", cost: "Medium", maintenance: "Low", climate: "Use thermal breaks and coastal-grade coating where required", sustainability: "Prioritise recycled aluminium" },
  { key: "low-iron-glass", name: "Low-Iron Glass", image: "/architecture/materials/low-iron-glass.jpg", category: "Glazing", finish: "Clear", application: "Main openings", cost: "High", maintenance: "Medium", climate: "Performance glazing and external shade are essential", sustainability: "Avoid unnecessary glazing area" },
  { key: "terrazzo", name: "Terrazzo", image: "/architecture/materials/terrazzo.jpg", category: "External Flooring", finish: "Honed", application: "Terraces and entry", cost: "High", maintenance: "Low to medium", climate: "Verify slip resistance and movement joints", sustainability: "Can use recycled aggregate" },
  { key: "standing-seam-metal", name: "Standing-Seam Metal", image: "/architecture/materials/standing-seam-metal.jpg", category: "Roof", finish: "Matte", application: "Roof planes", cost: "Medium", maintenance: "Low", climate: "Verify condensation, acoustics and corrosion", sustainability: "Highly recyclable" },
];

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from the server environment.`);
  return value;
}

async function createAuthenticatedSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }>,
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Cookie writes are optional after the response is committed.
          }
        },
      },
    },
  );
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractRequest;
    const projectId = body.projectId?.trim();
    const documentId = body.documentId?.trim();

    if (!projectId || !documentId) {
      return NextResponse.json({ success: false, error: "projectId and documentId are required." }, { status: 400 });
    }

    const supabase = await createAuthenticatedSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const [projectResult, documentResult] = await Promise.all([
      supabase.from("architecture_projects").select("id").eq("id", projectId).eq("user_id", user.id).single(),
      supabase
        .from("architecture_documents")
        .select("id,filename,mime_type,storage_path")
        .eq("id", documentId)
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single(),
    ]);

    if (projectResult.error || !projectResult.data) {
      return NextResponse.json({ success: false, error: "Architecture project not found." }, { status: 404 });
    }

    if (documentResult.error || !documentResult.data) {
      return NextResponse.json({ success: false, error: "Material reference image not found." }, { status: 404 });
    }

    if (!documentResult.data.mime_type?.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Material extraction requires an image file." }, { status: 400 });
    }

    // Demo Mode: choose a repeatable set from the prepared material library.
    // Real image analysis will replace this selection logic during final OpenAI testing.
    const seed = hashText(`${documentResult.data.filename}:${documentResult.data.storage_path}`);
    const count = 4;
    const suggestions = Array.from({ length: count }, (_, offset) => demoMaterials[(seed + offset * 3) % demoMaterials.length]);

    const rows = suggestions.map((material, index) => ({
      project_id: projectId,
      user_id: user.id,
      category: material.category,
      material_key: `extracted-${documentId}-${material.key}`,
      name: material.name,
      image_url: material.image,
      finish: material.finish,
      application: material.application,
      cost_level: material.cost,
      maintenance_level: material.maintenance,
      climate_suitability: material.climate,
      sustainability_note: material.sustainability,
      is_selected: true,
      is_extracted: true,
      source_document_id: documentId,
      sort_order: 100 + index,
      metadata: {
        mode: "demo",
        confidence: ["High visual similarity", "Likely", "Possible", "Alternative suggestion"][index],
        disclaimer: "Suggested visual identification only. Confirm the actual product and specification with suppliers and professionals.",
      },
    }));

    const { error: removeError } = await supabase
      .from("architecture_materials")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .eq("source_document_id", documentId)
      .eq("is_extracted", true);

    if (removeError) throw new Error(removeError.message);

    const { error: insertError } = await supabase.from("architecture_materials").insert(rows);
    if (insertError) throw new Error(insertError.message);

    const { data: materials, error: materialsError } = await supabase
      .from("architecture_materials")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (materialsError) throw new Error(materialsError.message);

    return NextResponse.json({
      success: true,
      mode: "demo",
      materials: materials || [],
      notice: "These are suggested materials based on Demo Mode, not verified product identifications.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Material suggestions could not be prepared." },
      { status: 500 },
    );
  }
}
