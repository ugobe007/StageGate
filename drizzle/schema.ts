import {
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Company profiles linked to users
export const companyProfiles = pgTable("company_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  country: varchar("country", { length: 100 }),
  robotTypes: text("robotTypes"),
  description: text("description"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = typeof companyProfiles.$inferInsert;

// Trade shows
export const tradeShows = pgTable("trade_shows", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  venue: varchar("venue", { length: 255 }),
  city: varchar("city", { length: 100 }),
  startDate: timestamp("startDate", { withTimezone: true }),
  endDate: timestamp("endDate", { withTimezone: true }),
  website: varchar("website", { length: 512 }),
  exhibitorListUrl: varchar("exhibitorListUrl", { length: 512 }),
  status: text("status").notNull().default("upcoming"),
  description: text("description"),
  roboticsRelevance: integer("roboticsRelevance").default(3),
  estimatedExhibitors: integer("estimatedExhibitors"),
  roboticsExhibitors: integer("roboticsExhibitors"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type TradeShow = typeof tradeShows.$inferSelect;
export type InsertTradeShow = typeof tradeShows.$inferInsert;

// Exhibitor leads discovered by AI
export const exhibitorLeads = pgTable("exhibitor_leads", {
  id: serial("id").primaryKey(),
  showId: integer("showId").notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  website: varchar("website", { length: 512 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactName: varchar("contactName", { length: 255 }),
  outreachStatus: text("outreachStatus").notNull().default("new"),
  aiSummary: text("aiSummary"),
  emailDraft: text("emailDraft"),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ExhibitorLead = typeof exhibitorLeads.$inferSelect;
export type InsertExhibitorLead = typeof exhibitorLeads.$inferInsert;

// Service catalog
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  brand: text("brand").notNull().default("stagegate"),
  category: text("category").notNull(),
  description: text("description"),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }),
  priceUnit: varchar("priceUnit", { length: 100 }),
  pricingTiers: text("pricingTiers"),
  phase: text("phase").notNull().default("phase1"),
  isActive: boolean("isActive").notNull().default(true),
  sortOrder: integer("sortOrder").default(0),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// Service orders
export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  showId: integer("showId").notNull(),
  status: text("status").notNull().default("pending"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  bookingId: integer("bookingId"), // originating booking_request id (if converted from a booking)
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// Order line items
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  serviceId: integer("serviceId").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }),
  configuration: text("configuration"),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Logistics partners directory
export const logisticsPartners = pgTable("logistics_partners", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  serviceType: text("serviceType").notNull(),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  website: varchar("website", { length: 512 }),
  city: varchar("city", { length: 100 }),
  notes: text("notes"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type LogisticsPartner = typeof logisticsPartners.$inferSelect;
export type InsertLogisticsPartner = typeof logisticsPartners.$inferInsert;

// Show booking notification requests
export const showNotifications = pgTable("show_notifications", {
  id: serial("id").primaryKey(),
  showId: integer("showId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ShowNotification = typeof showNotifications.$inferSelect;
export type InsertShowNotification = typeof showNotifications.$inferInsert;

// Quote requests from prospective clients
export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 64 }),
  robotType: varchar("robotType", { length: 255 }).notNull(),
  robotCount: integer("robotCount").notNull().default(1),
  robotDimensions: varchar("robotDimensions", { length: 255 }),
  robotWeight: varchar("robotWeight", { length: 100 }),
  showId: integer("showId"),
  showName: varchar("showName", { length: 255 }),
  serviceIds: text("serviceIds"),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  adminNotes: text("adminNotes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type InsertQuoteRequest = typeof quoteRequests.$inferInsert;

// Demo requests from prospective clients
export const demoRequests = pgTable("demo_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  robotType: varchar("robotType", { length: 255 }).notNull(),
  preferredShowId: integer("preferredShowId"),
  preferredShowName: varchar("preferredShowName", { length: 255 }),
  message: text("message"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type DemoRequest = typeof demoRequests.$inferSelect;
export type InsertDemoRequest = typeof demoRequests.$inferInsert;

// XBOT AI Logistics Agent — robot logistics projects
export const xbotProjects = pgTable("xbot_projects", {
  id: serial("id").primaryKey(),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  userId: integer("userId"),
  robotMake: varchar("robotMake", { length: 255 }),
  robotModel: varchar("robotModel", { length: 255 }),
  robotDimensions: varchar("robotDimensions", { length: 255 }),
  robotWeight: varchar("robotWeight", { length: 100 }),
  powerRequirements: varchar("powerRequirements", { length: 255 }),
  specialHandling: text("specialHandling"),
  originCountry: varchar("originCountry", { length: 100 }),
  originCity: varchar("originCity", { length: 100 }),
  shippingMethod: text("shippingMethod"),
  flightVesselNumber: varchar("flightVesselNumber", { length: 100 }),
  eta: timestamp("eta", { withTimezone: true }),
  portOfEntry: varchar("portOfEntry", { length: 255 }),
  hsCode: varchar("hsCode", { length: 20 }),
  ataCarnet: boolean("ataCarnet").default(false),
  customsBroker: text("customsBroker").default("tbd"),
  customsBrokerName: varchar("customsBrokerName", { length: 255 }),
  showId: integer("showId"),
  boothNumber: varchar("boothNumber", { length: 100 }),
  setupDate: timestamp("setupDate", { withTimezone: true }),
  teardownDate: timestamp("teardownDate", { withTimezone: true }),
  selectedServices: jsonb("selectedServices").$type<string[]>(),
  groundTransportProvider: text("groundTransportProvider"),
  contacts: jsonb("contacts").$type<{
    primary: { name: string; email: string; phone: string };
    onsite?: { name: string; email: string; phone: string };
    emergency?: { name: string; phone: string };
  }>(),
  currentStep: integer("currentStep").notNull().default(1),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type XbotProject = typeof xbotProjects.$inferSelect;
export type InsertXbotProject = typeof xbotProjects.$inferInsert;

// XBOT generated logistics briefs
export const xbotLogisticsBriefs = pgTable("xbot_logistics_briefs", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().unique(),
  timeline: jsonb("timeline").$type<Array<{ date: string; label: string; description: string; critical: boolean }>>(),
  customsChecklist: jsonb("customsChecklist").$type<Array<{ item: string; required: boolean; notes: string }>>(),
  groundTransportOptions: jsonb("groundTransportOptions").$type<Array<{ name: string; type: string; contact: string; website: string; notes: string }>>(),
  servicePackage: jsonb("servicePackage").$type<Array<{ service: string; description: string; included: boolean }>>(),
  hsCodeSuggestion: varchar("hsCodeSuggestion", { length: 20 }),
  ataCarnetEligible: boolean("ataCarnetEligible"),
  shipByDeadline: timestamp("shipByDeadline", { withTimezone: true }),
  summaryNotes: text("summaryNotes"),
  generatedAt: timestamp("generatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type XbotLogisticsBrief = typeof xbotLogisticsBriefs.$inferSelect;
export type InsertXbotLogisticsBrief = typeof xbotLogisticsBriefs.$inferInsert;

// ─── XBOT Prospects & Outreach ────────────────────────────────────────────────
export const prospects = pgTable("prospects", {
  id: serial("id").primaryKey(),
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
  shows: jsonb("shows").$type<string[]>().default([]),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  videoMessageUrl: varchar("videoMessageUrl", { length: 500 }),
  scheduledCallAt: timestamp("scheduledCallAt", { withTimezone: true }),
  contactLinkedIn: varchar("contactLinkedIn", { length: 512 }),
  emailConfidence: varchar("emailConfidence", { length: 20 }).default("low"),
  repliedAt: timestamp("repliedAt", { withTimezone: true }),
  followUpDate: timestamp("followUpDate", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = typeof prospects.$inferInsert;
export type ProspectStatus = "new" | "contacted" | "responded" | "scheduled" | "converted" | "not_interested";

export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId").notNull(),
  emailSentAt: timestamp("emailSentAt", { withTimezone: true }),
  emailSubject: varchar("emailSubject", { length: 300 }),
  emailBody: text("emailBody"),
  emailStatus: text("emailStatus").notNull().default("pending"),
  videoMessageUrl: varchar("videoMessageUrl", { length: 500 }),
  responseStatus: text("responseStatus").notNull().default("none"),
  scheduledCallAt: timestamp("scheduledCallAt", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = typeof outreachCampaigns.$inferInsert;

// ─── AI Agent Run Log ─────────────────────────────────────────────────────────
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  agentName: varchar("agentName", { length: 100 }).notNull(),
  status: text("status").notNull().default("running"),
  triggeredBy: varchar("triggeredBy", { length: 100 }).default("admin"),
  inputSummary: varchar("inputSummary", { length: 500 }),
  outputSummary: varchar("outputSummary", { length: 500 }),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  durationMs: integer("durationMs"),
});
export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;

// ─── Draft Emails (Outreach Workflow) ────────────────────────────────────────
export const draftEmails = pgTable("draft_emails", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  agentReasoning: text("agentReasoning"),
  status: text("status").notNull().default("pending"), // pending | approved | sent | discarded
  sentAt: timestamp("sentAt", { withTimezone: true }),
  resendMessageId: text("resendMessageId"), // Resend API message ID for webhook tracking
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});
export type DraftEmail = typeof draftEmails.$inferSelect;
export type NewDraftEmail = typeof draftEmails.$inferInsert;

// ─── Prospect Research (AI + Apollo nightly job) ──────────────────────────────
export const prospectResearch = pgTable("prospect_research", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId").notNull().unique().references(() => prospects.id, { onDelete: "cascade" }),
  // AI-generated fields
  companyOverview: text("companyOverview"),
  robotSpecs: jsonb("robotSpecs").$type<{
    name?: string;
    type?: string;
    height?: string;
    weight?: string;
    payload?: string;
    battery?: string;
    speed?: string;
    sensors?: string[];
    useCases?: string[];
    price?: string;
    availability?: string;
  }>(),
  competitiveContext: text("competitiveContext"),
  useCases: jsonb("useCases").$type<string[]>(),
  whyStageGate: text("whyStageGate"),
  showIntel: text("showIntel"),
  // Apollo.io contact data
  decisionMakers: jsonb("decisionMakers").$type<Array<{
    name: string;
    title: string;
    email?: string;
    emailConfidence?: string;
    linkedIn?: string;
    department?: string;
  }>>(),
  apolloOrgId: varchar("apolloOrgId", { length: 100 }),
  // Status tracking
  researchStatus: text("researchStatus").notNull().default("pending"), // pending | running | done | failed
  researchError: text("researchError"),
  researchedAt: timestamp("researchedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type ProspectResearch = typeof prospectResearch.$inferSelect;
export type InsertProspectResearch = typeof prospectResearch.$inferInsert;

// ─── Prospect Activity Timeline ───────────────────────────────────────────────
export const prospectActivities = pgTable("prospect_activities", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // email_sent | stage_changed | follow_up_scheduled | note_added | call_scheduled | replied
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type ProspectActivity = typeof prospectActivities.$inferSelect;
export type InsertProspectActivity = typeof prospectActivities.$inferInsert;

// ─── Booking Requests (from /register page) ───────────────────────────────────
export const bookingRequests = pgTable("booking_requests", {
  id: serial("id").primaryKey(),
  // Company info
  company: varchar("company", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 64 }),
  website: varchar("website", { length: 512 }),
  country: varchar("country", { length: 100 }),
  // Robot details
  robotName: varchar("robotName", { length: 255 }),
  robotType: varchar("robotType", { length: 100 }),
  robotCount: integer("robotCount").default(1),
  robotDimensions: varchar("robotDimensions", { length: 255 }),
  robotWeight: varchar("robotWeight", { length: 100 }),
  specialHandling: text("specialHandling"),
  // Show/event
  showName: varchar("showName", { length: 255 }),
  showDate: varchar("showDate", { length: 100 }),
  boothNumber: varchar("boothNumber", { length: 50 }),
  // Services requested
  services: jsonb("services").$type<string[]>().default([]),
  // Status
  status: text("status").notNull().default("new"), // new | reviewed | quoted | confirmed | cancelled
  adminNotes: text("adminNotes"),
  prospectId: integer("prospectId"), // link to prospect if matched
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type BookingRequest = typeof bookingRequests.$inferSelect;
export type InsertBookingRequest = typeof bookingRequests.$inferInsert;

// ─── Email Tracking Events (Resend webhook) ───────────────────────────────────
export const emailTrackingEvents = pgTable("email_tracking_events", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId"),
  messageId: text("messageId").notNull(),
  eventType: text("eventType").notNull(), // email.opened | email.clicked
  url: text("url"),
  occurredAt: timestamp("occurredAt", { withTimezone: true }).defaultNow().notNull(),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type EmailTrackingEvent = typeof emailTrackingEvents.$inferSelect;
export type InsertEmailTrackingEvent = typeof emailTrackingEvents.$inferInsert;

// ─── Email Threads (inbound + outbound conversation history) ─────────────────
export const emailThreads = pgTable("email_threads", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId"),
  threadId: text("threadId"), // email Message-ID / In-Reply-To chain key
  direction: text("direction").notNull(), // outbound | inbound
  fromAddress: text("fromAddress").notNull(),
  toAddress: text("toAddress").notNull(),
  subject: text("subject"),
  body: text("body"),
  htmlBody: text("htmlBody"),
  resendMessageId: text("resendMessageId"), // Resend message ID for outbound
  inReplyTo: text("inReplyTo"), // In-Reply-To header value
  references: text("references"), // References header value
  receivedAt: timestamp("receivedAt", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = typeof emailThreads.$inferInsert;

// ─── Sales Agent Conversations (state machine per prospect) ──────────────────
export const salesAgentConversations = pgTable("sales_agent_conversations", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospectId").notNull(),
  state: text("state").notNull().default("discovery"),
  // States: discovery | first_outreach | awaiting_reply | in_conversation |
  //         questions_answered | scheduling_sent | call_scheduled | committed | closed
  strategy: text("strategy"), // AI-generated per-company outreach strategy
  outreachAngle: text("outreachAngle"), // specific hook for this company
  lastActivityAt: timestamp("lastActivityAt", { withTimezone: true }).defaultNow().notNull(),
  nextFollowUpAt: timestamp("nextFollowUpAt", { withTimezone: true }),
  followUpCount: integer("followUpCount").default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type SalesAgentConversation = typeof salesAgentConversations.$inferSelect;
export type InsertSalesAgentConversation = typeof salesAgentConversations.$inferInsert;

// ─── Sales Agent Runs (nightly discovery job log) ────────────────────────────
export const salesAgentRuns = pgTable("sales_agent_runs", {
  id: serial("id").primaryKey(),
  runType: text("runType").notNull(), // discovery | outreach | reply | follow_up
  status: text("status").notNull().default("running"), // running | completed | failed
  prospectsFound: integer("prospectsFound").default(0),
  prospectsCreated: integer("prospectsCreated").default(0),
  emailsSent: integer("emailsSent").default(0),
  showsFound: integer("showsFound").default(0),
  errorMessage: text("errorMessage"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  startedAt: timestamp("startedAt", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completedAt", { withTimezone: true }),
});
export type SalesAgentRun = typeof salesAgentRuns.$inferSelect;
export type InsertSalesAgentRun = typeof salesAgentRuns.$inferInsert;

// ─── Vendors (logistics partners: freight, AV, rigging, warehouse, etc.) ─────
export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: text("type").notNull(), // freight | customs_broker | av | rigging | warehouse | transport | tech_support | other
  website: varchar("website", { length: 512 }),
  contactName: varchar("contactName", { length: 255 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 100 }).default("US"),
  notes: text("notes"),
  rating: integer("rating"), // 1-5
  isActive: boolean("isActive").default(true),
  scrapedFrom: varchar("scrapedFrom", { length: 512 }), // source URL
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

// ─── Logistics Workflows (per order, generated by Logistics Agent) ────────────
export const logisticsWorkflows = pgTable("logistics_workflows", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull(),
  prospectId: integer("prospectId"),
  status: text("status").notNull().default("active"), // active | completed | on_hold | cancelled
  robotCompany: varchar("robotCompany", { length: 255 }),
  robotName: varchar("robotName", { length: 255 }),
  showName: varchar("showName", { length: 255 }),
  showStartDate: timestamp("showStartDate", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type LogisticsWorkflow = typeof logisticsWorkflows.$inferSelect;
export type InsertLogisticsWorkflow = typeof logisticsWorkflows.$inferInsert;

// ─── Logistics Checkpoints (individual steps in a workflow) ──────────────────
export const logisticsCheckpoints = pgTable("logistics_checkpoints", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflowId").notNull(),
  type: text("type").notNull(),
  // Types: shipping_out | customs | airport_arrival | receiving | warehouse_in |
  //        staging | activation_test | problem_report | booth_delivery |
  //        show_floor_checkin | show_end | return_pickup | warehouse_return | completed
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed | blocked | escalated
  dueAt: timestamp("dueAt", { withTimezone: true }),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  responsibleParty: text("responsibleParty"), // stagegate | robot_company | vendor | robot_team
  vendorId: integer("vendorId"),
  trackingNumber: varchar("trackingNumber", { length: 255 }),
  carrierName: varchar("carrierName", { length: 100 }),
  notes: text("notes"),
  problemDescription: text("problemDescription"), // for problem_report type
  problemSeverity: text("problemSeverity"), // low | medium | high | critical
  escalatedAt: timestamp("escalatedAt", { withTimezone: true }),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type LogisticsCheckpoint = typeof logisticsCheckpoints.$inferSelect;
export type InsertLogisticsCheckpoint = typeof logisticsCheckpoints.$inferInsert;

// ─── Scheduling Slots (robot team availability for calls) ────────────────────
export const schedulingSlots = pgTable("scheduling_slots", {
  id: serial("id").primaryKey(),
  hostName: varchar("hostName", { length: 255 }).notNull(), // "Bob" | "Tommy" | "Robot Team"
  hostEmail: varchar("hostEmail", { length: 320 }).notNull(),
  slotStart: timestamp("slotStart", { withTimezone: true }).notNull(),
  slotEnd: timestamp("slotEnd", { withTimezone: true }).notNull(),
  isBooked: boolean("isBooked").default(false),
  bookedByProspectId: integer("bookedByProspectId"),
  bookedByName: varchar("bookedByName", { length: 255 }),
  bookedByEmail: varchar("bookedByEmail", { length: 320 }),
  meetingNotes: text("meetingNotes"),
  calendarEventId: varchar("calendarEventId", { length: 512 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});
export type SchedulingSlot = typeof schedulingSlots.$inferSelect;
export type InsertSchedulingSlot = typeof schedulingSlots.$inferInsert;
