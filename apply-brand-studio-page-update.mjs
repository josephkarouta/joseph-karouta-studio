import fs from "node:fs";
import path from "node:path";

const relativePath = path.join("app", "(studio-routes)", "brand-studio", "page.tsx");
const target = path.resolve(process.cwd(), relativePath);

if (!fs.existsSync(target)) {
  console.error(`Could not find ${relativePath}. Run this script from the Heyy Studio project root.`);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");
let changes = 0;

function replaceOnce(label, before, after) {
  const index = source.indexOf(before);
  if (index === -1) {
    console.error(`Patch stopped: could not find current Brand Studio block: ${label}`);
    process.exit(1);
  }
  if (source.indexOf(before, index + before.length) !== -1) {
    console.error(`Patch stopped: Brand Studio block is not unique: ${label}`);
    process.exit(1);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
  changes += 1;
}

replaceOnce(
  "logo decision icon map",
`const DELIVERABLE_ICONS: Record<string, LucideIcon> = {
  strategy: WandSparkles,
  "creative-direction": Palette,
  logo: PenTool,
  guidelines: BookOpenCheck,
  "business-card": BriefcaseBusiness,
  letterhead: FileOutput,
  envelope: PackageCheck,
  "email-signature": BadgeCheck,
  presentation: LayoutTemplate,
  "social-system": Shapes,
  website: LayoutTemplate,
  packaging: PackageCheck,
  signage: Shapes,
  merchandise: Boxes,
};`,
`const DELIVERABLE_ICONS: Record<string, LucideIcon> = {
  strategy: WandSparkles,
  "creative-direction": Palette,
  logo: PenTool,
  guidelines: BookOpenCheck,
  "business-card": BriefcaseBusiness,
  letterhead: FileOutput,
  envelope: PackageCheck,
  "email-signature": BadgeCheck,
  presentation: LayoutTemplate,
  "social-system": Shapes,
  website: LayoutTemplate,
  packaging: PackageCheck,
  signage: Shapes,
  merchandise: Boxes,
};

const LOGO_DECISION_ICONS: Record<string, LucideIcon> = {
  create: Sparkles,
  refine: RefreshCw,
  keep: BadgeCheck,
  none: Focus,
};`
);

replaceOnce(
  "Brand generation response helpers",
`type SharedBrandContact = {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};`,
`type SharedBrandContact = {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

type BrandGenerationStatus = {
  success?: boolean;
  status?: "processing" | "succeeded" | "failed";
  jobId?: string;
  projectId?: string;
  brandSystem?: Record<string, unknown> | null;
  creditsUsed?: number;
  error?: string;
};

async function readBrandApiJson(
  response: Response,
  fallback: string,
): Promise<BrandGenerationStatus> {
  const text = await response.text();
  if (!text) {
    if (!response.ok) throw new Error(fallback);
    return {};
  }

  try {
    return JSON.parse(text) as BrandGenerationStatus;
  } catch {
    if (response.status === 504 || /inactivity timeout|<html/i.test(text)) {
      throw new Error("Brand Studio could not start the workspace request. Please try again.");
    }
    throw new Error(fallback);
  }
}

async function waitForBrandGeneration(jobId: string, accessToken: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
    }

    const response = await fetch(
      \`/api/brand-studio/generate/status?job=\${encodeURIComponent(jobId)}\`,
      {
        headers: { Authorization: \`Bearer \${accessToken}\` },
        cache: "no-store",
      },
    );
    const data = await readBrandApiJson(
      response,
      "Unable to check Brand Studio generation.",
    );

    if (!response.ok || data.success === false) {
      throw new Error(data.error || "Unable to check Brand Studio generation.");
    }
    if (data.status === "succeeded" && data.projectId && data.brandSystem) {
      return data;
    }
    if (data.status === "failed") {
      throw new Error(
        data.error || "Brand workspace generation failed. Your credits were returned.",
      );
    }
  }

  throw new Error(
    "Your Brand workspace is still being prepared. The generation job is safe; open your Dashboard shortly.",
  );
}`
);

replaceOnce(
  "server-created project guard",
`    let createdProjectId: string | null = null;

    try {`,
`    let createdProjectId: string | null = null;
    let serverCreatedProject = false;

    try {`
);

replaceOnce(
  "async Brand Blueprint start and polling",
`      let brandSystem: any = buildLocalBrandSystem(requestPayload);

      if (shouldGenerateBrandBlueprint(projectJourney)) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Your session expired. Sign in again.");
        const response = await fetch("/api/brand-studio/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: \`Bearer \${accessToken}\` },
          body: JSON.stringify(requestPayload),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to prepare the Brand Studio workspace.");
        }

        brandSystem = {
          ...data.brandSystem,
          projectJourney,
        };
      }

      const { data: savedProject, error: saveError } = await supabase
        .from("brand_projects")
        .insert({
          user_id: user.id,
          project_name: businessName.trim(),
          industry: finalIndustry.trim(),
          audience: finalAudience.trim(),
          style: finalStyle.trim(),
          description: description.trim(),
          brand_system_json: brandSystem,
        })
        .select("id")
        .single();

      if (saveError || !savedProject?.id) {
        throw saveError || new Error("The Brand Studio project could not be saved.");
      }

      createdProjectId = savedProject.id;

      const finalBrandSystem = await uploadExistingLogo(
        savedProject.id,
        brandSystem,
        preparedLogo,
      );
      if (finalBrandSystem !== brandSystem) {
        const { error: updateError } = await supabase
          .from("brand_projects")
          .update({ brand_system_json: finalBrandSystem })
          .eq("id", savedProject.id)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
      }

      setLoadingStep(activeLoadingSteps.length - 1);
      window.setTimeout(() => {
        window.location.href = \`/dashboard/brand/\${savedProject.id}\`;
      }, 500);`,
`      let brandSystem = buildLocalBrandSystem(requestPayload);

      if (shouldGenerateBrandBlueprint(projectJourney)) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("Your session expired. Sign in again.");

        const response = await fetch("/api/brand-studio/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: \`Bearer \${accessToken}\` },
          body: JSON.stringify(requestPayload),
        });
        const started = await readBrandApiJson(
          response,
          "Unable to start the Brand Studio workspace.",
        );

        if (!response.ok || !started.success || !started.jobId) {
          throw new Error(started.error || "Unable to start the Brand Studio workspace.");
        }

        const completed = await waitForBrandGeneration(started.jobId, accessToken);
        if (!completed.projectId || !completed.brandSystem) {
          throw new Error("Brand Studio completed without a saved workspace.");
        }

        brandSystem = {
          ...completed.brandSystem,
          projectJourney,
        };
        createdProjectId = completed.projectId;
        serverCreatedProject = true;
      }

      if (!createdProjectId) {
        const { data: savedProject, error: saveError } = await supabase
          .from("brand_projects")
          .insert({
            user_id: user.id,
            project_name: businessName.trim(),
            industry: finalIndustry.trim(),
            audience: finalAudience.trim(),
            style: finalStyle.trim(),
            description: description.trim(),
            brand_system_json: brandSystem,
          })
          .select("id")
          .single();

        if (saveError || !savedProject?.id) {
          throw saveError || new Error("The Brand Studio project could not be saved.");
        }
        createdProjectId = savedProject.id;
      }

      const savedProjectId = createdProjectId;
      if (!savedProjectId) {
        throw new Error("The Brand Studio project could not be saved.");
      }

      const finalBrandSystem = await uploadExistingLogo(
        savedProjectId,
        brandSystem,
        preparedLogo,
      );
      if (finalBrandSystem !== brandSystem) {
        const { error: updateError } = await supabase
          .from("brand_projects")
          .update({ brand_system_json: finalBrandSystem })
          .eq("id", savedProjectId)
          .eq("user_id", user.id);
        if (updateError) throw updateError;
      }

      setLoadingStep(activeLoadingSteps.length - 1);
      window.setTimeout(() => {
        window.location.href = \`/dashboard/brand/\${savedProjectId}\`;
      }, 500);`
);

replaceOnce(
  "do not delete a completed background project",
`      if (createdProjectId && user?.id) {
        await supabase
          .from("brand_projects")
          .delete()
          .eq("id", createdProjectId)
          .eq("user_id", user.id);
      }`,
`      if (createdProjectId && user?.id && !serverCreatedProject) {
        await supabase
          .from("brand_projects")
          .delete()
          .eq("id", createdProjectId)
          .eq("user_id", user.id);
      }`
);

replaceOnce(
  "dark mode theme panel styles",
`        .brand-studio-v13 .border-violet-200 { border-color:rgba(190,89,235,.30) !important; }
        .brand-studio-v13 .bg-violet-50\\/50 { background:var(--brand-soft) !important; }
        [data-theme="dark"] .brand-studio-v13 .bg-violet-50, [data-theme="dark"] .brand-studio-v13 .bg-violet-100 { background:rgba(190,89,235,.13) !important; }`,
`        .brand-studio-v13 .border-violet-200 { border-color:rgba(190,89,235,.30) !important; }
        .brand-studio-v13 .bg-violet-50\\/50 { background:var(--brand-soft) !important; }
        .brand-soft-panel,
        .brand-selection-summary {
          border-color:rgba(190,89,235,.30) !important;
          background:linear-gradient(135deg,rgba(161,61,240,.10),var(--surface-strong)) !important;
          color:var(--text-primary) !important;
        }
        .brand-soft-eyebrow,
        .brand-selection-pill { color:var(--brand-accent-strong) !important; }
        .brand-soft-copy { color:var(--text-secondary) !important; }
        .brand-soft-panel label { color:var(--text-secondary) !important; }
        .brand-selection-pill {
          border-color:rgba(190,89,235,.30) !important;
          background:var(--surface) !important;
        }
        [data-theme="dark"] .brand-soft-panel,
        [data-theme="dark"] .brand-selection-summary {
          border-color:rgba(200,140,255,.34) !important;
          background:linear-gradient(135deg,rgba(161,61,240,.20),var(--surface-strong)) !important;
        }
        [data-theme="dark"] .brand-studio-v13 .bg-violet-50, [data-theme="dark"] .brand-studio-v13 .bg-violet-100 { background:rgba(190,89,235,.13) !important; }`
);

replaceOnce(
  "Shared Application Details dark mode",
`              <div className="rounded-[20px] border border-violet-200 bg-violet-50/50 p-4 sm:p-5">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">Shared application details</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">Add these once. Heyy Studio will automatically prefill matching Business Card, Letterhead, Envelope and Email Signature fields without overwriting your manual edits.</p>`,
`              <div className="brand-soft-panel rounded-[20px] border p-4 sm:p-5">
                <div>
                  <p className="brand-soft-eyebrow text-[8px] font-black uppercase tracking-[0.16em]">Shared application details</p>
                  <p className="brand-soft-copy mt-1 text-xs font-semibold leading-5">Add these once. Heyy Studio will automatically prefill matching Business Card, Letterhead, Envelope and Email Signature fields without overwriting your manual edits.</p>`
);

replaceOnce(
  "Current Identity selectable cards",
`                    {visibleLogoDecisions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLogoAction(item.id)}
                        data-selected={logoAction === item.id ? "true" : "false"}
                        className="brand-choice rounded-[18px] border border-slate-200 bg-white p-4 text-left transition hover:border-violet-400"
                      >
                        <p className="text-sm font-black text-slate-950">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
                      </button>
                    ))}`,
`                    {visibleLogoDecisions.map((item) => {
                      const selected = logoAction === item.id;
                      const Icon = LOGO_DECISION_ICONS[item.id] || Focus;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setLogoAction(item.id)}
                          data-selected={selected ? "true" : "false"}
                          className="brand-choice group min-h-[104px] rounded-[18px] border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5"
                        >
                          <div className="flex items-start gap-4">
                            <span className="brand-choice-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                              <Icon size={20} strokeWidth={2.1} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-black text-slate-950">{item.label}</p>
                                {selected && <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white"><Check size={14} strokeWidth={3} /></span>}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}`
);

replaceOnce(
  "Project Scope card hover/icon treatment",
`                      className="brand-choice flex min-h-[78px] items-center gap-3 rounded-[17px] border border-slate-200 bg-white p-3 text-left transition"
                    >
                      <span className="brand-choice-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-slate-100 text-slate-600">
                        <Icon size={18} strokeWidth={2.1} />
                      </span>`,
`                      className="brand-choice group flex min-h-[78px] items-center gap-3 rounded-[17px] border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5"
                    >
                      <span className="brand-choice-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-violet-100 text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">
                        <Icon size={20} strokeWidth={2.1} />
                      </span>`
);

replaceOnce(
  "Selected Scope dark mode",
`                <div className="rounded-[18px] border border-violet-200 bg-violet-50/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.15em] text-violet-600">Selected scope</p>
                      <p className="mt-1 text-sm font-black text-slate-950">{dynamicSummary.length} deliverable{dynamicSummary.length === 1 ? "" : "s"} will be created inside one connected project.</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-violet-600 text-white"><PackageCheck size={18} /></span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dynamicSummary.map((item) => (
                      <span key={item!.id} className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-black text-violet-700">{item!.label}</span>
                    ))}
                  </div>
                </div>`,
`                <div className="brand-selection-summary rounded-[18px] border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="brand-soft-eyebrow text-[8px] font-black uppercase tracking-[0.15em]">Selected scope</p>
                      <p className="brand-soft-copy mt-1 text-sm font-black">{dynamicSummary.length} deliverable{dynamicSummary.length === 1 ? "" : "s"} will be created inside one connected project.</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-violet-600 text-white"><PackageCheck size={18} /></span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dynamicSummary.map((item) => (
                      <span key={item!.id} className="brand-selection-pill rounded-full border px-3 py-1.5 text-[10px] font-black">{item!.label}</span>
                    ))}
                  </div>
                </div>`
);

fs.writeFileSync(target, source, "utf8");
console.log(`Updated ${relativePath} successfully (${changes} controlled replacements).`);
