import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Company profiles linked to users
export const companyProfiles = mysqlTable("company_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  country: varchar("country", { length: 100 }),
  robotTypes: text("robotTypes"), // JSON array stored as text
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = typeof companyProfiles.$inferInsert;

// Trade shows
export const tradeShows = mysqlTable("trade_shows", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  venue: varchar("venue", { length: 255 }),
  city: varchar("city", { length: 100 }),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  website: varchar("website", { length: 512 }),
  exhibitorListUrl: varchar("exhibitorListUrl", { length: 512 }),
  status: mysqlEnum("status", ["upcoming", "active", "completed"]).default("upcoming").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TradeShow = typeof tradeShows.$inferSelect;
export type InsertTradeShow = typeof tradeShows.$inferInsert;

// Exhibitor leads discovered by AI
export const exhibitorLeads = mysqlTable("exhibitor_leads", {
  id: int("id").autoincrement().primaryKey(),
  showId: int("showId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactName: varchar("contactName", { length: 255 }),
  outreachStatus: mysqlEnum("outreachStatus", ["new", "emailed", "responded", "registered"]).default("new").notNull(),
  aiSummary: text("aiSummary"),
  emailDraft: text("emailDraft"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExhibitorLead = typeof exhibitorLeads.$inferSelect;
export type InsertExhibitorLead = typeof exhibitorLeads.$inferInsert;

// Service catalog
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  brand: mysqlEnum("brand", ["stagegate", "stagehand", "stagepro"]).default("stagegate").notNull(),
  category: mysqlEnum("category", ["logistics", "activation", "support", "marketing", "training", "showroom"]).notNull(),
  description: text("description"),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }),
  priceUnit: varchar("priceUnit", { length: 100 }),
  pricingTiers: text("pricingTiers"), // JSON stored as text
  phase: mysqlEnum("phase", ["phase1", "phase2"]).default("phase1").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// Service orders
export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  showId: int("showId").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// Order line items
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  serviceId: int("serviceId").notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }),
  configuration: text("configuration"), // JSON stored as text
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Logistics partners directory
export const logisticsPartners = mysqlTable("logistics_partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  serviceType: mysqlEnum("serviceType", ["customs", "transporter", "insurance", "parts", "general"]).notNull(),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  website: varchar("website", { length: 512 }),
  city: varchar("city", { length: 100 }),
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LogisticsPartner = typeof logisticsPartners.$inferSelect;
export type InsertLogisticsPartner = typeof logisticsPartners.$inferInsert;
