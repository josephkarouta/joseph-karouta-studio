export function getWelcomeCreditAmount() {
  const raw = process.env.HEYY_WELCOME_CREDITS;
  if (raw === undefined || raw.trim() === "") return 30;
  const configured = Number(raw);
  if (!Number.isFinite(configured)) return 30;
  return Math.max(0, Math.floor(configured));
}
