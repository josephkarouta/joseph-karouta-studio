import { baseEmail } from "./base-email";
import { getSiteUrl } from "@/lib/site-url";

type EmailDetail = {
  label: string;
  value?: string | number | null;
};

type BuildEmailOptions = {
  eyebrow: string;
  title: string;
  intro: string;
  preheader?: string;
  recipient?: "client" | "admin";
  studio?: string | null;
  projectName?: string | null;
  service?: string | null;
  status?: string | null;
  amount?: string | null;
  details?: EmailDetail[];
  detailsTitle?: string;
  note?: string | null;
  supportingCopy?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function buildEmail(options: BuildEmailOptions) {
  return ensurePublicEmailLogo(baseEmail(options));
}

export function buildPlainTextEmail(options: BuildEmailOptions) {
  const details: EmailDetail[] = [
    options.projectName ? { label: "Project", value: options.projectName } : null,
    options.service ? { label: "Service", value: options.service } : null,
    options.status ? { label: "Status", value: options.status } : null,
    options.amount ? { label: "Amount", value: options.amount } : null,
    ...(options.details || []),
  ].filter((item): item is EmailDetail => Boolean(item?.value !== undefined && item?.value !== null && String(item.value).trim()));

  return [
    options.title,
    "",
    options.intro,
    "",
    ...details.flatMap((detail) => [`${detail.label}:`, String(detail.value), ""]),
    options.note || "",
    "",
    `${options.ctaLabel || "Open Heyy Studio"}: ${options.ctaUrl || getSiteUrl()}`,
    "",
    "Create with AI. Build with Experts.",
    "Heyy Studio",
  ].filter((line, index, array) => line || array[index - 1] !== "").join("\n").trim();
}

function ensurePublicEmailLogo(html: string) {
  const logoUrl = `${getSiteUrl().replace(/\/+$/, "")}/icon.png`;
  const replaceSrc = (tag: string) => {
    if (/\bsrc\s*=\s*["'][^"']*["']/i.test(tag)) {
      return tag.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${logoUrl}"`);
    }
    return tag.replace(/<img\b/i, `<img src="${logoUrl}"`);
  };

  // Prefer the Heyy/logo image when the template identifies it explicitly.
  const brandedImage = /<img\b[^>]*(?:alt\s*=\s*["'][^"']*heyy[^"']*["']|src\s*=\s*["'][^"']*(?:heyy|logo)[^"']*["'])[^>]*>/i;
  if (brandedImage.test(html)) return html.replace(brandedImage, replaceSrc);

  // The shared shell currently places its brand image first. This fallback keeps
  // the template intact while ensuring Gmail/Outlook receive a public HTTPS URL.
  return html.replace(/<img\b[^>]*>/i, replaceSrc);
}
