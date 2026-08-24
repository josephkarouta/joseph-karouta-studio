import { CREDIT_COSTS } from "@/lib/credits/config";

/**
 * Shared Architecture credit labels. Server-side generation routes should use
 * the same central credit ledger before provider calls.
 */
export const ARCHITECTURE_CREDIT_COSTS = {
  directionPreview: CREDIT_COSTS.architectureDirection,
  conceptPreview: CREDIT_COSTS.architectureDirection,
  visualPreview: CREDIT_COSTS.architectureVisual,
  renderedPlanPreview: CREDIT_COSTS.architectureVisual,
  professionalFinal: CREDIT_COSTS.architectureProfessionalFinal,
  technicalPlan: CREDIT_COSTS.architectureTechnicalPlan,
  textGeneration: CREDIT_COSTS.architectureText,
} as const;

export type ArchitectureCreditAction = keyof typeof ARCHITECTURE_CREDIT_COSTS;
