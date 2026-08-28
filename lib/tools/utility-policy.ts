export const UTILITY_DAILY_FREE_LIMIT = 5;
export const UTILITY_CREDIT_COST = 1;

export type UtilityTool = "pdf_tools" | "file_converter";

export const UTILITY_OPERATIONS: Record<UtilityTool, readonly string[]> = {
  pdf_tools: [
    "compress",
    "split",
    "merge",
    "unlock",
    "protect",
  ],
  file_converter: ["convert"],
};

export function isUtilityTool(value: unknown): value is UtilityTool {
  return value === "pdf_tools" || value === "file_converter";
}

export function isUtilityOperation(tool: UtilityTool, value: unknown) {
  return typeof value === "string" && UTILITY_OPERATIONS[tool].includes(value);
}

export function utilityCreditAction(tool: UtilityTool) {
  return tool === "pdf_tools" ? "pdfUtility" : "fileConversion";
}


export function utilitySubscriptionIncluded(plan: unknown, status: unknown) {
  const normalizedPlan = String(plan || "").trim().toLowerCase();
  if (normalizedPlan !== "starter" && normalizedPlan !== "pro") return false;

  const normalizedStatus = String(status || "").trim().toLowerCase();
  return normalizedStatus === "active" || normalizedStatus === "trialing";
}

export function utilitySubscriptionStatus(subscription: Record<string, unknown> | null | undefined) {
  return String(
    subscription?.status ||
      subscription?.subscription_status ||
      subscription?.state ||
      "",
  )
    .trim()
    .toLowerCase();
}
