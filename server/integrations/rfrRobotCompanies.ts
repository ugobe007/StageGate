/**
 * ReadyForRobots robot_companies bridge — canonical OEM prospect source.
 *
 * StageGate keeps local `prospects` rows for Cal FKs (drafts, conversations).
 * New OEM discovery lands in RFR first; this module syncs into local prospects.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { prospects, salesAgentConversations } from "../../drizzle/schema";
import type { InsertProspect, ProspectStatus } from "../../drizzle/schema";

const DEFAULT_RFR_API_BASE = "https://ready-2-robot.fly.dev";

export type RfrRobotCompany = {
  id: number;
  company_name: string;
  country?: string | null;
  robot_type?: string | null;
  target_market?: string | null;
  website?: string | null;
  contact_email?: string | null;
  sales_contact?: string | null;
  lead_score?: number | null;
  priority_tier?: string | null;
  outreach_status?: string | null;
  next_trade_show?: string | null;
  trade_shows?: string[] | null;
  data_source?: string | null;
};

export function rfrApiBase(): string {
  return (process.env.RFR_API_BASE || DEFAULT_RFR_API_BASE).replace(/\/$/, "");
}

export function rfrSyncEnabled(): boolean {
  return process.env.RFR_SYNC_ENABLED !== "false";
}

function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function rfrOutreachToProspectStatus(outreach?: string | null): ProspectStatus {
  const s = (outreach || "not_contacted").toLowerCase();
  if (s === "contacted") return "contacted";
  if (s === "responded") return "responded";
  if (s === "meeting_scheduled") return "scheduled";
  if (s === "partnership") return "converted";
  return "new";
}

export function prospectStatusToRfrOutreach(status: string): string {
  switch (status) {
    case "contacted":
      return "contacted";
    case "responded":
      return "responded";
    case "scheduled":
      return "meeting_scheduled";
    case "converted":
      return "partnership";
    case "not_interested":
      return "contacted";
    default:
      return "not_contacted";
  }
}

export async function fetchRfrRobotCompanies(limit = 500): Promise<RfrRobotCompany[]> {
  const url = `${rfrApiBase()}/api/robot-companies/?limit=${limit}&skip=0&min_score=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`RFR robot-companies fetch failed: ${res.status} ${await res.text()}`);
  }
  const payload = (await res.json()) as { companies?: RfrRobotCompany[] };
  return Array.isArray(payload.companies) ? payload.companies : [];
}

export async function pushRfrOutreachStatus(
  rfrId: number,
  outreachStatus: string,
  notes?: string,
): Promise<void> {
  const params = new URLSearchParams({ status: outreachStatus });
  if (notes) params.set("notes", notes);
  const url = `${rfrApiBase()}/api/robot-companies/${rfrId}/outreach?${params.toString()}`;
  const res = await fetch(url, { method: "PUT", headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.warn(`[RFR sync] outreach update failed for id=${rfrId}: ${res.status}`);
  }
}

function mapRfrToInsert(row: RfrRobotCompany): InsertProspect {
  const shows: string[] = [];
  if (row.next_trade_show) shows.push(row.next_trade_show);
  if (Array.isArray(row.trade_shows)) {
    for (const s of row.trade_shows) {
      if (s && !shows.includes(s)) shows.push(s);
    }
  }
  const notesParts = [
    row.data_source ? `source: ${row.data_source}` : null,
    row.lead_score != null ? `RFR score: ${row.lead_score}` : null,
    row.priority_tier ? `tier: ${row.priority_tier}` : null,
  ].filter(Boolean);

  return {
    company: row.company_name,
    hqCountry: row.country ?? null,
    robotType: row.robot_type ?? null,
    website: row.website ?? null,
    contactEmail: row.contact_email ?? null,
    contactName: row.sales_contact ?? null,
    shows,
    notes: notesParts.length ? notesParts.join(" · ") : null,
    status: rfrOutreachToProspectStatus(row.outreach_status),
    vendorType: "robot_oem",
    outreachAngle: "customer",
    rfrRobotCompanyId: row.id,
  };
}

export type RfrSyncResult = {
  fetched: number;
  linked: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

let lastSyncAt = 0;
let lastSyncPromise: Promise<RfrSyncResult> | null = null;
const SYNC_COOLDOWN_MS = 60_000;

/**
 * Pull RFR robot_companies into local prospects (upsert by rfrRobotCompanyId or company name).
 */
export async function syncFromRfrRobotCompanies(options?: { force?: boolean }): Promise<RfrSyncResult> {
  if (!rfrSyncEnabled()) {
    return { fetched: 0, linked: 0, created: 0, updated: 0, skipped: 0, errors: ["RFR_SYNC_ENABLED=false"] };
  }

  const now = Date.now();
  if (!options?.force && lastSyncPromise && now - lastSyncAt < SYNC_COOLDOWN_MS) {
    return lastSyncPromise;
  }

  lastSyncAt = now;
  lastSyncPromise = (async (): Promise<RfrSyncResult> => {
    const result: RfrSyncResult = {
      fetched: 0,
      linked: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const db = await getDb();
    if (!db) {
      result.errors.push("StageGate DB unavailable");
      return result;
    }

    let rows: RfrRobotCompany[];
    try {
      rows = await fetchRfrRobotCompanies();
      result.fetched = rows.length;
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
      return result;
    }

    const local = await db.select().from(prospects);
    const byRfrId = new Map<number, (typeof local)[0]>();
    const byCompany = new Map<string, (typeof local)[0]>();
    for (const p of local) {
      if (p.rfrRobotCompanyId != null) byRfrId.set(p.rfrRobotCompanyId, p);
      if (p.company) byCompany.set(normalizeCompanyName(p.company), p);
    }

    for (const row of rows) {
      if (!row.company_name?.trim()) {
        result.skipped++;
        continue;
      }

      try {
        const norm = normalizeCompanyName(row.company_name);
        let existing = byRfrId.get(row.id) ?? byCompany.get(norm) ?? null;
        const mappedStatus = rfrOutreachToProspectStatus(row.outreach_status);

        if (existing) {
          const patch: Partial<InsertProspect> = {
            rfrRobotCompanyId: row.id,
            updatedAt: new Date(),
          };
          if (!existing.website && row.website) patch.website = row.website;
          if (!existing.contactEmail && row.contact_email) patch.contactEmail = row.contact_email;
          if (existing.status === "new" && mappedStatus !== "new") {
            patch.status = mappedStatus;
          }
          await db.update(prospects).set(patch).where(eq(prospects.id, existing.id));
          byRfrId.set(row.id, { ...existing, ...patch, id: existing.id });
          result.linked++;
          result.updated++;
          continue;
        }

        const insertData = mapRfrToInsert(row);
        const [inserted] = await db
          .insert(prospects)
          .values(insertData)
          .returning({ id: prospects.id });

        if (inserted?.id) {
          await db.insert(salesAgentConversations).values({
            prospectId: inserted.id,
            state: "discovery",
            nextFollowUpAt: new Date(),
            lastActivityAt: new Date(),
          });
          const stub = { id: inserted.id, company: row.company_name, rfrRobotCompanyId: row.id } as (typeof local)[0];
          byRfrId.set(row.id, stub);
          byCompany.set(norm, stub);
          result.created++;
        }
      } catch (e) {
        result.errors.push(`${row.company_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    console.log(
      `[RFR sync] fetched=${result.fetched} linked=${result.linked} created=${result.created} updated=${result.updated}`,
    );
    return result;
  })();

  return lastSyncPromise;
}

/** Best-effort push when StageGate prospect status changes. */
export async function syncProspectStatusToRfr(
  prospectId: number,
  status: string,
): Promise<void> {
  if (!rfrSyncEnabled()) return;
  const db = await getDb();
  if (!db) return;

  const rows = await db
    .select({ rfrId: prospects.rfrRobotCompanyId, company: prospects.company })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);
  const rfrId = rows[0]?.rfrId;
  if (!rfrId) return;

  await pushRfrOutreachStatus(rfrId, prospectStatusToRfrOutreach(status), `StageGate prospect #${prospectId}`);
}
