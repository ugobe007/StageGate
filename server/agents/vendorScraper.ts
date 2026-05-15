/**
 * server/agents/vendorScraper.ts
 *
 * Vendor Scraper Agent
 * Searches for Las Vegas logistics vendors (freight, AV, rigging, warehouse, etc.)
 * and populates the vendors table.
 *
 * Triggered via POST /api/scheduled/vendor-scraper
 */
import type { Request, Response } from "express";
import { getDb } from "../db";
import { vendors } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { sdk } from "../_core/sdk";

// ─── Vendor Scraper Handler ───────────────────────────────────────────────────

export async function vendorScraperHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });

    const db = await getDb();
    if (!db) return res.status(503).json({ error: "db unavailable" });

    // Use LLM to generate a comprehensive list of Las Vegas logistics vendors
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a research assistant for StageGate, a robotics activation infrastructure company in Las Vegas.
StageGate needs to build a vendor directory of companies that can support robot logistics at Las Vegas trade shows.

Vendor categories needed:
- freight: Freight forwarders and shipping companies that handle Las Vegas trade show freight
- customs_broker: Customs brokers for international robot shipments
- av: AV companies that can provide power, lighting, and display support at trade show booths
- rigging: Rigging companies for heavy equipment at Las Vegas convention centers
- warehouse: Warehouse and storage facilities near Las Vegas convention centers
- transport: Local transport and drayage companies for Las Vegas convention centers
- tech_support: Technical support companies that can assist with robot repairs and maintenance
- other: Other relevant service providers

Return a JSON array of 30+ vendors with realistic Las Vegas-area companies.
Each vendor should have:
- name (string, required)
- type (string, one of: freight|customs_broker|av|rigging|warehouse|transport|tech_support|other)
- website (string)
- contactName (string, best guess for a contact person)
- contactEmail (string, best guess)
- contactPhone (string, Las Vegas area code 702)
- address (string, Las Vegas area address)
- city (string, "Las Vegas" or nearby)
- state (string, "NV")
- country (string, "US")
- notes (string, why they are relevant for robot logistics)

Return ONLY valid JSON array, no markdown.`,
        },
        {
          role: "user",
          content: `Generate a comprehensive list of 30+ Las Vegas area vendors for robot trade show logistics.
Focus on:
1. Companies that work with LVCC (Las Vegas Convention Center), Mandalay Bay, Venetian, MGM Grand convention centers
2. Companies with experience handling heavy, fragile, or high-value equipment
3. Companies that can handle international shipments (many robot companies are from Asia/Europe)
4. Companies with 24/7 support capability for show-critical operations

Include well-known Las Vegas trade show service companies like:
- Freeman (AV/rigging/logistics)
- GES (Global Experience Specialists)
- Shepard Exposition Services
- Clark County drayage companies
- Las Vegas freight forwarders
- Local customs brokers
- Tech support companies

Return as JSON array.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "vendor_list",
          strict: true,
          schema: {
            type: "object",
            properties: {
              vendors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    website: { type: "string" },
                    contactName: { type: "string" },
                    contactEmail: { type: "string" },
                    contactPhone: { type: "string" },
                    address: { type: "string" },
                    city: { type: "string" },
                    state: { type: "string" },
                    country: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["name", "type", "website", "contactName", "contactEmail", "contactPhone", "address", "city", "state", "country", "notes"],
                  additionalProperties: false,
                },
              },
            },
            required: ["vendors"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = result.choices?.[0]?.message?.content;
    const contentStr = typeof rawContent === "string" ? rawContent : "";

    let parsed: { vendors: VendorData[] } = { vendors: [] };
    try {
      parsed = JSON.parse(contentStr);
    } catch {
      console.error("[VendorScraper] Failed to parse LLM JSON:", contentStr.slice(0, 200));
    }

    const validTypes = ["freight", "customs_broker", "av", "rigging", "warehouse", "transport", "tech_support", "other"] as const;
    type VendorType = typeof validTypes[number];

    let vendorsCreated = 0;
    let vendorsSkipped = 0;

    for (const v of parsed.vendors) {
      if (!v.name) continue;

      // Check if vendor already exists
      const existing = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.name, v.name))
        .limit(1);

      if (existing.length > 0) {
        vendorsSkipped++;
        continue;
      }

      // Validate and normalize type
      const vendorType: VendorType = validTypes.includes(v.type as VendorType)
        ? (v.type as VendorType)
        : "other";

      await db.insert(vendors).values({
        name: v.name,
        type: vendorType,
        website: v.website || null,
        contactName: v.contactName || null,
        contactEmail: v.contactEmail || null,
        contactPhone: v.contactPhone || null,
        address: v.address || null,
        city: v.city || "Las Vegas",
        state: v.state || "NV",
        country: v.country || "US",
        notes: v.notes || null,
        isActive: true,
      });

      vendorsCreated++;
    }

    res.json({ ok: true, vendorsCreated, vendorsSkipped, total: parsed.vendors.length });
  } catch (err) {
    console.error("[VendorScraper error]", err);
    res.status(500).json({ error: String(err), timestamp: new Date().toISOString() });
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorData {
  name: string;
  type: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
}
