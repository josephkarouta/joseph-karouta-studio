import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireAdminApiCapability } from "@/lib/server/admin-api";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function firstText(...values: unknown[]) {
  return values.find((value) => typeof value === "string" && value.trim()) as string | undefined;
}

function architectureStoragePath(asset: any, dbRow?: any) {
  const assetMetadata = asRecord(asset?.metadata);
  const rowMetadata = asRecord(dbRow?.metadata || dbRow?.generation_json);
  const nested = [
    asset?.final_assets,
    asset?.rendered_final_assets,
    asset?.preview_assets,
    asset?.rendered_preview_assets,
    asset?.technical_assets,
    assetMetadata.final_assets,
    assetMetadata.rendered_final_assets,
    assetMetadata.preview_assets,
    assetMetadata.rendered_preview_assets,
    assetMetadata.technical_assets,
    rowMetadata.final_assets,
    rowMetadata.rendered_final_assets,
    rowMetadata.preview_assets,
    rowMetadata.rendered_preview_assets,
    rowMetadata.technical_assets,
  ].map(asRecord);

  return firstText(
    asset?.storage_path,
    asset?.image_storage_path,
    assetMetadata.storage_path,
    assetMetadata.image_storage_path,
    dbRow?.storage_path,
    dbRow?.image_storage_path,
    rowMetadata.storage_path,
    rowMetadata.image_storage_path,
    ...nested.flatMap((item) => [item.preview_storage_path, item.master_storage_path, item.thumbnail_storage_path]),
  ) || null;
}

async function signedArchitectureUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("architecture-files")
    .createSignedUrl(path, 60 * 60 * 24);
  return error ? null : data?.signedUrl || null;
}

async function hydrateArchitectureRequest(studioRequest: any) {
  if (studioRequest?.studio !== "architecture_studio" || !studioRequest?.project_id) {
    return studioRequest;
  }

  const metadata = asRecord(studioRequest.metadata);
  const requestAssets = Array.isArray(metadata.generated_assets)
    ? metadata.generated_assets
    : [];
  const ids = Array.from(new Set(requestAssets.map((asset: any) => String(asset?.id || "")).filter(Boolean)));

  const [visualResult, directionResult, conceptResult] = ids.length
    ? await Promise.all([
        supabase.from("architecture_visuals").select("*").eq("project_id", studioRequest.project_id).in("id", ids),
        supabase.from("architecture_directions").select("*").eq("project_id", studioRequest.project_id).in("id", ids),
        supabase.from("architecture_concepts").select("*").eq("project_id", studioRequest.project_id).in("id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }] as any;

  const rows = [
    ...(visualResult.data || []),
    ...(directionResult.data || []),
    ...(conceptResult.data || []),
  ];
  const byId = new Map(rows.map((row: any) => [String(row.id), row]));

  const hydratedAssets = await Promise.all(requestAssets.map(async (asset: any) => {
    const dbRow = byId.get(String(asset?.id || ""));
    const dbMetadata = asRecord(dbRow?.metadata || dbRow?.generation_json);
    const storagePath = architectureStoragePath(asset, dbRow);
    const freshUrl = await signedArchitectureUrl(storagePath);
    const currentUrl = firstText(
      asset?.file_url,
      asset?.image_url,
      dbRow?.image_url,
      dbMetadata.preview_url,
      dbMetadata.image_url,
    ) || null;
    const imageUrl = freshUrl || currentUrl;

    return {
      ...asset,
      group: asset?.group || dbMetadata.group || null,
      visual_type: asset?.visual_type || dbRow?.visual_type || null,
      title: asset?.title || dbRow?.title || asset?.visual_type || "Generated output",
      is_approved: asset?.is_approved ?? dbRow?.is_approved ?? null,
      image_url: imageUrl,
      file_url: imageUrl,
      storage_path: storagePath,
      technical_assets: asset?.technical_assets || dbMetadata.technical_assets || null,
      rendered_preview_assets: asset?.rendered_preview_assets || dbMetadata.rendered_preview_assets || null,
      rendered_final_assets: asset?.rendered_final_assets || dbMetadata.rendered_final_assets || null,
      preview_assets: asset?.preview_assets || dbMetadata.preview_assets || null,
      final_assets: asset?.final_assets || dbMetadata.final_assets || null,
    };
  }));

  const preferredPreview = hydratedAssets.find((asset: any) => asset?.group === "direction" && asset?.file_url)?.file_url
    || hydratedAssets.find((asset: any) => asset?.file_url)?.file_url
    || studioRequest.preview_image
    || null;

  return {
    ...studioRequest,
    preview_image: preferredPreview,
    metadata: {
      ...metadata,
      generated_assets: hydratedAssets,
      generated_asset_count: hydratedAssets.length,
    },
  };
}


async function hydrateInteriorRequest(studioRequest: any) {
  if (studioRequest?.studio !== "interior_studio" || !studioRequest?.project_id) {
    return studioRequest;
  }

  const metadata = asRecord(studioRequest.metadata);
  const existingAssets = Array.isArray(metadata.generated_assets)
    ? metadata.generated_assets
    : [];
  if (existingAssets.length) return studioRequest;

  const { data } = await supabase
    .from("project_assets")
    .select("id,asset_type,title,file_url,thumbnail_url,metadata,payload,created_at")
    .eq("project_id", studioRequest.project_id)
    .eq("studio", "interior_studio")
    .order("created_at", { ascending: true })
    .limit(100);

  const generatedAssets = (data || [])
    .filter((asset: any) => {
      const type = String(asset?.asset_type || "");
      return type.startsWith("interior_plan_") || type.startsWith("interior_visual_");
    })
    .map((asset: any) => {
      const assetMetadata = asRecord(asset?.metadata);
      return {
        id: asset.id,
        asset_type: asset.asset_type,
        group: String(asset.asset_type || "").startsWith("interior_plan_") ? "plans" : "visuals",
        visual_type: assetMetadata.view_type || null,
        title: asset.title || asset.asset_type || "Interior generated output",
        is_approved: assetMetadata.approved === true || assetMetadata.approved === "true",
        file_url: asset.file_url || asset.thumbnail_url || null,
        image_url: asset.file_url || asset.thumbnail_url || null,
        thumbnail_url: asset.thumbnail_url || null,
        storage_path: assetMetadata.storage_path || null,
        created_at: asset.created_at || null,
        payload: asset.payload || {},
      };
    });

  if (!generatedAssets.length) return studioRequest;

  return {
    ...studioRequest,
    preview_image: studioRequest.preview_image || generatedAssets.find((asset: any) => asset.file_url)?.file_url || null,
    metadata: {
      ...metadata,
      generated_assets: generatedAssets,
      generated_asset_count: generatedAssets.length,
    },
  };
}

export async function GET(request: NextRequest) {
  const access = await requireAdminApiCapability("operations");
  if (access.response) return access.response;

  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { success: false, error: "Missing id" },
      { status: 400 },
    );
  }

  const { data: studioRequest, error: requestError } = await supabase
    .from("studio_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (requestError || !studioRequest) {
    return NextResponse.json(
      {
        success: false,
        error: requestError?.message || "Studio request not found",
      },
      { status: 500 },
    );
  }

  const { data: quote, error: quoteError } = await supabase
    .from("workspace_quotes")
    .select("*")
    .eq("studio_request_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (quoteError) {
    return NextResponse.json(
      { success: false, error: quoteError.message },
      { status: 500 },
    );
  }

  const architectureHydrated = await hydrateArchitectureRequest(studioRequest);
  const hydratedRequest = await hydrateInteriorRequest(architectureHydrated);

  return NextResponse.json({
    success: true,
    request: hydratedRequest,
    quote: quote || null,
  });
}
