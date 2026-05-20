CREATE TABLE "carrier_tracking_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflowId" integer NOT NULL,
	"checkpointId" integer,
	"carrier" varchar(50) NOT NULL,
	"trackingNumber" varchar(255) NOT NULL,
	"eventCode" varchar(50),
	"statusSummary" varchar(255),
	"location" varchar(255),
	"eventTimestamp" timestamp with time zone,
	"isDelivered" boolean DEFAULT false,
	"rawPayload" jsonb,
	"polledAt" timestamp with time zone DEFAULT now(),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_costs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflowId" integer NOT NULL,
	"phaseNumber" integer NOT NULL,
	"phaseName" varchar(100) NOT NULL,
	"costType" varchar(100) NOT NULL,
	"description" varchar(500) NOT NULL,
	"estimatedAmountUsd" numeric(10, 2),
	"actualAmountUsd" numeric(10, 2),
	"vendorName" varchar(255),
	"vendorId" integer,
	"isPaidByClient" boolean DEFAULT true,
	"invoiceNumber" varchar(100),
	"paidAt" timestamp with time zone,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"first_name" varchar(128),
	"interests" text,
	"source" varchar(64) DEFAULT 'website',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_subscriptions_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "logistics_checkpoints" ADD COLUMN "phaseNumber" integer;--> statement-breakpoint
ALTER TABLE "logistics_checkpoints" ADD COLUMN "customerVisibleNote" text;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "robotModel" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "robotSerialNumber" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "originCountry" varchar(100);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "robotWeightKg" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "robotLengthCm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "robotWidthCm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "robotHeightCm" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "declaredValueUsd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "batteryType" varchar(100);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "batteryWh" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "hasWirelessRadio" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "hasCameras" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "requiresFccDocs" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "requiresFdaDocs" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "ataCarnetRequired" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "hsTariffCode" varchar(20);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "totalEstimatedCostUsd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "totalActualCostUsd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "costEstimateAcceptedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "costEstimateAcceptedBy" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "trackingToken" varchar(64);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "customerEmail" varchar(320);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "customerName" varchar(255);--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "showEndDate" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD COLUMN "targetArrivalDate" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "stripeCheckoutSessionId" varchar(255);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "stripePaymentIntentId" varchar(255);--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "stripePaymentStatus" varchar(64) DEFAULT 'unpaid';--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "paidAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "logistics_workflows" ADD CONSTRAINT "logistics_workflows_trackingToken_unique" UNIQUE("trackingToken");