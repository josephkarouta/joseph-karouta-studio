import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const layoutRelative = path.join("app", "layout.tsx");
const layoutPath = path.join(root, layoutRelative);
const componentRelative = path.join("components", "system", "ApiResponseSafety.tsx");
const componentPath = path.join(root, componentRelative);
const creditsRelative = path.join("lib", "credits", "server.ts");
const creditsPath = path.join(root, creditsRelative);

function stop(message) {
  console.error(`Patch stopped: ${message}`);
  console.error("No risky automatic fallback was used. Run this script from the current Heyy Studio project root.");
  process.exit(1);
}

if (!fs.existsSync(layoutPath)) stop(`${layoutRelative} was not found.`);
if (!fs.existsSync(componentPath)) {
  stop(`${componentRelative} was not found. Unzip the patch into the project root first.`);
}

let layout = fs.readFileSync(layoutPath, "utf8");
let layoutChanged = false;

if (!layout.includes('from "@/components/system/ApiResponseSafety"') && !layout.includes("from '@/components/system/ApiResponseSafety'")) {
  const importLines = [...layout.matchAll(/^import[^\n]+;\s*$/gm)];
  if (!importLines.length) stop(`${layoutRelative} has no recognizable import block.`);
  const last = importLines[importLines.length - 1];
  const insertAt = Number(last.index) + last[0].length;
  layout = `${layout.slice(0, insertAt)}\nimport ApiResponseSafety from "@/components/system/ApiResponseSafety";${layout.slice(insertAt)}`;
  layoutChanged = true;
}

if (!layout.includes("<ApiResponseSafety")) {
  const bodyMatch = layout.match(/<body\b[^>]*>/i);
  if (!bodyMatch || bodyMatch.index == null) stop(`${layoutRelative} has no recognizable <body> element.`);
  const insertAt = bodyMatch.index + bodyMatch[0].length;
  layout = `${layout.slice(0, insertAt)}\n        <ApiResponseSafety />${layout.slice(insertAt)}`;
  layoutChanged = true;
}

if (layoutChanged) {
  fs.writeFileSync(layoutPath, layout, "utf8");
  console.log(`Updated ${layoutRelative}`);
} else {
  console.log(`${layoutRelative} already includes the API response safety guard.`);
}

if (fs.existsSync(creditsPath)) {
  let credits = fs.readFileSync(creditsPath, "utf8");
  const before = credits;

  const creditSystemPattern = /function creditSystemError\(error: unknown, fallback: string\) \{[\s\S]*?\n\}\n\nasync function releaseStaleReservations/;
  if (creditSystemPattern.test(credits)) {
    credits = credits.replace(
      creditSystemPattern,
`function creditSystemError(error: unknown, fallback: string) {
  const technicalMessage =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || fallback)
      : fallback;

  console.error("Credit system operation failed:", technicalMessage);

  if (/does not exist|schema cache|credit_wallets|credit_usage_events|heyy_(reserve|commit|refund)_credits/i.test(technicalMessage)) {
    return new CreditError(
      "Credits are temporarily unavailable. Please try again shortly.",
      "CREDIT_SYSTEM_UNAVAILABLE",
      503,
    );
  }

  return new CreditError(
    fallback || "Credits could not be updated. Please try again.",
    "CREDIT_OPERATION_FAILED",
    500,
  );
}

async function releaseStaleReservations`,
    );
  }

  credits = credits
    .replaceAll(
      '"The V13 credit migration has not been applied yet."',
      '"Credits are temporarily unavailable. Please try again shortly."',
    )
    .replaceAll(
      '"The V13 credit migration has not been applied correctly."',
      '"Credits are temporarily unavailable. Please try again shortly."',
    )
    .replace(
      /throw new CreditError\(message \|\| "Credits could not be reserved\."\);/g,
      'console.error("Credit reservation failed:", message);\n    throw new CreditError("Credits could not be reserved. Please try again.", "CREDIT_OPERATION_FAILED", 500);',
    )
    .replace(
      /if \(!reservationId\) throw new CreditError\("Credit reservation returned no identifier\."\);/g,
      'if (!reservationId) throw new CreditError("Credits could not be reserved. Please try again.", "CREDIT_OPERATION_FAILED", 500);',
    )
    .replace(
      /if \(error\) throw new CreditError\(error\.message \|\| "Credits could not be committed\."\);/g,
      'if (error) {\n    console.error("Credit commit failed:", error);\n    throw new CreditError("Credits could not be updated. Please try again.", "CREDIT_OPERATION_FAILED", 500);\n  }',
    );

  if (credits !== before) {
    fs.writeFileSync(creditsPath, credits, "utf8");
    console.log(`Updated ${creditsRelative}`);
  } else {
    console.log(`${creditsRelative} did not contain any of the known raw credit-error patterns (or was already fixed).`);
  }
} else {
  console.warn(`Warning: ${creditsRelative} was not found. Browser/API response safety was still installed.`);
}

// Static audit only: report customer-facing files that still parse JSON directly.
// The runtime guard protects them immediately; the count helps future cleanup without risky mass rewrites.
const scanRoots = ["app", "components"];
let directJsonParsers = 0;
for (const scanRoot of scanRoots) {
  const base = path.join(root, scanRoot);
  if (!fs.existsSync(base)) continue;
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) stack.push(path.join(current, entry));
      continue;
    }
    if (!/\.(?:ts|tsx|js|jsx)$/.test(current)) continue;
    const text = fs.readFileSync(current, "utf8");
    const matches = text.match(/\.json\(\)/g);
    if (matches) directJsonParsers += matches.length;
  }
}

console.log("");
console.log("Heyy Studio site-wide customer API error guard applied.");
console.log(`Audit: found ${directJsonParsers} direct .json() call(s). They are now protected from HTML/non-JSON parser leakage at runtime.`);
console.log("No SQL is required.");
console.log("Next: npm run build");
