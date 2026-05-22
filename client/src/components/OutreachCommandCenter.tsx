/**
 * Post-send command center — confirmation, stats, inbox links, Cal social drafts.
 * Gamified feedback loops after Step 3 (Send).
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  CheckCircle2, Inbox, Telescope, BarChart3, Linkedin, Twitter,
  FileText, Copy, ExternalLink, Mail, MousePointerClick, MessageSquare,
  TrendingUp, Zap, ArrowRight,
} from "lucide-react";
import { buildCalSocialPosts, outreachXpLevel, type OutreachHubStats } from "@/lib/calSocialPosts";

type Props = {
  stats: OutreachHubStats;
  draftsSent: number;
  lastSentAt: Date | string | null;
  queueClear: boolean;
};

function formatWhen(d: Date | string | null): string {
  if (!d) return "recently";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text);
  toast.success(`${label} copied — paste into ${label}`);
}

export default function OutreachCommandCenter({ stats, draftsSent, lastSentAt, queueClear }: Props) {
  const [, setLocation] = useLocation();
  const [expandedSocial, setExpandedSocial] = useState<string | null>("linkedin");

  const sentTotal = Math.max(stats.emailsSent, draftsSent);
  const xp = outreachXpLevel(sentTotal);
  const socialPosts = buildCalSocialPosts({ ...stats, emailsSent: sentTotal });

  const actionCards = [
    {
      id: "inbox",
      icon: Inbox,
      title: "Inbox",
      desc: stats.awaitingInbox > 0
        ? `${stats.awaitingInbox} repl${stats.awaitingInbox !== 1 ? "ies" : "y"} waiting for you`
        : stats.emailsReceived > 0
        ? `${stats.emailsReceived} inbound message${stats.emailsReceived !== 1 ? "s" : ""} logged`
        : "Watch for replies in Pipeline",
      href: "/admin/pipeline",
      badge: stats.awaitingInbox || stats.replied,
      color: "#00ff87",
      pulse: stats.awaitingInbox > 0,
    },
    {
      id: "leads",
      icon: Telescope,
      title: "Lead Generation",
      desc: stats.newLeads > 0
        ? `${stats.newLeads} new prospects to draft`
        : "Discover robot OEMs & show targets",
      href: "/admin/leads",
      badge: stats.newLeads,
      color: "#60a5fa",
      pulse: false,
    },
    {
      id: "stats",
      icon: BarChart3,
      title: "Outreach Stats",
      desc: `${stats.responseRatePct}% response · ${stats.openRatePct}% open rate`,
      href: "/admin/sales-agent",
      badge: stats.opens,
      color: "#fbbf24",
      pulse: stats.opens > 0 && stats.replied === 0,
    },
    {
      id: "prospects",
      icon: Zap,
      title: "Next Batch",
      desc: "Draft more intros with Cal",
      href: "/admin/prospects",
      badge: 0,
      color: "#a78bfa",
      pulse: false,
    },
  ];

  if (sentTotal === 0 && !queueClear) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      {/* Mission complete */}
      {queueClear && sentTotal > 0 && (
        <div style={{
          padding: "1.25rem 1.5rem",
          marginBottom: "1rem",
          borderRadius: "0.5rem",
          border: "1px solid rgba(0,255,135,0.35)",
          background: "linear-gradient(135deg, rgba(0,255,135,0.08) 0%, rgba(0,255,135,0.02) 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
            <CheckCircle2 size={28} style={{ color: "#00ff87", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#00ff87", margin: "0 0 0.35rem" }}>
                Step 3 Complete
              </p>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ececec", margin: 0 }}>
                {draftsSent > 0 ? `${draftsSent} emails confirmed sent` : `${sentTotal} outreach emails in flight`}
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)", margin: "0.35rem 0 0" }}>
                Last batch: {formatWhen(lastSentAt)} · Cal is tracking opens and replies
              </p>
            </div>
            {/* XP bar */}
            <div style={{ minWidth: "10rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "rgba(255,255,255,0.40)", marginBottom: "0.35rem" }}>
                <span>Lvl {xp.level} · {xp.label}</span>
                <span>{sentTotal} / {xp.nextAt} XP</span>
              </div>
              <div style={{ height: "6px", borderRadius: "9999px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${xp.progressPct}%`, background: "linear-gradient(90deg, #00ff87, #fbbf24)", borderRadius: "9999px", transition: "width 0.4s ease" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live stats ticker */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))",
        gap: "0.5rem",
        marginBottom: "1rem",
      }}>
        {[
          { label: "Sent", value: sentTotal, icon: Mail, color: "#60a5fa" },
          { label: "Received", value: stats.emailsReceived, icon: MessageSquare, color: "#00ff87" },
          { label: "Opens", value: stats.opens, icon: TrendingUp, color: "#fbbf24" },
          { label: "Clicks", value: stats.clicks, icon: MousePointerClick, color: "#a78bfa" },
          { label: "Replied", value: stats.replied, icon: CheckCircle2, color: "#00ff87" },
          { label: "Response", value: `${stats.responseRatePct}%`, icon: BarChart3, color: "#f59e0b" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{
              padding: "0.75rem 0.875rem",
              borderRadius: "0.375rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#111111",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                <Icon size={12} style={{ color: s.color }} />
                <span style={{ fontSize: "0.625rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(255,255,255,0.30)" }}>{s.label}</span>
              </div>
              <span style={{ fontSize: "1.125rem", fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          );
        })}
      </div>

      {/* Action loop cards */}
      <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", margin: "0 0 0.5rem" }}>
        Active feedback loops
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => setLocation(card.href)}
              style={{
                textAlign: "left",
                padding: "0.875rem 1rem",
                borderRadius: "0.375rem",
                border: `1px solid ${card.pulse ? `${card.color}55` : "rgba(255,255,255,0.08)"}`,
                background: card.pulse ? `${card.color}08` : "#111111",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <Icon size={16} style={{ color: card.color }} />
                {card.badge > 0 && (
                  <span style={{
                    fontSize: "0.6875rem", fontWeight: 700,
                    padding: "0.1rem 0.4rem", borderRadius: "9999px",
                    background: card.color, color: "#080808",
                    animation: card.pulse ? "pulse 2s infinite" : undefined,
                  }}>{card.badge}</span>
                )}
                <ArrowRight size={12} style={{ color: "rgba(255,255,255,0.25)" }} />
              </div>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#ececec", margin: 0 }}>{card.title}</p>
              <p style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.40)", margin: "0.25rem 0 0", lineHeight: 1.4 }}>{card.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Social amplification */}
      <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", margin: "0 0 0.5rem" }}>
        Online marketing — Cal&apos;s draft posts
      </p>
      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {socialPosts.map((post) => {
          const icon = post.channel === "linkedin" ? Linkedin : post.channel === "x" ? Twitter : FileText;
          const Icon = icon;
          const active = expandedSocial === post.channel;
          return (
            <button
              key={post.channel}
              onClick={() => setExpandedSocial(active ? null : post.channel)}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                fontSize: "0.8125rem", fontWeight: 500,
                padding: "0.375rem 0.75rem",
                border: `1px solid ${active ? "rgba(0,255,135,0.40)" : "rgba(255,255,255,0.10)"}`,
                background: active ? "rgba(0,255,135,0.06)" : "#111111",
                color: active ? "#00ff87" : "rgba(255,255,255,0.55)",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              <Icon size={14} /> {post.label}
            </button>
          );
        })}
      </div>

      {expandedSocial && (() => {
        const post = socialPosts.find((p) => p.channel === expandedSocial);
        if (!post) return null;
        const openUrl = post.channel === "linkedin"
          ? "https://www.linkedin.com/feed/"
          : post.channel === "x"
          ? "https://x.com/compose/tweet"
          : "https://substack.com/sign-in";
        return (
          <div style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "0.5rem",
            background: "#0a0a0a",
            padding: "1rem",
          }}>
            <pre style={{
              fontSize: "0.8125rem", whiteSpace: "pre-wrap", fontFamily: "inherit",
              color: "#ececec", lineHeight: 1.6, margin: "0 0 1rem",
              maxHeight: "14rem", overflow: "auto",
            }}>{post.text}</pre>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => copyText(post.text, post.label)}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 600, padding: "0.375rem 0.875rem", border: "none", background: "#00ff87", color: "#080808", borderRadius: "0.25rem", cursor: "pointer" }}
              >
                <Copy size={13} /> Copy draft
              </button>
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.875rem", border: "1px solid rgba(255,255,255,0.12)", color: "#cbd5e1", borderRadius: "0.25rem", textDecoration: "none" }}
              >
                <ExternalLink size={13} /> {post.cta}
              </a>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
