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
  description: text("description"),
  roboticsRelevance: int("roboticsRelevance").default(3), // 1-5 scale
  estimatedExhibitors: int("estimatedExhibitors"),
  roboticsExhibitors: int("roboticsExhibitors"),
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

// Show booking notification requests
export const showNotifications = mysqlTable("show_notifications", {
  id: int("id").autoincrement().primaryKey(),
  showId: int("showId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShowNotification = typeof showNotifications.$inferSelect;
export type InsertShowNotification = typeof showNotifications.$inferInsert;

// Quote requests from prospective clients
export const quoteRequests = mysqlTable("quote_requests", {
  id: int("id").autoincrement().primaryKey(),
  // Contact info
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  // Robot details
  robotType: varchar("robotType", { length: 255 }).notNull(),
  robotCount: int("robotCount").default(1).notNull(),
  robotDimensions: varchar("robotDimensions", { length: 255 }),
  robotWeight: varchar("robotWeight", { length: 100 }),
  // Show and services
  showId: int("showId"),
  showName: varchar("showName", { length: 255 }), // fallback if show not in DB
  serviceIds: text("serviceIds"), // JSON array of service IDs
  // Additional info
  notes: text("notes"),
  // Admin workflow
  status: mysqlEnum("status", ["new", "reviewing", "quoted", "converted", "closed"]).default("new").notNull(),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type InsertQuoteRequest = typeof quoteRequests.$inferInsert;

// Demo requests from prospective clients
export const demoRequests = mysqlTable("demo_requests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  robotType: varchar("robotType", { length: 255 }).notNull(),
  preferredShowId: int("preferredShowId"),
  preferredShowName: varchar("preferredShowName", { length: 255 }),
  message: text("message"),
  status: mysqlEnum("status", ["new", "contacted", "scheduled", "completed", "closed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DemoRequest = typeof demoRequests.$inferSelect;
export type InsertDemoRequest = typeof demoRequests.$inferInsert;

// XBOT AI Logistics Agent — robot logistics projects
export const xbotProjects = mysqlTable("xbot_projects", {
  id: int("id").autoincrement().primaryKey(),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  userId: int("userId"), // nullable — anonymous users allowed
  // Step 1: Robot Profile
  robotMake: varchar("robotMake", { length: 255 }),
  robotModel: varchar("robotModel", { length: 255 }),
  robotDimensions: varchar("robotDimensions", { length: 255 }), // LxWxH cm
  robotWeight: varchar("robotWeight", { length: 100 }), // kg
  powerRequirements: varchar("powerRequirements", { length: 255 }),
  specialHandling: text("specialHandling"),
  // Step 2: Origin & Shipping
  originCountry: varchar("originCountry", { length: 100 }),
  originCity: varchar("originCity", { length: 100 }),
  shippingMethod: mysqlEnum("shippingMethod", ["air", "sea", "ground"]),
  flightVesselNumber: varchar("flightVesselNumber", { length: 100 }),
  eta: timestamp("eta"),
  portOfEntry: varchar("portOfEntry", { length: 255 }),
  // Step 3: Customs
  hsCode: varchar("hsCode", { length: 20 }),
  ataCarnet: boolean("ataCarnet").default(false),
  customsBroker: mysqlEnum("customsBroker", ["stagegate", "own", "tbd"]).default("tbd"),
  customsBrokerName: varchar("customsBrokerName", { length: 255 }),
  // Step 4: Target Show
  showId: int("showId"),
  boothNumber: varchar("boothNumber", { length: 100 }),
  setupDate: timestamp("setupDate"),
  teardownDate: timestamp("teardownDate"),
  // Step 5: Services (JSON array of service keys)
  selectedServices: json("selectedServices").$type<string[]>(),
  groundTransportProvider: mysqlEnum("groundTransportProvider", ["stagegate", "own", "directory"]),
  // Step 6: Contacts
  contacts: json("contacts").$type<{
    primary: { name: string; email: string; phone: string };
    onsite?: { name: string; email: string; phone: string };
    emergency?: { name: string; phone: string };
  }>(),
  // Workflow
  currentStep: int("currentStep").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "brief_generated", "submitted", "in_review", "confirmed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type XbotProject = typeof xbotProjects.$inferSelect;
export type InsertXbotProject = typeof xbotProjects.$inferInsert;

// XBOT generated logistics briefs
export const xbotLogisticsBriefs = mysqlTable("xbot_logistics_briefs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull().unique(),
  timeline: json("timeline").$type<Array<{ date: string; label: string; description: string; critical: boolean }>>(),
  customsChecklist: json("customsChecklist").$type<Array<{ item: string; required: boolean; notes: string }>>(),
  groundTransportOptions: json("groundTransportOptions").$type<Array<{ name: string; type: string; contact: string; website: string; notes: string }>>(),
  servicePackage: json("servicePackage").$type<Array<{ service: string; description: string; included: boolean }>>(),
  hsCodeSuggestion: varchar("hsCodeSuggestion", { length: 20 }),
  ataCarnetEligible: boolean("ataCarnetEligible"),
  shipByDeadline: timestamp("shipByDeadline"),
  summaryNotes: text("summaryNotes"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export type XbotLogisticsBrief = typeof xbotLogisticsBriefs.$inferSelect;
export type InsertXbotLogisticsBrief = typeof xbotLogisticsBriefs.$inferInsert;

// ─── XBOT Prospects & Outreach ────────────────────────────────────────────────
export const prospects = mysqlTable("prospects", {
  id: int("id").primaryKey().autoincrement(),
  company: varchar("company", { length: 200 }).notNull(),
  robotName: varchar("robotName", { length: 200 }),
  robotType: varchar("robotType", { length: 50 }),
  hqCountry: varchar("hqCountry", { length: 100 }),
  attendsLasVegas: varchar("attendsLasVegas", { length: 10 }).default("unknown"),
  contactName: varchar("contactName", { length: 200 }),
  contactEmail: varchar("contactEmail", { length: 200 }),
  contactTitle: varchar("contactTitle", { length: 200 }),
  contactDept: varchar("contactDept", { length: 100 }),
  website: varchar("website", { length: 300 }),
  shows: json("shows").$type<string[]>().default([]),
  notes: text("notes"),
  status: mysqlEnum("status", ["new", "contacted", "responded", "scheduled", "converted", "not_interested"]).default("new").notNull(),
  videoMessageUrl: varchar("videoMessageUrl", { length: 500 }),
  scheduledCallAt: timestamp("scheduledCallAt"),
  contactLinkedIn: varchar("contactLinkedIn", { length: 512 }),
  emailConfidence: varchar("emailConfidence", { length: 20 }).default("low"),
  repliedAt: timestamp("repliedAt"),
  followUpDate: timestamp("followUpDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = typeof prospects.$inferInsert;

export const outreachCampaigns = mysqlTable("outreach_campaigns", {
  id: int("id").primaryKey().autoincrement(),
  prospectId: int("prospectId").notNull(),
  emailSentAt: timestamp("emailSentAt"),
  emailSubject: varchar("emailSubject", { length: 300 }),
  emailBody: text("emailBody"),
  emailStatus: mysqlEnum("emailStatus", ["pending", "sent", "failed", "opened", "replied"]).default("pending").notNull(),
  videoMessageUrl: varchar("videoMessageUrl", { length: 500 }),
  responseStatus: mysqlEnum("responseStatus", ["none", "positive", "negative", "scheduled"]).default("none").notNull(),
  scheduledCallAt: timestamp("scheduledCallAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = typeof outreachCampaigns.$inferInsert;
