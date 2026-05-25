/** Shared brand URLs for server-rendered HTML (emails, quotes, previews). */
export const SITE_URL = "https://onstage.bot";

export const SITE_BRAND = {
  name: "StageGate",
  tagline: "Robotics Activation Infrastructure",
  logoIconUrl: `${SITE_URL}/icon-192.png`,
  logoOgUrl: `${SITE_URL}/og-image.png`,
  emerald: "#00E87A",
  nearBlack: "#1C1E22",
} as const;

/** Inline email-safe logo mark (square [S/G] icon). */
export function emailLogoHtml(size = 48): string {
  return `<img src="${SITE_BRAND.logoIconUrl}" alt="${SITE_BRAND.name}" width="${size}" height="${size}" style="display:block;border:0;border-radius:8px;" />`;
}

/** Text fallback lockup for plain-text contexts. */
export const emailLogoText = "[S/G] StageGate";
