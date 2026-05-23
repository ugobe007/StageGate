/**
 * Partner & vendor outreach email service.
 * Unified recipients from partner prospects, vendors directory, and logistics partners.
 */
import { getDb, updateProspectStatus } from "../db";
import { prospects, vendors, logisticsPartners, prospectResearch } from "../../drizzle/schema";
import { eq, or, and, ne, isNotNull, isNull } from "drizzle-orm";
import { pickCalInsight } from "../agents/calInsights";
import { FRANK_PERSONA } from "../agents/frankPlaybook";
import type { VendorType } from "../agents/discoveryLogicEngine";
import * as emailHelpers from "../email";

export type PartnerRecipientSource = "prospect" | "vendor" | "logistics_partner";

export type PartnerRecipient = {
  key: string;
  source: PartnerRecipientSource;
  id: number;
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  partnerType: string;
  partnerTypeLabel: string;
  city: string | null;
  website: string | null;
  notes: string | null;
  prospectId?: number;
  /** Resolved first name for greeting — null if admin must enter */
  greetingName: string | null;
  needsContactName: boolean;
  isGenericInbox: boolean;
  researchContactName: string | null;
};

const VENDOR_TYPE_LABELS: Record<string, string> = {
  robot_oem: "Robot OEM",
  exhibit_house: "Exhibit House",
  freight: "Freight / Drayage",
  av_electrical: "AV / Production",
  venue: "Venue",
  agency: "Agency",
  show_organizer: "Show Organizer",
  customs: "Customs / Freight",
  transporter: "Transporter",
  insurance: "Insurance",
  parts: "Parts Supplier",
  general: "Partner",
  customs_broker: "Customs Broker",
  av: "AV / Production",
  rigging: "Rigging",
  warehouse: "Warehouse",
  transport: "Transport / Drayage",
  tech_support: "Tech Support",
  other: "Partner",
};

function labelFor(type: string): string {
  return VENDOR_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function mapVendorType(vendorType: string): VendorType | string {
  const map: Record<string, VendorType> = {
    freight: "freight",
    customs_broker: "freight",
    transport: "freight",
    av: "av_electrical",
    rigging: "agency",
    warehouse: "freight",
    tech_support: "other",
    customs: "freight",
    transporter: "freight",
    insurance: "other",
    parts: "other",
    general: "other",
    other: "other",
  };
  return map[vendorType] ?? vendorType;
}

export function getPartnerHook(vendorType: string): string {
  const vt = mapVendorType(vendorType);
  if (vt === "exhibit_house") {
    return "I work with exhibit teams when their clients bring robots to Vegas — receiving, staging, power-up, and hands-on tech before the hall opens.";
  }
  if (vt === "av_electrical") {
    return "When booths include live robots, someone has to power them up and debug hardware before your AV and demo schedule starts. That's the gap we fill.";
  }
  if (vt === "show_organizer" || vt === "venue") {
    return "More exhibitors are bringing robots every year. We're the Las Vegas team that receives, stages, and supports that hardware on the ground.";
  }
  if (vt === "freight") {
    return "Robot freight often needs more than drayage — bonded storage, battery-safe handling, and activation before the booth. We handle that last mile in Vegas.";
  }
  return "When your clients or partners bring robots to Las Vegas shows, we're the local team for warehouse, staging, and robot tech support.";
}

export const PARTNER_SIGNUP_URL = "https://onstage.bot/get-started";

const GENERIC_EMAIL_LOCALS = new Set([
  "info", "contact", "sales", "marketing", "hello", "support", "admin",
  "office", "inquiries", "enquiries", "team", "noreply", "no-reply",
]);

export function isGenericInbox(email: string | null | undefined): boolean {
  if (!email) return true;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return GENERIC_EMAIL_LOCALS.has(local) || local.startsWith("info");
}

export function firstNameFromFullName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Best greeting first name — null means admin must supply one. */
export function resolveGreetingName(input: {
  contactName?: string | null;
  contactEmail?: string | null;
  company: string;
  researchContactName?: string | null;
}): { greetingName: string | null; needsName: boolean; source: string } {
  if (input.contactName?.trim()) {
    return {
      greetingName: firstNameFromFullName(input.contactName),
      needsName: false,
      source: "contact",
    };
  }
  if (input.researchContactName?.trim()) {
    return {
      greetingName: firstNameFromFullName(input.researchContactName),
      needsName: false,
      source: "research",
    };
  }
  const email = input.contactEmail?.trim();
  if (email && !isGenericInbox(email)) {
    const local = email.split("@")[0] ?? "";
    const fromEmail = local.split(/[._-]/)[0];
    if (fromEmail && fromEmail.length >= 2 && /^[a-z]+$/i.test(fromEmail)) {
      return {
        greetingName: fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1).toLowerCase(),
        needsName: false,
        source: "email",
      };
    }
  }
  return { greetingName: null, needsName: true, source: "missing" };
}

export function greetingLine(greetingName: string | null): string {
  return greetingName ? `Hi ${greetingName},` : "Hi team,";
}

export function buildCalPartnerEmail(input: {
  company: string;
  contactName?: string | null;
  vendorType?: string | null;
  showName?: string;
  showCity?: string;
}): { subject: string; body: string; greetingName: string | null; needsName: boolean } {
  const resolved = resolveGreetingName({
    contactName: input.contactName,
    company: input.company,
  });
  const greetingName = resolved.greetingName;
  const vendorType = input.vendorType ?? "agency";
  const partnerHook = getPartnerHook(vendorType);
  const showName = input.showName ?? "CES";
  const showCity = input.showCity ?? "Las Vegas";
  const showRef = /las vegas/i.test(showCity)
    ? `${showName} and other Las Vegas shows`
    : "Las Vegas shows like CES and NAB";

  const insight = pickCalInsight({
    showName,
    companyName: input.company,
    allowHumor: true,
  });

  const body = [
    greetingLine(greetingName),
    ``,
    `This is Cal from StageGate. We're the robotics logistics and technical operations team here in Las Vegas.`,
    ``,
    `${partnerHook} Curious whether that's come up for ${input.company} — especially around ${showRef}.`,
    ``,
    insight,
    ``,
    `We're not competing with your core services — we care for the robots so your team and your clients don't have to debug freight damage at midnight. Happy to talk about how a referral works.`,
    ``,
    `Register free at ${PARTNER_SIGNUP_URL} — takes about two minutes. Or reply here and we can find 15 minutes on the calendar.`,
    ``,
    `Thanks,`,
    FRANK_PERSONA.signature,
  ].join("\n");

  return {
    subject: `Quick note — robotics support in Vegas (${input.company})`,
    body,
    greetingName,
    needsName: resolved.needsName,
  };
}

export const DEFAULT_PARTNER_TEMPLATE = `Hi {{contact_name}},

This is Cal from StageGate. We're the robotics logistics and technical operations team here in Las Vegas.

{{partner_hook}}

Curious whether that's come up for {{company}} — especially around CES and other Las Vegas shows.

We're not competing with your core services — we care for the robots so your team and your clients don't have to debug freight damage at midnight. Happy to talk about how a referral works.

Reply if useful, or check out onstage.bot for context.

Thanks,
Cal
StageGate
hello@onstage.bot`;

export function applyPartnerMergeFields(
  template: string,
  recipient: PartnerRecipient,
  contactNameOverride?: string,
): string {
  const resolved = resolveGreetingName({
    contactName: contactNameOverride ?? recipient.contactName,
    contactEmail: recipient.contactEmail,
    company: recipient.company,
    researchContactName: recipient.researchContactName,
  });
  const name = resolved.greetingName ?? "team";
  return template
    .replace(/\{\{company\}\}/g, recipient.company)
    .replace(/\{\{contact_name\}\}/g, name)
    .replace(/\{\{partner_type\}\}/g, recipient.partnerTypeLabel)
    .replace(/\{\{partner_hook\}\}/g, getPartnerHook(recipient.partnerType))
    .replace(/\{\{city\}\}/g, recipient.city ?? "Las Vegas")
    .replace(/\{\{signup_url\}\}/g, PARTNER_SIGNUP_URL);
}

function enrichRecipient(
  base: Omit<
    PartnerRecipient,
    "greetingName" | "needsContactName" | "isGenericInbox" | "researchContactName"
  >,
  researchContactName: string | null,
): PartnerRecipient {
  const resolved = resolveGreetingName({
    contactName: base.contactName,
    contactEmail: base.contactEmail,
    company: base.company,
    researchContactName,
  });
  return {
    ...base,
    researchContactName,
    greetingName: resolved.greetingName,
    needsContactName: resolved.needsName,
    isGenericInbox: isGenericInbox(base.contactEmail),
  };
}

export async function updatePartnerContactName(
  key: string,
  contactName: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [source, idStr] = key.split(":");
  const id = Number(idStr);
  if (!source || !id) throw new Error("Invalid recipient key");

  if (source === "prospect") {
    await db.update(prospects).set({ contactName }).where(eq(prospects.id, id));
  } else if (source === "vendor") {
    await db.update(vendors).set({ contactName, updatedAt: new Date() }).where(eq(vendors.id, id));
  } else if (source === "logistics_partner") {
    await db.update(logisticsPartners).set({ contactName, updatedAt: new Date() }).where(eq(logisticsPartners.id, id));
  } else {
    throw new Error("Unknown recipient source");
  }
}

export async function listPartnerRecipients(filters?: {
  source?: PartnerRecipientSource | "all";
  hasEmail?: boolean;
  partnerType?: string;
}): Promise<PartnerRecipient[]> {
  const db = await getDb();
  if (!db) return [];

  const recipients: PartnerRecipient[] = [];
  const source = filters?.source ?? "all";

  if (source === "all" || source === "prospect") {
    const rows = await db
      .select({
        prospect: prospects,
        research: prospectResearch,
      })
      .from(prospects)
      .leftJoin(prospectResearch, eq(prospectResearch.prospectId, prospects.id))
      .where(
        or(
          eq(prospects.outreachAngle, "partner"),
          and(isNotNull(prospects.vendorType), ne(prospects.vendorType, "robot_oem")),
        ),
      );

    for (const { prospect: p, research } of rows) {
      const partnerType = p.vendorType ?? "agency";
      const dm = research?.decisionMakers as Array<{ name?: string }> | null | undefined;
      const researchName = dm?.[0]?.name ?? null;
      recipients.push(
        enrichRecipient(
          {
            key: `prospect:${p.id}`,
            source: "prospect",
            id: p.id,
            company: p.company,
            contactName: p.contactName,
            contactEmail: p.contactEmail,
            contactPhone: null,
            partnerType,
            partnerTypeLabel: labelFor(partnerType),
            city: null,
            website: p.website,
            notes: p.notes,
            prospectId: p.id,
          },
          researchName,
        ),
      );
    }
  }

  if (source === "all" || source === "vendor") {
    const rows = await db
      .select()
      .from(vendors)
      .where(or(eq(vendors.isActive, true), isNull(vendors.isActive)));
    for (const v of rows) {
      recipients.push(
        enrichRecipient(
          {
            key: `vendor:${v.id}`,
            source: "vendor",
            id: v.id,
            company: v.name,
            contactName: v.contactName,
            contactEmail: v.contactEmail,
            contactPhone: v.contactPhone,
            partnerType: v.type,
            partnerTypeLabel: labelFor(v.type),
            city: v.city,
            website: v.website,
            notes: v.notes,
          },
          null,
        ),
      );
    }
  }

  if (source === "all" || source === "logistics_partner") {
    const rows = await db
      .select()
      .from(logisticsPartners)
      .where(eq(logisticsPartners.isActive, true));
    for (const p of rows) {
      recipients.push(
        enrichRecipient(
          {
            key: `logistics_partner:${p.id}`,
            source: "logistics_partner",
            id: p.id,
            company: p.name,
            contactName: p.contactName,
            contactEmail: p.contactEmail,
            contactPhone: p.contactPhone,
            partnerType: p.serviceType,
            partnerTypeLabel: labelFor(p.serviceType),
            city: p.city,
            website: p.website,
            notes: p.notes,
          },
          null,
        ),
      );
    }
  }

  let result = recipients.sort((a, b) => a.company.localeCompare(b.company));

  if (filters?.hasEmail) {
    result = result.filter((r) => !!r.contactEmail?.trim());
  }
  if (filters?.partnerType && filters.partnerType !== "all") {
    result = result.filter((r) => r.partnerType === filters.partnerType);
  }

  return result;
}

export async function getPartnerRecipient(key: string): Promise<PartnerRecipient | null> {
  const all = await listPartnerRecipients();
  return all.find((r) => r.key === key) ?? null;
}

export type PartnerEmailDraft = {
  recipientKey: string;
  company: string;
  contactEmail: string | null;
  subject: string;
  body: string;
  contactName: string;
  needsContactName: boolean;
  readyToSend: boolean;
};

export async function bulkBuildCalPartnerDrafts(
  recipientKeys: string[],
): Promise<PartnerEmailDraft[]> {
  const drafts: PartnerEmailDraft[] = [];
  for (const key of recipientKeys) {
    const recipient = await getPartnerRecipient(key);
    if (!recipient?.contactEmail) continue;
    const contactName =
      recipient.contactName ?? recipient.researchContactName ?? recipient.greetingName ?? "";
    const cal = buildCalPartnerEmail({
      company: recipient.company,
      contactName: contactName || undefined,
      vendorType: recipient.partnerType,
    });
    const hasName = !!(contactName.trim() || cal.greetingName);
    drafts.push({
      recipientKey: key,
      company: recipient.company,
      contactEmail: recipient.contactEmail,
      subject: cal.subject,
      body: cal.body,
      contactName,
      needsContactName: recipient.needsContactName && !hasName,
      readyToSend: !cal.body.includes("{{") && !cal.subject.includes("{{"),
    });
  }
  return drafts;
}

/** Build Cal drafts and persist to draft_emails for review workflow. */
export async function bulkSaveCalPartnerDrafts(
  recipientKeys: string[],
): Promise<{ drafted: number; draftIds: number[]; skipped: number }> {
  const built = await bulkBuildCalPartnerDrafts(recipientKeys);
  const draftIds: number[] = [];
  for (const d of built) {
    const row = await emailHelpers.createPartnerDraft({
      recipientKey: d.recipientKey,
      subject: d.subject,
      body: d.body,
      agentReasoning: "Cal partner outreach draft",
    });
    draftIds.push(row.id);
  }
  return {
    drafted: draftIds.length,
    draftIds,
    skipped: recipientKeys.length - built.length,
  };
}

export async function sendPartnerOutreachEmail(input: {
  recipientKey: string;
  subject: string;
  body: string;
  toEmail?: string;
  contactName?: string;
  /** Bulk send: allow "Hi team," when no contact name (generic inbox) */
  allowTeamGreeting?: boolean;
}): Promise<{ sentTo: string; messageId?: string; warning?: string }> {
  const recipient = await getPartnerRecipient(input.recipientKey);
  if (!recipient) throw new Error("Recipient not found");

  if (input.body.includes("{{") || input.subject.includes("{{")) {
    throw new Error("Email still has unfilled placeholders — finish the draft before sending");
  }

  const resolved = resolveGreetingName({
    contactName: input.contactName ?? recipient.contactName,
    contactEmail: recipient.contactEmail,
    company: recipient.company,
    researchContactName: recipient.researchContactName,
  });
  if (resolved.needsName && !input.allowTeamGreeting) {
    throw new Error(`Add a contact name for ${recipient.company} before sending`);
  }
  if (resolved.needsName && input.allowTeamGreeting && !/^Hi team,/m.test(input.body)) {
    throw new Error(`${recipient.company}: use "Hi team," greeting or add a contact name`);
  }

  if (input.contactName?.trim() && input.contactName !== recipient.contactName) {
    await updatePartnerContactName(input.recipientKey, input.contactName.trim());
  }

  const toEmail = (input.toEmail ?? recipient.contactEmail)?.trim();
  if (!toEmail) throw new Error(`${recipient.company} has no email address`);

  const sendResult = await emailHelpers.sendEmail({
    to: toEmail,
    subject: input.subject,
    body: input.body,
  });

  if (recipient.prospectId) {
    await emailHelpers.recordOutboundCommunication({
      prospect: { id: recipient.prospectId, company: recipient.company },
      subject: input.subject,
      body: input.body,
      resendMessageId: sendResult.id,
      source: "partner_outreach",
    });
    await updateProspectStatus(recipient.prospectId, "contacted");
  }

  return {
    sentTo: toEmail,
    messageId: sendResult.id,
    warning: sendResult.warning,
  };
}

// Re-export for salesAgent compatibility
export function isPartnerProspect(prospect: {
  outreachAngle?: string | null;
  vendorType?: string | null;
}): boolean {
  return (
    prospect.outreachAngle === "partner" ||
    (prospect.vendorType != null && prospect.vendorType !== "robot_oem")
  );
}
