import { Pool } from "pg";
import { config } from "dotenv";
config();

const db = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS carrier_tracking_events (
  id serial PRIMARY KEY,
  "workflowId" integer NOT NULL,
  "checkpointId" integer,
  carrier varchar(50) NOT NULL,
  "trackingNumber" varchar(255) NOT NULL,
  "eventCode" varchar(50),
  "statusSummary" varchar(255),
  location varchar(255),
  "eventTimestamp" timestamp with time zone,
  "isDelivered" boolean DEFAULT false,
  "rawPayload" jsonb,
  "polledAt" timestamp with time zone DEFAULT now(),
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS logistics_costs (
  id serial PRIMARY KEY,
  "workflowId" integer NOT NULL,
  "phaseNumber" integer NOT NULL,
  "phaseName" varchar(100) NOT NULL,
  "costType" varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  "estimatedAmountUsd" numeric(10,2),
  "actualAmountUsd" numeric(10,2),
  "vendorName" varchar(255),
  "vendorId" integer,
  "isPaidByClient" boolean DEFAULT true,
  "invoiceNumber" varchar(100),
  "paidAt" timestamp with time zone,
  notes text,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE logistics_checkpoints ADD COLUMN IF NOT EXISTS "phaseNumber" integer;
ALTER TABLE logistics_checkpoints ADD COLUMN IF NOT EXISTS "customerVisibleNote" text;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "robotModel" varchar(255);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "robotSerialNumber" varchar(255);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "originCountry" varchar(100);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "robotWeightKg" numeric(8,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "robotLengthCm" numeric(8,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "robotWidthCm" numeric(8,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "robotHeightCm" numeric(8,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "declaredValueUsd" numeric(12,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "batteryType" varchar(100);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "batteryWh" numeric(8,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "hasWirelessRadio" boolean DEFAULT false;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "hasCameras" boolean DEFAULT false;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "requiresFccDocs" boolean DEFAULT false;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "requiresFdaDocs" boolean DEFAULT false;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "ataCarnetRequired" boolean DEFAULT false;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "hsTariffCode" varchar(20);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "totalEstimatedCostUsd" numeric(12,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "totalActualCostUsd" numeric(12,2);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "costEstimateAcceptedAt" timestamp with time zone;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "costEstimateAcceptedBy" varchar(255);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "trackingToken" varchar(64);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "customerEmail" varchar(320);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "customerName" varchar(255);
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "showEndDate" timestamp with time zone;
ALTER TABLE logistics_workflows ADD COLUMN IF NOT EXISTS "targetArrivalDate" timestamp with time zone;
CREATE UNIQUE INDEX IF NOT EXISTS lw_tracking_token_idx ON logistics_workflows("trackingToken");
`;

db.query(sql)
  .then(() => { console.log("Migration applied"); return db.end(); })
  .catch(e => { console.error("FAILED:", e.message); process.exit(1); });
