export const BRAND_BOOK_CREDIT_COSTS = {
  textGuidelines: 10,
  logoGeneration: 40,
  moodboardGeneration: 60,
  premiumWebsiteMockup: 80,
  premiumPackagingMockup: 80,
  premiumBillboardMockup: 80,
  premiumVehicleMockup: 100,
  fullPremiumMockupPack: 300,
};

export function getBrandBookCreditCost(key: keyof typeof BRAND_BOOK_CREDIT_COSTS) {
  return BRAND_BOOK_CREDIT_COSTS[key];
}
