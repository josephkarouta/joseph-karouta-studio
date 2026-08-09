import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function safeOwnedPath(userId: string, value: unknown) {
  const path = String(value || "").trim();
  if (!path || !path.startsWith(`${userId}/`)) return null;
  return path;
}

export async function POST(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a profile image." }, { status: 400 });
    }

    const extension = MIME_TO_EXTENSION[file.type];
    if (!extension) {
      return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Profile images must be 5 MB or smaller." }, { status: 400 });
    }

    const storagePath = `${user.id}/avatar-${Date.now()}-${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("profile-avatars")
      .upload(storagePath, bytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = admin.storage.from("profile-avatars").getPublicUrl(storagePath);

    // Do not call admin.auth.updateUserById here. The signed-in browser updates
    // its own Auth metadata after this upload succeeds, which avoids an extra
    // Auth-server round trip and immediately refreshes the local session.
    return NextResponse.json({
      success: true,
      avatarUrl: publicData.publicUrl,
      storagePath,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile image could not be updated." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, admin } = await requireApiUser(request);
    const body = (await request.json().catch(() => ({}))) as { path?: string };
    const path = safeOwnedPath(user.id, body.path);

    if (!path) {
      return NextResponse.json({ error: "A valid profile image path is required." }, { status: 400 });
    }

    const { error } = await admin.storage.from("profile-avatars").remove([path]);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile image could not be removed." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
