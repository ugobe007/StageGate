CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agentName" varchar(100) NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"triggeredBy" varchar(100) DEFAULT 'admin',
	"inputSummary" varchar(500),
	"outputSummary" varchar(500),
	"errorMessage" text,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"durationMs" integer
);
--> statement-breakpoint
CREATE TABLE "booking_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"company" varchar(255) NOT NULL,
	"contactName" varchar(255) NOT NULL,
	"contactEmail" varchar(320) NOT NULL,
	"contactPhone" varchar(64),
	"website" varchar(512),
	"country" varchar(100),
	"robotName" varchar(255),
	"robotType" varchar(100),
	"robotCount" integer DEFAULT 1,
	"robotDimensions" varchar(255),
	"robotWeight" varchar(100),
	"specialHandling" text,
	"showName" varchar(255),
	"showDate" varchar(100),
	"boothNumber" varchar(50),
	"services" jsonb DEFAULT '[]'::jsonb,
	"robotSqft" integer,
	"storageDays" integer,
	"warehouseBayId" integer,
	"warehouseEstimate" numeric(10, 2),
	"status" text DEFAULT 'new' NOT NULL,
	"adminNotes" text,
	"prospectId" integer,
	"quoteSentAt" timestamp with time zone,
	"quoteResendMessageId" varchar(255),
	"quoteFollowUpSentAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"startAt" timestamp with time zone NOT NULL,
	"endAt" timestamp with time zone NOT NULL,
	"type" varchar(32) DEFAULT 'meeting' NOT NULL,
	"status" varchar(32) DEFAULT 'scheduled' NOT NULL,
	"prospectId" integer,
	"prospectEmail" varchar(320),
	"prospectName" varchar(255),
	"companyName" varchar(255),
	"notes" text,
	"shareToken" varchar(64),
	"createdBy" integer,
	"notificationSentAt" timestamp with time zone,
	"reminderSentAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_shareToken_unique" UNIQUE("shareToken")
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"companyName" varchar(255) NOT NULL,
	"website" varchar(512),
	"contactName" varchar(255),
	"contactEmail" varchar(320),
	"contactPhone" varchar(64),
	"country" varchar(100),
	"robotTypes" text,
	"description" text,
	"robots" text,
	"showsAttending" text,
	"servicesNeeded" text,
	"logoUrl" text,
	"linkedinUrl" text,
	"onboardingComplete" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(255) NOT NULL,
	"robotType" varchar(255) NOT NULL,
	"preferredShowId" integer,
	"preferredShowName" varchar(255),
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"agentReasoning" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sentAt" timestamp with time zone,
	"resendMessageId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer,
	"threadId" text,
	"direction" text NOT NULL,
	"fromAddress" text NOT NULL,
	"toAddress" text NOT NULL,
	"subject" text,
	"body" text,
	"htmlBody" text,
	"resendMessageId" text,
	"inReplyTo" text,
	"references" text,
	"receivedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_tracking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer,
	"messageId" text NOT NULL,
	"eventType" text NOT NULL,
	"url" text,
	"occurredAt" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exhibitor_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"showId" integer NOT NULL,
	"companyName" varchar(255) NOT NULL,
	"website" varchar(512),
	"contactEmail" varchar(320),
	"contactName" varchar(255),
	"outreachStatus" text DEFAULT 'new' NOT NULL,
	"aiSummary" text,
	"emailDraft" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_checkpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflowId" integer NOT NULL,
	"type" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"dueAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"responsibleParty" text,
	"vendorId" integer,
	"trackingNumber" varchar(255),
	"carrierName" varchar(100),
	"notes" text,
	"problemDescription" text,
	"problemSeverity" text,
	"escalatedAt" timestamp with time zone,
	"resolvedAt" timestamp with time zone,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"serviceType" text NOT NULL,
	"contactName" varchar(255),
	"contactEmail" varchar(320),
	"contactPhone" varchar(64),
	"website" varchar(512),
	"city" varchar(100),
	"notes" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"prospectId" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"robotCompany" varchar(255),
	"robotName" varchar(255),
	"showName" varchar(255),
	"showStartDate" timestamp with time zone,
	"notes" text,
	"warehouseBayId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer NOT NULL,
	"serviceId" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unitPrice" numeric(10, 2),
	"configuration" text
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer NOT NULL,
	"emailSentAt" timestamp with time zone,
	"emailSubject" varchar(300),
	"emailBody" text,
	"emailStatus" text DEFAULT 'pending' NOT NULL,
	"videoMessageUrl" varchar(500),
	"responseStatus" text DEFAULT 'none' NOT NULL,
	"scheduledCallAt" timestamp with time zone,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer NOT NULL,
	"type" text NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_research" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer NOT NULL,
	"companyOverview" text,
	"robotSpecs" jsonb,
	"competitiveContext" text,
	"useCases" jsonb,
	"whyStageGate" text,
	"showIntel" text,
	"decisionMakers" jsonb,
	"apolloOrgId" varchar(100),
	"researchStatus" text DEFAULT 'pending' NOT NULL,
	"researchError" text,
	"researchedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_research_prospectId_unique" UNIQUE("prospectId")
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"shows" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"videoMessageUrl" varchar(500),
	"scheduledCallAt" timestamp with time zone,
	"contactLinkedIn" varchar(512),
	"emailConfidence" varchar(20) DEFAULT 'low',
	"robotCategory" varchar(30) DEFAULT 'light',
	"repliedAt" timestamp with time zone,
	"followUpDate" timestamp with time zone,
	"vendorType" varchar(50) DEFAULT 'robot_oem',
	"outreachAngle" varchar(50) DEFAULT 'customer',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"company" varchar(255) NOT NULL,
	"phone" varchar(64),
	"robotType" varchar(255) NOT NULL,
	"robotCount" integer DEFAULT 1 NOT NULL,
	"robotDimensions" varchar(255),
	"robotWeight" varchar(100),
	"showId" integer,
	"showName" varchar(255),
	"serviceIds" text,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"adminNotes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_agent_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospectId" integer NOT NULL,
	"state" text DEFAULT 'discovery' NOT NULL,
	"strategy" text,
	"outreachAngle" text,
	"lastActivityAt" timestamp with time zone DEFAULT now() NOT NULL,
	"nextFollowUpAt" timestamp with time zone,
	"followUpCount" integer DEFAULT 0,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"runType" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"prospectsFound" integer DEFAULT 0,
	"prospectsCreated" integer DEFAULT 0,
	"emailsSent" integer DEFAULT 0,
	"showsFound" integer DEFAULT 0,
	"errorMessage" text,
	"details" jsonb,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scheduling_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"hostName" varchar(255) NOT NULL,
	"hostEmail" varchar(320) NOT NULL,
	"slotStart" timestamp with time zone NOT NULL,
	"slotEnd" timestamp with time zone NOT NULL,
	"isBooked" boolean DEFAULT false,
	"bookedByProspectId" integer,
	"bookedByName" varchar(255),
	"bookedByEmail" varchar(320),
	"bookedByCompany" varchar(255),
	"meetingNotes" text,
	"calendarEventId" varchar(512),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"showId" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"totalAmount" numeric(10, 2),
	"notes" text,
	"bookingId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"companyProfileId" integer,
	"requestType" varchar(100) NOT NULL,
	"showName" varchar(255),
	"showDate" varchar(100),
	"robotName" varchar(255),
	"robotType" varchar(100),
	"details" text,
	"urgency" varchar(50) DEFAULT 'normal',
	"status" varchar(50) DEFAULT 'new' NOT NULL,
	"adminNotes" text,
	"quotedPrice" varchar(100),
	"attachmentUrl" text,
	"attachmentKey" text,
	"attachmentName" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"brand" text DEFAULT 'stagegate' NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"basePrice" numeric(10, 2),
	"priceUnit" varchar(100),
	"pricingTiers" text,
	"phase" text DEFAULT 'phase1' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "show_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"showId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_shows" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"venue" varchar(255),
	"city" varchar(100),
	"startDate" timestamp with time zone,
	"endDate" timestamp with time zone,
	"website" varchar(512),
	"exhibitorListUrl" varchar(512),
	"status" text DEFAULT 'upcoming' NOT NULL,
	"description" text,
	"roboticsRelevance" integer DEFAULT 3,
	"estimatedExhibitors" integer,
	"roboticsExhibitors" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" text NOT NULL,
	"website" varchar(512),
	"contactName" varchar(255),
	"contactEmail" varchar(320),
	"contactPhone" varchar(64),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"country" varchar(100) DEFAULT 'US',
	"notes" text,
	"rating" integer,
	"isActive" boolean DEFAULT true,
	"scrapedFrom" varchar(512),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_bay_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"bay_id" integer NOT NULL,
	"bay_name" varchar(100) NOT NULL,
	"workflow_id" integer,
	"event" varchar(20) NOT NULL,
	"robot_company" varchar(255),
	"show_name" varchar(255),
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_bays" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"sqft" integer NOT NULL,
	"price_per_sqft_per_day" numeric(10, 4) DEFAULT '0.50' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xbot_logistics_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" integer NOT NULL,
	"timeline" jsonb,
	"customsChecklist" jsonb,
	"groundTransportOptions" jsonb,
	"servicePackage" jsonb,
	"hsCodeSuggestion" varchar(20),
	"ataCarnetEligible" boolean,
	"shipByDeadline" timestamp with time zone,
	"summaryNotes" text,
	"generatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xbot_logistics_briefs_projectId_unique" UNIQUE("projectId")
);
--> statement-breakpoint
CREATE TABLE "xbot_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionToken" varchar(128) NOT NULL,
	"userId" integer,
	"robotMake" varchar(255),
	"robotModel" varchar(255),
	"robotDimensions" varchar(255),
	"robotWeight" varchar(100),
	"powerRequirements" varchar(255),
	"specialHandling" text,
	"originCountry" varchar(100),
	"originCity" varchar(100),
	"shippingMethod" text,
	"flightVesselNumber" varchar(100),
	"eta" timestamp with time zone,
	"portOfEntry" varchar(255),
	"hsCode" varchar(20),
	"ataCarnet" boolean DEFAULT false,
	"customsBroker" text DEFAULT 'tbd',
	"customsBrokerName" varchar(255),
	"showId" integer,
	"boothNumber" varchar(100),
	"setupDate" timestamp with time zone,
	"teardownDate" timestamp with time zone,
	"selectedServices" jsonb,
	"groundTransportProvider" text,
	"contacts" jsonb,
	"currentStep" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xbot_projects_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
ALTER TABLE "draft_emails" ADD CONSTRAINT "draft_emails_prospectId_prospects_id_fk" FOREIGN KEY ("prospectId") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_prospectId_prospects_id_fk" FOREIGN KEY ("prospectId") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_research" ADD CONSTRAINT "prospect_research_prospectId_prospects_id_fk" FOREIGN KEY ("prospectId") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;