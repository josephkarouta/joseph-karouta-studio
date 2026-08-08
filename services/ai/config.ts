export const AI_CONFIG = {
  developerMode:
    process.env.NEXT_PUBLIC_DEVELOPER_MODE === "true",

  mockImages:
    process.env.NEXT_PUBLIC_MOCK_IMAGES === "true",

  mockChat:
    process.env.NEXT_PUBLIC_MOCK_CHAT === "true",

  simulateDelay:
    Number(process.env.NEXT_PUBLIC_AI_DELAY ?? 0),
};