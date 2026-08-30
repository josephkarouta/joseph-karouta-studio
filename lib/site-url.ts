export function getSiteUrl() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || "https://heyystudio.com")
    .trim()
    .replace(/\/+$/, "");
}

export function sitePath(path = "/") {
  const base = getSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
