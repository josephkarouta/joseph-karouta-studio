import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountProject = {
  id: string;
  name: string;
  studio: "brand" | "architecture" | "interior" | "marketing";
  sourceTable: "brand_projects" | "architecture_projects" | "studio_projects";
  status: string;
  updatedAt: string | null;
  hasProductionHistory: boolean;
  canDelete: boolean;
};

type Row = Record<string, any>;

function ignoreMissing(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

async function rowsForUser(admin: SupabaseClient, table: string, userId: string) {
  const { data, error } = await admin.from(table).select("*").eq("user_id", userId);
  if (error) {
    if (ignoreMissing(error)) return [] as Row[];
    throw error;
  }
  return (data || []) as Row[];
}

type ProductionOverview = {
  hasHistory: boolean;
  status: string | null;
};

function rowTime(row: Row | null | undefined) {
  const value = row?.updated_at || row?.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function requestStatusLabel(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  if (value.includes("paid") || value.includes("converted")) return "Payment confirmed";
  if (value.includes("quote") && (value.includes("sent") || value.includes("ready"))) return "Awaiting payment";
  if (value.includes("review") || value.includes("sourc") || value.includes("request")) return "Production requested";
  return "Production requested";
}

function jobStatusLabel(job: Row) {
  const combined = `${job.status || ""} ${job.delivery_status || ""}`.toLowerCase();
  if (job.client_approved_at || combined.includes("client approved") || combined.includes("completed") || combined.includes("delivered")) {
    return "Production completed";
  }
  if (combined.includes("review") || combined.includes("ready for review") || combined.includes("submitted")) {
    return "Client review";
  }
  if (combined.includes("progress") || combined.includes("started") || combined.includes("assigned") || combined.includes("active")) {
    return "In production";
  }
  return "Production active";
}

async function productionOverviewForUser(admin: SupabaseClient, userId: string) {
  const [jobsResult, requestsResult, quotesResult] = await Promise.all([
    admin
      .from("production_jobs")
      .select("project_id,status,delivery_status,client_approved_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("studio_requests")
      .select("project_id,status,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("workspace_quotes")
      .select("project_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const safeRows = (result: any) => {
    if (result.error) {
      if (ignoreMissing(result.error)) return [] as Row[];
      console.warn("Project production overview lookup failed:", result.error.message);
      return [] as Row[];
    }
    return (result.data || []) as Row[];
  };

  const jobs = safeRows(jobsResult);
  const requests = safeRows(requestsResult);
  const quotes = safeRows(quotesResult);
  const projectIds = new Set<string>();
  for (const row of [...jobs, ...requests, ...quotes]) {
    if (row.project_id) projectIds.add(String(row.project_id));
  }

  const overview = new Map<string, ProductionOverview>();
  for (const projectId of projectIds) {
    const latestJob = jobs.find((row) => String(row.project_id || "") === projectId) || null;
    const latestRequest = requests.find((row) => String(row.project_id || "") === projectId) || null;
    const requestIsNewer = Boolean(latestRequest && rowTime(latestRequest) > rowTime(latestJob));

    let status: string | null = null;
    if (requestIsNewer) status = requestStatusLabel(latestRequest?.status);
    else if (latestJob) status = jobStatusLabel(latestJob);
    else if (latestRequest) status = requestStatusLabel(latestRequest.status);

    overview.set(projectId, { hasHistory: true, status });
  }

  return overview;
}

export async function listAccountProjects(
  readClient: SupabaseClient,
  userId: string,
  productionClient: SupabaseClient = readClient,
) {
  const [brands, architecture, generic] = await Promise.all([
    rowsForUser(readClient, "brand_projects", userId),
    rowsForUser(readClient, "architecture_projects", userId),
    rowsForUser(readClient, "studio_projects", userId),
  ]);

  const base: Omit<AccountProject, "hasProductionHistory" | "canDelete">[] = [
    ...brands.map((row) => ({
      id: String(row.id),
      name: String(row.business_name || row.project_name || row.name || "Untitled brand"),
      studio: "brand" as const,
      sourceTable: "brand_projects" as const,
      status: String(row.status || "Active"),
      updatedAt: row.updated_at || row.created_at || null,
    })),
    ...architecture.map((row) => ({
      id: String(row.id),
      name: String(row.project_name || row.name || "Untitled architecture project"),
      studio: "architecture" as const,
      sourceTable: "architecture_projects" as const,
      status: String(row.status || row.current_stage || "Active"),
      updatedAt: row.updated_at || row.created_at || null,
    })),
    ...generic
      .filter((row) => row.studio === "interior_studio" || row.studio === "marketing_studio")
      .map((row) => ({
        id: String(row.id),
        name: String(row.project_name || row.name || "Untitled project"),
        studio: row.studio === "marketing_studio" ? ("marketing" as const) : ("interior" as const),
        sourceTable: "studio_projects" as const,
        status: String(row.status || "Active"),
        updatedAt: row.updated_at || row.created_at || null,
      })),
  ];

  const productionOverview = await productionOverviewForUser(productionClient, userId);

  return base
    .map((project) => {
      const production = productionOverview.get(project.id);
      const hasProductionHistory = Boolean(production?.hasHistory);
      return {
        ...project,
        status: production?.status || project.status,
        hasProductionHistory,
        canDelete: !hasProductionHistory,
      };
    })
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
}

async function removeStorageTree(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
) {
  const paths: string[] = [];

  async function walk(path: string) {
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(path, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("bucket") || message.includes("not found")) return;
        throw error;
      }
      const items = data || [];
      if (!items.length) break;
      for (const item of items) {
        const child = path ? `${path}/${item.name}` : item.name;
        if (item.id) paths.push(child);
        else await walk(child);
      }
      if (items.length < 100) break;
      offset += items.length;
    }
  }

  await walk(prefix);
  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);
    if (chunk.length) {
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) throw error;
    }
  }
}

async function deleteWhereProjectId(
  admin: SupabaseClient,
  table: string,
  projectId: string,
) {
  const { error } = await admin.from(table).delete().eq("project_id", projectId);
  if (error && !ignoreMissing(error)) throw error;
}

export async function deleteAccountProject(args: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  sourceTable: AccountProject["sourceTable"];
  readClient?: SupabaseClient;
}) {
  const projects = await listAccountProjects(
    args.readClient || args.admin,
    args.userId,
    args.admin,
  );
  const project = projects.find(
    (item) => item.id === args.projectId && item.sourceTable === args.sourceTable,
  );
  if (!project) throw new Error("Project not found or you no longer have access to it.");
  if (project.hasProductionHistory) {
    throw new Error(
      "This project has quote or production history. It cannot be removed through self-service because the paid production record and delivered files must remain auditable.",
    );
  }

  await Promise.all([
    removeStorageTree(args.admin, "project-assets", `${args.userId}/${args.projectId}`),
    removeStorageTree(args.admin, "architecture-files", `${args.userId}/${args.projectId}`),
  ]);

  // Shared asset/history rows.
  await deleteWhereProjectId(args.admin, "project_assets", args.projectId);
  await deleteWhereProjectId(args.admin, "project_version_history", args.projectId);
  await deleteWhereProjectId(args.admin, "project_activities", args.projectId);
  await deleteWhereProjectId(args.admin, "project_messages", args.projectId);
  await deleteWhereProjectId(args.admin, "project_settings", args.projectId);

  if (project.studio === "architecture") {
    for (const table of [
      "architecture_design_packs",
      "architecture_plan_sets",
      "architecture_visuals",
      "architecture_concepts",
      "architecture_directions",
      "architecture_materials",
      "architecture_planning",
      "architecture_space_programs",
      "architecture_sites",
      "architecture_documents",
    ]) {
      await deleteWhereProjectId(args.admin, table, args.projectId);
    }
  }

  const { error } = await args.admin
    .from(args.sourceTable)
    .delete()
    .eq("id", args.projectId)
    .eq("user_id", args.userId);
  if (error) throw error;

  return project;
}
