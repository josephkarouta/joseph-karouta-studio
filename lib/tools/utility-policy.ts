export const UTILITY_DAILY_FREE_LIMIT = 5;
export const UTILITY_CREDIT_COST = 1;

export type UtilityTool = "pdf_tools" | "file_converter";

export const UTILITY_OPERATIONS: Record<UtilityTool, readonly string[]> = {
  pdf_tools: [
    "edit",
    "compress",
    "split",
    "merge",
    "unlock",
    "protect",
    "sign",
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
