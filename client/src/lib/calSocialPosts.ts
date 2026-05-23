/** Cal-authored social drafts — insight and curiosity only. Never volume or send counts. */

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
  lastSentAt?: Date | string | null;
};

export type SocialChannel = "linkedin" | "x" | "substack";

export type SocialPostDraft = {
  channel: SocialChannel;
  label: string;
  charLimit: number;
  text: string;
  cta: string;
};

const CURIOUS_HOOKS = [
  "Question I keep asking robot teams before show season: when does your hardware actually get a full run after freight — not just a power-on in the hotel room?",
  "Curious who else has watched a demo-ready robot fail for a dumb reason — loose connector, not software.",
  "Show season is close. I wonder how many teams have someone local who can fix hardware before the founder lands.",
  "Most interesting conversations at shows happen off the main floor. Wondering who's planning for that this year.",
];

function pickHook(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CURIOUS_HOOKS[h % CURIOUS_HOOKS.length]!;
}

/** Social posts never mention how many emails were sent — that's admin data, not Cal's voice. */
export function buildCalSocialPosts(_stats?: Partial<OutreachHubStats>): SocialPostDraft[] {
  const hook = pickHook(new Date().toDateString());

  return [
    {
      channel: "linkedin",
      label: "LinkedIn",
      charLimit: 3000,
      cta: "Post on LinkedIn",
      text: `This is Cal from StageGate.

Last CES I watched a team spend their first morning on the floor with a robot that worked fine in the lab and wouldn't boot in the hall. Turned out to be a connector that shook loose in transit. Twenty-minute fix — if someone local had been there at 6am.

${hook}

I help robot teams in Las Vegas with warehouse, staging, and hands-on tech before they hit the show floor. If that's relevant for your team, I'm at onstage.bot.

#robotics #CES`,
    },
    {
      channel: "x",
      label: "X",
      charLimit: 280,
      cta: "Post on X",
      text: `Cal from StageGate. A humanoid in a cardboard box is not a shipping plan. (Learned that one the hard way.) If you're bringing robots to Vegas for a show — happy to talk staging before you land. onstage.bot`,
    },
    {
      channel: "substack",
      label: "Substack",
      charLimit: 5000,
      cta: "Open in Substack",
      text: `Notes from the floor

I'm not going to give you a deck on "robot logistics." You've seen those. Here's what I actually see.

Someone ships a robot cross-country. It arrives. Looks fine. Demo day, it glitches — sensor, connector, software that doesn't love show-floor Wi‑Fi. The founder is running the meeting and also trying to debug at the same time. Nobody wins.

I used to be in the lab at UNLV. I've prepped robots for live demos. I know that feeling in your stomach when the thing won't move and the crowd is already walking up.

That's why StageGate exists in Las Vegas. We hold the robot before you get there. Unpack it. Charge it. Run it. If freight knocked something loose, we fix it before your first meeting.

${hook}

If you're exhibiting at CES, NAB, or anything in Vegas this year — onstage.bot. Or reply to an email from me. I read them.

— Cal
Robot Ready Team @ StageGate`,
    },
  ];
}
