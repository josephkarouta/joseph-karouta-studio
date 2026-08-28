export const CREDIT_COSTS = {
  pdfUtility: 1,
  fileConversion: 1,
  textToImagePreview: 2,
  textToImageHigh: 2,
  imageEdit: 2,
  digitalAdaptationFamily: 2,
  imageToVideoPreview: 13,
  imageToVideoHigh: 13,
  aiUpscale2x: 3,
  aiUpscale4x: 6,
  powerpointDraft: 3,
  powerpointFull: 3,
  powerpoint11To15: 4,
  powerpoint16To20: 5,
  interiorConcept: 6,
  interiorProfessionalConcept: 6,
  interiorTechnicalPlan: 4,
  interiorPreview: 6,
  interiorProfessionalFinal: 6,
  interiorPlan: 8,
  interiorVisual: 6,
  marketingCampaign: 1,
  marketingCreativePack: 2,
  marketingVisualPreview: 2,
  marketingProfessionalFinal: 2,
  brandSystemText: 1,
  brandDirectionText: 1,
  brandGuidelines: 2,
  brandLogoConcept: 2,
  brandMoodboard: 2,
  brandApplicationVisual: 2,
  brandProfessionalFinal: 2,
  brandVariation: 2,
  architectureText: 2,
  architectureTechnicalPlan: 4,
  architectureDirection: 6,
  architectureVisual: 6,
  architectureProfessionalFinal: 6,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

export function getCreditCost(action: CreditAction) {
  return CREDIT_COSTS[action];
}

export const POWERPOINT_INCLUDED_SLIDES = 10;

export function getPowerPointCreditCost(slideCount: number) {
  const normalizedSlides = Math.max(5, Math.min(20, Math.floor(Number(slideCount) || POWERPOINT_INCLUDED_SLIDES)));

  if (normalizedSlides <= 10) return CREDIT_COSTS.powerpointFull;
  if (normalizedSlides <= 15) return CREDIT_COSTS.powerpoint11To15;
  return CREDIT_COSTS.powerpoint16To20;
}
