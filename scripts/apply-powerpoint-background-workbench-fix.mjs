import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const relative = path.join("components", "tools", "PowerPointWorkbench.tsx");
const target = path.join(root, relative);

if (!fs.existsSync(target)) {
  console.error(`Fix stopped: ${relative} was not found.`);
  process.exit(1);
}

let source = fs.readFileSync(target, "utf8");
const original = source;

function replaceOnce(search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) {
    console.error(`Fix stopped: could not find ${label}. No partial file was written.`);
    process.exit(1);
  }
  if (source.indexOf(search, index + search.length) >= 0) {
    console.error(`Fix stopped: ${label} matched more than once. No partial file was written.`);
    process.exit(1);
  }
  source = source.slice(0, index) + replacement + source.slice(index + search.length);
}

if (!source.includes('import { useEffect, useMemo, useRef, useState } from "react";')) {
  replaceOnce(
    'import { useMemo, useRef, useState } from "react";',
    'import { useEffect, useMemo, useRef, useState } from "react";',
    "React hooks import",
  );
}

if (!source.includes("const POLL_INTERVAL_MS = 4000;")) {
  replaceOnce(
    'const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "jfif", "webp", "svg"]);',
    'const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "jfif", "webp", "svg"]);\nconst POLL_INTERVAL_MS = 4000;\nconst MAX_POLL_ATTEMPTS = 225;',
    "PowerPoint constants",
  );
}

if (!source.includes('const [jobId, setJobId] = useState("");')) {
  replaceOnce(
    '  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState("");',
    '  const [loading, setLoading] = useState(false);\n  const [jobId, setJobId] = useState("");\n  const [statusText, setStatusText] = useState("");\n  const [error, setError] = useState("");',
    "PowerPoint job state",
  );
}

const oldGenerate = `  async function generate() {
    if (!title.trim() || !objective.trim() || (source.trim().length < 10 && attachments.length === 0)) {
      setError("Add a title, objective and either source notes or at least one attachment.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const requestPayload = {
        title,
        audience,
        objective,
        source,
        slideCount: slides,
        tone,
        visualStyle,
        attachments: attachments.map((file) => ({ name: file.name, size: file.size, modified: file.lastModified })),
        logoAttachmentName,
      };
      const form = new FormData();
      form.set("title", title);
      form.set("audience", audience);
      form.set("objective", objective);
      form.set("source", source);
      form.set("slideCount", String(slides));
      form.set("tone", tone);
      form.set("visualStyle", visualStyle);
      if (logoAttachmentName) form.set("logoAttachmentName", logoAttachmentName);
      attachments.forEach((file) => form.append("attachments", file, file.name));

      const response = await generationFetch("/api/tools/powerpoint-generator/generate", {
        method: "POST",
        headers: { Authorization: \`Bearer \${token}\` },
        body: form,
      }, {
        scope: "powerpoint-generator",
        payload: requestPayload,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Presentation generation failed.");

      setResult(payload);
      setActiveSlide(0);
      await refreshAccount();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Presentation generation failed.");
    } finally {
      setLoading(false);
    }
  }
`;

const newGenerate = `  useEffect(() => {
    if (!jobId || !loading) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your session expired. Sign in again.");

        for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !cancelled; attempt += 1) {
          const response = await fetch(\`/api/tools/powerpoint-generator/status?jobId=\${encodeURIComponent(jobId)}\`, {
            headers: { Authorization: \`Bearer \${token}\` },
            cache: "no-store",
          });
          const payload = await readApiPayload(response);

          if (!response.ok) {
            throw new Error(publicApiMessage(payload, "Presentation status could not be loaded."));
          }
          if (payload?.status === "succeeded" && payload?.result) {
            setResult(payload.result as Result);
            setActiveSlide(0);
            setLoading(false);
            setJobId("");
            setStatusText("");
            await refreshAccount();
            return;
          }
          if (payload?.status === "failed" || payload?.status === "cancelled") {
            throw new Error(publicApiMessage(payload, "Presentation generation could not be completed. Your credits were returned."));
          }

          setStatusText(attempt < 3 ? "Starting your presentation…" : "Researching, designing and building your presentation…");
          await sleep(POLL_INTERVAL_MS);
        }

        if (!cancelled) {
          setLoading(false);
          setStatusText("");
          setError("Your presentation is still being prepared in the background. Check Generation Activity shortly for the result.");
        }
      } catch (generationError) {
        if (cancelled) return;
        setLoading(false);
        setJobId("");
        setStatusText("");
        setError(generationError instanceof Error ? generationError.message : "Presentation generation could not be completed.");
        await refreshAccount();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, loading, refreshAccount, supabase]);

  async function generate() {
    if (!title.trim() || !objective.trim() || (source.trim().length < 10 && attachments.length === 0)) {
      setError("Add a title, objective and either source notes or at least one attachment.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setStatusText("Preparing your presentation…");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const requestPayload = {
        title,
        audience,
        objective,
        source,
        slideCount: slides,
        tone,
        visualStyle,
        attachments: attachments.map((file) => ({ name: file.name, size: file.size, modified: file.lastModified })),
        logoAttachmentName,
      };
      const form = new FormData();
      form.set("title", title);
      form.set("audience", audience);
      form.set("objective", objective);
      form.set("source", source);
      form.set("slideCount", String(slides));
      form.set("tone", tone);
      form.set("visualStyle", visualStyle);
      if (logoAttachmentName) form.set("logoAttachmentName", logoAttachmentName);
      attachments.forEach((file) => form.append("attachments", file, file.name));

      const response = await generationFetch("/api/tools/powerpoint-generator/generate", {
        method: "POST",
        headers: { Authorization: \`Bearer \${token}\` },
        body: form,
      }, {
        scope: "powerpoint-generator",
        payload: requestPayload,
      });
      const payload = await readApiPayload(response);
      if (!response.ok) {
        throw new Error(publicApiMessage(payload, "Presentation generation could not start. Please try again."));
      }

      const nextJobId = typeof payload?.jobId === "string" ? payload.jobId : "";
      if (!nextJobId) throw new Error("Presentation generation could not start. Please try again.");

      setJobId(nextJobId);
      setStatusText(payload?.existing ? "This presentation is already being prepared…" : "Presentation queued. Building it in the background…");
    } catch (generationError) {
      setLoading(false);
      setJobId("");
      setStatusText("");
      setError(generationError instanceof Error ? generationError.message : "Presentation generation could not start.");
      await refreshAccount();
    }
  }
`;

if (!source.includes("Presentation queued. Building it in the background…")) {
  replaceOnce(oldGenerate, newGenerate, "PowerPoint generate function");
}

source = source.replace(
  '{loading ? "Writing and designing slides…" : `Generate PowerPoint · ${cost} credits`}',
  '{loading ? "Preparing in background…" : `Generate PowerPoint · ${cost} credits`}',
);

source = source.replace(
`              <h3 className="mt-4 text-xl font-black">Researching and designing the deck</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                Heyy Studio is developing the narrative, art-directing the visuals and building the editable PowerPoint. This can take a few minutes.
              </p>`,
`              <h3 className="mt-4 text-xl font-black">{statusText || "Preparing your presentation"}</h3>
              <p className="mt-2 text-sm font-semibold text-[var(--text-muted)]">
                Your presentation is running in the background. You can leave this page and return later; Generation Activity will keep its status.
              </p>`,
);

const helperMarker = "function attachmentExtension(file: File) {";
if (!source.includes("async function readApiPayload(response: Response)")) {
  const helperIndex = source.indexOf(helperMarker);
  if (helperIndex < 0) {
    console.error("Fix stopped: attachment helper marker was not found. No partial file was written.");
    process.exit(1);
  }
  const helpers = `async function readApiPayload(response: Response): Promise<any> {
  const text = await response.text();
  if (!text.trim()) return {};
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("json")) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function publicApiMessage(payload: any, fallback: string) {
  const message = typeof payload?.error === "string" ? payload.error.trim() : "";
  if (
    message &&
    message.length <= 240 &&
    !/[{}<>\x60]/.test(message) &&
    !/https?:\\/\\//i.test(message) &&
    !/unexpected token|json|html|supabase|openai|netlify|credit_operation|stack|schema cache/i.test(message)
  ) {
    return message;
  }
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

`;
  source = source.slice(0, helperIndex) + helpers + source.slice(helperIndex);
}

if (source === original) {
  console.log(`${relative} already contains the PowerPoint background UI changes.`);
  process.exit(0);
}

const temp = `${target}.heyy-ppt-background.tmp`;
fs.writeFileSync(temp, source, "utf8");
fs.renameSync(temp, target);
console.log(`Updated ${relative}`);
console.log("PowerPoint background UI patch applied.");
