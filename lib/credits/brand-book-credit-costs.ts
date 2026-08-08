export const BRAND_BOOK_CREDIT_COSTS = {
  textGuidelines: 1,
  logoGeneration: 4,
  moodboardGeneration: 6,
  premiumWebsiteMockup: 8,
  premiumPackagingMockup: 8,
  premiumBillboardMockup: 8,
  premiumVehicleMockup: 10,
  fullPremiumMockupPack: 30,
};

export function getBrandBookCreditCost(key: keyof typeof BRAND_BOOK_CREDIT_COSTS) {
  return BRAND_BOOK_CREDIT_COSTS[key];
}
