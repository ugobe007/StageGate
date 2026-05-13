import { Link } from "wouter";

const GOOGLE_CALENDAR_URL =
  "https://calendar.google.com/calendar/embed?src=bc58ef12c74e2216111ee28feb95e5edf6381e54aa8699acdab87cd370177797%40group.calendar.google.com&ctz=America%2FLos_Angeles";

export default function Schedule() {
  return (
    <div style={{ background: "#050508", minHeight: "100vh", color: "#fff" }}>
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "24px 0",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <Link href="/">
            <span
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              ← Back to StageGate
            </span>
          </Link>
        </div>
      </div>

      {/* Hero text */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "64px 24px 40px",
        }}
      >
        <p
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#f59e0b",
            marginBottom: 16,
          }}
        >
          Schedule a Call
        </p>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: 20,
          }}
        >
          Talk to the StageGate team.
        </h1>
        <p
          style={{
            fontSize: 18,
            color: "rgba(255,255,255,0.75)",
            maxWidth: 560,
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          We'll walk through your robot's logistics needs, upcoming shows, and
          how StageGate can handle everything from port to booth.
        </p>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.04em",
          }}
        >
          All times shown in Pacific Time (Los Angeles).
        </p>
      </div>

      {/* Divider */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <div
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 40 }}
        />
      </div>

      {/* Calendar embed */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        <div
          style={{
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <iframe
            src={GOOGLE_CALENDAR_URL}
            style={{
              width: "100%",
              height: 680,
              border: "none",
              display: "block",
            }}
            title="StageGate Scheduling Calendar"
            loading="lazy"
          />
        </div>

        {/* Fallback link */}
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "rgba(255,255,255,0.35)",
            textAlign: "center",
          }}
        >
          Calendar not loading?{" "}
          <a
            href={GOOGLE_CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#f59e0b", textDecoration: "none" }}
          >
            Open in Google Calendar →
          </a>
        </p>
      </div>

      {/* What to expect */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          padding: "60px 0",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 48,
          }}
        >
          {[
            {
              num: "01",
              title: "15-minute intro",
              desc: "Tell us about your robot, your next show, and your timeline.",
            },
            {
              num: "02",
              title: "Custom logistics plan",
              desc: "We'll outline a full plan: customs, shipping, staging, and activation.",
            },
            {
              num: "03",
              title: "No obligation",
              desc: "No sales pressure. If we're not the right fit, we'll say so.",
            },
          ].map((item) => (
            <div key={item.num}>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.25)",
                  display: "block",
                  marginBottom: 10,
                }}
              >
                {item.num}
              </span>
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 18,
                  fontWeight: 600,
                  marginBottom: 8,
                  color: "#fff",
                }}
              >
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
