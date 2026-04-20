const FALLBACK_SITE_URL = "https://urbis.linekoders.com";

export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (!fromEnv) {
    return FALLBACK_SITE_URL;
  }

  const normalized = fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;

  try {
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function getAbsoluteUrl(pathname = "/"): string {
  const base = getSiteUrl();
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${safePath}`;
}
