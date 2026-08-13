import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function findExisting(candidates, label) {
  for (const candidate of candidates) {
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) return full;
  }
  throw new Error(`${label} was not found. Expected one of:\n${candidates.map((item) => `- ${item}`).join("\n")}`);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Could not find ${label} start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Could not find ${label} end marker: ${endMarker}`);
  return `${source.slice(0, start)}${replacement}\n\n${source.slice(end)}`;
}

function injectBefore(source, marker, block, id) {
  if (source.includes(id)) return source;
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Could not find helper insertion marker: ${marker}`);
  return `${source.slice(0, index)}${block}\n\n${source.slice(index)}`;
}

const asyncHelpers = `// HEYY_STUDIO_ASYNC_INTERIOR_MARKETING_V1
async function readStudioAsyncPayload(response: Response, fallback: string): Promise<any> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) throw new Error(fallback);
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    if (response.status === 504 || /inactivity timeout|<!doctype|<html|<head|<body/i.test(text)) {
      throw new Error("Heyy Studio could not start the background generation request. Please try again.");
    }
    throw new Error(fallback);
  }
}

async function waitForStudioAsyncJob(
  studio: "interior" | "marketing",
  kind: "concept" | "image",
  jobId: string,
  accessToken: string,
): Promise<any> {
  if (!jobId) throw new Error("The generation job could not be started.");
  const statusPath = kind === "image"
    ? \`/api/studios/\${studio}/images/status?job=\${encodeURIComponent(jobId)}\`
    : \`/api/studios/\${studio}/status?job=\${encodeURIComponent(jobId)}\`;

  for (let attempt = 0; attempt < 360; attempt += 1) {
    if (attempt > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));
    const response = await fetch(statusPath, {
      headers: { Authorization: \`Bearer \${accessToken}\` },
      cache: "no-store",
    });
    const payload = await readStudioAsyncPayload(response, "Unable to check generation status.");
    if (!response.ok || payload.success === false) throw new Error(payload.error || "Unable to check generation status.");
    if (payload.status === "failed") throw new Error(payload.error || "Generation failed. Your credits were returned.");
    if (payload.status === "succeeded") return payload;
  }

  throw new Error("Generation is still processing safely in the background. Refresh this project shortly to load the completed result.");
}`;

function patchInterior(file) {
  let source = fs.readFileSync(file, "utf8");
  source = injectBefore(source, "export default function InteriorStudioWorkspace()", asyncHelpers, "HEYY_STUDIO_ASYNC_INTERIOR_MARKETING_V1");

  const concept = `  async function generateConcept() {
    const missing = allFields.filter((field) => field.required && isEmpty(form[field.id]));
    if (missing.length) {
      setError(\`Complete \${missing.map((field) => field.label.toLowerCase()).join(", ")} before generating.\`);
      setStep(Math.max(0, activeSteps.findIndex((section) => section.fields.some((field) => missing.some((item) => item.id === field.id)))));
      return;
    }
    if (form.architectureSource === "Use an existing Architecture project" && !String(form.architectureProjectId || "")) {
      setError("Choose the Architecture project this interior should follow.");
      setStep(0);
      return;
    }

    setGeneratingConcept(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/studios/interior/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ input: { ...form, workMode }, projectId: project?.id || null }),
      });
      const started = await readStudioAsyncPayload(response, "Interior project generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Interior project generation could not start.");
      const data = started.status === "succeeded"
        ? started
        : await waitForStudioAsyncJob("interior", "concept", String(started.jobId || ""), token);

      const nextProject = data.project as ProjectRecord;
      const nextResult = data.output as ResultData;
      if (!nextProject?.id || !nextResult) throw new Error("Interior project generation finished without a saved project.");
      setResult(nextResult);
      setProject(nextProject);
      setStep(activeSteps.length);
      setActiveTab("overview");
      await refreshAccount();
      rememberInteriorWorkspaceTab(nextProject.id, "overview");
      const url = new URL(window.location.href);
      url.searchParams.set("project", nextProject.id);
      url.searchParams.set("tab", "overview");
      window.history.replaceState({}, "", url);
      await loadAssets(nextProject.id);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Generation failed.");
    } finally {
      setGeneratingConcept(false);
    }
  }`;

  const image = `  async function generateImage(viewType: InteriorImageType, stage: GenerationStage) {
    if (!project?.id || !result) {
      setError("Generate the interior concept first.");
      return;
    }
    setGeneratingImage({ viewType, stage });
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/studios/interior/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ projectId: project.id, viewType, stage }),
      });
      const started = await readStudioAsyncPayload(response, "Interior image generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Interior image generation could not start.");
      if (started.status !== "succeeded") {
        await waitForStudioAsyncJob("interior", "image", String(started.jobId || ""), token);
      }

      await Promise.all([loadAssets(project.id), refreshAccount()]);
      selectWorkspaceTab(viewType.endsWith("_plan") ? "plans" : "visuals");
    } catch (visualError) {
      setError(visualError instanceof Error ? visualError.message : "Image generation failed.");
    } finally {
      setGeneratingImage(null);
    }
  }`;

  source = replaceRange(source, "  async function generateConcept() {", "  async function generateImage(", concept, "Interior generateConcept");
  source = replaceRange(source, "  async function generateImage(", "  async function approveAsset(", image, "Interior generateImage");
  source = source.replace(
    'detail="Keep this page open. Reserved credits are automatically returned if generation fails."',
    'detail="Generation continues safely in the background if you leave this page. Reserved credits are automatically returned if generation fails."',
  );
  fs.writeFileSync(file, source);
}

function patchMarketing(file) {
  let source = fs.readFileSync(file, "utf8");
  source = injectBefore(source, "export default function MarketingStudioWorkspace()", asyncHelpers, "HEYY_STUDIO_ASYNC_INTERIOR_MARKETING_V1");

  const concept = `  async function generateConcept() {
    const missing = allFields.filter((field) => field.required && isEmpty(form[field.id]));
    if (missing.length) {
      setError(\`Complete \${missing.map((field) => field.label.toLowerCase()).join(", ")} before generating.\`);
      const missingStep = activeSteps.findIndex((section) => section.fields.some((field) => missing.some((item) => item.id === field.id)));
      setStep(Math.max(0, missingStep));
      return;
    }
    if (form.brandSource === "Use an existing Heyy Studio brand" && !String(form.brandProjectId || "")) {
      setError("Choose the saved Brand System you want this campaign to use.");
      setStep(0);
      return;
    }

    setGeneratingConcept(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studios/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ input: { ...form, workMode }, projectId: project?.id || null }),
      });
      const started = await readStudioAsyncPayload(response, "Campaign generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Campaign generation could not start.");
      const data = started.status === "succeeded"
        ? started
        : await waitForStudioAsyncJob("marketing", "concept", String(started.jobId || ""), token);
      const savedProject = data.project as ProjectRecord;
      const savedOutput = data.output as ResultData;
      if (!savedProject?.id || !savedOutput) throw new Error("Campaign generation finished without a saved project.");
      setProject(savedProject);
      setResult(savedOutput);
      setStep(activeSteps.length);
      setActiveTab("overview");
      await Promise.all([loadAssets(String(savedProject.id)), refreshAccount()]);
      const url = new URL(window.location.href);
      url.searchParams.set("project", String(savedProject.id));
      url.searchParams.set("tab", "overview");
      window.history.replaceState({}, "", url);
      rememberMarketingWorkspaceTab(String(savedProject.id), "overview");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Campaign generation failed.");
    } finally {
      setGeneratingConcept(false);
    }
  }`;

  const visual = `  async function generateVisual(viewType: MarketingVisualType, stage: GenerationStage, tweak = "") {
    if (!project?.id) return;
    setGeneratingVisual({ viewType, stage });
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/studios/marketing/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({ projectId: project.id, viewType, stage, tweak: tweak.trim() || null }),
      });
      const started = await readStudioAsyncPayload(response, "Campaign visual generation could not start.");
      if (!response.ok || started.success === false) throw new Error(started.error || "Campaign visual generation could not start.");
      if (started.status !== "succeeded") {
        await waitForStudioAsyncJob("marketing", "image", String(started.jobId || ""), token);
      }
      await Promise.all([loadAssets(project.id), refreshAccount()]);
      selectWorkspaceTab("visuals");
    } catch (visualError) {
      setError(visualError instanceof Error ? visualError.message : "Campaign visual generation failed.");
    } finally {
      setGeneratingVisual(null);
    }
  }`;

  source = replaceRange(source, "  async function generateConcept() {", "  async function generateVisual(", concept, "Marketing generateConcept");
  source = replaceRange(source, "  async function generateVisual(", "  async function saveOutputPatch(", visual, "Marketing generateVisual");
  source = source.replace(
    'detail="Keep this page open. Credits are refunded automatically if generation fails."',
    'detail="Generation continues safely in the background if you leave this page. Credits are refunded automatically if generation fails."',
  );
  fs.writeFileSync(file, source);
}

const interior = findExisting([
  "components/studio/interior/InteriorStudioWorkspace.tsx",
  "components/studio/InteriorStudioWorkspace.tsx",
], "InteriorStudioWorkspace.tsx");
const marketing = findExisting([
  "components/studio/marketing/MarketingStudioWorkspace.tsx",
  "components/studio/MarketingStudioWorkspace.tsx",
], "MarketingStudioWorkspace.tsx");

patchInterior(interior);
patchMarketing(marketing);

console.log("Patched Interior + Marketing workspaces for durable async generation:");
console.log(`- ${path.relative(root, interior)}`);
console.log(`- ${path.relative(root, marketing)}`);
