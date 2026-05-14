-- StageGate — Postgres schema for Supabase
-- Generated from drizzle/schema.ts (MySQL → Postgres conversion)

-- users
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY,
  "openId" varchar(64) NOT NULL UNIQUE,
  "name" text,
  "email" varchar(320),
  "loginMethod" varchar(64),
  "role" text NOT NULL DEFAULT 'user' CHECK ("role" IN ('user', 'admin')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "lastSignedIn" timestamptz NOT NULL DEFAULT now()
);

-- company_profiles
CREATE TABLE IF NOT EXISTS "company_profiles" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "companyName" varchar(255) NOT NULL,
  "website" varchar(512),
  "contactName" varchar(255),
  "contactEmail" varchar(320),
  "contactPhone" varchar(64),
  "country" varchar(100),
  "robotTypes" text,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- trade_shows
CREATE TABLE IF NOT EXISTS "trade_shows" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "location" varchar(255),
  "venue" varchar(255),
  "city" varchar(100),
  "startDate" timestamptz,
  "endDate" timestamptz,
  "website" varchar(512),
  "exhibitorListUrl" varchar(512),
  "status" text NOT NULL DEFAULT 'upcoming' CHECK ("status" IN ('upcoming', 'active', 'completed')),
  "description" text,
  "roboticsRelevance" integer DEFAULT 3,
  "estimatedExhibitors" integer,
  "roboticsExhibitors" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- exhibitor_leads
CREATE TABLE IF NOT EXISTS "exhibitor_leads" (
  "id" serial PRIMARY KEY,
  "showId" integer NOT NULL,
  "companyName" varchar(255) NOT NULL,
  "website" varchar(512),
  "contactEmail" varchar(320),
  "contactName" varchar(255),
  "outreachStatus" text NOT NULL DEFAULT 'new' CHECK ("outreachStatus" IN ('new', 'emailed', 'responded', 'registered')),
  "aiSummary" text,
  "emailDraft" text,
  "notes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- services
CREATE TABLE IF NOT EXISTS "services" (
  "id" serial PRIMARY KEY,
  "slug" varchar(100) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "brand" text NOT NULL DEFAULT 'stagegate' CHECK ("brand" IN ('stagegate', 'stagehand', 'stagepro')),
  "category" text NOT NULL CHECK ("category" IN ('logistics', 'activation', 'support', 'marketing', 'training', 'showroom')),
  "description" text,
  "basePrice" numeric(10,2),
  "priceUnit" varchar(100),
  "pricingTiers" text,
  "phase" text NOT NULL DEFAULT 'phase1' CHECK ("phase" IN ('phase1', 'phase2')),
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" integer DEFAULT 0
);

-- service_orders
CREATE TABLE IF NOT EXISTS "service_orders" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL,
  "showId" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  "totalAmount" numeric(10,2),
  "notes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- order_items
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" serial PRIMARY KEY,
  "orderId" integer NOT NULL,
  "serviceId" integer NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unitPrice" numeric(10,2),
  "configuration" text
);

-- logistics_partners
CREATE TABLE IF NOT EXISTS "logistics_partners" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "serviceType" text NOT NULL CHECK ("serviceType" IN ('customs', 'transporter', 'insurance', 'parts', 'general')),
  "contactName" varchar(255),
  "contactEmail" varchar(320),
  "contactPhone" varchar(64),
  "website" varchar(512),
  "city" varchar(100),
  "notes" text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- show_notifications
CREATE TABLE IF NOT EXISTS "show_notifications" (
  "id" serial PRIMARY KEY,
  "showId" integer NOT NULL,
  "email" varchar(320) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- quote_requests
CREATE TABLE IF NOT EXISTS "quote_requests" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "email" varchar(320) NOT NULL,
  "company" varchar(255) NOT NULL,
  "phone" varchar(64),
  "robotType" varchar(255) NOT NULL,
  "robotCount" integer NOT NULL DEFAULT 1,
  "robotDimensions" varchar(255),
  "robotWeight" varchar(100),
  "showId" integer,
  "showName" varchar(255),
  "serviceIds" text,
  "notes" text,
  "status" text NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'reviewing', 'quoted', 'converted', 'closed')),
  "adminNotes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- demo_requests
CREATE TABLE IF NOT EXISTS "demo_requests" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "email" varchar(320) NOT NULL,
  "company" varchar(255) NOT NULL,
  "robotType" varchar(255) NOT NULL,
  "preferredShowId" integer,
  "preferredShowName" varchar(255),
  "message" text,
  "status" text NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'contacted', 'scheduled', 'completed', 'closed')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- xbot_projects
CREATE TABLE IF NOT EXISTS "xbot_projects" (
  "id" serial PRIMARY KEY,
  "sessionToken" varchar(128) NOT NULL UNIQUE,
  "userId" integer,
  "robotMake" varchar(255),
  "robotModel" varchar(255),
  "robotDimensions" varchar(255),
  "robotWeight" varchar(100),
  "powerRequirements" varchar(255),
  "specialHandling" text,
  "originCountry" varchar(100),
  "originCity" varchar(100),
  "shippingMethod" text CHECK ("shippingMethod" IN ('air', 'sea', 'ground')),
  "flightVesselNumber" varchar(100),
  "eta" timestamptz,
  "portOfEntry" varchar(255),
  "hsCode" varchar(20),
  "ataCarnet" boolean DEFAULT false,
  "customsBroker" text DEFAULT 'tbd' CHECK ("customsBroker" IN ('stagegate', 'own', 'tbd')),
  "customsBrokerName" varchar(255),
  "showId" integer,
  "boothNumber" varchar(100),
  "setupDate" timestamptz,
  "teardownDate" timestamptz,
  "selectedServices" jsonb,
  "groundTransportProvider" text CHECK ("groundTransportProvider" IN ('stagegate', 'own', 'directory')),
  "contacts" jsonb,
  "currentStep" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'brief_generated', 'submitted', 'in_review', 'confirmed')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- xbot_logistics_briefs
CREATE TABLE IF NOT EXISTS "xbot_logistics_briefs" (
  "id" serial PRIMARY KEY,
  "projectId" integer NOT NULL UNIQUE,
  "timeline" jsonb,
  "customsChecklist" jsonb,
  "groundTransportOptions" jsonb,
  "servicePackage" jsonb,
  "hsCodeSuggestion" varchar(20),
  "ataCarnetEligible" boolean,
  "shipByDeadline" timestamptz,
  "summaryNotes" text,
  "generatedAt" timestamptz NOT NULL DEFAULT now()
);

-- prospects
CREATE TABLE IF NOT EXISTS "prospects" (
  "id" serial PRIMARY KEY,
  "company" varchar(200) NOT NULL,
  "robotName" varchar(200),
  "robotType" varchar(50),
  "hqCountry" varchar(100),
  "attendsLasVegas" varchar(10) DEFAULT 'unknown',
  "contactName" varchar(200),
  "contactEmail" varchar(200),
  "contactTitle" varchar(200),
  "contactDept" varchar(100),
  "website" varchar(300),
  "shows" jsonb DEFAULT '[]',
  "notes" text,
  "status" text NOT NULL DEFAULT 'new' CHECK ("status" IN ('new', 'contacted', 'responded', 'scheduled', 'converted', 'not_interested')),
  "videoMessageUrl" varchar(500),
  "scheduledCallAt" timestamptz,
  "contactLinkedIn" varchar(512),
  "emailConfidence" varchar(20) DEFAULT 'low',
  "repliedAt" timestamptz,
  "followUpDate" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- outreach_campaigns
CREATE TABLE IF NOT EXISTS "outreach_campaigns" (
  "id" serial PRIMARY KEY,
  "prospectId" integer NOT NULL,
  "emailSentAt" timestamptz,
  "emailSubject" varchar(300),
  "emailBody" text,
  "emailStatus" text NOT NULL DEFAULT 'pending' CHECK ("emailStatus" IN ('pending', 'sent', 'failed', 'opened', 'replied')),
  "videoMessageUrl" varchar(500),
  "responseStatus" text NOT NULL DEFAULT 'none' CHECK ("responseStatus" IN ('none', 'positive', 'negative', 'scheduled')),
  "scheduledCallAt" timestamptz,
  "notes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- agent_runs
CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" serial PRIMARY KEY,
  "agentName" varchar(100) NOT NULL,
  "status" text NOT NULL DEFAULT 'running' CHECK ("status" IN ('running', 'success', 'error')),
  "triggeredBy" varchar(100) DEFAULT 'admin',
  "inputSummary" varchar(500),
  "outputSummary" varchar(500),
  "errorMessage" text,
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz,
  "durationMs" integer
);
