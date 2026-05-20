import { eq, desc, and, like, lte, gte, isNotNull, notInArray, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  users,
  companyProfiles,
  tradeShows,
  exhibitorLeads,
  services,
  serviceOrders,
  orderItems,
  logisticsPartners,
  showNotifications,
  quoteRequests,
  InsertQuoteRequest,
  InsertCompanyProfile,
  InsertTradeShow,
  InsertExhibitorLead,
  InsertServiceOrder,
  InsertOrderItem,
  InsertLogisticsPartner,
  demoRequests,
  xbotProjects,
  xbotLogisticsBriefs,
  InsertXbotProject,
  InsertXbotLogisticsBrief,
  prospects,
  outreachCampaigns,
  InsertProspect,
  InsertOutreachCampaign,
  Prospect,
  OutreachCampaign,
  agentRuns,
  InsertAgentRun,
  AgentRun,
  serviceRequests,
  InsertServiceRequest,
  ServiceRequest,
  calendarEvents,
  CalendarEvent,
  InsertCalendarEvent,
  newsletterSubscriptions,
  logisticsCosts,
  LogisticsCost,
  InsertLogisticsCost,
  carrierTrackingEvents,
  CarrierTrackingEvent,
  InsertCarrierTrackingEvent,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  const connString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!_db && connString) {
    try {
      const pool = new Pool({
        connectionString: connString,
        ssl: { rejectUnauthorized: false },
      });
      _db = drizzle(pool);
      console.log("[Database] Connected to", process.env.SUPABASE_DATABASE_URL ? "Supabase (Postgres)" : "built-in DB");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return null;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  const userEmail = user.email?.toLowerCase();
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId || (userEmail && ENV.adminEmails.includes(userEmail))) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  const result = await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet }).returning();
  return result[0] ?? null;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Company Profiles ─────────────────────────────────────────────────────────

export async function getCompanyProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertCompanyProfile(data: InsertCompanyProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getCompanyProfileByUserId(data.userId);
  if (existing) {
    await db.update(companyProfiles).set(data).where(eq(companyProfiles.userId, data.userId));
    return existing.id;
  } else {
    const [inserted] = await db.insert(companyProfiles).values(data).returning({ id: companyProfiles.id });
    return inserted!.id;
  }
}

export async function getAllCompanyProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyProfiles).orderBy(desc(companyProfiles.createdAt));
}

// ─── Service Requests ───────────────────────────────────────────────────────

export async function createServiceRequest(data: InsertServiceRequest): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(serviceRequests).values(data).returning({ id: serviceRequests.id });
  return inserted!.id;
}

export async function getServiceRequestsByUserId(userId: number): Promise<ServiceRequest[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceRequests)
    .where(eq(serviceRequests.userId, userId))
    .orderBy(desc(serviceRequests.createdAt));
}

export async function getAllServiceRequests(): Promise<(ServiceRequest & { contactEmail: string | null; companyName: string | null })[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: serviceRequests.id,
      userId: serviceRequests.userId,
      companyProfileId: serviceRequests.companyProfileId,
      requestType: serviceRequests.requestType,
      showName: serviceRequests.showName,
      showDate: serviceRequests.showDate,
      robotName: serviceRequests.robotName,
      robotType: serviceRequests.robotType,
      details: serviceRequests.details,
      urgency: serviceRequests.urgency,
      status: serviceRequests.status,
      adminNotes: serviceRequests.adminNotes,
      quotedPrice: serviceRequests.quotedPrice,
      attachmentUrl: serviceRequests.attachmentUrl,
      attachmentKey: serviceRequests.attachmentKey,
      attachmentName: serviceRequests.attachmentName,
      createdAt: serviceRequests.createdAt,
      updatedAt: serviceRequests.updatedAt,
      contactEmail: companyProfiles.contactEmail,
      companyName: companyProfiles.companyName,
    })
    .from(serviceRequests)
    .leftJoin(companyProfiles, eq(serviceRequests.companyProfileId, companyProfiles.id))
    .orderBy(desc(serviceRequests.createdAt));
  return rows;
}

export async function getServiceRequestById(id: number): Promise<ServiceRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateServiceRequestStatus(
  id: number,
  status: string,
  adminNotes?: string,
  quotedPrice?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(serviceRequests)
    .set({ status, adminNotes: adminNotes ?? null, quotedPrice: quotedPrice ?? null, updatedAt: new Date() })
    .where(eq(serviceRequests.id, id));
}

// ─── Trade Shows ──────────────────────────────────────────────────────────────

export async function getAllTradeShows() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tradeShows).orderBy(tradeShows.startDate);
}

export async function getLasVegasShows2026() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(tradeShows).orderBy(tradeShows.startDate);
  return rows.filter((show) => {
    const isLasVegas = (show.city ?? "").toLowerCase().includes("las vegas");
    const year = show.startDate ? new Date(show.startDate).getFullYear() : null;
    return isLasVegas && year === 2026;
  });
}

export async function getOtherShows() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(tradeShows).orderBy(tradeShows.startDate);
  return rows.filter((show) => {
    const isLasVegas = (show.city ?? "").toLowerCase().includes("las vegas");
    return !isLasVegas;
  });
}

export async function getUpcomingLasVegasShows(limit = 6) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(tradeShows).orderBy(tradeShows.startDate);
  const now = new Date();
  return rows
    .filter((show) => {
      const isLasVegas = (show.city ?? "").toLowerCase().includes("las vegas");
      const isFuture = show.startDate ? new Date(show.startDate) > now : false;
      return isLasVegas && isFuture;
    })
    .slice(0, limit);
}
export async function subscribeNewsletter(email: string, firstName?: string, interests?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Upsert — if email already exists, update name/interests
  const existing = await db.select({ id: newsletterSubscriptions.id })
    .from(newsletterSubscriptions)
    .where(eq(newsletterSubscriptions.email, email.toLowerCase().trim()))
    .limit(1);
  if (existing.length > 0) {
    return { alreadySubscribed: true };
  }
  await db.insert(newsletterSubscriptions).values({
    email: email.toLowerCase().trim(),
    firstName: firstName?.trim() || null,
    interests: interests || null,
    source: "website",
  });
  return { alreadySubscribed: false };
}

export async function searchTradeShows(query: string, city?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(tradeShows).orderBy(tradeShows.startDate);
  const q = query.toLowerCase().trim();
  return rows.filter((show) => {
    const matchesQuery =
      !q ||
      show.name.toLowerCase().includes(q) ||
      (show.venue ?? "").toLowerCase().includes(q) ||
      (show.city ?? "").toLowerCase().includes(q) ||
      (show.location ?? "").toLowerCase().includes(q);
    const matchesCity =
      !city ||
      (show.city ?? "").toLowerCase().includes(city.toLowerCase());
    return matchesQuery && matchesCity;
  });
}

export async function getTradeShowById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tradeShows).where(eq(tradeShows.id, id)).limit(1);
  return result[0];
}

export async function createTradeShow(data: InsertTradeShow) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(tradeShows).values(data).returning({ id: tradeShows.id });
  return inserted!.id;
}

export async function updateTradeShow(id: number, data: Partial<InsertTradeShow>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(tradeShows).set(data).where(eq(tradeShows.id, id));
}

export async function deleteTradeShow(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(tradeShows).where(eq(tradeShows.id, id));
}

// ─── Exhibitor Leads ──────────────────────────────────────────────────────────

export async function getLeadsByShowId(showId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exhibitorLeads).where(eq(exhibitorLeads.showId, showId)).orderBy(desc(exhibitorLeads.createdAt));
}

export async function getAllLeads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exhibitorLeads).orderBy(desc(exhibitorLeads.createdAt));
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(exhibitorLeads).where(eq(exhibitorLeads.id, id)).limit(1);
  return result[0];
}

export async function createLead(data: InsertExhibitorLead) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(exhibitorLeads).values(data).returning({ id: exhibitorLeads.id });
  return inserted!.id;
}

export async function updateLead(id: number, data: Partial<InsertExhibitorLead>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(exhibitorLeads).set(data).where(eq(exhibitorLeads.id, id));
}

export async function deleteLead(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(exhibitorLeads).where(eq(exhibitorLeads.id, id));
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getAllServices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).where(eq(services.isActive, true)).orderBy(services.sortOrder);
}

export async function getServiceBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  return result[0];
}

// ─── Service Orders ───────────────────────────────────────────────────────────

export async function getOrdersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceOrders).where(eq(serviceOrders.userId, userId)).orderBy(desc(serviceOrders.createdAt));
}

export async function getAllOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(serviceOrders).orderBy(desc(serviceOrders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return result[0];
}

export async function createOrder(data: InsertServiceOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(serviceOrders).values(data).returning({ id: serviceOrders.id });
  return inserted!.id;
}

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(orderItems).values(data);
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function updateOrderStatus(
  id: number,
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(serviceOrders).set({ status }).where(eq(serviceOrders.id, id));
}

// ─── Logistics Partners ───────────────────────────────────────────────────────

export async function getAllLogisticsPartners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(logisticsPartners).orderBy(logisticsPartners.serviceType, logisticsPartners.name);
}

export async function getLogisticsPartnerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(logisticsPartners).where(eq(logisticsPartners.id, id)).limit(1);
  return result[0];
}

export async function createLogisticsPartner(data: InsertLogisticsPartner) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [inserted] = await db.insert(logisticsPartners).values(data).returning({ id: logisticsPartners.id });
  return inserted!.id;
}

export async function updateLogisticsPartner(id: number, data: Partial<InsertLogisticsPartner>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(logisticsPartners).set(data).where(eq(logisticsPartners.id, id));
}

export async function deleteLogisticsPartner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(logisticsPartners).where(eq(logisticsPartners.id, id));
}

// ─── Show Notifications ───────────────────────────────────────────────────────

export async function createShowNotification(showId: number, email: string): Promise<{ id: number; alreadyExists: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check for duplicate (same email + showId)
  const existing = await db
    .select({ id: showNotifications.id })
    .from(showNotifications)
    .where(and(eq(showNotifications.showId, showId), eq(showNotifications.email, email)))
    .limit(1);
  if (existing.length > 0) {
    return { id: existing[0]!.id, alreadyExists: true };
  }
  const [inserted] = await db.insert(showNotifications).values({ showId, email }).returning({ id: showNotifications.id });
  return { id: inserted!.id, alreadyExists: false };
}

export async function getShowNotificationsByShowId(showId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(showNotifications)
    .where(eq(showNotifications.showId, showId))
    .orderBy(desc(showNotifications.createdAt));
}

export async function getAllShowNotifications() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(showNotifications)
    .orderBy(desc(showNotifications.createdAt));
}

// ── Quote Requests ──────────────────────────────────────────────────────────
export async function createQuoteRequest(data: InsertQuoteRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(quoteRequests).values(data);
}

export async function getAllQuoteRequests() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(quoteRequests)
    .orderBy(desc(quoteRequests.createdAt));
}

export async function getQuoteRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(quoteRequests)
    .where(eq(quoteRequests.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function updateQuoteRequestStatus(
  id: number,
  status: "new" | "reviewing" | "quoted" | "converted" | "closed",
  adminNotes?: string
) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  await db.update(quoteRequests).set(updateData).where(eq(quoteRequests.id, id));
}

// ── Demo Requests ──────────────────────────────────────────────────────────
export async function createDemoRequest(data: {
  name: string;
  email: string;
  company: string;
  robotType: string;
  preferredShowId?: number;
  preferredShowName?: string;
  message?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(demoRequests).values(data);
}

export async function getAllDemoRequests() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(demoRequests)
    .orderBy(desc(demoRequests.createdAt));
}

export async function updateDemoRequestStatus(
  id: number,
  status: "new" | "contacted" | "scheduled" | "completed" | "closed"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(demoRequests).set({ status }).where(eq(demoRequests.id, id));
}

// ─── XBOT AI Logistics Agent helpers ─────────────────────────────────────────

export async function createXbotProject(data: InsertXbotProject) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [inserted] = await db.insert(xbotProjects).values(data).returning({ id: xbotProjects.id });
  const rows = await db.select().from(xbotProjects).where(eq(xbotProjects.id, inserted!.id));
  return rows[0];
}

export async function getXbotProject(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(xbotProjects).where(eq(xbotProjects.id, id));
  return rows[0] ?? null;
}

export async function updateXbotProject(id: number, data: Partial<InsertXbotProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(xbotProjects).set(data).where(eq(xbotProjects.id, id));
}

export async function getXbotBrief(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(xbotLogisticsBriefs)
    .where(eq(xbotLogisticsBriefs.projectId, projectId));
  return rows[0] ?? null;
}

export async function upsertXbotBrief(data: InsertXbotLogisticsBrief) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check if brief already exists for this project
  const existing = await getXbotBrief(data.projectId);
  if (existing) {
    await db
      .update(xbotLogisticsBriefs)
      .set({ ...data, generatedAt: new Date() })
      .where(eq(xbotLogisticsBriefs.projectId, data.projectId));
    const rows = await db
      .select()
      .from(xbotLogisticsBriefs)
      .where(eq(xbotLogisticsBriefs.projectId, data.projectId));
    return rows[0];
  } else {
    const [inserted] = await db.insert(xbotLogisticsBriefs).values(data).returning({ id: xbotLogisticsBriefs.id });
    const rows = await db
      .select()
      .from(xbotLogisticsBriefs)
      .where(eq(xbotLogisticsBriefs.id, inserted!.id));
    return rows[0];
  }
}

export async function listXbotProjectsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(xbotProjects)
    .where(eq(xbotProjects.userId, userId))
    .orderBy(desc(xbotProjects.updatedAt));
}

export async function listAllXbotProjects(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db
      .select()
      .from(xbotProjects)
      .where(
        eq(
          xbotProjects.status,
          status as "draft" | "brief_generated" | "submitted" | "in_review" | "confirmed"
        )
      )
      .orderBy(desc(xbotProjects.createdAt));
  }
  return db.select().from(xbotProjects).orderBy(desc(xbotProjects.createdAt));
}

// ─── Prospects ────────────────────────────────────────────────────────────────
export async function listProspects(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    return db
      .select()
      .from(prospects)
      .where(eq(prospects.status, status as Prospect["status"]))
      .orderBy(desc(prospects.createdAt));
  }
  return db.select().from(prospects).orderBy(desc(prospects.createdAt));
}

export async function getProspectById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(prospects).where(eq(prospects.id, id));
  return rows[0] ?? null;
}

export async function createProspect(data: InsertProspect) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [inserted] = await db.insert(prospects).values(data).returning({ id: prospects.id });
  return inserted;
}

export async function updateProspect(id: number, data: Partial<InsertProspect>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(prospects).set(data).where(eq(prospects.id, id));
}

export async function updateProspectStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(prospects).set({ status, updatedAt: new Date() }).where(eq(prospects.id, id));
}

export async function bulkInsertProspects(data: InsertProspect[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (data.length === 0) return;
  await db.insert(prospects).values(data);
}

// ─── Outreach Campaigns ───────────────────────────────────────────────────────
export async function listOutreachByProspect(prospectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.prospectId, prospectId))
    .orderBy(desc(outreachCampaigns.createdAt));
}

export async function createOutreachCampaign(data: InsertOutreachCampaign) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [inserted] = await db.insert(outreachCampaigns).values(data).returning({ id: outreachCampaigns.id });
  return inserted;
}

export async function updateOutreachCampaign(id: number, data: Partial<InsertOutreachCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(outreachCampaigns).set(data).where(eq(outreachCampaigns.id, id));
}

// Suppress unused import warnings
export type { Prospect, OutreachCampaign };

export async function getAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(users).orderBy(desc(users.createdAt));
}
export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Agent Run Log Helpers ────────────────────────────────────────────────────
export async function createAgentRun(data: Omit<InsertAgentRun, "id" | "startedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [inserted] = await db.insert(agentRuns).values({ ...data, startedAt: new Date() }).returning({ id: agentRuns.id });
  return inserted!.id;
}

export async function completeAgentRun(id: number, status: "success" | "error", opts: { outputSummary?: string; errorMessage?: string } = {}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const completedAt = new Date();
  await db.update(agentRuns).set({
    status,
    completedAt,
    outputSummary: opts.outputSummary,
    errorMessage: opts.errorMessage,
  }).where(eq(agentRuns.id, id));
}

export async function getRecentAgentRuns(limit = 50): Promise<AgentRun[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(limit);
}

export async function getAgentRunStats(): Promise<Array<{ agentName: string; totalRuns: number; successRuns: number; errorRuns: number; lastRunAt: Date | null }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt));
  const statsMap = new Map<string, { totalRuns: number; successRuns: number; errorRuns: number; lastRunAt: Date | null }>();
  for (const row of rows) {
    if (!statsMap.has(row.agentName)) {
      statsMap.set(row.agentName, { totalRuns: 0, successRuns: 0, errorRuns: 0, lastRunAt: null });
    }
    const s = statsMap.get(row.agentName)!;
    s.totalRuns++;
    if (row.status === "success") s.successRuns++;
    if (row.status === "error") s.errorRuns++;
    if (!s.lastRunAt && row.startedAt) s.lastRunAt = row.startedAt;
  }
  return Array.from(statsMap.entries()).map(([agentName, stats]) => ({ agentName, ...stats }));
}
export async function getProspectsWithOverdueFollowUp(): Promise<Prospect[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(prospects).where(
    and(
      isNotNull(prospects.followUpDate),
      lte(prospects.followUpDate, now),
      notInArray(prospects.status, ["responded", "converted"])
    )
  ).orderBy(prospects.followUpDate);
}

export async function bulkUpdateProspectStatus(ids: number[], status: string): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  if (!db) return 0;
  await db.update(prospects)
    .set({ status: status as Prospect["status"], updatedAt: new Date() })
    .where(inArray(prospects.id, ids));
  return ids.length;
}
// ─── Calendar Events ─────────────────────────────────────────────────────────

export async function listCalendarEvents(opts?: { from?: Date; to?: Date; type?: string }): Promise<CalendarEvent[]> {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(calendarEvents).$dynamic();
  if (opts?.from) query = query.where(sql`${calendarEvents.startAt} >= ${opts.from}`);
  if (opts?.to) query = query.where(sql`${calendarEvents.endAt} <= ${opts.to}`);
  if (opts?.type) query = query.where(eq(calendarEvents.type, opts.type));
  return query.orderBy(calendarEvents.startAt);
}

export async function getCalendarEventById(id: number): Promise<CalendarEvent | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getCalendarEventByToken(token: string): Promise<CalendarEvent | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(calendarEvents).where(eq(calendarEvents.shareToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.insert(calendarEvents).values(data).returning();
  return row!;
}

export async function updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.update(calendarEvents).set({ ...data, updatedAt: new Date() }).where(eq(calendarEvents.id, id)).returning();
  return row ?? null;
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
}

// Suppress unused import warnings
export type { AgentRun, InsertAgentRun, CalendarEvent, InsertCalendarEvent };
