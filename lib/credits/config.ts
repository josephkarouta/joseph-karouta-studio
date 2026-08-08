export const CREDIT_COSTS = {
  textToImagePreview: 6,
  textToImageHigh: 12,
  imageEdit: 8,
  digitalAdaptationFamily: 8,
  imageToVideoPreview: 24,
  imageToVideoHigh: 48,
  aiUpscale2x: 4,
  aiUpscale4x: 8,
  powerpointDraft: 5,
  powerpointFull: 12,
  interiorConcept: 8,
  interiorProfessionalConcept: 16,
  interiorTechnicalPlan: 4,
  interiorPreview: 12,
  interiorProfessionalFinal: 24,
  interiorPlan: 8,
  interiorVisual: 12,
  marketingCampaign: 6,
  marketingCreativePack: 12,
  marketingVisualPreview: 12,
  marketingProfessionalFinal: 24,
  brandSystemText: 4,
  brandDirectionText: 2,
  brandGuidelines: 2,
  brandLogoConcept: 8,
  brandMoodboard: 8,
  brandApplicationVisual: 8,
  brandProfessionalFinal: 16,
  brandVariation: 8,
  architectureText: 2,
  architectureTechnicalPlan: 4,
  architectureDirection: 8,
  architectureVisual: 12,
  architectureProfessionalFinal: 24,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export function getCreditCost(action: CreditAction) {
  return CREDIT_COSTS[action];
}
