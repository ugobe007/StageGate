import { BRAND } from "@/lib/brand";

/** Public site URL — used for OG tags, JSON-LD, and absolute asset links. */
export const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://onstage.bot";

export const SITE = {
  name: "StageGate",
  tagline: "Robotics Activation Infrastructure",
  title: "StageGate — Robotics Activation Infrastructure",
  description:
    "StageGate is the deployment infrastructure layer for robot companies — customs, receiving, activation, and field support for trade shows and permanent installs.",
  locale: "en_US",
  themeColor: BRAND.nearBlack,
  twitterHandle: "@onstagebot",
} as const;

/** Absolute URLs for favicons, PWA icons, and social preview images. */
export const SITE_ASSETS = {
  faviconSvg: `${SITE_URL}/stagegate-mark.svg`,
  favicon16: `${SITE_URL}/favicon-16x16.png`,
  favicon32: `${SITE_URL}/favicon-32x32.png`,
  appleTouchIcon: `${SITE_URL}/apple-touch-icon.png`,
  icon192: `${SITE_URL}/icon-192.png`,
  icon512: `${SITE_URL}/icon-512.png`,
  ogImage: `${SITE_URL}/og-image.png`,
  manifest: `${SITE_URL}/site.webmanifest`,
} as const;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE_URL,
    logo: SITE_ASSETS.icon512,
    description: SITE.description,
    sameAs: [] as string[],
  };
}
