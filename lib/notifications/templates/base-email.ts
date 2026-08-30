import { getSiteUrl } from "@/lib/site-url";

type EmailDetail = {
  label: string;
  value?: string | number | null;
};

type BaseEmailProps = {
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
  ctaLabel?: string;
  ctaUrl?: string;
};

const studioThemes: Record<string, { accent: string; accentDark: string; soft: string; label: string }> = {
  brand_studio: { accent: "#9f2ce0", accentDark: "#6f2dff", soft: "#f7eaff", label: "Brand Studio" },
  brand: { accent: "#9f2ce0", accentDark: "#6f2dff", soft: "#f7eaff", label: "Brand Studio" },
  marketing_studio: { accent: "#eb3d87", accentDark: "#b71f62", soft: "#ffeaf4", label: "Marketing Studio" },
  marketing: { accent: "#eb3d87", accentDark: "#b71f62", soft: "#ffeaf4", label: "Marketing Studio" },
  architecture_studio: { accent: "#1676e8", accentDark: "#0f55a8", soft: "#eaf3ff", label: "Architecture Studio" },
  architecture: { accent: "#1676e8", accentDark: "#0f55a8", soft: "#eaf3ff", label: "Architecture Studio" },
  interior_studio: { accent: "#d06b14", accentDark: "#97450a", soft: "#fff0df", label: "Interior Design Studio" },
  interior: { accent: "#d06b14", accentDark: "#97450a", soft: "#fff0df", label: "Interior Design Studio" },
};

export function baseEmail({
  eyebrow,
  title,
  intro,
  preheader,
  recipient = "client",
  studio,
  projectName,
  service,
  status,
  amount,
  details = [],
  detailsTitle = "Project details",
  note,
  ctaLabel = "Open Heyy Studio",
  ctaUrl,
}: BaseEmailProps) {
  const siteUrl = getSiteUrl();
  const theme = studioThemes[normaliseStudio(studio)] || {
    accent: "#7c3aed",
    accentDark: "#5721b8",
    soft: "#f2ebff",
    label: "Heyy Studio",
  };
  const destination = ctaUrl || siteUrl;
  const allDetails: EmailDetail[] = [
    projectName ? { label: "Project", value: projectName } : null,
    service ? { label: "Service", value: service } : null,
    status ? { label: "Status", value: status } : null,
    amount ? { label: "Amount", value: amount } : null,
    ...details,
  ].filter((item): item is EmailDetail => Boolean(item?.value !== undefined && item?.value !== null && String(item.value).trim()));
  const recipientLabel = recipient === "admin" ? "Heyy Studio Admin" : theme.label;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light only; supported-color-schemes: light; }
      .heyy-email-bg { background-color:#f6f4fa !important; }
      .heyy-email-card, .heyy-email-brand, .heyy-email-body { background-color:#ffffff !important; }
      .heyy-email-copy { color:#555062 !important; }
      .heyy-email-strong { color:#17131f !important; }
      @media (prefers-color-scheme: dark) {
        .heyy-email-bg { background-color:#f6f4fa !important; }
        .heyy-email-card, .heyy-email-brand, .heyy-email-body { background-color:#ffffff !important; }
        .heyy-email-copy { color:#555062 !important; }
        .heyy-email-strong { color:#17131f !important; }
      }
      @media only screen and (max-width: 620px) {
        .heyy-email-wrap { padding:16px 8px !important; }
        .heyy-email-pad { padding-left:20px !important; padding-right:20px !important; }
        .heyy-email-title { font-size:30px !important; line-height:1.08 !important; letter-spacing:-.7px !important; }
        .heyy-email-brand-logo { width:132px !important; }
        .heyy-email-brand-label { font-size:9px !important; letter-spacing:1.25px !important; }
        .heyy-email-detail-label { width:39% !important; }
        .heyy-email-footer-left, .heyy-email-footer-right { display:block !important; width:100% !important; text-align:left !important; }
        .heyy-email-footer-right { padding-top:10px !important; }
      }
    </style>
  </head>
  <body class="heyy-email-bg" bgcolor="#f6f4fa" style="margin:0;padding:0;background:#f6f4fa;font-family:Arial,Helvetica,sans-serif;color:#17131f;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;">
      ${escapeHtml(preheader || intro)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f6f4fa" class="heyy-email-bg" style="width:100%;background:#f6f4fa;">
      <tr>
        <td align="center" class="heyy-email-wrap" style="padding:28px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" class="heyy-email-card" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e5e0ec;border-radius:24px;overflow:hidden;box-shadow:0 18px 55px rgba(39,24,64,.10);">
            <tr>
              <td bgcolor="#ffffff" class="heyy-email-brand heyy-email-pad" style="padding:20px 30px 18px;background:#ffffff;border-top:4px solid ${theme.accent};border-bottom:1px solid #ece8f0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="cid:heyy-studio-logo" alt="Heyy Studio" width="148" class="heyy-email-brand-logo" style="display:block;width:148px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;background:#ffffff;" />
                    </td>
                    <td align="right" class="heyy-email-brand-label" style="color:${theme.accentDark};font-size:10px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;vertical-align:middle;">
                      ${escapeHtml(recipientLabel)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td bgcolor="#17131f" class="heyy-email-pad" style="padding:30px 30px 32px;background:#17131f;border-bottom:4px solid ${theme.accent};">
                <div style="display:inline-block;padding:7px 11px;border:1px solid ${theme.accent};border-radius:999px;background:#231a2d;color:#ffffff;font-size:10px;font-weight:900;letter-spacing:1.55px;text-transform:uppercase;">
                  ${escapeHtml(eyebrow)}
                </div>
                <h1 class="heyy-email-title" style="margin:16px 0 0;color:#f6f4fa;font-size:34px;line-height:1.08;letter-spacing:-1.05px;font-weight:900;">
                  ${escapeHtml(title)}
                </h1>
              </td>
            </tr>

            <tr>
              <td bgcolor="#ffffff" class="heyy-email-body heyy-email-pad" style="padding:30px 30px 12px;background:#ffffff;">
                <p class="heyy-email-copy" style="margin:0;color:#555062;font-size:16px;line-height:1.7;font-weight:500;">
                  ${escapeHtml(intro)}
                </p>
              </td>
            </tr>

            ${allDetails.length ? renderDetails(allDetails, detailsTitle, theme) : ""}

            ${note ? `
            <tr>
              <td bgcolor="#ffffff" class="heyy-email-body heyy-email-pad" style="padding:12px 30px 0;background:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${theme.soft}" style="background:${theme.soft};border:1px solid ${theme.accent}33;border-radius:16px;">
                  <tr>
                    <td style="padding:15px 17px;color:#51495c;font-size:13px;line-height:1.6;font-weight:600;">
                      ${escapeHtml(note)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>` : ""}

            <tr>
              <td bgcolor="#ffffff" class="heyy-email-body heyy-email-pad" style="padding:26px 30px 34px;background:#ffffff;">
                <a href="${escapeAttribute(destination)}" style="display:inline-block;background:${theme.accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:900;padding:15px 22px;border-radius:999px;box-shadow:0 10px 24px ${theme.accent}33;">
                  ${escapeHtml(ctaLabel)}
                </a>
                <p class="heyy-email-copy" style="margin:22px 0 0;color:#8a8394;font-size:12px;line-height:1.65;">
                  Manage your projects, messages, payments and account inside your Heyy Studio workspace.
                </p>
              </td>
            </tr>

            <tr>
              <td bgcolor="#17131f" class="heyy-email-pad" style="padding:22px 30px;background:#17131f;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="heyy-email-footer-left" style="color:#ffffff;font-size:12px;font-weight:800;line-height:1.6;">
                      Create with AI. Build with Experts.
                    </td>
                    <td align="right" class="heyy-email-footer-right" style="color:#aaa1b6;font-size:11px;line-height:1.6;">
                      <a href="${escapeAttribute(siteUrl)}" style="color:#ffffff;text-decoration:none;">heyystudio.com</a><br />
                      hello@heyystudio.com
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:16px 0 0;color:#8c8497;font-size:10px;line-height:1.6;text-align:center;">
            ${recipient === "admin" ? "This operational notification was sent to the Heyy Studio administration team." : "This message was sent by Heyy Studio about your account, payment or project."}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function renderDetails(
  details: EmailDetail[],
  detailsTitle: string,
  theme: { accent: string; soft: string },
) {
  const rows = details.map((detail, index) => `
    <tr>
      <td width="42%" class="heyy-email-detail-label" style="width:42%;padding:14px 16px;${index < details.length - 1 ? "border-bottom:1px solid #ebe7ef;" : ""}color:#81798b;font-size:12px;font-weight:700;vertical-align:top;">${escapeHtml(detail.label)}</td>
      <td align="right" style="padding:14px 16px;${index < details.length - 1 ? "border-bottom:1px solid #ebe7ef;" : ""}color:#211a29;font-size:13px;font-weight:800;line-height:1.5;vertical-align:top;word-break:break-word;">${escapeHtml(String(detail.value ?? ""))}</td>
    </tr>`).join("");

  return `
    <tr>
      <td bgcolor="#ffffff" class="heyy-email-body heyy-email-pad" style="padding:14px 30px 0;background:#ffffff;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fbfafc" style="background:#fbfafc;border:1px solid #e8e3ed;border-radius:18px;overflow:hidden;">
          <tr>
            <td colspan="2" bgcolor="${theme.soft}" style="padding:12px 16px;background:${theme.soft};border-bottom:1px solid ${theme.accent}24;color:${theme.accent};font-size:10px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;">${escapeHtml(detailsTitle)}</td>
          </tr>
          ${rows}
        </table>
      </td>
    </tr>`;
}

function normaliseStudio(studio?: string | null) {
  return String(studio || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
