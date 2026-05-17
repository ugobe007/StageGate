/**
 * server/agents/intentClassifier.ts
 *
 * Multi-layer intent and mood detection for inbound prospect emails.
 *
 * Layer 1 — Pattern matching (zero latency, covers obvious signals)
 * Layer 2 — Semantic phrase matching (covers natural language variants)
 * Layer 3 — LLM classification (fallback for NEUTRAL / low-confidence)
 *
 * Intent categories:
 *   POSITIVE_SCHEDULE  — "yes", "sounds good", "let's plan it", "sure Cal"
 *   AVAILABILITY_GIVEN — "I'm free Tuesday", "these dates work for me"
 *   ASKING_AVAILABILITY — "when are you free?", "what's your availability?"
 *   CALENDAR_REQUEST   — "please send an invite", "send me a calendar link"
 *   QUESTION           — asking about services, pricing, technical specifics
 *   NEGATIVE           — "not interested", "not the right time", "pass"
 *   OPT_OUT            — "unsubscribe", "remove me", "stop emailing"
 *   NEUTRAL            — general reply, unclear intent
 */

import { invokeLLM } from "../_core/llm.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IntentCategory =
  | "POSITIVE_SCHEDULE"
  | "AVAILABILITY_GIVEN"
  | "ASKING_AVAILABILITY"
  | "CALENDAR_REQUEST"
  | "QUESTION"
  | "NEGATIVE"
  | "OPT_OUT"
  | "NEUTRAL";

export type Mood = "positive" | "neutral" | "negative";
export type Confidence = "high" | "medium" | "low";

export interface IntentResult {
  intent: IntentCategory;
  confidence: Confidence;
  mood: Mood;
  wantsToSchedule: boolean;   // true for POSITIVE_SCHEDULE | CALENDAR_REQUEST | AVAILABILITY_GIVEN | ASKING_AVAILABILITY
  wantsOptOut: boolean;
  extractedDates: string[];   // raw date/time strings mentioned in the email
  reasoning: string;
}

// ─── Layer 1: Exact + fuzzy pattern banks ────────────────────────────────────

const OPT_OUT_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\bstop emailing\b/i,
  /\bdo not contact\b/i,
  /\bdo not email\b/i,
  /\bopt[\s-]?out\b/i,
  /\btake me off\b/i,
  /\bplease don'?t (email|contact|reach out)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\bnot interested\b/i,
  /\bno thanks?\b/i,
  /\bno thank you\b/i,
  /\bpas+\b/i,
  /\bnot (at this time|right now|a fit|the right fit|a priority)\b/i,
  /\bnot for us\b/i,
  /\bdoesn'?t (apply|work) for us\b/i,
  /\bmaybe (later|another time|next year)\b/i,
  /\bcheck back (later|in a few months|next quarter)\b/i,
  /\bwe'?re (good|all set|covered)\b/i,
  /\bwe (already have|use|work with) (someone|a vendor|a partner)\b/i,
  /\bno need\b/i,
  /\bnot looking\b/i,
  /\bnot in the (budget|plan)\b/i,
];

const CALENDAR_REQUEST_PATTERNS = [
  /\bsend (me )?(a |the )?calendar (invite|link|event|request)\b/i,
  /\bplease send (an |the )?invite\b/i,
  /\bcalendly\b/i,
  /\bbook (it|a time|the (call|meeting|demo))\b/i,
  /\bsend (over )?(an |the )?invite\b/i,
  /\bput (something |it )?on (the |my )?calendar\b/i,
  /\bblock (it|the time|the slot)\b/i,
  /\bsend (a |the )?(meeting|calendar) (link|request|invite)\b/i,
];

const ASKING_AVAILABILITY_PATTERNS = [
  /\bwhat'?s your availability\b/i,
  /\bwhen are you (free|available|open)\b/i,
  /\bwhen (can|could|would) (we|you)\b/i,
  /\bwhat (time|day|days?) works (for you|best)\b/i,
  /\bwhat works (for you|on your end)\b/i,
  /\bany (time|availability) (this week|next week|this month)\b/i,
  /\bwhen does? (this|that|it) work (for you)?\b/i,
  /\bdo you have (time|availability)\b/i,
  /\bwhat (are|is) your (schedule|calendar)\b/i,
];

const POSITIVE_SCHEDULE_PATTERNS = [
  // Direct affirmatives
  /^\s*(yes|yeah|yep|yup|sure|absolutely|definitely|totally|of course|indeed|affirmative)\b/i,
  /\byes[,!.]?\s*(please|let'?s|i'?d love to|that (sounds|works))/i,
  /\bsounds (good|great|perfect|interesting|amazing|like a plan|right)\b/i,
  /\blooks good\b/i,
  /\bworks for me\b/i,
  /\bI'?m in\b/i,
  /\bI'?d (love|like) to\b/i,
  /\bI'?m interested\b/i,
  /\binterested in (learning|hearing|chatting|talking|discussing)\b/i,
  /\bwould (love|like) to (connect|chat|talk|discuss|schedule|set up|meet)\b/i,
  // Scheduling verbs
  /\blet'?s (do it|set (up|a time)|schedule|plan|connect|chat|talk|meet|hop on|jump on)\b/i,
  /\blet'?s (get|set up) (a |the )?(call|meeting|demo|time)\b/i,
  /\b(happy|glad|great) to (connect|chat|talk|meet|discuss|schedule)\b/i,
  /\b(please |go ahead and )?(reach out|contact|schedule|set (up|a time)|send (an |the )?invite)\b/i,
  /\bthat (sounds|would be) (great|good|perfect|interesting|helpful|useful)\b/i,
  /\bthis sounds (interesting|great|helpful|relevant|perfect|exactly what)\b/i,
  /\bwe('d| would) (like|love|be interested) (to|in)\b/i,
  /\bfeel free (to call|to reach out|to schedule|to send)\b/i,
  /\bgo ahead (and send|and schedule|and set)\b/i,
  /\bplease (do|go ahead|send|reach out|set it up)\b/i,
  /\bopen to (a call|a demo|chatting|talking|learning more)\b/i,
  /\bwould (appreciate|welcome) (a call|a chat|more info)\b/i,
  /\btell me more\b/i,
  /\bI want to (learn|hear|know) more\b/i,
];

const AVAILABILITY_GIVEN_PATTERNS = [
  /\bI'?m (available|free|open|around)\b/i,
  /\bI am (available|free|open)\b/i,
  /\b(available|free|open) on\b/i,
  /\b(available|free|open) (Monday|Tuesday|Wednesday|Thursday|Friday|this week|next week)\b/i,
  /\bhow about (Monday|Tuesday|Wednesday|Thursday|Friday|this|next|tomorrow|the \d)/i,
  /\bwhat about (Monday|Tuesday|Wednesday|Thursday|Friday|this|next|tomorrow)/i,
  /\b(could do|can do|can make it|works for me|that works)\b.*\b(Monday|Tuesday|Wednesday|Thursday|Friday|\d+(am|pm))\b/i,
  /\b(9|10|11|12|1|2|3|4|5)\s?(am|pm|AM|PM)\b/,
  /\b(morning|afternoon|evening)\s+(of|on)\b/i,
  /\bthese (dates|times|slots) (work|are good|look good)\b/i,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/i,
  /\b\d{1,2}[\/\-]\d{1,2}\b/,  // e.g. 5/20 or 5-20
];

// Words that signal a question (not scheduling)
const QUESTION_PATTERNS = [
  /\bhow (much|many|long|does|do|is|are|can|would)\b/i,
  /\bwhat (is|are|does|do|can|would) (your|the|a|this)\b/i,
  /\bdo you (offer|provide|handle|support|cover|work with|have)\b/i,
  /\bcan you (help|handle|support|provide|do|work with)\b/i,
  /\bare you (able|licensed|insured|bonded|certified|experienced)\b/i,
  /\bwhat (type|kind|sort) of\b/i,
  /\bpricing|cost|rate|fee|quote|proposal\b/i,
  /\bmore information|more details|more info\b/i,
  /\btell me about\b/i,
  /\bquestion about\b/i,
];

// Date extraction regex
const DATE_EXTRACT_PATTERNS = [
  /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
  /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,
  /\b(9|10|11|12|1|2|3|4|5)\s?(?:am|pm|AM|PM)\b/g,
  /\bnext (week|Monday|Tuesday|Wednesday|Thursday|Friday)\b/gi,
  /\bthis (week|Monday|Tuesday|Wednesday|Thursday|Friday)\b/gi,
  /\btomorrow\b/gi,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDates(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of DATE_EXTRACT_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      found.add(m[0].trim());
    }
  }
  return [...found];
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter(p => p.test(text)).length;
}

function moodFromIntent(intent: IntentCategory): Mood {
  if (["POSITIVE_SCHEDULE", "AVAILABILITY_GIVEN", "ASKING_AVAILABILITY", "CALENDAR_REQUEST"].includes(intent)) return "positive";
  if (["NEGATIVE", "OPT_OUT"].includes(intent)) return "negative";
  return "neutral";
}

// ─── Layer 1 + 2: Pattern-based classification ────────────────────────────────

function classifyByPatterns(text: string): { intent: IntentCategory; confidence: Confidence } | null {
  // OPT_OUT — highest priority, always override
  if (countMatches(text, OPT_OUT_PATTERNS) >= 1) {
    return { intent: "OPT_OUT", confidence: "high" };
  }

  // NEGATIVE
  const negCount = countMatches(text, NEGATIVE_PATTERNS);
  if (negCount >= 2) return { intent: "NEGATIVE", confidence: "high" };
  if (negCount === 1) return { intent: "NEGATIVE", confidence: "medium" };

  // CALENDAR_REQUEST — strong signal
  const calCount = countMatches(text, CALENDAR_REQUEST_PATTERNS);
  if (calCount >= 1) return { intent: "CALENDAR_REQUEST", confidence: "high" };

  // AVAILABILITY_GIVEN — they shared dates/times
  const availGivenCount = countMatches(text, AVAILABILITY_GIVEN_PATTERNS);
  if (availGivenCount >= 2) return { intent: "AVAILABILITY_GIVEN", confidence: "high" };
  if (availGivenCount === 1) return { intent: "AVAILABILITY_GIVEN", confidence: "medium" };

  // ASKING_AVAILABILITY
  const askingCount = countMatches(text, ASKING_AVAILABILITY_PATTERNS);
  if (askingCount >= 1) return { intent: "ASKING_AVAILABILITY", confidence: "high" };

  // POSITIVE_SCHEDULE — multiple matches = high confidence
  const posCount = countMatches(text, POSITIVE_SCHEDULE_PATTERNS);
  if (posCount >= 3) return { intent: "POSITIVE_SCHEDULE", confidence: "high" };
  if (posCount >= 1) return { intent: "POSITIVE_SCHEDULE", confidence: "medium" };

  // QUESTION
  const qCount = countMatches(text, QUESTION_PATTERNS);
  if (qCount >= 2) return { intent: "QUESTION", confidence: "high" };
  if (qCount === 1) return { intent: "QUESTION", confidence: "medium" };

  return null;
}

// ─── Layer 3: LLM classification fallback ─────────────────────────────────────

async function classifyByLLM(emailText: string, companyName: string): Promise<{ intent: IntentCategory; reasoning: string }> {
  const prompt = `You are classifying a reply email from a prospect (${companyName}) to Cal at StageGate.

Classify the intent of this email as exactly ONE of these categories:
- POSITIVE_SCHEDULE: They said yes or want to set up a call/demo/meeting
- AVAILABILITY_GIVEN: They shared their availability (dates/times they're free)
- ASKING_AVAILABILITY: They're asking when Cal is available
- CALENDAR_REQUEST: They explicitly asked for a calendar invite or link
- QUESTION: They're asking about services, pricing, or technical details
- NEGATIVE: Not interested, not the right time, or similar decline
- OPT_OUT: Asking to be removed from the list
- NEUTRAL: Unclear intent, just acknowledging, or generic reply

Email:
"""
${emailText.slice(0, 800)}
"""

Reply ONLY with valid JSON: { "intent": "CATEGORY", "reasoning": "one sentence explanation" }`;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = result.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof raw === "string" ? raw : "{}") as { intent?: string; reasoning?: string };
    const validIntents: IntentCategory[] = [
      "POSITIVE_SCHEDULE", "AVAILABILITY_GIVEN", "ASKING_AVAILABILITY",
      "CALENDAR_REQUEST", "QUESTION", "NEGATIVE", "OPT_OUT", "NEUTRAL",
    ];
    const intent = validIntents.includes(parsed.intent as IntentCategory)
      ? (parsed.intent as IntentCategory)
      : "NEUTRAL";
    return { intent, reasoning: parsed.reasoning ?? "LLM classification" };
  } catch {
    return { intent: "NEUTRAL", reasoning: "LLM unavailable — defaulted to NEUTRAL" };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function classifyEmailIntent(
  emailText: string,
  companyName: string = "the prospect",
  useLLMFallback: boolean = true,
): Promise<IntentResult> {
  const text = emailText.trim();
  const extractedDates = extractDates(text);

  // Layer 1 + 2: pattern matching
  const patternResult = classifyByPatterns(text);

  if (patternResult && patternResult.confidence === "high") {
    const { intent, confidence } = patternResult;
    return {
      intent,
      confidence,
      mood: moodFromIntent(intent),
      wantsToSchedule: ["POSITIVE_SCHEDULE", "CALENDAR_REQUEST", "AVAILABILITY_GIVEN", "ASKING_AVAILABILITY"].includes(intent),
      wantsOptOut: intent === "OPT_OUT",
      extractedDates,
      reasoning: `Pattern match (${intent}, ${confidence})`,
    };
  }

  // Layer 3: LLM fallback for neutral or medium confidence
  if (useLLMFallback && (!patternResult || patternResult.confidence === "medium")) {
    const llmResult = await classifyByLLM(text, companyName);

    // If pattern had a medium-confidence result and LLM agrees, boost to high
    const resolvedIntent = (patternResult?.intent === llmResult.intent)
      ? llmResult.intent
      : llmResult.intent; // LLM wins on disagreement

    return {
      intent: resolvedIntent,
      confidence: patternResult ? "medium" : "low",
      mood: moodFromIntent(resolvedIntent),
      wantsToSchedule: ["POSITIVE_SCHEDULE", "CALENDAR_REQUEST", "AVAILABILITY_GIVEN", "ASKING_AVAILABILITY"].includes(resolvedIntent),
      wantsOptOut: resolvedIntent === "OPT_OUT",
      extractedDates,
      reasoning: llmResult.reasoning,
    };
  }

  // No pattern match, LLM disabled or skipped
  const fallbackIntent = patternResult?.intent ?? "NEUTRAL";
  return {
    intent: fallbackIntent,
    confidence: patternResult?.confidence ?? "low",
    mood: moodFromIntent(fallbackIntent),
    wantsToSchedule: ["POSITIVE_SCHEDULE", "CALENDAR_REQUEST", "AVAILABILITY_GIVEN", "ASKING_AVAILABILITY"].includes(fallbackIntent),
    wantsOptOut: fallbackIntent === "OPT_OUT",
    extractedDates,
    reasoning: patternResult ? `Pattern match (${fallbackIntent})` : "No signal detected",
  };
}
