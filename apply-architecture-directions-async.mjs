import fs from "node:fs";
import path from "node:path";

const file = path.resolve("components/studio/architecture/ArchitectureProjectWorkspace.tsx");
if (!fs.existsSync(file)) {
  throw new Error(`Could not find ${file}. Run this script from the Heyy Studio project root.`);
}

const source = fs.readFileSync(file, "utf8");
const startMarker = "  async function generateDirections(directionNumber?: number) {";
const endMarker = "  async function selectDirection(direction: Direction) {";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Could not find the Architecture generateDirections block. No file was changed.");
}

const replacement = `  async function generateDirections(directionNumber?: number) {
    if (!user) return;

    const hasExistingDirections = directions.length > 0;
    const targetLabel = directionNumber
      ? \`Direction \${String.fromCharCode(64 + directionNumber)}\`
      : "all three Architecture Directions";

    if (
      hasExistingDirections &&
      !window.confirm(
        \`Regenerate \${targetLabel}? Existing generated text and imagery for the selected direction\${directionNumber ? "" : "s"} will be replaced.\`,
      )
    ) {
      return;
    }

    setGeneratingDirection(directionNumber ?? "all");
    setError("");
    setMessage("");

    type ArchitectureDirectionResponse = {
      success?: boolean;
      status?: "processing" | "succeeded" | "failed";
      jobId?: string;
      error?: string;
      directions?: Direction[];
      project?: Project | null;
    };

    async function readArchitectureDirectionResponse(
      response: Response,
      fallback: string,
    ): Promise<ArchitectureDirectionResponse> {
      const text = await response.text();
      if (!text) {
        if (!response.ok) throw new Error(fallback);
        return {};
      }

      try {
        return JSON.parse(text) as ArchitectureDirectionResponse;
      } catch {
        if (response.status === 504 || /inactivity timeout|<html|<!doctype/i.test(text)) {
          throw new Error("Architecture Studio could not start the Direction request. Please try again.");
        }
        throw new Error(fallback);
      }
    }

    try {
      const response = await fetch("/api/architecture/directions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          directionNumber,
        }),
      });

      const started = await readArchitectureDirectionResponse(
        response,
        "Architecture Directions could not be started.",
      );

      if (!response.ok || !started.success || !started.jobId) {
        throw new Error(started.error || "Architecture Directions could not be started.");
      }

      let payload: ArchitectureDirectionResponse | null = null;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        if (attempt > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 2500));
        }

        const statusResponse = await fetch(
          \`/api/architecture/directions/status?job=\${encodeURIComponent(started.jobId)}\`,
          { cache: "no-store" },
        );
        const statusPayload = await readArchitectureDirectionResponse(
          statusResponse,
          "Unable to check Architecture Direction generation.",
        );

        if (!statusResponse.ok || statusPayload.success === false) {
          throw new Error(statusPayload.error || "Unable to check Architecture Direction generation.");
        }
        if (statusPayload.status === "failed") {
          throw new Error(
            statusPayload.error || "Architecture Direction generation failed. Your credits were returned.",
          );
        }
        if (statusPayload.status === "succeeded") {
          payload = statusPayload;
          break;
        }
      }

      if (!payload?.directions) {
        throw new Error(
          "Your Architecture Directions are still being prepared safely in the background. Reopen the project shortly to see the saved result.",
        );
      }

      setDirections(payload.directions);

      if (payload.project) {
        setProject(payload.project);
        setProjectDraft(payload.project);
      }

      showMessage(
        directionNumber
          ? \`Direction \${String.fromCharCode(64 + directionNumber)} text regenerated. Select it before generating a visual.\`
          : "Three text-first Architecture Directions generated. Select one, then generate only its visual.",
      );
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Architecture Directions could not be generated.",
      );
    } finally {
      setGeneratingDirection(null);
    }
  }

`;

const next = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, next, "utf8");
console.log("✓ Patched Architecture Directions to durable background generation.");
console.log(`✓ Updated: ${path.relative(process.cwd(), file)}`);
