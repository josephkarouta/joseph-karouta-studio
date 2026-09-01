import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const jobRelative = path.join("lib", "tools", "digital-adaptations-job.ts");
const backgroundRelative = path.join(
  "netlify",
  "functions",
  "digital-adaptations-background.ts",
);
const jobPath = path.join(root, jobRelative);
const backgroundPath = path.join(root, backgroundRelative);

if (!fs.existsSync(jobPath)) {
  console.error(`Fix stopped: ${jobRelative} was not found.`);
  console.error("Run this script from the Heyy Studio project root.");
  process.exit(1);
}

let source = fs.readFileSync(jobPath, "utf8");
const original = source;

if (!/processDigitalAdaptationsJob/.test(source)) {
  console.error(
    `Fix stopped: ${jobRelative} does not look like the current Digital Adaptations worker.`,
  );
  process.exit(1);
}

const workerUnsafeModules = [
  "@/lib/assets-server",
  "@/lib/credits/server",
  "@/lib/ai/openai-server",
];

const allowedWorkerImports = new Set([
  "getOpenAI",
  "storeGeneratedAsset",
  "commitCredits",
  "refundCredits",
  "CreditError",
  "CreditReservation",
]);

for (const moduleName of workerUnsafeModules) {
  const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importPattern = new RegExp(
    `import\\s+(type\\s+)?\\{([^}]*)\\}\\s+from\\s+[\"']${escaped}[\"'];?`,
    "g",
  );

  for (const match of source.matchAll(importPattern)) {
    const imported = match[2]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim());

    const unexpected = imported.filter((name) => !allowedWorkerImports.has(name));
    if (unexpected.length) {
      console.error(
        `Fix stopped: ${jobRelative} imports unexpected worker helpers from ${moduleName}: ${unexpected.join(", ")}`,
      );
      console.error(
        "No file was changed. Send this message back to ChatGPT so the patch can be adjusted safely.",
      );
      process.exit(1);
    }
  }
}

// A standalone Netlify background function must not depend on Next's
// `server-only` package/condition marker.
source = source.replace(/^\s*import\s+["']server-only["'];?\s*\r?\n/gm, "");

// Keep the existing Digital Adaptations job logic intact; only swap its
// Next-only helpers for API-compatible worker-safe implementations.
for (const moduleName of workerUnsafeModules) {
  source = source
    .split(`from "${moduleName}"`)
    .join('from "@/lib/tools/background-worker-runtime"')
    .split(`from '${moduleName}'`)
    .join("from '@/lib/tools/background-worker-runtime'");
}

const forbiddenAfterPatch = [
  /import\s+["']server-only["']/, 
  /from\s+["']@\/lib\/assets-server["']/,
  /from\s+["']@\/lib\/credits\/server["']/,
  /from\s+["']@\/lib\/ai\/openai-server["']/,
];

if (forbiddenAfterPatch.some((pattern) => pattern.test(source))) {
  console.error(
    `Fix stopped: a Next-only dependency still remains in ${jobRelative}. No file was changed.`,
  );
  process.exit(1);
}

if (source === original) {
  console.log(
    `${jobRelative} already has no direct Next-only worker imports. Nothing was changed.`,
  );
} else {
  const tempPath = `${jobPath}.heyy-worker-fix.tmp`;
  fs.writeFileSync(tempPath, source, "utf8");
  fs.renameSync(tempPath, jobPath);
  console.log(`Updated ${jobRelative}`);
}

if (fs.existsSync(backgroundPath)) {
  const background = fs.readFileSync(backgroundPath, "utf8");
  if (/import\s+["']server-only["']/.test(background)) {
    const next = background.replace(
      /^\s*import\s+["']server-only["'];?\s*\r?\n/gm,
      "",
    );
    fs.writeFileSync(backgroundPath, next, "utf8");
    console.log(`Updated ${backgroundRelative}`);
  }

  const finalBackground = fs.readFileSync(backgroundPath, "utf8");
  if (
    /@\/lib\/(assets-server|credits\/server|ai\/openai-server)/.test(
      finalBackground,
    )
  ) {
    console.error(
      `Warning: ${backgroundRelative} directly imports a Next-only helper. Send the file to ChatGPT before deploying.`,
    );
    process.exitCode = 2;
  }
} else {
  console.warn(
    `Warning: ${backgroundRelative} was not found. The job helper was patched, but verify the background function path before deploying.`,
  );
}

console.log("");
console.log("Digital Adaptations worker import fix applied.");
console.log("Next: npm run build");
