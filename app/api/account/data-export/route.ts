import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import { accountExportSnapshot, listAccountProjects } from "@/lib/account/project-data";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "account";
}

export async function POST(request: Request) {
  try {
    const { user, admin, client } = await requireApiUser(request);
    const [tables, projects] = await Promise.all([
      accountExportSnapshot(admin, user.id),
      listAccountProjects(client, user.id, admin),
    ]);

    const requestedAt = new Date().toISOString();
    const payload = {
      exportVersion: 1,
      generatedAt: requestedAt,
      account: {
        id: user.id,
        email: user.email || null,
        createdAt: user.created_at || null,
        lastSignInAt: user.last_sign_in_at || null,
        metadata: user.user_metadata || {},
      },
      projects,
      data: tables,
      note:
        "This export contains the account and workspace data currently available to Heyy Studio. Large binary files are represented by their saved asset metadata/paths rather than embedded directly in this JSON file.",
    };

    await admin.from("account_data_requests").insert({
      user_id: user.id,
      request_type: "export",
      status: "completed",
      metadata: {
        generated_at: requestedAt,
        format: "json",
        project_count: projects.length,
      },
      completed_at: requestedAt,
    });

    const name = safeFilename(
      String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "account"),
    );
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="heyy-studio-${name}-data-export.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Data export could not be prepared." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
