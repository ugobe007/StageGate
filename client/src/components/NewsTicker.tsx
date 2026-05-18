/**
 * NewsTicker — fixed bar placed immediately below the main nav.
 * Shows upcoming LV show dates + curated robotics/conference headlines.
 * Scrolls continuously; pauses on hover.
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Calendar, Rss } from "lucide-react";

const INDIGO = "oklch(0.72 0.20 262)";
const AMBER  = "oklch(0.78 0.18 75)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const TEXT_DIM = "oklch(0.50 0.010 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";

// Fallback items shown while the query loads
const FALLBACK_ITEMS = [
  { type: "show" as const,  text: "CES 2027 — Las Vegas, Jan 6–9" },
  { type: "news" as const,  text: "Unitree G1 cleared US customs — operators entering Las Vegas market" },
  { type: "news" as const,  text: "Figure AI deploying humanoids at BMW and US 3PL facilities" },
  { type: "show" as const,  text: "Manifest 2027 — Las Vegas, Feb" },
  { type: "news" as const,  text: "CES 2027 Eureka Park: record humanoid applications expected" },
  { type: "news" as const,  text: "StageGate now supports bonded warehouse receiving for international robot shipments" },
];

export default function NewsTicker() {
  const { data } = trpc.news.ticker.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,   // cache 5 min
    refetchOnWindowFocus: false,
  });

  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Build flat item list from server data or fallback
  const items = data
    ? [
        ...data.shows.map((s) => ({ type: "show" as const, text: s.text })),
        ...data.headlines.map((h) => ({ type: "news" as const, text: h.text })),
      ]
    : FALLBACK_ITEMS;

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        position: "fixed",
        top: "56px",
        left: 0,
        right: 0,
        height: "28px",
        zIndex: 29,
        background: CARD,
        borderBottom: `1px solid ${BORDER}`,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Label badge */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "0 10px 0 12px",
          borderRight: `1px solid ${BORDER}`,
          height: "100%",
          fontSize: "9px",
          fontFamily: "monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: INDIGO,
          background: `${INDIGO}0a`,
          whiteSpace: "nowrap",
        }}
      >
        <Rss size={9} />
        LIVE
      </div>

      {/* Scrolling track */}
      <div
        style={{ flex: 1, overflow: "hidden", position: "relative", height: "100%" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <style>{`
          @keyframes ticker-scroll {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-track {
            display: flex;
            align-items: center;
            height: 100%;
            width: max-content;
            animation: ticker-scroll 60s linear infinite;
            will-change: transform;
          }
          .ticker-track.paused {
            animation-play-state: paused;
          }
        `}</style>
        <div
          ref={trackRef}
          className={`ticker-track${paused ? " paused" : ""}`}
        >
          {doubled.map((item, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "0 18px",
                fontSize: "11px",
                color: item.type === "show" ? TEXT_MID : TEXT_DIM,
                whiteSpace: "nowrap",
              }}
            >
              {item.type === "show" ? (
                <Calendar
                  size={9}
                  style={{ color: AMBER, flexShrink: 0 }}
                />
              ) : (
                <span style={{ color: INDIGO, fontSize: "8px", lineHeight: 1 }}>●</span>
              )}
              {item.text}
              <span style={{ color: BORDER, marginLeft: "10px" }}>·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
