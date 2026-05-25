import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { BRAND } from "@/lib/brand";
import { Loader2, Sun, ArrowRight, Mail, Users, FileEdit, Send } from "lucide-react";

const D = {
  surface: "#111111",
  border: "rgba(255,255,255,0.08)",
  text: "#ececec",
  text2: "rgba(255,255,255,0.55)",
  text3: "rgba(255,255,255,0.28)",
  emerald: BRAND.emerald,
  amber: "#f59e0b",
  blue: "#60a5fa",
  font: "'Space Grotesk','Inter',ui-sans-serif,system-ui,sans-serif",
};

type Props = {
  /** StageGate uses trpc; pass enabled=false to hide when not admin */
  enabled?: boolean;
};

export default function DailyBriefPanel({ enabled = true }: Props) {
  const { data, isLoading } = trpc.admin.getDailyBrief.useQuery(undefined, {
    enabled,
    refetchInterval: 60_000,
  });

  if (!enabled) return null;

  const m = data?.metrics;
  const today = data?.date ?? new Date().toISOString().slice(0, 10);

  const statCards = m
    ? [
        {
          label: "New leads today",
          value: m.newExhibitorLeadsToday + m.newProspectsToday,
          sub: `${m.newExhibitorLeadsToday} exhibitor · ${m.newProspectsToday} prospect`,
          icon: Users,
          color: "#f97316",
        },
        {
          label: "Drafts in queue",
          value: m.draftsPending + m.draftsApproved + m.partnerDraftsPending,
          sub: `${m.draftsPending + m.draftsApproved} OEM · ${m.partnerDraftsPending} partner`,
          icon: FileEdit,
          color: D.amber,
        },
        {
          label: "Emails sent today",
          value: m.emailsSentToday,
          sub: `${m.draftsCreatedToday} drafted today`,
          icon: Send,
          color: D.emerald,
        },
        {
          label: "Action items",
          value: data?.nextSteps.length ?? 0,
          sub: `${m.followUpsDue} follow-ups · ${m.awaitingReply} awaiting`,
          icon: Mail,
          color: D.blue,
        },
      ]
    : [];

  return (
    <div
      style={{
        marginBottom: "1.25rem",
        padding: "1.25rem",
        background: D.surface,
        border: `1px solid rgba(0,232,122,0.18)`,
        borderRadius: "0.5rem",
        fontFamily: D.font,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sun size={16} style={{ color: D.emerald }} />
          <div>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: D.text, margin: 0 }}>Daily brief</h2>
            <p style={{ fontSize: "0.75rem", color: D.text3, margin: 0 }}>UTC {today} · intake, outreach, next steps</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: D.text3, fontSize: "0.875rem", padding: "1rem 0" }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading today&apos;s activity…
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.625rem", marginBottom: "1rem" }}>
            {statCards.map((s) => (
              <div
                key={s.label}
                style={{
                  padding: "0.75rem",
                  background: "#1C1E22",
                  border: `1px solid ${D.border}`,
                  borderRadius: "0.375rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
                  <s.icon size={13} style={{ color: s.color }} />
                  <span style={{ fontSize: "0.6875rem", color: D.text2 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: "1.375rem", fontWeight: 700, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                <div style={{ fontSize: "0.625rem", color: D.text3, marginTop: "0.2rem" }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {(data?.nextSteps.length ?? 0) > 0 ? (
            <div>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: D.text3, margin: "0 0 0.5rem" }}>
                Next steps
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {data!.nextSteps.map((step) => (
                  <Link
                    key={step.label}
                    href={step.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.5rem 0.75rem",
                      background: step.priority === "high" ? "rgba(0,232,122,0.06)" : "#1C1E22",
                      border: `1px solid ${step.priority === "high" ? "rgba(0,232,122,0.25)" : D.border}`,
                      borderRadius: "0.375rem",
                      textDecoration: "none",
                      color: D.text,
                    }}
                  >
                    <span style={{ fontSize: "0.8125rem" }}>
                      <strong style={{ color: D.emerald, fontFamily: "var(--font-mono)" }}>{step.count}</strong>
                      {" "}{step.label}
                    </span>
                    <ArrowRight size={13} style={{ color: D.text3, flexShrink: 0 }} />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "0.8125rem", color: D.text3, margin: 0 }}>No pending workflow actions — queue is clear.</p>
          )}
        </>
      )}
    </div>
  );
}
