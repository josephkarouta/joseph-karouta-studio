import "server-only";

import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readPayload(asset: any) {
  const payload = asset?.output_payload || asset?.payload || {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return payload && typeof payload === "object" ? payload : {};
}

function assetImages(asset: any) {
  const output = readPayload(asset);
  const images: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim() && !images.includes(value.trim())) {
      images.push(value.trim());
    }
  };

  add(asset?.file_url);
  add(asset?.thumbnail_url);
  add(output?.imageUrl);
  add(output?.image_url);
  output?.moodboards?.forEach((item: any) => add(item?.imageUrl || item?.image_url));
  output?.directions?.forEach((item: any) => add(item?.imageUrl || item?.image_url));
  output?.variations?.forEach((item: any) => add(item?.imageUrl || item?.image_url));
  output?.logos?.forEach((item: any) => add(item?.imageUrl || item?.image_url));
  output?.conceptsByDirection?.forEach((item: any) =>
    add(item?.imageUrl || item?.image_url),
  );
  output?.outputs?.forEach((item: any) =>
    add(item?.imageUrl || item?.image_url),
  );

  return images;
}

function safeFilename(value: unknown) {
  return String(value || "heyy-studio-asset")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "heyy-studio-asset";
}

function extensionFor(contentType: string, sourceUrl: string) {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("svg")) return "svg";
  if (type.includes("pdf")) return "pdf";
  let pathname = sourceUrl;
  try {
    pathname = new URL(sourceUrl).pathname;
  } catch {
    pathname = sourceUrl.split("?")[0];
  }
  const match = pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match?.[1]?.toLowerCase() || "bin";
}

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const url = new URL(request.url);
    const assetId = String(url.searchParams.get("assetId") || "").trim();
    const index = Number.parseInt(url.searchParams.get("index") || "0", 10);

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID is required." }, { status: 400 });
    }

    const { data: asset, error } = await admin
      .from("project_assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const images = assetImages(asset);
    const sourceUrl = images[Number.isFinite(index) ? index : 0];
    if (!sourceUrl) {
      return NextResponse.json(
        { error: "This asset does not have a downloadable image." },
        { status: 404 },
      );
    }

    const source = await fetch(sourceUrl, { cache: "no-store" });
    if (!source.ok) {
      return NextResponse.json(
        { error: "The asset file could not be retrieved." },
        { status: 502 },
      );
    }

    const contentType = source.headers.get("content-type") || "application/octet-stream";
    const extension = extensionFor(contentType, sourceUrl);
    const filename = `${safeFilename(asset.title)}-${index + 1}.${extension}`;
    const buffer = await source.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Asset download error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The asset could not be downloaded.",
      },
      { status: 500 },
    );
  }
}
