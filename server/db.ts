import { eq, desc, and, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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
  InsertCompanyProfile,
  InsertTradeShow,
  InsertExhibitorLead,
  InsertServiceOrder,
  InsertOrderItem,
  InsertLogisticsPartner,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

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
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
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
  if (!db) return undefined;
  const result = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function upsertCompanyProfile(data: InsertCompanyProfile) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getCompanyProfileByUserId(data.userId);
  if (existing) {
    await db.update(companyProfiles).set(data).where(eq(companyProfiles.userId, data.userId));
    return existing.id;
  } else {
    const result = await db.insert(companyProfiles).values(data);
    return (result[0] as any).insertId as number;
  }
}

export async function getAllCompanyProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyProfiles).orderBy(desc(companyProfiles.createdAt));
}

// ─── Trade Shows ──────────────────────────────────────────────────────────────

export async function getAllTradeShows() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tradeShows).orderBy(tradeShows.startDate);
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
  const result = await db.insert(tradeShows).values(data);
  return (result[0] as any).insertId as number;
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
  const result = await db.insert(exhibitorLeads).values(data);
  return (result[0] as any).insertId as number;
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
  const result = await db.insert(serviceOrders).values(data);
  return (result[0] as any).insertId as number;
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
  const result = await db.insert(logisticsPartners).values(data);
  return (result[0] as any).insertId as number;
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
