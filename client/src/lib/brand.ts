/** StageGate brand tokens — see brand identity guidelines */
export const BRAND = {
  emerald: "#00E87A",
  nearBlack: "#1C1E22",
  white: "#FFFFFF",
  deepGreen: "#00A055",
  midGray: "#5A5F64",
  lightGray: "#EBEDF0",
} as const;

const EMERALD_RGB = "0, 232, 122";

/** rgba() helper for emerald tints on dark UI */
export function emeraldAlpha(opacity: number): string {
  return `rgba(${EMERALD_RGB}, ${opacity})`;
}
