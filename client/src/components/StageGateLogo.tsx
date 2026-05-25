import type { CSSProperties } from "react";
import { BRAND } from "@/lib/brand";

type StageGateLogoProps = {
  /** Width in pixels */
  size?: number;
  /** Icon mark only, or icon + STAGE/GATE wordmark */
  variant?: "icon" | "lockup";
  /** Text color context */
  theme?: "dark" | "light";
  className?: string;
  style?: CSSProperties;
  title?: string;
};

function IconMark({
  emerald,
  textColor,
  centerX,
  y = 24,
  fontSize = 22,
}: {
  emerald: string;
  textColor: string;
  centerX: number;
  y?: number;
  fontSize?: number;
}) {
  return (
    <text
      x={centerX}
      y={y}
      textAnchor="middle"
      fontFamily="'Space Grotesk', 'Inter', system-ui, sans-serif"
      fontSize={fontSize}
      fontWeight="700"
      letterSpacing="-0.03em"
    >
      <tspan fill={emerald}>[</tspan>
      <tspan fill={textColor}>S</tspan>
      <tspan fill={emerald}>/</tspan>
      <tspan fill={textColor}>G</tspan>
      <tspan fill={emerald}>]</tspan>
    </text>
  );
}

function Wordmark({
  emerald,
  textColor,
  centerX,
  y = 58,
  fontSize = 13,
}: {
  emerald: string;
  textColor: string;
  centerX: number;
  y?: number;
  fontSize?: number;
}) {
  return (
    <text
      x={centerX}
      y={y}
      textAnchor="middle"
      fontFamily="'Space Grotesk', 'Inter', system-ui, sans-serif"
      fontSize={fontSize}
      fontWeight="700"
      letterSpacing="0.14em"
    >
      <tspan fill={textColor}>STAGE</tspan>
      <tspan fill={emerald}>/</tspan>
      <tspan fill={emerald}>GATE</tspan>
    </text>
  );
}

/**
 * StageGate brand mark — [S/G] icon with optional STAGE/GATE lockup.
 */
export default function StageGateLogo({
  size = 32,
  variant = "icon",
  theme = "dark",
  className,
  style,
  title = "StageGate",
}: StageGateLogoProps) {
  const emerald = BRAND.emerald;
  const textColor = theme === "dark" ? BRAND.white : BRAND.nearBlack;
  const isLockup = variant === "lockup";
  const viewBox = isLockup ? "0 0 132 68" : "0 0 72 32";
  const width = size;
  const height = Math.round(size * (isLockup ? 68 / 132 : 32 / 72));

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "block", background: "transparent", ...style }}
      role="img"
      aria-label={title}
    >
      {isLockup ? (
        <>
          <IconMark emerald={emerald} textColor={textColor} centerX={66} y={26} />
          <Wordmark emerald={emerald} textColor={textColor} centerX={66} y={58} />
        </>
      ) : (
        <IconMark emerald={emerald} textColor={textColor} centerX={36} y={24} />
      )}
    </svg>
  );
}
