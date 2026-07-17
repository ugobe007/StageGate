/**
 * Detect pre-Cal (Frank / XBOT sales) drafts still stored in draft_emails.
 * Used to auto-redraft on read so admins never review stale pitch copy.
 */

const LEGACY_BODY_PATTERNS: RegExp[] = [
  /\bFrank\b[\s\S]{0,80}StageGate — Robotics/i,
  /Robotics Activation Infrastructure/i,
  /\b480V\b/,
  /field-ready/i,
  /Zero-Risk/i,
  /Saw you're bringing/i,
  /end-to-end robotics logistics/i,
  /demo day surprises/i,
  /We handle end-to-end/i,
  /We ensure your units/i,
  /Worth a quick call/i,
  /100% field-ready/i,
  /metropolitan rigging/i,
  /onstage\.bot\s*$/im,
  /You are XBOT/i,
];

const LEGACY_SUBJECT_PATTERNS: RegExp[] = [
  /^MODEX 20\d{2}:/i,
  /^StageGate: Las Vegas Robot Logistics/i,
  /Zero-Risk/i,
];

function hasCalFieldNoteVoice(body: string): boolean {
  const trimmed = body.trim();
  const hasSignature = /—\s*Cal\s*$/.test(trimmed) || trimmed.endsWith("— Cal");
  if (!hasSignature) return false;
  return (
    /Deployment Diary/.test(body) ||
    /I'm curious|Does that|Have you|What's the|If you|How often|Where do|When a customer|How do you/.test(body)
  );
}

/** True when body/subject match old Frank or XBOT sales outreach, not Cal field notes. */
export function isLegacyFrankDraft(body: string, subject?: string | null): boolean {
  if (!body?.trim()) return false;
  if (hasCalFieldNoteVoice(body)) return false;

  const combined = `${subject ?? ""}\n${body}`;
  if (LEGACY_BODY_PATTERNS.some((p) => p.test(combined))) return true;
  if (subject && LEGACY_SUBJECT_PATTERNS.some((p) => p.test(subject))) return true;

  // Old discovery emails pitched logistics without a field-note header.
  if (
    !/Field Note #|Deployment Diary/.test(body) &&
    (/logistics, staging, and activation|flashed, fully tested|rigging, 480V|focus on closing deals/i.test(body))
  ) {
    return true;
  }

  return false;
}

/** Pending drafts that should be regenerated (legacy Frank copy or old Cal numbered headers). */
export function needsCalDraftRefresh(body: string, subject?: string | null): boolean {
  if (!body?.trim()) return false;
  if (isLegacyFrankDraft(body, subject)) return true;
  if (/Field Note #\d+/.test(body)) return true;
  return false;
}
