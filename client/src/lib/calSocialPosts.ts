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

function weekNote(sent: number, replied: number, opens: number): string {
  if (replied > 0) {
    return `Been reaching out to robot teams all week (${sent} notes sent). Already got ${replied} ${replied === 1 ? "reply" : "replies"} back — that’s the part I care about.`;
  }
  if (opens > 0) {
    return `Sent ${sent} notes to robot companies this week. A few opens trickling in. Waiting on the first real reply.`;
  }
  if (sent > 0) {
    return `Sent ${sent} notes to robot companies this week. Show season is coming fast.`;
  }
  return "Show season is coming fast.";
}

export function buildCalSocialPosts(stats: OutreachHubStats): SocialPostDraft[] {
  const { emailsSent, opens, replied } = stats;
  const week = weekNote(emailsSent, replied, opens);

  return [
    {
      channel: "linkedin",
      label: "LinkedIn",
      charLimit: 3000,
      cta: "Post on LinkedIn",
      text: `This is Cal from StageGate.

Last CES I watched a team spend their first morning on the floor with a robot that worked fine in the lab and wouldn’t boot in the hall. Turned out to be a connector that shook loose in transit. Twenty-minute fix — if someone local had been there at 6am.

${week}

I run robot logistics in Las Vegas — warehouse, staging, hands-on tech when something breaks before your team lands. If you’re heading to a Vegas show and that sounds useful, I’m easy to find at onstage.bot.

#robotics #CES`,
    },
    {
      channel: "x",
      label: "X",
      charLimit: 280,
      cta: "Post on X",
      text: replied > 0
        ? `Cal here. ${emailsSent} outreach emails this week, ${replied} ${replied === 1 ? "reply" : "replies"} so far. One guy’s robot died in transit last year and he missed day one of CES. We fix that stuff in Vegas now. onstage.bot`
        : emailsSent >= 50
        ? `Show season note: sent ${emailsSent} emails to robot OEMs this week. The good news always comes back as a reply, not an open. onstage.bot`
        : `A humanoid in a cardboard box is not a shipping plan. (Learned that one the hard way.) We stage robots in Vegas now. onstage.bot`,
    },
    {
      channel: "substack",
      label: "Substack",
      charLimit: 5000,
      cta: "Open in Substack",
      text: `Notes from the outreach desk

${week}

I’m not going to give you a deck on “robot logistics.” You’ve seen those. Here’s what I actually see.

Someone ships a robot cross-country. It arrives. Looks fine. Demo day, it glitches — sensor, connector, software that doesn’t love show-floor Wi‑Fi. The founder is running the meeting and also trying to debug at the same time. Nobody wins.

I used to be in the lab at UNLV. I’ve prepped robots for live demos. I know that feeling in your stomach when the thing won’t move and the crowd is already walking up.

That’s the whole reason StageGate exists in Las Vegas. We hold the robot before you get there. Unpack it. Charge it. Run it. If freight knocked something loose, we fix it before your first meeting.

If you’re exhibiting at CES, NAB, or anything in Vegas this year and want a local crew — onstage.bot. Register’s free. Or just reply to one of my emails. I read them.

— Cal
Robot Ready Team @ StageGate`,
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
