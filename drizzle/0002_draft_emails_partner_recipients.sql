-- Partner/vendor outreach: draft_emails can reference vendors & logistics partners
ALTER TABLE "draft_emails" ALTER COLUMN "prospectId" DROP NOT NULL;

ALTER TABLE "draft_emails" ADD COLUMN IF NOT EXISTS "vendorId" integer;
ALTER TABLE "draft_emails" ADD COLUMN IF NOT EXISTS "logisticsPartnerId" integer;
ALTER TABLE "draft_emails" ADD COLUMN IF NOT EXISTS "recipientKey" text;
ALTER TABLE "draft_emails" ADD COLUMN IF NOT EXISTS "audience" text NOT NULL DEFAULT 'prospect';

DO $$ BEGIN
  ALTER TABLE "draft_emails" ADD CONSTRAINT "draft_emails_vendorId_vendors_id_fk"
    FOREIGN KEY ("vendorId") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "draft_emails" ADD CONSTRAINT "draft_emails_logisticsPartnerId_logistics_partners_id_fk"
    FOREIGN KEY ("logisticsPartnerId") REFERENCES "public"."logistics_partners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_draft_emails_audience_status" ON "draft_emails" ("audience", "status");
CREATE INDEX IF NOT EXISTS "idx_draft_emails_recipient_key" ON "draft_emails" ("recipientKey") WHERE "recipientKey" IS NOT NULL;
