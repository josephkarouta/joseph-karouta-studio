import { NextResponse } from "next/server";
import { ApiAuthError, requireApiUser } from "@/lib/server/auth";
import {
  deleteAccountProject,
  listAccountProjects,
  type AccountProject,
} from "@/lib/account/project-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, admin, client } = await requireApiUser(request);
    const projects = await listAccountProjects(client, user.id, admin);
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project data could not be loaded." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, admin, client } = await requireApiUser(request);
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string;
      sourceTable?: AccountProject["sourceTable"];
      confirmation?: string;
    };
    const projectId = String(body.projectId || "").trim();
    const sourceTable = body.sourceTable;
    if (!projectId || !sourceTable) {
      return NextResponse.json({ error: "Project ID and source are required." }, { status: 400 });
    }
    if (String(body.confirmation || "").trim() !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm project removal." }, { status: 400 });
    }

    const project = await deleteAccountProject({
      admin,
      userId: user.id,
      projectId,
      sourceTable,
      readClient: client,
    });

    return NextResponse.json({ success: true, deletedProject: project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Project data could not be deleted." },
      { status: error instanceof ApiAuthError ? error.status : 500 },
    );
  }
}
