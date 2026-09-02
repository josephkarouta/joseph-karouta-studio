#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const PATCH_MARKER = "HEYY_ASSETS_VERSIONS_EMAIL_PPT_CLEANUP_20260902";
const SUPPORT_CATEGORY_FILTER = '("custom-material","custom_material","material-reference","material_reference","color-swatch","colour-swatch","paint-swatch")';
const changed = [];
const notes = [];
const backups = new Map();
let completed = false;

function rememberOriginal(rel) {
  if (backups.has(rel)) return;
  const target = path.join(ROOT, rel);
  backups.set(rel, fs.existsSync(target) ? fs.readFileSync(target) : null);
}

function rollback() {
  if (completed || backups.size === 0) return;
  for (const [rel, original] of [...backups.entries()].reverse()) {
    const target = path.join(ROOT, rel);
    try {
      if (original === null) fs.rmSync(target, { force: true });
      else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, original);
      }
    } catch (error) {
      console.error(`Rollback warning for ${rel}:`, error instanceof Error ? error.message : error);
    }
  }
  console.error("Any files changed by this run were rolled back.");
}

function fail(message) {
  rollback();
  console.error(`\nCleanup patch stopped safely: ${message}`);
  console.error("No SQL was applied automatically.");
  process.exit(1);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function write(rel, contents) {
  rememberOriginal(rel);
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  if (!changed.includes(rel)) changed.push(rel);
}

function assertProjectRoot() {
  if (!exists("package.json") || !exists("app") || !exists("lib")) {
    fail("Run this script from the Heyy Studio project root (the folder containing package.json, app/ and lib/).");
  }
}

function addSitePathImport(source) {
  if (/\bsitePath\b/.test(source) && /from\s+["']@\/lib\/site-url["']/.test(source)) return source;

  const existing = source.match(/import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/site-url["'];?/);
  if (existing) {
    const names = existing[1].split(",").map((item) => item.trim()).filter(Boolean);
    if (!names.includes("sitePath")) names.push("sitePath");
    return source.replace(existing[0], `import { ${names.join(", ")} } from "@/lib/site-url";`);
  }

  const importLine = 'import { sitePath } from "@/lib/site-url";\n';
  if (source.startsWith('import "server-only";')) {
    const end = source.indexOf("\n");
    return source.slice(0, end + 1) + importLine + source.slice(end + 1);
  }
  return importLine + source;
}

async function ensureEmailLogoPng() {
  const outputRel = "public/brand/heyy/heyy-email-logo.png";
  const preferred = [
    "public/brand/heyy/heyy-full-colour-dark.svg",
    "public/brand/heyy/heyy-black.svg",
    "public/logo.svg",
  ];

  let sourceRel = preferred.find(exists) || null;
  if (!sourceRel) {
    const publicDir = path.join(ROOT, "public");
    if (fs.existsSync(publicDir)) {
      const stack = [publicDir];
      while (stack.length && !sourceRel) {
        const dir = stack.pop();
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) stack.push(full);
          else if (/heyy.*\.svg$/i.test(entry.name)) sourceRel = path.relative(ROOT, full);
        }
      }
    }
  }

  if (!sourceRel) {
    if (exists(outputRel)) {
      notes.push(`Email logo PNG already exists: ${outputRel}`);
      return outputRel;
    }
    fail("Could not find the current Heyy Studio SVG logo under public/. The email template was not changed.");
  }

  let sharp;
  try {
    ({ default: sharp } = await import("sharp"));
  } catch (error) {
    fail(`The project dependency \"sharp\" could not be loaded (${error instanceof Error ? error.message : String(error)}). Run npm install first, then rerun this patch.`);
  }

  const sourcePath = path.join(ROOT, sourceRel);
  const targetPath = path.join(ROOT, outputRel);
  rememberOriginal(outputRel);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  await sharp(sourcePath, { density: 240 })
    .resize({ width: 420, height: 120, fit: "inside", withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toFile(targetPath);
  if (!changed.includes(outputRel)) changed.push(outputRel);
  notes.push(`Email logo rasterized from ${sourceRel}`);
  return outputRel;
}

function findEmailTemplateFile() {
  const files = walkSourceFiles(path.join(ROOT, "lib"));
  const candidates = files
    .map((full) => {
      const rel = path.relative(ROOT, full);
      const source = fs.readFileSync(full, "utf8");
      let score = 0;
      if (/buildEmail\s*[=(]/.test(source) || /function\s+buildEmail\b/.test(source)) score += 8;
      if (/buildPlainTextEmail\s*[=(]/.test(source) || /function\s+buildPlainTextEmail\b/.test(source)) score += 6;
      if (/notifications/i.test(rel)) score += 5;
      if (/templates?/i.test(rel)) score += 4;
      if (/<img\b|logo/i.test(source)) score += 2;
      if (/Heyy Studio/i.test(source)) score += 1;
      return { rel, source, score };
    })
    .filter((item) => item.score >= 12)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    fail('Could not locate the current shared email template that exports buildEmail/buildPlainTextEmail.');
  }

  const top = candidates[0];
  if (candidates[1] && candidates[1].score === top.score && candidates[1].rel !== top.rel) {
    fail(`Two equally likely shared email templates were found (${top.rel}, ${candidates[1].rel}).`);
  }

  notes.push(`Shared email template detected at ${top.rel}`);
  return top.rel;
}

function patchEmailTemplate(rel) {
  if (!exists(rel)) fail(`${rel} was not found. The current communications shell needs inspection before changing email branding.`);

  let source = read(rel);
  if (source.includes(PATCH_MARKER) && source.includes("heyy-email-logo.png")) {
    notes.push(`${rel} already has the email-logo fix.`);
    return;
  }

  const original = source;
  const logoPath = "/brand/heyy/heyy-email-logo.png";

  // First prefer replacing known static SVG paths while preserving the existing absolute-URL helper.
  source = source
    .replace(/\/brand\/heyy\/heyy-full-colour-(?:dark|light)\.svg/g, logoPath)
    .replace(/\/brand\/heyy\/heyy-(?:black|white)\.svg/g, logoPath)
    .replace(/\/logo\.svg/g, logoPath);

  // Then force the actual Heyy-logo <img> tag to use an absolute site URL. Email clients do not resolve app-relative paths.
  const imageTags = [...source.matchAll(/<img\b[^>]*>/gi)];
  let tagPatched = false;
  for (const match of imageTags) {
    const tag = match[0];
    if (!/Heyy\s*Studio|heyy-email-logo|brand\/heyy|logo\.svg/i.test(tag)) continue;
    const replacement = tag.replace(
      /src\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/i,
      'src="${sitePath("/brand/heyy/heyy-email-logo.png")}"',
    );
    if (replacement !== tag) {
      source = source.replace(tag, replacement);
      tagPatched = true;
      break;
    }
  }

  // If the shell stores the logo URL in a variable, make that variable absolute too.
  if (!tagPatched && source.includes("heyy-email-logo.png")) {
    source = source.replace(
      /([=:]\s*)["']\/brand\/heyy\/heyy-email-logo\.png["']/g,
      '$1sitePath("/brand/heyy/heyy-email-logo.png")',
    );
  }

  if (!source.includes("heyy-email-logo.png")) {
    fail(`${rel} did not contain a recognizable Heyy logo reference or Heyy logo <img> tag. It was left untouched.`);
  }

  if (!/sitePath\(["']\/brand\/heyy\/heyy-email-logo\.png["']\)/.test(source)) {
    // Last safe attempt: change a direct HTML relative src.
    source = source.replace(
      /src=["']\/brand\/heyy\/heyy-email-logo\.png["']/,
      'src="${sitePath("/brand/heyy/heyy-email-logo.png")}"',
    );
  }

  if (!/sitePath\(["']\/brand\/heyy\/heyy-email-logo\.png["']\)/.test(source)) {
    fail(`${rel} still did not resolve the email logo through sitePath(). The file was left untouched to avoid sending another broken email.`);
  }

  source = addSitePathImport(source);
  source = `// ${PATCH_MARKER}: email-safe absolute PNG logo.\n${source}`;

  if (source !== original) write(rel, source);
}

function patchPowerPointJob() {
  const rel = "lib/tools/powerpoint-job.ts";
  if (!exists(rel)) fail(`${rel} was not found. Apply the latest PowerPoint background reliability patch first.`);

  let source = read(rel);
  if (source.includes("HEYY_PPT_ASSET_THUMBNAIL_V1")) {
    notes.push(`${rel} already has PowerPoint asset thumbnails.`);
    return;
  }

  if (!source.includes('assetType: "powerpoint"') || !source.includes("buildPreviewVisuals")) {
    fail(`${rel} does not match the current background PowerPoint worker shape. It was not changed.`);
  }

  if (!source.includes("type StoredAsset = {")) fail(`${rel}: StoredAsset type marker was not found.`);
  source = source.replace(
    /type StoredAsset = \{([\s\S]*?)\n\};/,
    (full, body) => {
      if (/thumbnail_url\?/.test(body)) return full;
      return `type StoredAsset = {${body}\n  thumbnail_url?: string | null;\n};`;
    },
  );

  const storeStart = source.indexOf("    asset = await storeGeneratedAsset({");
  if (storeStart < 0) fail(`${rel}: PowerPoint asset-save block was not found.`);
  const storeEndMarker = "    }) as StoredAsset;";
  const storeEnd = source.indexOf(storeEndMarker, storeStart);
  if (storeEnd < 0) fail(`${rel}: PowerPoint asset-save closing marker was not found.`);
  const insertionPoint = storeEnd + storeEndMarker.length;
  const attachBlock = `\n\n    // HEYY_PPT_ASSET_THUMBNAIL_V1: keep the editable PPTX and add a lightweight cover preview for Assets/Versions.\n    asset = await attachPowerPointThumbnail({\n      admin,\n      asset,\n      userId: String(claimed.user_id),\n      title,\n      deckSubtitle: plan.deckSubtitle,\n      previewVisuals,\n    });`;
  source = source.slice(0, insertionPoint) + attachBlock + source.slice(insertionPoint);

  source = source.replace(
    "      asset: { id: asset.id },",
    "      asset: { id: asset.id, thumbnailUrl: asset.thumbnail_url || null },",
  );

  const removeMarker = "async function removeStoredAsset(admin: SupabaseClient, asset: StoredAsset) {";
  const removeIndex = source.indexOf(removeMarker);
  if (removeIndex < 0) fail(`${rel}: cleanup function marker was not found.`);

  const helpers = `\n// HEYY_PPT_ASSET_THUMBNAIL_V1\nasync function attachPowerPointThumbnail({\n  admin,\n  asset,\n  userId,\n  title,\n  deckSubtitle,\n  previewVisuals,\n}: {\n  admin: SupabaseClient;\n  asset: StoredAsset;\n  userId: string;\n  title: string;\n  deckSubtitle: string;\n  previewVisuals: Record<string, string>;\n}) {\n  const thumbnail = await buildPowerPointAssetThumbnail({ title, deckSubtitle, previewVisuals });\n  const storagePath = \`${'${userId}'}/tools/powerpoint-previews/${'${asset.id}'}-${'${Date.now()}'}\.jpg\`;\n\n  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, thumbnail, {\n    contentType: \"image/jpeg\",\n    cacheControl: \"31536000\",\n    upsert: false,\n  });\n  if (uploadError) throw new Error(\`Presentation preview upload failed: ${'${uploadError.message}'}\`);\n\n  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);\n  const thumbnailUrl = publicData.publicUrl || null;\n  if (!thumbnailUrl) {\n    await admin.storage.from(BUCKET).remove([storagePath]);\n    throw new Error(\"Presentation preview URL could not be created.\");\n  }\n\n  const metadata = {\n    ...(asset.metadata || {}),\n    thumbnail_storage_path: storagePath,\n    thumbnail_content_type: \"image/jpeg\",\n  };\n  const { data: updated, error: updateError } = await admin\n    .from(\"project_assets\")\n    .update({ thumbnail_url: thumbnailUrl, metadata })\n    .eq(\"id\", asset.id)\n    .select(\"id,file_url,thumbnail_url,metadata\")\n    .single();\n\n  if (updateError || !updated) {\n    await admin.storage.from(BUCKET).remove([storagePath]);\n    throw new Error(updateError?.message || \"Presentation preview could not be linked to the asset.\");\n  }\n\n  return updated as StoredAsset;\n}\n\nasync function buildPowerPointAssetThumbnail({\n  title,\n  deckSubtitle,\n  previewVisuals,\n}: {\n  title: string;\n  deckSubtitle: string;\n  previewVisuals: Record<string, string>;\n}) {\n  const width = 1200;\n  const height = 675;\n  const sourcePreview = previewVisuals[\"0\"] || Object.values(previewVisuals)[0] || \"\";\n  let base = sharp({\n    create: { width, height, channels: 4, background: { r: 246, g: 243, b: 255, alpha: 1 } },\n  });\n\n  if (sourcePreview) {\n    const encoded = sourcePreview.split(\",\")[1] || \"\";\n    if (encoded) {\n      base = sharp(Buffer.from(encoded, \"base64\"))\n        .resize({ width, height, fit: \"cover\", position: \"attention\" });\n    }\n  }\n\n  const titleLines = wrapThumbnailText(title, 31, 3);\n  const subtitle = escapeThumbnailSvg(deckSubtitle || \"Professional presentation\").slice(0, 110);\n  const hasImage = Boolean(sourcePreview);\n  const titleFill = hasImage ? \"#ffffff\" : \"#18141f\";\n  const subtitleFill = hasImage ? \"#f0eaff\" : \"#665f70\";\n  const lineMarkup = titleLines\n    .map((line, index) => \`<tspan x=\"72\" dy=\"${'${index === 0 ? 0 : 62}'}\">${'${escapeThumbnailSvg(line)}'}<\/tspan>\`)\n    .join(\"\");\n\n  const overlay = Buffer.from(\`<svg width=\"${'${width}'}\" height=\"${'${height}'}\" viewBox=\"0 0 ${'${width}'} ${'${height}'}\" xmlns=\"http://www.w3.org/2000/svg\">\n    <defs>\n      <linearGradient id=\"shade\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"0\">\n        <stop offset=\"0\" stop-color=\"#140c20\" stop-opacity=\"0.92\"/>\n        <stop offset=\"0.58\" stop-color=\"#221132\" stop-opacity=\"0.62\"/>\n        <stop offset=\"1\" stop-color=\"#221132\" stop-opacity=\"0.08\"/>\n      </linearGradient>\n      <linearGradient id=\"plain\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"1\">\n        <stop offset=\"0\" stop-color=\"#f7f3ff\"/>\n        <stop offset=\"1\" stop-color=\"#ece2ff\"/>\n      </linearGradient>\n    </defs>\n    ${'${hasImage ? `<rect width="1200" height="675" fill="url(#shade)"/>` : `<rect width="1200" height="675" fill="url(#plain)"/>`}'}\n    <rect x=\"72\" y=\"70\" width=\"150\" height=\"8\" rx=\"4\" fill=\"#7c3aed\"/>\n    <text x=\"72\" y=\"126\" fill=\"${'${hasImage ? "#efe7ff" : "#6d28d9"}'}\" font-family=\"Arial, Helvetica, sans-serif\" font-size=\"20\" font-weight=\"700\" letter-spacing=\"4\">HEYY STUDIO · PRESENTATION</text>\n    <text x=\"72\" y=\"255\" fill=\"${'${titleFill}'}\" font-family=\"Arial, Helvetica, sans-serif\" font-size=\"54\" font-weight=\"800\">${'${lineMarkup}'}</text>\n    <text x=\"72\" y=\"535\" fill=\"${'${subtitleFill}'}\" font-family=\"Arial, Helvetica, sans-serif\" font-size=\"25\" font-weight=\"500\">${'${subtitle}'}</text>\n    <text x=\"72\" y=\"608\" fill=\"${'${hasImage ? "#ddd2eb" : "#81778e"}'}\" font-family=\"Arial, Helvetica, sans-serif\" font-size=\"18\">Editable PowerPoint · Generated in Heyy Studio</text>\n  </svg>\`);\n\n  return base\n    .composite([{ input: overlay }])\n    .jpeg({ quality: 82, progressive: true })\n    .toBuffer();\n}\n\nfunction wrapThumbnailText(value: string, maxChars: number, maxLines: number) {\n  const words = String(value || \"Presentation\").trim().split(/\\s+/).filter(Boolean);\n  const lines: string[] = [];\n  let line = \"\";\n  for (const word of words) {\n    const next = line ? \`${'${line}'} ${'${word}'}\` : word;\n    if (next.length <= maxChars || !line) {\n      line = next;\n      continue;\n    }\n    lines.push(line);\n    line = word;\n    if (lines.length >= maxLines - 1) break;\n  }\n  if (line && lines.length < maxLines) lines.push(line);\n  if (!lines.length) lines.push(\"Presentation\");\n  return lines;\n}\n\nfunction escapeThumbnailSvg(value: string) {\n  return String(value || \"\")\n    .replace(/&/g, \"&amp;\")\n    .replace(/</g, \"&lt;\")\n    .replace(/>/g, \"&gt;\")\n    .replace(/\"/g, \"&quot;\")\n    .replace(/'/g, \"&apos;\");\n}\n\n`;
  source = source.slice(0, removeIndex) + helpers + source.slice(removeIndex);

  const storageDecl = '  const storagePath = typeof asset.metadata?.storage_path === "string" ? asset.metadata.storage_path : "";';
  if (!source.includes(storageDecl)) fail(`${rel}: failed-asset storage cleanup marker was not found.`);
  source = source.replace(
    storageDecl,
    `${storageDecl}\n  const thumbnailStoragePath = typeof asset.metadata?.thumbnail_storage_path === "string" ? asset.metadata.thumbnail_storage_path : "";`,
  );

  const cleanupTail = `  if (storagePath) {\n    const { error: storageError } = await admin.storage.from(BUCKET).remove([storagePath]);\n    if (storageError) console.error("PowerPoint failed asset storage cleanup error:", storageError.message);\n  }\n}`;
  if (!source.includes(cleanupTail)) fail(`${rel}: failed-asset cleanup tail did not match the current worker.`);
  source = source.replace(
    cleanupTail,
    `  const storagePaths = [storagePath, thumbnailStoragePath].filter(Boolean);\n  if (storagePaths.length) {\n    const { error: storageError } = await admin.storage.from(BUCKET).remove(storagePaths);\n    if (storageError) console.error("PowerPoint failed asset storage cleanup error:", storageError.message);\n  }\n}`,
  );

  write(rel, source);
}

function walkSourceFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".netlify", "dist", "build"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSourceFiles(full, result);
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

function scoreAssetLibraryCandidate(rel, source) {
  if (!/\.from\(["']architecture_documents["']\)/.test(source)) return -1;
  if (/ArchitectureProjectWorkspace|architecture-studio|source-plans|account\/project-data/i.test(rel)) return -1;
  let score = 5;
  if (/asset_library_overrides/.test(source)) score += 6;
  if (/\.from\(["']project_assets["']\)/.test(source)) score += 4;
  if (/production_deliverables/.test(source)) score += 3;
  if (/architecture_visuals/.test(source)) score += 2;
  if (/source_key|sourceKey/.test(source)) score += 2;
  if (/asset library|Assets Library|UnifiedAsset|LibraryAsset/i.test(source)) score += 3;
  if (/asset/i.test(rel)) score += 2;
  if (/dashboard/i.test(rel)) score += 1;
  return score;
}

function insertArchitectureDocumentFilter(source) {
  const re = /\.from\(["']architecture_documents["']\)/g;
  const matches = [...source.matchAll(re)];
  if (!matches.length) return { source, patched: 0 };
  let offset = 0;
  let patched = 0;
  let next = source;

  for (const match of matches) {
    const start = (match.index || 0) + offset;
    const end = next.indexOf(";", start);
    if (end < 0) continue;
    const segment = next.slice(start, end);
    if (/\.not\(["']category["']\s*,\s*["']in["']/.test(segment)) continue;
    if (!/\.select\(/.test(segment)) continue;

    const orderIndex = segment.search(/\.(?:order|limit|range)\s*\(/);
    const insertAt = start + (orderIndex >= 0 ? orderIndex : segment.length);
    const filter = `\n      .not("category", "in", '${SUPPORT_CATEGORY_FILTER}')`;
    next = next.slice(0, insertAt) + filter + next.slice(insertAt);
    offset += filter.length;
    patched += 1;
  }

  return { source: next, patched };
}

function patchAssetsLibrary() {
  const files = [
    ...walkSourceFiles(path.join(ROOT, "app")),
    ...walkSourceFiles(path.join(ROOT, "lib")),
    ...walkSourceFiles(path.join(ROOT, "components")),
  ];

  const candidates = files
    .map((full) => {
      const rel = path.relative(ROOT, full);
      const source = fs.readFileSync(full, "utf8");
      return { full, rel, source, score: scoreAssetLibraryCandidate(rel, source) };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    fail("Could not find the current Assets Library architecture-document aggregator. Email/PPT files were prepared in memory only; no partial patch was written.");
  }

  const top = candidates[0];
  if (top.score < 9) {
    fail(`Found architecture_documents, but no high-confidence Assets Library aggregator. Top candidate: ${top.rel} (score ${top.score}). No partial patch was written.`);
  }
  if (candidates[1] && candidates[1].score === top.score && candidates[1].rel !== top.rel) {
    fail(`Two equally likely Assets Library files were found (${top.rel}, ${candidates[1].rel}). No partial patch was written.`);
  }

  const result = insertArchitectureDocumentFilter(top.source);
  if (!result.patched) {
    if (top.source.includes(SUPPORT_CATEGORY_FILTER) || /\.not\(["']category["']\s*,\s*["']in["']/.test(top.source)) {
      notes.push(`${top.rel} already excludes material support documents.`);
      return;
    }
    fail(`${top.rel} looks like the Assets Library source, but its architecture_documents query shape was not safe to patch automatically.`);
  }

  write(top.rel, `// ${PATCH_MARKER}: hide internal material/color support documents from customer Assets.\n${result.source}`);
  notes.push(`Assets Library filter applied in ${top.rel} (${result.patched} architecture document query${result.patched === 1 ? "" : "ies"}).`);
}

async function main() {
  assertProjectRoot();

  // Build all changes in memory/temporary output first where possible. The Assets scan is done before final writes
  // so an unexpected project shape does not leave a half-applied cleanup batch.
  const templateRel = findEmailTemplateFile();
  const pptRel = "lib/tools/powerpoint-job.ts";
  if (!exists(pptRel)) fail(`${pptRel} was not found. Apply the PowerPoint background reliability patch first.`);

  // Assets library is the least path-stable part of the app; validate and patch it first.
  patchAssetsLibrary();
  await ensureEmailLogoPng();
  patchEmailTemplate(templateRel);
  patchPowerPointJob();

  completed = true;
  console.log("\nHeyy Studio Assets / Versions / Email / PPT cleanup applied.");
  console.log("Changed files:");
  for (const file of changed) console.log(`  - ${file}`);
  if (notes.length) {
    console.log("\nNotes:");
    for (const note of notes) console.log(`  - ${note}`);
  }
  console.log("\nStorage policy intentionally unchanged: meaningful final AI-tool outputs remain saved; no 24-hour purge was added.");
  console.log("SQL was NOT applied automatically. Run the supplied 20260902_workspace_material_support_visibility.sql in Supabase after the build passes.");
  console.log("\nNext: npm run build");
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
