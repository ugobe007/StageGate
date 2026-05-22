/** Cal-authored social drafts for post-outreach amplification */

export type OutreachHubStats = {
  emailsSent: number;
  emailsReceived: number;
  opens: number;
  clicks: number;
  contacted: number;
  replied: number;
  responseRatePct: number;
  openRatePct: number;
  newLeads: number;
};

export type SocialChannel = "linkedin" | "x" | "substack";

export type SocialPostDraft = {
  channel: SocialChannel;
  label: string;
  charLimit: number;
  text: string;
  cta: string;
};

function milestoneLine(sent: number): string {
  if (sent >= 200) return "We're deep in show season outreach.";
  if (sent >= 100) return "Crossed 100 robot OEM conversations this cycle.";
  if (sent >= 50) return "Momentum is building with Vegas show season approaching.";
  return "Kicking off outreach to robot companies heading to major trade shows.";
}

export function buildCalSocialPosts(stats: OutreachHubStats): SocialPostDraft[] {
  const { emailsSent, opens, replied, responseRatePct } = stats;
  const replyNote = replied > 0
    ? `${replied} repl${replied !== 1 ? "ies" : "y"} already in — real conversations, not just opens.`
    : "Watching for replies — the interesting part starts when someone writes back.";

  return [
    {
      channel: "linkedin",
      label: "LinkedIn",
      charLimit: 3000,
      cta: "Post on LinkedIn",
      text: `Robot companies shipping to CES, Automate, and Vegas shows face the same problem: transit damage, last-minute boot failures, and nobody on the ground when something breaks.

At StageGate we warehouse, stage, and tech-support robots during Las Vegas shows — so your team focuses on the demo, not the dock paperwork.

${milestoneLine(emailsSent)} ${replyNote}

If you're exhibiting this season and want a local crew before you land → onstage.bot

#robotics #CES #tradeshows #automation #LasVegas`,
    },
    {
      channel: "x",
      label: "X",
      charLimit: 280,
      cta: "Post on X",
      text: emailsSent >= 100
        ? `Cal update: ${emailsSent}+ outreach emails to robot OEMs this cycle. ${replied > 0 ? `${replied} replies.` : "Inboxes warming up."} Show season logistics is a team sport — we stage & fix bots in Vegas before you hit the floor. onstage.bot`
        : `Robot in a cardboard box is not a shipping plan. We help OEMs warehouse, stage & fix bots during Vegas shows. ${emailsSent} convos started this week. onstage.bot 🤖`,
    },
    {
      channel: "substack",
      label: "Substack",
      charLimit: 5000,
      cta: "Open in Substack",
      text: `What breaks before the booth opens

I sent ${emailsSent} intro emails this week to robot companies heading to major trade shows. ${opens > 0 ? `${opens} opens so far (${stats.openRatePct}% open rate).` : "Tracking opens and replies now."} ${replyNote}

The pattern I keep seeing: teams fly in, the robot worked in the lab, and something small from freight — a loose connector, a misaligned joint — eats the first morning on the floor.

That's why we built StageGate in Las Vegas. Bonded warehouse. Engineers who've handled real hardware. Unpack, diagnose, charge, and roll to the hall when you're ready.

If you're planning CES, NAB, or any Vegas show this year, register free at onstage.bot — takes two minutes.

— Cal, Robot Ready Team @ StageGate

P.S. ${responseRatePct > 0 ? `Response rate sitting at ${responseRatePct}% —` : "Still early, but"} the best conversations are always off-floor anyway.`,
    },
  ];
}

export function outreachXpLevel(emailsSent: number): { level: number; label: string; nextAt: number; progressPct: number } {
  const tiers = [
    { at: 0, label: "Scout" },
    { at: 25, label: "Operator" },
    { at: 50, label: "Field Tech" },
    { at: 100, label: "Show Captain" },
    { at: 200, label: "Floor General" },
    { at: 500, label: "Vegas Legend" },
  ];
  let level = 1;
  let label = tiers[0]!.label;
  let nextAt = tiers[1]!.at;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (emailsSent >= tiers[i]!.at) {
      level = i + 1;
      label = tiers[i]!.label;
      nextAt = tiers[i + 1]?.at ?? tiers[i]!.at + 100;
      break;
    }
  }
  const prevAt = tiers[level - 1]?.at ?? 0;
  const span = nextAt - prevAt;
  const progressPct = span > 0 ? Math.min(100, Math.round(((emailsSent - prevAt) / span) * 100)) : 100;
  return { level, label, nextAt, progressPct };
}
