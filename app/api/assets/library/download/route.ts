import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { resolveLibrarySource } from "@/lib/assets/library";
import { getWorkspaceStorageEntitlement, storageAccessError } from "@/lib/workspace-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(value: unknown) {
  return String(value || "heyy-studio-asset")
    .trim()
    .replace(/[\\/\r\n]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 140) || "heyy-studio-asset";
}

function extension(contentType: string, ...sources: Array<string | null | undefined>) {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("svg")) return "svg";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("zip")) return "zip";
  if (type.includes("mp4")) return "mp4";
  if (type.includes("mov")) return "mov";
  if (type.includes("json")) return "json";

  for (const source of sources) {
    const clean = String(source || "").split("?")[0];
    const match = clean.match(/\.([a-zA-Z0-9]{2,8})$/);
    if (match?.[1]) return match[1].toLowerCase();
  }

  return "bin";
}

export async function GET(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const entitlement = await getWorkspaceStorageEntitlement(admin, user.id);
    if (!entitlement.canDownload) {
      return NextResponse.json({ error: storageAccessError(entitlement) }, { status: 403 });
    }
    const sourceKey = new URL(request.url).searchParams.get("sourceKey")?.trim() || "";
    if (!sourceKey) return NextResponse.json({ error: "Asset is required." }, { status: 400 });

    const source = await resolveLibrarySource(admin, user.id, sourceKey);
    if (!source) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

    let sourceUrl = source.url;
    if (source.storageBucket && source.storagePath) {
      const { data, error } = await admin.storage.from(source.storageBucket).createSignedUrl(source.storagePath, 60 * 5);
      if (error || !data?.signedUrl) throw error || new Error("Could not create the secure file link.");
      sourceUrl = data.signedUrl;
    }

    if (!sourceUrl) return NextResponse.json({ error: "This asset does not have a downloadable file." }, { status: 404 });
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) throw new Error("The asset file could not be retrieved.");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const headerFilename = response.headers.get("content-disposition") || "";
    const responseFilename = headerFilename.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)?.[1] || "";
    const ext = extension(contentType, responseFilename, source.storagePath, sourceUrl, source.title);
    const baseName = safeFilename(source.title).replace(/\.[a-zA-Z0-9]{2,8}$/g, "") || "heyy-studio-asset";
    const filename = `${baseName}.${ext}`;
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Assets library download error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not download this asset." }, { status: 500 });
  }
}
