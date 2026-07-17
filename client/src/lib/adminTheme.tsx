/**
 * Shared admin-panel design tokens + layout primitives.
 *
 * Panels are LIGHTER than the page background and carry a soft shadow so they
 * read as raised surfaces (not recessed holes). Import `ADMIN` for inline
 * styles, `adminTw` for Tailwind class strings, or the layout components below.
 */
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { BRAND, emeraldAlpha } from "./brand";

export const ADMIN = {
  bg: "#1C1E22",
  bgGradient: "linear-gradient(180deg,#202329 0%,#1C1E22 60%)",
  surface: "#24272e",
  surfaceGrad: "linear-gradient(180deg,#282c34 0%,#22252c 100%)",
  s2: "#2b2f38",
  border: "rgba(255,255,255,0.10)",
  borderHi: "rgba(255,255,255,0.16)",
  text: "#f3f4f6",
  text2: "rgba(255,255,255,0.64)",
  text3: "rgba(255,255,255,0.40)",
  emerald: BRAND.emerald,
  emeraldDim: emeraldAlpha(0.14),
  amber: "#f59e0b",
  blue: "#60a5fa",
  red: "#ef4444",
  shadow: "0 1px 2px rgba(0,0,0,0.40), 0 6px 20px rgba(0,0,0,0.22)",
  font: "'Space Grotesk','Inter',ui-sans-serif,system-ui,sans-serif",
} as const;

/** Ready-to-spread style for a raised admin card. */
export const adminCardStyle: CSSProperties = {
  background: ADMIN.surfaceGrad,
  border: `1px solid ${ADMIN.border}`,
  borderRadius: "0.625rem",
  boxShadow: ADMIN.shadow,
};

export const adminPageOuterStyle: CSSProperties = {
  minHeight: "100%",
  background: ADMIN.bgGradient,
  color: ADMIN.text,
  fontFamily: ADMIN.font,
};

export const adminPageInnerStyle: CSSProperties = {
  padding: "1.5rem",
  maxWidth: "1200px",
  margin: "0 auto",
};

/** Tailwind utility strings for shadcn / className-based admin pages. */
export const adminTw = {
  page: "min-h-full text-[#f3f4f6]",
  card:
    "rounded-[0.625rem] border border-white/10 bg-gradient-to-b from-[#282c34] to-[#22252c] shadow-[0_1px_2px_rgba(0,0,0,0.4),0_6px_20px_rgba(0,0,0,0.22)]",
  cardHover: "transition-all duration-150 hover:border-white/16 hover:-translate-y-px",
  panel: "rounded-[0.625rem] border border-white/10 bg-[#24272e]",
  muted: "text-white/64",
  dim: "text-white/40",
  input: "bg-[#2b2f38] border-white/10 text-[#f3f4f6] placeholder:text-white/35",
  divider: "border-white/10",
  tabActive: "border-[#00E87A] text-[#f3f4f6]",
  tabInactive: "border-transparent text-white/55 hover:text-white/80",
  statValue: "text-2xl font-bold font-mono tabular-nums",
} as const;

export function AdminPage({
  children,
  maxWidth = "1200px",
  fullHeight,
  noPadding,
  className,
  surface = "dark",
}: {
  children: ReactNode;
  maxWidth?: string;
  fullHeight?: boolean;
  noPadding?: boolean;
  className?: string;
  /** `light` for raised-card layouts (e.g. Cal workflow) on a soft gray base. */
  surface?: "dark" | "light";
}) {
  const outerStyle =
    surface === "light"
      ? {
          minHeight: "100%",
          background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
          color: "#0f172a",
          fontFamily: ADMIN.font,
        }
      : adminPageOuterStyle;

  return (
    <div
      className={className}
      style={{
        ...outerStyle,
        ...(fullHeight ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0 } : {}),
      }}
    >
      <div
        style={{
          ...adminPageInnerStyle,
          maxWidth,
          ...(noPadding ? { padding: 0 } : {}),
          ...(fullHeight ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 0, maxWidth: "none" } : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AdminCard({
  children,
  style,
  accentColor,
  padding = "1.25rem",
  onMouseEnter,
  onMouseLeave,
}: {
  children: ReactNode;
  style?: CSSProperties;
  accentColor?: string;
  padding?: string | number;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      style={{
        ...adminCardStyle,
        padding,
        ...(accentColor ? { borderLeft: `2px solid ${accentColor}` } : {}),
        ...style,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
}

export function AdminPageHeader({
  kicker,
  title,
  description,
  icon: Icon,
  actions,
  backHref = "/admin",
  backLabel = "Admin",
}: {
  kicker?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div
      style={{
        marginBottom: "1.5rem",
        borderBottom: `1px solid ${ADMIN.border}`,
        paddingBottom: "1rem",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && (
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.5625rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ADMIN.emerald,
              margin: "0 0 0.4rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: ADMIN.emerald,
                boxShadow: `0 0 8px ${ADMIN.emerald}`,
              }}
            />
            {kicker}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {Icon && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: "0.5rem",
                background: emeraldAlpha(0.12),
                border: `1px solid ${emeraldAlpha(0.25)}`,
              }}
            >
              <Icon size={16} style={{ color: ADMIN.emerald }} />
            </span>
          )}
          <div>
            <h1
              style={{
                fontSize: "1.375rem",
                fontWeight: 700,
                color: ADMIN.text,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </h1>
            {description && (
              <p style={{ fontSize: "0.8125rem", color: ADMIN.text2, margin: "0.25rem 0 0" }}>
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        {backHref && (
          <Link href={backHref}>
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.8125rem",
                color: ADMIN.text2,
                background: "transparent",
                border: `1px solid ${ADMIN.border}`,
                borderRadius: "0.375rem",
                padding: "0.35rem 0.65rem",
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={13} /> {backLabel}
            </button>
          </Link>
        )}
        {actions}
      </div>
    </div>
  );
}
