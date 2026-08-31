export const CREDIT_COSTS = {
  pdfUtility: 10,
  fileConversion: 10,
  textToImagePreview: 20,
  textToImageHigh: 20,
  imageEdit: 20,
  digitalAdaptationFamily: 20,
  imageToVideoPreview: 130,
  imageToVideoHigh: 130,
  aiUpscale2x: 30,
  aiUpscale4x: 60,
  powerpointDraft: 30,
  powerpointFull: 30,
  powerpoint11To15: 40,
  powerpoint16To20: 50,
  interiorConcept: 60,
  interiorProfessionalConcept: 60,
  interiorTechnicalPlan: 40,
  interiorPreview: 60,
  interiorProfessionalFinal: 60,
  interiorPlan: 80,
  interiorVisual: 60,
  marketingCampaign: 10,
  marketingCreativePack: 20,
  marketingVisualPreview: 20,
  marketingProfessionalFinal: 20,
  brandSystemText: 10,
  brandDirectionText: 10,
  brandGuidelines: 20,
  brandLogoConcept: 20,
  brandMoodboard: 20,
  brandApplicationVisual: 20,
  brandProfessionalFinal: 20,
  brandVariation: 20,
  architectureText: 20,
  architectureTechnicalPlan: 40,
  architectureDirection: 60,
  architectureVisual: 60,
  architectureProfessionalFinal: 60,
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
