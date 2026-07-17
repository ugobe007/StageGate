import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { emailLogoHtml } from "@shared/siteBrand";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import * as workflows from "./workflows";
import * as emailHelpers from "./email";
import { eq, desc, count, sql, inArray, and } from "drizzle-orm";
import { draftEmails, prospectResearch, prospectActivities, bookingRequests, prospects as prospectsTable, serviceOrders, emailTrackingEvents, orderItems, schedulingSlots, salesAgentConversations, salesAgentRuns, vendors, emailThreads, logisticsWorkflows, logisticsCheckpoints, logisticsCosts, carrierTrackingEvents, warehouseBays, warehouseBayEvents, tradeShows, services as servicesTable, logisticsPartners, xbotProjects, agentRuns, outreachCampaigns, serviceRequests } from "../drizzle/schema";
import crypto from "crypto";
import { getDb } from "./db";
import { researchProspect } from "./research-agent";
import { roleBasedOutreachEmails, isDeprecatedRoleInbox } from "./outreachContacts";
import {
  salesAgentManualSendCore,
  salesAgentPreviewCore,
  generateCalDraftsCore,
  refreshCalDraftsCore,
  redraftPendingCalDraftsCore,
  repairLegacyCalDraftCore,
  advanceProspectConversationAfterSend,
  getCalWorkflowSummary,
} from "./agents/salesAgent";
import { applyInboundContactUpdates } from "./inboundContactUpdates.js";
import { isLegacyFrankDraft } from "./agents/calDraftQuality";
import { recoverQuarantinedProspectContacts } from "./agents/prospectEnrichment";
import { computeBounceStats } from "./outreachGate";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Batch Verify Progress Tracking ────────────────────────────────────────
type BatchVerifyState = {
  total: number;
  current: number;
  verified: number;
  notFound: number;
  currentCompany: string;
  status: 'running' | 'complete' | 'error';
  startedAt: Date;
  errors: string[];
};
const batchVerifyProgress = new Map<string, BatchVerifyState>();

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Company Profile ───────────────────────────────────────────────────────
  company: router({
    getMyProfile: protectedProcedure.query(async ({ ctx }) => {
      return db.getCompanyProfileByUserId(ctx.user.id);
    }),

    upsertProfile: protectedProcedure
      .input(
        z.object({
          companyName: z.string().min(1),
          website: z.string().optional(),
          contactName: z.string().optional(),
          contactEmail: z.string().email().optional().or(z.literal("")),
          contactPhone: z.string().optional(),
          country: z.string().optional(),
          robotTypes: z.string().optional(),
          description: z.string().optional(),
          robots: z.string().optional(),
          showsAttending: z.string().optional(),
          servicesNeeded: z.string().optional(),
          logoUrl: z.string().optional(),
          linkedinUrl: z.string().optional(),
          onboardingComplete: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isNew = !(await db.getCompanyProfileByUserId(ctx.user.id));
        const profileData = { ...input, userId: ctx.user.id, contactEmail: input.contactEmail || undefined };
        const id = await db.upsertCompanyProfile(profileData);
        if (isNew) {
          await notifyOwner({
            title: "New Company Registered",
            content: `${input.companyName} just completed their company profile on StageGate.`,
          }).catch(() => {});
        }
        return { id };
      }),

    getAllProfiles: adminProcedure.query(async () => {
      return db.getAllCompanyProfiles();
    }),

    submitServiceRequest: protectedProcedure
      .input(
        z.object({
          requestType: z.string().min(1),
          showName: z.string().optional(),
          showDate: z.string().optional(),
          robotName: z.string().optional(),
          robotType: z.string().optional(),
          details: z.string().optional(),
          urgency: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
          attachmentUrl: z.string().optional(),
          attachmentKey: z.string().optional(),
          attachmentName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await db.getCompanyProfileByUserId(ctx.user.id);
        const id = await db.createServiceRequest({
          userId: ctx.user.id,
          companyProfileId: profile?.id ?? null,
          ...input,
        });
        await notifyOwner({
          title: `New Service Request: ${input.requestType}`,
          content: `${profile?.companyName ?? ctx.user.name ?? "A company"} submitted a ${input.requestType} request for ${input.showName ?? "an upcoming show"}.\n\nDetails: ${input.details ?? "None"}`,
        }).catch(() => {});
        return { id };
      }),

    getMyServiceRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getServiceRequestsByUserId(ctx.user.id);
    }),

    getAllServiceRequests: adminProcedure.query(async () => {
      return db.getAllServiceRequests();
    }),

    updateServiceRequestStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.string(),
          adminNotes: z.string().optional(),
          quotedPrice: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateServiceRequestStatus(input.id, input.status, input.adminNotes, input.quotedPrice);
        // Send Resend email notification when status changes to quoted or approved
        if (input.status === "quoted" || input.status === "approved") {
          try {
            const req = await db.getServiceRequestById(input.id);
            if (req) {
              const profiles = await db.getAllCompanyProfiles();
              const profile = profiles.find((p) => p.userId === req.userId);
              const toEmail = profile?.contactEmail;
              if (toEmail) {
                const statusLabel = input.status === "quoted" ? "Quoted" : "Approved";
                const priceNote = input.quotedPrice ? `\n\nQuoted price: ${input.quotedPrice}` : "";
                const notesNote = input.adminNotes ? `\n\nNotes from StageGate: ${input.adminNotes}` : "";
                const subject = input.status === "quoted"
                  ? `Your StageGate service request has been quoted — ${req.requestType}`
                  : `Your StageGate service request is approved — ${req.requestType}`;
                const textBody = `Hi ${profile?.companyName ?? "there"},\n\nYour service request for "${req.requestType}" at ${req.showName ?? "your upcoming show"} has been updated to: ${statusLabel}.${priceNote}${notesNote}\n\nLog in to your StageGate dashboard to view the full details and next steps:\nhttps://onstage.bot/dashboard\n\nThank you,\nThe StageGate Team`;
                await emailHelpers.sendEmail({
                  to: toEmail,
                  subject,
                  body: textBody,
                  htmlBody: `<p>${textBody.replace(/\n/g, "<br>")}</p>`,
                });
              }
            }
          } catch (err) {
            console.warn("[ServiceRequest] Failed to send status notification email:", err);
          }
        }
        return { success: true };
      }),
  }),

  // ─── Trade Shows ───────────────────────────────────────────────────────────
  shows: router({
    list: publicProcedure.query(async () => {
      return db.getAllTradeShows();
    }),
    lasVegas2026: publicProcedure.query(async () => {
      return db.getLasVegasShows2026();
    }),

    otherShows: publicProcedure.query(async () => {
      return db.getOtherShows();
    }),

    search: publicProcedure
      .input(
        z.object({
          query: z.string().default(""),
          city: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return db.searchTradeShows(input.query, input.city);
      }),

    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getTradeShowById(input.id);
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          location: z.string().optional(),
          venue: z.string().optional(),
          city: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          website: z.string().optional(),
          exhibitorListUrl: z.string().optional(),
          status: z.enum(["upcoming", "active", "completed"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createTradeShow({
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });
        return { id };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          location: z.string().optional(),
          venue: z.string().optional(),
          city: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          website: z.string().optional(),
          exhibitorListUrl: z.string().optional(),
          status: z.enum(["upcoming", "active", "completed"]).optional(),
          description: z.string().optional(),
          roboticsRelevance: z.number().int().min(1).max(5).optional(),
          estimatedExhibitors: z.number().int().optional(),
          roboticsExhibitors: z.number().int().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateTradeShow(id, {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTradeShow(input.id);
        return { success: true };
      }),

    // Public: register email for booking-open notification
    notifyMe: publicProcedure
      .input(
        z.object({
          showId: z.number(),
          email: z.string().email({ message: "Please enter a valid email address" }),
        })
      )
      .mutation(async ({ input }) => {
        const show = await db.getTradeShowById(input.showId);
        if (!show) throw new TRPCError({ code: "NOT_FOUND", message: "Show not found" });
        const { alreadyExists } = await db.createShowNotification(input.showId, input.email);
        if (!alreadyExists) {
          await notifyOwner({
            title: "New Booking Notification Request",
            content: `${input.email} wants to be notified when bookings open for "${show.name}".`,
          }).catch(() => {});
        }
        return { success: true, alreadyExists };
      }),

    // Admin: list all notification requests for a show
    getNotifications: adminProcedure
      .input(z.object({ showId: z.number().optional() }))
      .query(async ({ input }) => {
        if (input.showId) {
          return db.getShowNotificationsByShowId(input.showId);
        }
        return db.getAllShowNotifications();
      }),
  }),

  // ─── Newsletter ────────────────────────────────────────────────────────────
  newsletter: router({
    subscribe: publicProcedure
      .input(z.object({
        email: z.string().email({ message: "Please enter a valid email address" }),
        firstName: z.string().optional(),
        interests: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await db.subscribeNewsletter(input.email, input.firstName, input.interests);
        if (!result.alreadySubscribed) {
          await notifyOwner({
            title: "New Newsletter Subscriber",
            content: `${input.email} subscribed to the StageGate newsletter.${input.firstName ? ` Name: ${input.firstName}.` : ""}${input.interests ? ` Interests: ${input.interests}.` : ""}`,
          }).catch(() => {});
        }
        return { success: true, alreadySubscribed: result.alreadySubscribed };
      }),
  }),

  // ─── News Ticker ───────────────────────────────────────────────────────────
  news: router({
    ticker: publicProcedure.query(async () => {
      // Pull next 6 upcoming LV shows from DB
      const upcomingShows = await db.getUpcomingLasVegasShows(6);
      const showItems = upcomingShows.map((s) => ({
        type: "show" as const,
        text: `${s.name}${s.startDate ? " — " + new Date(s.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}`,
        city: s.city ?? "Las Vegas",
      }));

      // Curated robot/conference headlines (updated periodically)
      const headlines = [
        { type: "news" as const, text: "Unitree G1 cleared US customs — new operators in Las Vegas market" },
        { type: "news" as const, text: "Figure AI raises Series B — deploying humanoids at BMW and US facilities" },
        { type: "news" as const, text: "CES 2027 Eureka Park: record humanoid robot applications expected" },
        { type: "news" as const, text: "UBTECH Walker S confirmed for MODEX 2026 demo floor" },
        { type: "news" as const, text: "Agility Robotics Digit now shipping to 3PL partners across North America" },
        { type: "news" as const, text: "Richtech Robotics ADAM bartender robot expanding to Las Vegas casinos" },
        { type: "news" as const, text: "Ghost Robotics Vision 60 demoed at AUSA 2026 — new defense contracts" },
        { type: "news" as const, text: "NAB Show 2026: AI-powered broadcast robots draw record exhibitor count" },
        { type: "news" as const, text: "MINExpo 2026: autonomous mining robots — 40+ OEMs confirmed" },
        { type: "news" as const, text: "StageGate now supports bonded warehouse receiving for international robot shipments" },
      ];

      return { shows: showItems, headlines };
    }),
  }),

  // ─── Services ──────────────────────────────────────────────────────────────
  services: router({
    list: publicProcedure.query(async () => {
      return db.getAllServices();
    }),

    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return db.getServiceBySlug(input.slug);
      }),
  }),

  // ─── Orders ────────────────────────────────────────────────────────────────
  orders: router({
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByUserId(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const items = await db.getOrderItems(input.id);
        return { order, items };
      }),

    create: protectedProcedure
      .input(
        z.object({
          showId: z.number(),
          serviceIds: z.array(z.number()).min(1),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get service details to calculate total
        const allServices = await db.getAllServices();
        const selectedServices = allServices.filter((s) => input.serviceIds.includes(s.id));
        const total = selectedServices.reduce((sum, s) => sum + parseFloat(s.basePrice || "0"), 0);

        const orderId = await db.createOrder({
          userId: ctx.user.id,
          showId: input.showId,
          totalAmount: total.toFixed(2),
          notes: input.notes,
          status: "pending",
        });

        for (const svc of selectedServices) {
          await db.createOrderItem({
            orderId,
            serviceId: svc.id,
            quantity: 1,
            unitPrice: svc.basePrice,
          });
        }

        const show = await db.getTradeShowById(input.showId);
        const profile = await db.getCompanyProfileByUserId(ctx.user.id);
        await notifyOwner({
          title: "New Service Order",
          content: `${profile?.companyName || ctx.user.name || "A client"} placed a new order for ${show?.name || "a trade show"} — ${selectedServices.map((s) => s.name).join(", ")}.`,
        }).catch(() => {});

        return { orderId };
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
        return { success: true };
      }),

    allOrders: adminProcedure.query(async () => {
      return db.getAllOrders();
    }),

    // Get all services (for line-item editor dropdown)
    getAllServices: adminProcedure.query(async () => {
      return db.getAllServices();
    }),

    // Add a line item to an order
    addLineItem: adminProcedure
      .input(z.object({
        orderId: z.number(),
        serviceId: z.number(),
        quantity: z.number().int().min(1).default(1),
        unitPrice: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createOrderItem({
          orderId: input.orderId,
          serviceId: input.serviceId,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
        });
        return { id };
      }),

    // Remove a line item from an order
    removeLineItem: adminProcedure
      .input(z.object({ itemId: z.number(), orderId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await dbConn.delete(orderItems).where(eq(orderItems.id, input.itemId));
        return { success: true };
      }),

    // Update a line item's quantity or unit price
    updateLineItem: adminProcedure
      .input(z.object({
        itemId: z.number(),
        quantity: z.number().int().min(1).optional(),
        unitPrice: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const updates: Record<string, unknown> = {};
        if (input.quantity !== undefined) updates.quantity = input.quantity;
        if (input.unitPrice !== undefined) updates.unitPrice = input.unitPrice;
        if (Object.keys(updates).length > 0) {
          await dbConn.update(orderItems).set(updates).where(eq(orderItems.id, input.itemId));
        }
        return { success: true };
      }),

    // Get a single order with booking reference for the detail page
    getDetail: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const orderRows = await dbConn.select().from(serviceOrders).where(eq(serviceOrders.id, input.id));
        const order = orderRows[0];
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        // Fetch originating booking if present
        let booking = null;
        if (order.bookingId) {
          const bookingRows = await dbConn.select().from(bookingRequests).where(eq(bookingRequests.id, order.bookingId));
          booking = bookingRows[0] ?? null;
        }
        const items = await db.getOrderItems(input.id);
        return { order, booking, items };
      }),
  }),

  // ─── Leads (AI Discovery + Outreach) ──────────────────────────────────────
  leads: router({
    byShow: adminProcedure
      .input(z.object({ showId: z.number() }))
      .query(async ({ input }) => {
        return db.getLeadsByShowId(input.showId);
      }),

    all: adminProcedure.query(async () => {
      return db.getAllLeads();
    }),

    create: adminProcedure
      .input(
        z.object({
          showId: z.number(),
          companyName: z.string().min(1),
          website: z.string().optional(),
          contactEmail: z.string().optional(),
          contactName: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createLead({ ...input, outreachStatus: "new" });
        return { id };
      }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          outreachStatus: z.enum(["new", "emailed", "responded", "registered"]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateLead(input.id, {
          outreachStatus: input.outreachStatus,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLead(input.id);
        return { success: true };
      }),

    // AI: Discover leads from a trade show exhibitor list URL
    discover: adminProcedure
      .input(
        z.object({
          showId: z.number(),
          exhibitorListText: z.string().min(10),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { result } = await workflows.withAgentRun(
          { agentName: "Lead Discovery", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `Show ID: ${input.showId}, ${input.exhibitorListText.slice(0, 80)}...` },
          async () => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert robotics industry analyst. Given a list of trade show exhibitors, identify companies that manufacture, sell, or demonstrate robots (humanoid robots, industrial robots, delivery robots, service robots, collaborative robots, drones, or any autonomous hardware). For each robotics company found, extract their name, website if visible, and write a 1-2 sentence summary of what they do. Return a JSON array.`,
            },
            {
              role: "user",
              content: `Here is the exhibitor list text from a trade show. Please identify all robotics companies:\n\n${input.exhibitorListText}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "robotics_leads",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  leads: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        companyName: { type: "string" },
                        website: { type: "string" },
                        aiSummary: { type: "string" },
                      },
                      required: ["companyName", "website", "aiSummary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["leads"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices[0]?.message?.content as string | undefined;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned no content" });

        const parsed = JSON.parse(content) as { leads: Array<{ companyName: string; website: string; aiSummary: string }> };
        const created: number[] = [];
        for (const lead of parsed.leads) {
          const id = await db.createLead({
            showId: input.showId,
            companyName: lead.companyName,
            website: lead.website || undefined,
            aiSummary: lead.aiSummary,
            outreachStatus: "new",
          });
          created.push(id);
        }
          return { count: created.length, leadIds: created };
          }
        );
        return result;
      }),

    // AI: Generate personalized outreach email for a lead
    generateEmail: adminProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        const { result: emailResult } = await workflows.withAgentRun(
          { agentName: "Lead Email Generator", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `Lead: ${lead.companyName}` },
          async () => {
        const show = await db.getTradeShowById(lead.showId);
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a business development representative for StageGate, a robotics activation infrastructure company based in Las Vegas. StageGate offers end-to-end logistics, warehousing, staging, activation, and technical support for robots at trade shows. The tagline is "We turn shipped robots into live experiences." Write professional, concise B2B outreach emails.`,
            },
            {
              role: "user",
              content: `Write a personalized outreach email to ${lead.companyName} who will be exhibiting at ${show?.name || "an upcoming trade show"} in ${show?.city || "Las Vegas"}. 
              
Company summary: ${lead.aiSummary || "A robotics company"}

The email should:
1. Acknowledge their upcoming show appearance
2. Highlight the problem of unsupported robot logistics (costs $25k-$80k per show, engineers must fly in)
3. Introduce StageGate's services: inbound logistics, warehousing, staging & activation, live technical support
4. Mention free company registration
5. Include a clear call-to-action to visit stagegate.com or reply to learn more
6. Be 150-200 words, professional but warm

Subject line and body only.`,
            },
          ],
        });

        const emailDraft = (response.choices[0]?.message?.content as string) || "";
        await db.updateLead(input.leadId, { emailDraft });
        return { emailDraft };
          }
        );
        return emailResult;
      }),

    markEmailed: adminProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await db.getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        await db.updateLead(input.leadId, { outreachStatus: "emailed" });

        await notifyOwner({
          title: "Lead Marked as Emailed",
          content: `Outreach email sent to ${lead.companyName}.`,
        }).catch(() => {});

        return { success: true };
      }),

    markResponded: adminProcedure
      .input(z.object({ leadId: z.number(), notes: z.string().optional() }))
      .mutation(async ({ input }) => {
        const lead = await db.getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        await db.updateLead(input.leadId, {
          outreachStatus: "responded",
          ...(input.notes ? { notes: input.notes } : {}),
        });

        await notifyOwner({
          title: "Lead Responded to Outreach",
          content: `${lead.companyName} responded to StageGate outreach. Notes: ${input.notes || "none"}`,
        }).catch(() => {});

        return { success: true };
      }),
  }),

  // ─── Logistics Partners ────────────────────────────────────────────────────
  partners: router({
    list: protectedProcedure.query(async () => {
      return db.getAllLogisticsPartners();
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          serviceType: z.enum(["customs", "transporter", "insurance", "parts", "general"]),
          contactName: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          website: z.string().optional(),
          city: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createLogisticsPartner({ ...input, isActive: true });
        return { id };
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          serviceType: z.enum(["customs", "transporter", "insurance", "parts", "general"]).optional(),
          contactName: z.string().optional(),
          contactEmail: z.string().optional(),
          contactPhone: z.string().optional(),
          website: z.string().optional(),
          city: z.string().optional(),
          notes: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateLogisticsPartner(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteLogisticsPartner(input.id);
        return { success: true };
      }),
  }),

  // ─── Partner & Vendor Outreach Email ─────────────────────────────────────────
  partnerOutreach: router({
    listRecipients: adminProcedure
      .input(
        z.object({
          source: z.enum(["all", "prospect", "vendor", "logistics_partner"]).optional(),
          hasEmail: z.boolean().optional(),
          partnerType: z.string().optional(),
        }).optional(),
      )
      .query(async ({ input }) => {
        const { listPartnerRecipients } = await import("./services/partnerEmail");
        return listPartnerRecipients({
          source: input?.source ?? "all",
          hasEmail: input?.hasEmail,
          partnerType: input?.partnerType,
        });
      }),

    previewCalEmail: adminProcedure
      .input(z.object({
        recipientKey: z.string(),
        contactName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { getPartnerRecipient, buildCalPartnerEmail } = await import("./services/partnerEmail");
        const recipient = await getPartnerRecipient(input.recipientKey);
        if (!recipient) throw new TRPCError({ code: "NOT_FOUND", message: "Recipient not found" });
        return buildCalPartnerEmail({
          company: recipient.company,
          contactName: input.contactName ?? recipient.contactName ?? recipient.researchContactName,
          vendorType: recipient.partnerType,
        });
      }),

    updateContact: adminProcedure
      .input(z.object({ recipientKey: z.string(), contactName: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { updatePartnerContactName } = await import("./services/partnerEmail");
        await updatePartnerContactName(input.recipientKey, input.contactName.trim());
        return { ok: true };
      }),

    sendEmail: adminProcedure
      .input(
        z.object({
          recipientKey: z.string(),
          subject: z.string().min(1),
          body: z.string().min(1),
          toEmail: z.string().email().optional(),
          contactName: z.string().optional(),
          allowTeamGreeting: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { sendPartnerOutreachEmail } = await import("./services/partnerEmail");
        try {
          return await sendPartnerOutreachEmail(input);
        } catch (err) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }),

    bulkSend: adminProcedure
      .input(
        z.object({
          sends: z.array(
            z.object({
              recipientKey: z.string(),
              subject: z.string().min(1),
              body: z.string().min(1),
              toEmail: z.string().email().optional(),
              contactName: z.string().optional(),
              allowTeamGreeting: z.boolean().optional(),
            }),
          ).min(1).max(50),
        }),
      )
      .mutation(async ({ input }) => {
        const { sendPartnerOutreachEmail } = await import("./services/partnerEmail");
        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const item of input.sends) {
          try {
            await sendPartnerOutreachEmail(item);
            sent++;
          } catch (err) {
            failed++;
            errors.push(`${item.recipientKey}: ${err instanceof Error ? err.message : String(err)}`);
          }
          await new Promise((r) => setTimeout(r, 400));
        }

        return { sent, failed, errors: errors.slice(0, 10) };
      }),

    bulkDraftCal: adminProcedure
      .input(z.object({ recipientKeys: z.array(z.string()).min(1).max(50) }))
      .mutation(async ({ input }) => {
        const { bulkSaveCalPartnerDrafts } = await import("./services/partnerEmail");
        return bulkSaveCalPartnerDrafts(input.recipientKeys);
      }),

    saveDraft: adminProcedure
      .input(
        z.object({
          recipientKey: z.string(),
          subject: z.string().min(1),
          body: z.string().min(1),
          contactName: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { getPartnerRecipient, updatePartnerContactName } = await import("./services/partnerEmail");
        const recipient = await getPartnerRecipient(input.recipientKey);
        if (!recipient) throw new TRPCError({ code: "NOT_FOUND", message: "Recipient not found" });
        if (input.contactName?.trim() && input.contactName !== recipient.contactName) {
          await updatePartnerContactName(input.recipientKey, input.contactName.trim());
        }
        const row = await emailHelpers.createPartnerDraft({
          recipientKey: input.recipientKey,
          subject: input.subject,
          body: input.body,
          agentReasoning: "Manual partner outreach draft",
        });
        return { draftId: row.id };
      }),
  }),

  // ── Demo Requests ──────────────────────────────────────────────────────
  demos: router({
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Valid email required"),
          company: z.string().min(1, "Company is required"),
          robotType: z.string().min(1, "Robot type is required"),
          preferredShowId: z.number().optional(),
          preferredShowName: z.string().optional(),
          message: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.createDemoRequest(input);
        const showLabel = input.preferredShowName || (input.preferredShowId ? `Show #${input.preferredShowId}` : "Not specified");
        await notifyOwner({
          title: `New Demo Request — ${input.company}`,
          content: `${input.name} (${input.email}) from ${input.company} has requested a demo.\nRobot: ${input.robotType}\nPreferred show: ${showLabel}\n${input.message ? `Message: ${input.message}` : ""}`,
        }).catch(() => {});
        return { success: true };
      }),

    list: adminProcedure.query(async () => {
      return db.getAllDemoRequests();
    }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "contacted", "scheduled", "completed", "closed"]),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateDemoRequestStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // ── Quote Requests ──────────────────────────────────────────────────────
  quotes: router({
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          company: z.string().min(1),
          phone: z.string().optional(),
          robotType: z.string().min(1),
          robotCount: z.number().int().min(1).max(50).default(1),
          robotDimensions: z.string().optional(),
          robotWeight: z.string().optional(),
          showId: z.number().optional(),
          showName: z.string().optional(),
          serviceIds: z.array(z.number()).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { serviceIds, ...rest } = input;
        await db.createQuoteRequest({
          ...rest,
          serviceIds: serviceIds ? JSON.stringify(serviceIds) : null,
        });
        await notifyOwner({
          title: "New Quote Request — " + input.company,
          content: `${input.name} (${input.email}) from ${input.company} has requested a quote.\nRobot: ${input.robotType} × ${input.robotCount}\nShow: ${input.showName || "Not specified"}\nServices: ${serviceIds?.length || 0} selected`,
        });
        return { success: true };
      }),

    list: adminProcedure.query(async () => {
      return db.getAllQuoteRequests();
    }),

    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "reviewing", "quoted", "converted", "closed"]),
          adminNotes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateQuoteRequestStatus(input.id, input.status, input.adminNotes);
        return { success: true };
      }),
  }),

  // ─── XBOT AI Logistics Agent ───────────────────────────────────────────────
  xbot: router({
    // Create a new logistics project (anonymous or authenticated)
    createProject: publicProcedure
      .input(z.object({
        robotMake: z.string().optional(),
        robotModel: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const crypto = await import("crypto");
        const sessionToken = crypto.randomBytes(48).toString("hex");
        const userId = ctx.user?.id ?? null;
        const project = await db.createXbotProject({ sessionToken, userId, ...input });
        return { projectId: project.id, sessionToken };
      }),

    // Get a project by id + sessionToken (anonymous) or userId (authenticated)
    getProject: publicProcedure
      .input(z.object({
        projectId: z.number(),
        sessionToken: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const project = await db.getXbotProject(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const isOwner = (ctx.user && project.userId === ctx.user.id) ||
          (input.sessionToken && project.sessionToken === input.sessionToken);
        if (!isOwner) throw new TRPCError({ code: "FORBIDDEN" });
        const brief = await db.getXbotBrief(input.projectId);
        return { project, brief };
      }),

    // Update project step data
    updateProject: publicProcedure
      .input(z.object({
        projectId: z.number(),
        sessionToken: z.string().optional(),
        data: z.object({
          robotMake: z.string().optional(),
          robotModel: z.string().optional(),
          robotDimensions: z.string().optional(),
          robotWeight: z.string().optional(),
          powerRequirements: z.string().optional(),
          specialHandling: z.string().optional(),
          originCountry: z.string().optional(),
          originCity: z.string().optional(),
          shippingMethod: z.enum(["air", "sea", "ground"]).optional(),
          flightVesselNumber: z.string().optional(),
          eta: z.string().optional(), // ISO date string
          portOfEntry: z.string().optional(),
          hsCode: z.string().optional(),
          ataCarnet: z.boolean().optional(),
          customsBroker: z.enum(["stagegate", "own", "tbd"]).optional(),
          customsBrokerName: z.string().optional(),
          showId: z.number().optional(),
          boothNumber: z.string().optional(),
          setupDate: z.string().optional(),
          teardownDate: z.string().optional(),
          selectedServices: z.array(z.string()).optional(),
          groundTransportProvider: z.enum(["stagegate", "own", "directory"]).optional(),
          contacts: z.object({
            primary: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
            onsite: z.object({ name: z.string(), email: z.string(), phone: z.string() }).optional(),
            emergency: z.object({ name: z.string(), phone: z.string() }).optional(),
          }).optional(),
          currentStep: z.number().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getXbotProject(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const isOwner = (ctx.user && project.userId === ctx.user.id) ||
          (input.sessionToken && project.sessionToken === input.sessionToken);
        if (!isOwner) throw new TRPCError({ code: "FORBIDDEN" });
        // Convert date strings to Date objects
        const updateData: Record<string, unknown> = { ...input.data };
        if (input.data.eta) updateData.eta = new Date(input.data.eta);
        if (input.data.setupDate) updateData.setupDate = new Date(input.data.setupDate);
        if (input.data.teardownDate) updateData.teardownDate = new Date(input.data.teardownDate);
        await db.updateXbotProject(input.projectId, updateData);
        return { success: true };
      }),

    // Generate logistics brief via LLM
    generateBrief: publicProcedure
      .input(z.object({
        projectId: z.number(),
        sessionToken: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getXbotProject(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const isOwner = (ctx.user && project.userId === ctx.user.id) ||
          (input.sessionToken && project.sessionToken === input.sessionToken);
        if (!isOwner) throw new TRPCError({ code: "FORBIDDEN" });

        // Get show details if showId provided
        let showInfo = "";
        if (project.showId) {
          const show = await db.getTradeShowById(project.showId);
          if (show) showInfo = `Target show: ${show.name} at ${show.venue}, Las Vegas. Setup: ${show.startDate?.toISOString().split("T")[0]}. Teardown: ${show.endDate?.toISOString().split("T")[0]}.`;
        }

        const prompt = `You are a logistics expert specializing in international trade show freight for robotics companies. Generate a comprehensive logistics brief for the following robot shipment to Las Vegas.

Robot: ${project.robotMake || "Unknown"} ${project.robotModel || ""}
Dimensions: ${project.robotDimensions || "Not specified"}
Weight: ${project.robotWeight || "Not specified"} kg
Power: ${project.powerRequirements || "Not specified"}
Special handling: ${project.specialHandling || "None"}

Origin: ${project.originCity || "Unknown"}, ${project.originCountry || "Unknown"}
Shipping method: ${project.shippingMethod || "Not specified"}
Flight/Vessel: ${project.flightVesselNumber || "Not specified"}
ETA: ${project.eta ? new Date(project.eta).toISOString().split("T")[0] : "Not specified"}
Port of entry: ${project.portOfEntry || "Not specified"}

Customs:
- HS Code provided: ${project.hsCode || "None — suggest one"}
- ATA Carnet requested: ${project.ataCarnet ? "Yes" : "No"}
- Customs broker: ${project.customsBroker}

${showInfo}

Selected services: ${(project.selectedServices as string[] | null)?.join(", ") || "Not specified"}
Ground transport: ${project.groundTransportProvider || "Not specified"}

Generate a JSON response with these exact fields:
{
  "timeline": [{"date": "YYYY-MM-DD", "label": "string", "description": "string", "critical": boolean}],
  "customsChecklist": [{"item": "string", "required": boolean, "notes": "string"}],
  "groundTransportOptions": [{"name": "string", "type": "string", "contact": "string", "website": "string", "notes": "string"}],
  "servicePackage": [{"service": "string", "description": "string", "included": boolean}],
  "hsCodeSuggestion": "string",
  "ataCarnetEligible": boolean,
  "shipByDeadline": "YYYY-MM-DD",
  "summaryNotes": "string"
}

For timeline: include ship-by deadline, customs clearance window, dockside pickup, warehouse arrival, setup day, show days, teardown.
For groundTransportOptions: include 3 real Las Vegas freight/drayage companies if provider is "directory".
For hsCodeSuggestion: suggest the most appropriate HS code for this robot type.
For ataCarnetEligible: determine if this shipment qualifies for an ATA Carnet based on origin country and robot type.`;

        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are a logistics expert. Always respond with valid JSON only, no markdown." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });

        let briefData: Record<string, unknown>;
        try {
          const content = llmResponse.choices[0].message.content as string;
          briefData = JSON.parse(content);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse logistics brief" });
        }

        // Convert shipByDeadline string to Date
        const shipByDeadline = briefData.shipByDeadline ? new Date(briefData.shipByDeadline as string) : null;

        const brief = await db.upsertXbotBrief({
          projectId: input.projectId,
          timeline: briefData.timeline as never,
          customsChecklist: briefData.customsChecklist as never,
          groundTransportOptions: briefData.groundTransportOptions as never,
          servicePackage: briefData.servicePackage as never,
          hsCodeSuggestion: briefData.hsCodeSuggestion as string,
          ataCarnetEligible: briefData.ataCarnetEligible as boolean,
          shipByDeadline,
          summaryNotes: briefData.summaryNotes as string,
        });

        // Update project status
        await db.updateXbotProject(input.projectId, { status: "brief_generated" });

        return { brief };
      }),

    // Submit service request (requires authentication)
    submitServiceRequest: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getXbotProject(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        if (project.userId !== ctx.user.id && project.userId !== null) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        // Claim anonymous project for this user
        if (project.userId === null) {
          await db.updateXbotProject(input.projectId, { userId: ctx.user.id });
        }
        await db.updateXbotProject(input.projectId, { status: "submitted" });
        // Notify owner
        const contacts = project.contacts as { primary?: { name?: string; email?: string } } | null;
        await notifyOwner({
          title: `New XBOT Service Request — ${project.robotMake || "Robot"} ${project.robotModel || ""}`,
          content: `Company contact: ${contacts?.primary?.name || "Unknown"} (${contacts?.primary?.email || "no email"})\nRobot: ${project.robotMake} ${project.robotModel}\nOrigin: ${project.originCity}, ${project.originCountry}\nShipping: ${project.shippingMethod}\nServices: ${(project.selectedServices as string[] | null)?.join(", ") || "None selected"}`,
        });
        return { success: true };
      }),

    // List user's projects (authenticated)
    listProjects: protectedProcedure
      .query(async ({ ctx }) => {
        const projects = await db.listXbotProjectsByUser(ctx.user.id);
        return { projects };
      }),

    // Admin: list all projects
    adminList: adminProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        const projects = await db.listAllXbotProjects(input.status);
        return { projects };
      }),
  }),

  // ─── Prospects & Outreach ───────────────────────────────────────────────────
  prospects: router({
    // List all prospects (admin only)
    list: adminProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        const items = await db.listProspects(input.status);
        // Cross-reference company_profiles to flag which prospects have signed up as clients
        const profiles = await db.getAllCompanyProfiles();
        const clientEmails = new Set(profiles.map(p => (p.contactEmail ?? "").toLowerCase()).filter(Boolean));
        const clientCompanies = new Set(profiles.map(p => (p.companyName ?? "").toLowerCase()).filter(Boolean));
        const prospectsWithClientFlag = items.map(p => ({
          ...p,
          hasClientProfile: (
            (p.contactEmail ? clientEmails.has(p.contactEmail.toLowerCase()) : false) ||
            (p.company ? clientCompanies.has(p.company.toLowerCase()) : false)
          ),
        }));
        return { prospects: prospectsWithClientFlag };
      }),

    // List prospects with computed engagement score (opens×1 + clicks×2)
    listWithEngagement: adminProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return { prospects: [] };
        // Subquery: count opens and clicks per prospect from email_tracking_events
        const items = await db.listProspects(input.status);
        if (items.length === 0) return { prospects: [] };
        // Fetch engagement and outbound send signals for all prospects in one query each.
        const [engagementRows, sentDraftRows, campaignRows, outboundThreadRows] = await Promise.all([
          dbConn
          .select({
            prospectId: emailTrackingEvents.prospectId,
            opens: sql<number>`SUM(CASE WHEN ${emailTrackingEvents.eventType} = 'email.opened' THEN 1 ELSE 0 END)`.as('opens'),
            clicks: sql<number>`SUM(CASE WHEN ${emailTrackingEvents.eventType} = 'email.clicked' THEN 1 ELSE 0 END)`.as('clicks'),
          })
          .from(emailTrackingEvents)
            .groupBy(emailTrackingEvents.prospectId),
          dbConn.select({ prospectId: draftEmails.prospectId }).from(draftEmails).where(eq(draftEmails.status, "sent")),
          dbConn.select({ prospectId: outreachCampaigns.prospectId }).from(outreachCampaigns).where(eq(outreachCampaigns.emailStatus, "sent")),
          dbConn.select({ prospectId: emailThreads.prospectId }).from(emailThreads).where(eq(emailThreads.direction, "outbound")),
        ]);
        // Build a lookup map
        const engMap = new Map<number, { opens: number; clicks: number }>();
        for (const row of engagementRows) {
          if (row.prospectId !== null) {
            engMap.set(row.prospectId, { opens: Number(row.opens), clicks: Number(row.clicks) });
          }
        }
        const contactedIds = new Set<number>();
        for (const row of sentDraftRows) {
          if (row.prospectId !== null) contactedIds.add(row.prospectId);
        }
        for (const row of campaignRows) contactedIds.add(row.prospectId);
        for (const row of outboundThreadRows) {
          if (row.prospectId !== null) contactedIds.add(row.prospectId);
        }

        // Merge engagement score into each prospect, and keep the pipeline honest
        // when older send paths recorded email history but missed the status update.
        const withScore = items.map(p => {
          const eng = engMap.get(p.id) ?? { opens: 0, clicks: 0 };
          const status = p.status === "new" && contactedIds.has(p.id) ? "contacted" : p.status;
          return { ...p, status, engagementScore: eng.opens * 1 + eng.clicks * 2, opens: eng.opens, clicks: eng.clicks };
        });
        return { prospects: withScore };
      }),

    // Get single prospect
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prospect = await db.getProspectById(input.id);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });
        return { prospect };
      }),

    // AI-generated CRM intelligence brief (summary, show intel, why StageGate — NO email draft)
    // Email drafts are exclusively generated by Cal via salesAgentPreviewCore.
    getBrief: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prospect = await db.getProspectById(input.id);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

        const shows = (prospect.shows as string[] | null) ?? [];
        const showList = shows.length ? shows.join(", ") : "upcoming trade shows";
        const robot = [prospect.robotName, prospect.robotType].filter(Boolean).join(" — ") || "robot";
        const contact = prospect.contactName ? `Contact: ${prospect.contactName}${prospect.contactTitle ? `, ${prospect.contactTitle}` : ""}. ` : "";
        const country = prospect.hqCountry ? `HQ: ${prospect.hqCountry}. ` : "";

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a sharp B2B sales intelligence assistant for StageGate — a robotics activation company that handles robot receiving, unpacking, testing, staging, and delivery at trade shows. You write concise, factual, and actionable CRM briefs. Be specific. No fluff. Output valid JSON only.`,
            },
            {
              role: "user",
              content: `Write a CRM brief for this robotics company:\n\nCompany: ${prospect.company}\nRobot: ${robot}\n${country}${contact}Shows: ${showList}\n\nReturn JSON with exactly these fields:\n- summary: 2 sentences max. What the company does and what robot they're bringing.\n- showIntel: 1 sentence per show. What they likely need at each event.\n- whyStageGate: 1 sentence. Why StageGate is the right fit.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "prospect_brief",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  showIntel: { type: "string" },
                  whyStageGate: { type: "string" },
                },
                required: ["summary", "showIntel", "whyStageGate"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = result.choices?.[0]?.message?.content ?? "{}";
        const brief = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as {
          summary: string;
          showIntel: string;
          whyStageGate: string;
        };

        return { brief, prospect };
      }),

    // Generate a fresh Cal draft — routes through Cal's actual pipeline (buildDiscoveryEmail template
    // for discovery stage, Cal's LLM persona for follow-ups). Never uses a generic LLM prompt.
    regenerateDraft: adminProcedure
      .input(z.object({
        id: z.number(),
        tone: z.enum(["professional", "friendly", "concise", "bold"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const prospect = await db.getProspectById(input.id);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

        // Always use Cal's pipeline — generates from frankPlaybook template (discovery)
        // or Cal's LLM persona (follow-up stages). tone param kept for API compat but
        // Cal's voice is already defined in frankPlaybook; we pass it as a hint only.
        const preview = await salesAgentPreviewCore(input.id, "discovery");
        return { draft: preview.body, subject: preview.subject };
      }),

    // Create a prospect
    create: adminProcedure
      .input(z.object({
        company: z.string().min(1),
        robotName: z.string().optional(),
        robotType: z.string().optional(),
        hqCountry: z.string().optional(),
        attendsLasVegas: z.enum(["yes", "no", "unknown"]).optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactTitle: z.string().optional(),
        contactDept: z.string().optional(),
        website: z.string().optional(),
        shows: z.array(z.string()).optional(),
        notes: z.string().optional(),
        status: z.enum(["new", "contacted", "responded", "scheduled", "converted", "not_interested"]).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createProspect(input as Parameters<typeof db.createProspect>[0]);
        return { success: true };
      }),

    // Update a prospect
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "responded", "scheduled", "converted", "not_interested"]).optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactTitle: z.string().optional(),
        contactLinkedIn: z.string().optional(),
        emailConfidence: z.enum(["verified", "high", "medium", "low"]).optional(),
        notes: z.string().optional(),
        videoMessageUrl: z.string().optional(),
        followUpDate: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, followUpDate, ...rest } = input;
        const data: Parameters<typeof db.updateProspect>[1] = { ...rest };
        if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null;
        await db.updateProspect(id, data);
        return { success: true };
      }),

    // Quick status update: mark a prospect as replied/responded
    // Optional: scheduleMeeting=true auto-creates a calendar event and sends emails to Tommy + owner
    markReplied: adminProcedure
      .input(z.object({
        id: z.number(),
        scheduleMeeting: z.boolean().optional(),
        proposedTime: z.string().optional(), // ISO datetime for meeting start
        meetingDurationMinutes: z.number().int().positive().optional().default(30),
        meetingNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const prospect = await db.getProspectById(input.id);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

        // Update prospect status to responded
        await db.updateProspect(input.id, { status: "responded", repliedAt: new Date() });

        let calendarEvent = null;
        if (input.scheduleMeeting && input.proposedTime) {
          // Auto-create calendar event
          const startAt = new Date(input.proposedTime);
          const endAt = new Date(startAt.getTime() + (input.meetingDurationMinutes ?? 30) * 60 * 1000);
          const crypto = await import("crypto");
          const shareToken = crypto.randomBytes(24).toString("hex");

          calendarEvent = await db.createCalendarEvent({
            title: `Intro Call — ${prospect.company}`,
            description: `Prospect responded to outreach. Scheduled intro call with ${prospect.contactName ?? prospect.company}.`,
            startAt,
            endAt,
            type: "call",
            status: "scheduled",
            prospectId: input.id,
            prospectEmail: prospect.contactEmail ?? null,
            prospectName: prospect.contactName ?? null,
            companyName: prospect.company,
            notes: input.meetingNotes ?? null,
            shareToken,
            createdBy: ctx.user.id,
          });

          // Update prospect status to scheduled
          await db.updateProspect(input.id, { status: "scheduled" });

          // Format times for email
          const startDisplay = startAt.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "full", timeStyle: "short" });
          const shareUrl = `https://onstage.bot/calendar/${shareToken}`;

          const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#00E87A;">New Meeting Scheduled — ${prospect.company}</h2>
  <p><strong>Prospect:</strong> ${prospect.contactName ?? "Unknown"} (${prospect.contactEmail ?? "no email"})</p>
  <p><strong>Company:</strong> ${prospect.company}</p>
  <p><strong>Time:</strong> ${startDisplay} (PT)</p>
  <p><strong>Duration:</strong> ${input.meetingDurationMinutes ?? 30} minutes</p>
  ${input.meetingNotes ? `<p><strong>Notes:</strong> ${input.meetingNotes}</p>` : ""}
  <p><a href="${shareUrl}" style="color:#00E87A;">View Event Details →</a></p>
  <hr style="border-color:#333;">
  <p style="color:#888;font-size:12px;">StageGate • onstage.bot</p>
</div>`;

          // Send to Tommy
          try {
            await emailHelpers.sendEmail({
              to: "tom@starsupportinc.com",
              subject: `[StageGate] Meeting Scheduled: ${prospect.company} — ${startDisplay}`,
              body: `New meeting scheduled with ${prospect.company} (${prospect.contactEmail ?? ""}) for ${startDisplay} PT.\n\nView: ${shareUrl}`,
              htmlBody: emailHtml,
            });
          } catch (e) {
            console.warn("[Calendar] Failed to email Tommy:", e);
          }

          // Notify owner via Manus notification
          try {
            await notifyOwner({
              title: `Meeting Scheduled: ${prospect.company}`,
              content: `${prospect.contactName ?? prospect.company} responded YES to outreach. Call scheduled for ${startDisplay} PT.\n\nView: ${shareUrl}`,
            });
          } catch (e) {
            console.warn("[Calendar] Failed to notify owner:", e);
          }

          // Send confirmation email to the prospect
          if (prospect.contactEmail) {
            const prospectHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">Your Meeting with StageGate is Confirmed</h2>
  <p>Hi ${prospect.contactName ?? "there"},</p>
  <p>We've confirmed your intro call with the StageGate team. Here are the details:</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>Date &amp; Time</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
    <tr><td style="padding:0.5rem 0;color:#555;"><strong>Duration</strong></td><td style="padding:0.5rem 0;">${input.meetingDurationMinutes ?? 30} minutes</td></tr>
    ${input.meetingNotes ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Notes</strong></td><td style="padding:0.5rem 0;">${input.meetingNotes}</td></tr>` : ""}
  </table>
  <p><a href="${shareUrl}" style="display:inline-block;background:#00E87A;color:#1C1E22;padding:0.6rem 1.2rem;border-radius:0.25rem;text-decoration:none;font-weight:600;">View Event Details →</a></p>
  <p style="color:#555;">We look forward to speaking with you. If you need to reschedule, reply to this email or reach us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a>.</p>
  <hr style="border-color:#eee;">
  <p style="color:#999;font-size:12px;">StageGate — Robotics Activation Infrastructure • <a href="https://onstage.bot" style="color:#999;">onstage.bot</a></p>
</div>`;
            try {
              await emailHelpers.sendEmail({
                to: prospect.contactEmail,
                subject: `Meeting Confirmed: Intro Call with StageGate — ${startDisplay} PT`,
                body: `Hi ${prospect.contactName ?? "there"},\n\nYour intro call with StageGate is confirmed for ${startDisplay} PT (${input.meetingDurationMinutes ?? 30} min).\n\nView event details: ${shareUrl}\n\nLooking forward to speaking with you.\n\n— StageGate Team\nhello@onstage.bot`,
                htmlBody: prospectHtml,
              });
            } catch (e) {
              console.warn("[Calendar] Failed to email prospect:", e);
            }
          }
        }

        return { success: true, calendarEvent };
      }),

    // Bulk update status for multiple prospects
    bulkUpdateStatus: adminProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1),
        status: z.enum(["new", "contacted", "responded", "scheduled", "converted", "not_interested"]),
      }))
      .mutation(async ({ input }) => {
        const count = await db.bulkUpdateProspectStatus(input.ids, input.status);
        return { updated: count };
      }),
    // Bulk import prospects from JSON
    bulkImport: adminProcedure
      .input(z.object({
        prospects: z.array(z.object({
          company: z.string(),
          robotName: z.string().optional(),
          robotType: z.string().optional(),
          hqCountry: z.string().optional(),
          attendsLasVegas: z.string().optional(),
          contactName: z.string().optional(),
          contactEmail: z.string().optional(),
          contactTitle: z.string().optional(),
          contactDept: z.string().optional(),
          website: z.string().optional(),
          shows: z.array(z.string()).optional(),
          notes: z.string().optional(),
        }))
      }))
      .mutation(async ({ input }) => {
        await db.bulkInsertProspects(input.prospects as Parameters<typeof db.bulkInsertProspects>[0]);
        return { imported: input.prospects.length };
      }),

    // Send intro email via LLM-generated personalized copy
    sendIntroEmail: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const prospect = await db.getProspectById(input.prospectId);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });
        const toEmail = emailHelpers.getProspectOutreachEmail(prospect);
        if (!toEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Prospect has no email address" });
        const { result: outreachResult } = await workflows.withAgentRun(
          { agentName: "XBOT Outreach", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `Prospect: ${prospect.company}` },
          async () => {
        // Generate personalized email via LLM
        const llmRes = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are XBOT, an AI logistics coordinator for StageGate — a Las Vegas-based company that handles all robot logistics for trade shows: international shipping, customs clearance, warehousing, staging, activation, and on-site support. Write a concise, professional, and compelling outreach email (150-200 words) to a robotics company. The tone is direct, knowledgeable, and peer-to-peer (robot-to-robot company). Do NOT use generic phrases like 'I hope this email finds you well'. Start with a specific observation about their robot. End with two clear CTAs on separate lines: (1) Register at https://onstage.bot to start their logistics intake, and (2) Schedule a 15-minute call with the StageGate team at https://calendar.google.com/calendar/embed?src=bc58ef12c74e2216111ee28feb95e5edf6381e54aa8699acdab87cd370177797%40group.calendar.google.com&ctz=America%2FLos_Angeles — use the exact URL, do not shorten it. Return ONLY the email body text, no subject line, no greeting header.`,
            },
            {
              role: "user",
              content: `Company: ${prospect.company}\nRobot: ${prospect.robotName ?? "their robot"}\nRobot type: ${prospect.robotType ?? "unknown"}\nShows they attend: ${(prospect.shows as string[] ?? []).join(", ") || "major trade shows"}\nContact dept: ${prospect.contactDept ?? "operations"}`,
            },
          ],
        });

        const rawContent = llmRes.choices?.[0]?.message?.content;
        const emailBody = typeof rawContent === "string" ? rawContent : (Array.isArray(rawContent) ? rawContent.map((c: { type: string; text?: string }) => c.type === "text" ? c.text ?? "" : "").join("") : "");
        const emailSubject = `StageGate: Las Vegas Robot Logistics for ${prospect.company}`;

        // Log the campaign
        await db.createOutreachCampaign({
          prospectId: prospect.id,
          emailSubject,
          emailBody,
          emailStatus: "sent",
          emailSentAt: new Date(),
        });

        // Update prospect status
        await db.updateProspect(prospect.id, { status: "contacted" });

        // Notify owner
        await notifyOwner({
          title: `XBOT Outreach: ${prospect.company}`,
          content: `Email sent to ${prospect.company} (${prospect.robotName ?? "robot"}).\n\nSubject: ${emailSubject}\n\n${emailBody}`,
        });

        return { success: true, emailSubject, emailBody };
          }
        );
        return outreachResult;
      }),

    bulkSendEmails: adminProcedure
      .input(z.object({ prospectIds: z.array(z.number()).min(1).max(50) }))
      .mutation(async ({ input, ctx }) => {
        const { result: bulkResult } = await workflows.withAgentRun(
          { agentName: "XBOT Bulk Outreach", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `${input.prospectIds.length} prospects` },
          async () => {
        const results: { id: number; success: boolean; company: string; error?: string }[] = [];
        for (const prospectId of input.prospectIds) {
          try {
            const prospect = await db.getProspectById(prospectId);
            if (!prospect) { results.push({ id: prospectId, success: false, company: "Unknown", error: "Not found" }); continue; }
            const toEmail = emailHelpers.getProspectOutreachEmail(prospect);
            if (!toEmail) { results.push({ id: prospectId, success: false, company: prospect.company, error: "No email address" }); continue; }
            // Generate personalized email via LLM
            const llmRes = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are XBOT, an AI logistics coordinator for StageGate — a Las Vegas-based company that handles all robot logistics for trade shows: international shipping, customs clearance, warehousing, staging, activation, and on-site support. Write a concise, professional, and compelling outreach email (150-200 words) to a robotics company. The tone is direct, knowledgeable, and peer-to-peer (robot-to-robot company). Do NOT use generic phrases like 'I hope this email finds you well'. Start with a specific observation about their robot. End with two clear CTAs on separate lines: (1) Register at https://onstage.bot to start their logistics intake, and (2) Schedule a 15-minute call with the StageGate team at https://calendar.google.com/calendar/embed?src=bc58ef12c74e2216111ee28feb95e5edf6381e54aa8699acdab87cd370177797%40group.calendar.google.com&ctz=America%2FLos_Angeles — use the exact URL, do not shorten it. Return ONLY the email body text, no subject line, no greeting header.`,
                },
                {
                  role: "user",
                  content: `Company: ${prospect.company}\nRobot: ${prospect.robotName ?? "their robot"}\nRobot type: ${prospect.robotType ?? "unknown"}\nShows they attend: ${(prospect.shows as string[] ?? []).join(", ") || "major trade shows"}\nContact: ${prospect.contactName ?? prospect.contactDept ?? "operations team"}`,
                },
              ],
            });
            const rawContent = llmRes.choices?.[0]?.message?.content;
            const emailBody = typeof rawContent === "string" ? rawContent : (Array.isArray(rawContent) ? rawContent.map((c: { type: string; text?: string }) => c.type === "text" ? c.text ?? "" : "").join("") : "");
            const emailSubject = `StageGate: Las Vegas Robot Logistics for ${prospect.company}`;
            await db.createOutreachCampaign({ prospectId: prospect.id, emailSubject, emailBody, emailStatus: "sent", emailSentAt: new Date() });
            await db.updateProspect(prospect.id, { status: "contacted" });
            // Log persistent activity record so the contact timeline stays up to date
            const dbConn2 = await getDb();
            if (dbConn2) {
              await dbConn2.insert(prospectActivities).values({
                prospectId: prospect.id,
                type: "email_sent",
                title: emailSubject,
                description: `XBOT bulk outreach email sent to ${prospect.contactEmail ?? prospect.company}`,
                metadata: { source: "xbot_bulk_outreach", company: prospect.company },
              });
            }
            results.push({ id: prospectId, success: true, company: prospect.company });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            results.push({ id: prospectId, success: false, company: String(prospectId), error: msg });
          }
        }
        const sent = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        await notifyOwner({
          title: `XBOT Bulk Outreach: ${sent} emails sent`,
          content: `Bulk send complete.\n\nSent: ${sent}\nFailed: ${failed}\n\nDetails:\n${results.map(r => `${r.company}: ${r.success ? "✓ sent" : `✗ ${r.error}`}`).join("\n")}`,
        });
        return { sent, failed, results };
          }
        );
        return bulkResult;
      }),
    // Get AI research data for a prospect
    getResearch: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return null;
        const [research] = await dbConn.select().from(prospectResearch)
          .where(eq(prospectResearch.prospectId, input.prospectId));
        return research ?? null;
      }),
    // Get activity timeline for a prospect
    getActivities: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const activities = await dbConn.select().from(prospectActivities)
          .where(eq(prospectActivities.prospectId, input.prospectId))
          .orderBy(desc(prospectActivities.createdAt));
        return activities;
      }),
    // Get email engagement events (opens + clicks) for a prospect
    getEmailEngagement: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn
          .select()
          .from(emailTrackingEvents)
          .where(eq(emailTrackingEvents.prospectId, input.prospectId))
          .orderBy(desc(emailTrackingEvents.occurredAt));
      }),
    // Log an activity for a prospect
    logActivity: adminProcedure
      .input(z.object({
        prospectId: z.number(),
        type: z.string(),
        title: z.string(),
        description: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return { success: false };
        await dbConn.insert(prospectActivities).values({
          prospectId: input.prospectId,
          type: input.type,
          title: input.title,
          description: input.description,
          metadata: input.metadata,
        });
        return { success: true };
      }),
    // Trigger AI research for a single prospect (on-demand)
    triggerResearch: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .mutation(async ({ input }) => {
        // Fire and forget — don't await, return immediately
        researchProspect(input.prospectId).catch(console.error);
        return { started: true };
      }),
    // Batch research enrichment for all ecosystem partner prospects (exhibit houses, freight, AV, venues)
    triggerPartnerEnrichment: adminProcedure
      .mutation(async ({ ctx }) => {
        return workflows.withAgentRun(
          { agentName: "Partner Enrichment", triggeredBy: ctx.user?.name ?? "admin", inputSummary: "all ecosystem partner prospects" },
          async () => {
            const allProspects = await db.listProspects();
            // Target: any prospect with vendorType set and not robot_oem, or outreachAngle = partner
            const partners = (allProspects as Array<{ id: number; company: string; vendorType?: string | null; outreachAngle?: string | null }>)
              .filter(p => (p.vendorType && p.vendorType !== "robot_oem") || p.outreachAngle === "partner");

            let started = 0;
            for (const partner of partners) {
              // Fire and forget with stagger to avoid rate limits
              await new Promise(r => setTimeout(r, 200));
              researchProspect(partner.id).catch(err =>
                console.error(`[PartnerEnrichment] Failed for ${partner.company} (${partner.id}):`, err.message)
              );
              started++;
            }

            return { started, total: partners.length, message: `Enrichment triggered for ${started} partner prospects` };
          }
        );
      }),

    // Send a draft email with full workflow: log activity, advance stage, schedule follow-up, notify owner
    sendDraftWithWorkflow: adminProcedure
      .input(z.object({
        prospectId: z.number(),
        subject: z.string(),
        body: z.string(),
        advanceStage: z.boolean().default(true),
        scheduleFollowUp: z.boolean().default(true),
        followUpDays: z.number().default(7),
      }))
      .mutation(async ({ input, ctx }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const prospect = await db.getProspectById(input.prospectId);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

        // Use specific contact email if set; otherwise default to marketing@ + sales@
        const specificEmail = prospect.contactEmail?.trim() && !isDeprecatedRoleInbox(prospect.contactEmail)
          ? prospect.contactEmail.trim()
          : null;
        const toAddresses: string[] = specificEmail
          ? [specificEmail]
          : roleBasedOutreachEmails(prospect);
        if (toAddresses.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot derive an email address — add a website or contact email to this prospect" });
        }
        const primaryToEmail = toAddresses[0]!;

        // 1. Save draft email record
        await dbConn.insert(draftEmails).values({
          prospectId: input.prospectId,
          subject: input.subject,
          body: input.body,
          status: "sent",
          sentAt: new Date(),
        });

        // 2. Send via Resend (to: [marketing@, sales@] or specific contact)
        const sendResult = await emailHelpers.sendEmail({
          to: toAddresses,
          subject: input.subject,
          body: input.body,
        });

        // 3. Log communication in the unified thread/timeline tables.
        await emailHelpers.recordOutboundCommunication({
          prospect,
          subject: input.subject,
          body: input.body,
          resendMessageId: sendResult?.id,
          source: "workflow_send",
        });

        // 3. Advance stage to 'contacted' if requested
        if (input.advanceStage && prospect.status === "new") {
          await db.updateProspect(input.prospectId, { status: "contacted" });
          await dbConn.insert(prospectActivities).values({
            prospectId: input.prospectId,
            type: "stage_changed",
            title: "Stage advanced: Prospects → Contacted",
            metadata: { from: "new", to: "contacted" },
          });
        }

        // 4. Schedule follow-up
        if (input.scheduleFollowUp) {
          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + input.followUpDays);
          await db.updateProspect(input.prospectId, { followUpDate });
          await dbConn.insert(prospectActivities).values({
            prospectId: input.prospectId,
            type: "follow_up_scheduled",
            title: `Follow-up scheduled for ${followUpDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            metadata: { followUpDate: followUpDate.toISOString(), days: input.followUpDays },
          });
        }

        // 5. Notify owner
        await notifyOwner({
          title: `📧 Outreach sent: ${prospect.company}`,
          content: `Email sent to ${prospect.company} → ${toAddresses.join(", ")}.\n\nSubject: ${input.subject}\n\nFollow-up scheduled in ${input.followUpDays} days.`,
        });

        return { success: true, sentTo: toAddresses };
      }),
  }),
  // ─── Video Message Intake (public — for prospects to submit) ─────────────────
  videoIntake: router({
    submit: publicProcedure
      .input(z.object({
        company: z.string().min(1),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        robotName: z.string().optional(),
        videoUrl: z.string().url(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Find or create prospect
        const existing = await db.listProspects();
        const match = existing.find(p => p.company.toLowerCase() === input.company.toLowerCase());

        if (match) {
          await db.updateProspect(match.id, {
            videoMessageUrl: input.videoUrl,
            contactName: input.contactName ?? match.contactName ?? undefined,
            contactEmail: input.contactEmail ?? match.contactEmail ?? undefined,
            status: "responded",
          });
        } else {
          await db.createProspect({
            company: input.company,
            contactName: input.contactName,
            contactEmail: input.contactEmail,
            robotName: input.robotName,
            videoMessageUrl: input.videoUrl,
            notes: input.notes,
            status: "responded",
          });
        }

        await notifyOwner({
          title: `New Video Message: ${input.company}`,
          content: `${input.contactName ?? "Someone"} from ${input.company} submitted a video message.\nRobot: ${input.robotName ?? "unknown"}\nVideo: ${input.videoUrl}\nNotes: ${input.notes ?? ""}`,
        });

        return { success: true };
      }),
  }),
  admin: router({
    getUsers: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    setUserRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot change your own role" });
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),
    getAgentStats: adminProcedure.query(async () => {
      return db.getAgentRunStats();
    }),
    getAgentRuns: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }))
      .query(async ({ input }) => {
        return db.getRecentAgentRuns(input.limit ?? 50);
      }),
    dbHealth: adminProcedure.query(async () => {
      return workflows.getDbHealth();
    }),
    pipelineStats: adminProcedure.query(async () => {
      return workflows.getPipelineStats();
    }),
    // ─── Outreach / Draft Email procedures ──────────────────────────────────

    // Generate Cal's discovery drafts for all prospects that don't have a pending draft.
    // Routes exclusively through salesAgentPreviewCore (frankPlaybook / buildDiscoveryEmail).
    // Also seeds salesAgentConversations rows for any prospects that don't have one,
    // so the nightly cron will pick them up for automated follow-ups.
    // Refresh = regenerate pending drafts + create missing ones (single admin workflow).
    generateDrafts: adminProcedure
      .input(z.object({ prospectIds: z.array(z.number()).optional() }))
      .mutation(async ({ input, ctx }) => {
        return workflows.withAgentRun(
          { agentName: "Cal Draft Refresh", triggeredBy: ctx.user?.name ?? "admin", inputSummary: input.prospectIds ? `${input.prospectIds.length} selected prospects` : "all Cal prospect drafts" },
          async () => refreshCalDraftsCore({ prospectIds: input.prospectIds }),
        );
      }),

    /** @deprecated Use generateDrafts — kept for older clients. */
    redraftPendingDrafts: adminProcedure.mutation(async ({ ctx }) => {
      return workflows.withAgentRun(
        { agentName: "Cal Redraft", triggeredBy: ctx.user?.name ?? "admin", inputSummary: "all pending prospect drafts" },
        async () => refreshCalDraftsCore(),
      );
    }),

    /** Trailing bounce-rate stats + circuit breaker state for Cal deliverability. */
    getDeliverabilityStatus: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return computeBounceStats(db);
    }),

    /** Auto-quarantine bounced emails, Hunter-replace, discard unrecoverable drafts. */
    quarantineBouncedProspects: adminProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return workflows.withAgentRun(
        { agentName: "Cal Quarantine", triggeredBy: ctx.user?.name ?? "admin", inputSummary: "bounced prospect recovery" },
        async () => recoverQuarantinedProspectContacts(db),
      );
    }),

    // Get all drafts with recipient data (prospects + partners/vendors)
    getDrafts: adminProcedure
      .input(z.object({
        statuses: z.array(z.string()).optional(),
        audience: z.enum(["prospect", "partner", "all"]).optional(),
      }))
      .query(async ({ input }) => {
        return emailHelpers.getDraftsWithRecipients(
          input.statuses ?? ["pending", "approved"],
          input.audience ?? "all",
        );
      }),

    // Get drafts for a single prospect (for per-row review in AdminProspects)
     getDraftsForProspect: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        return emailHelpers.getDraftsForProspect(input.prospectId);
      }),
    // Create a new draft for a prospect
    createDraft: adminProcedure
      .input(z.object({ prospectId: z.number(), subject: z.string(), body: z.string() }))
      .mutation(async ({ input }) => {
        return emailHelpers.createDraft({ prospectId: input.prospectId, subject: input.subject, body: input.body });
      }),
    // Approve a draft
    approveDraft: adminProcedure
      .input(z.object({ draftId: z.number() }))
      .mutation(async ({ input }) => {
        return emailHelpers.updateDraft(input.draftId, { status: "approved" });
      }),

    // Discard a draft
    discardDraft: adminProcedure
      .input(z.object({ draftId: z.number() }))
      .mutation(async ({ input }) => {
        return emailHelpers.updateDraft(input.draftId, { status: "discarded" });
      }),

    // Edit a draft's subject and/or body
    editDraft: adminProcedure
      .input(z.object({ draftId: z.number(), subject: z.string().optional(), body: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { draftId, ...data } = input;
        return emailHelpers.updateDraft(draftId, data);
      }),

    // Send a single draft email via Resend
    sendDraft: adminProcedure
      .input(z.object({ draftId: z.number() }))
      .mutation(async ({ input }) => {
        const drafts = await emailHelpers.getDraftsWithRecipients(["pending", "approved"], "all");
        const entry = drafts.find((d) => d.draft.id === input.draftId);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });

        let sendResult: { sentTo: string; messageId?: string; warning?: string };
        try {
          sendResult = await emailHelpers.sendUnifiedDraftEntry(entry);
        } catch (sendErr) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: sendErr instanceof Error ? sendErr.message : String(sendErr),
          });
        }

        await emailHelpers.markDraftSent(entry.draft.id, sendResult.messageId);

        if (entry.prospect && entry.draft.audience === "prospect") {
          const pgDb = await getDb();
          if (pgDb) {
            const [conv] = await pgDb
              .select({ state: salesAgentConversations.state })
              .from(salesAgentConversations)
              .where(eq(salesAgentConversations.prospectId, entry.prospect.id))
              .limit(1);
            await advanceProspectConversationAfterSend(
              entry.prospect.id,
              (conv?.state ?? "discovery") as "discovery" | "intro_sent" | "followup_1" | "followup_2",
            );
          }
        }

        return { success: true, sentTo: sendResult.sentTo, messageId: sendResult.messageId, warning: sendResult.warning };
      }),

    // Bulk send multiple approved drafts
    bulkSendDrafts: adminProcedure
      .input(z.object({ draftIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const drafts = await emailHelpers.getDraftsWithRecipients(["pending", "approved"], "all");
        const targets = drafts.filter((d) => input.draftIds.includes(d.draft.id));

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const entry of targets) {
          try {
            const sendResult = await emailHelpers.sendUnifiedDraftEntry(entry);
            await emailHelpers.markDraftSent(entry.draft.id, sendResult.messageId);

            if (entry.prospect && entry.draft.audience === "prospect") {
              const pgDb = await getDb();
              if (pgDb) {
                const [conv] = await pgDb
                  .select({ state: salesAgentConversations.state })
                  .from(salesAgentConversations)
                  .where(eq(salesAgentConversations.prospectId, entry.prospect.id))
                  .limit(1);
                await advanceProspectConversationAfterSend(
                  entry.prospect.id,
                  (conv?.state ?? "discovery") as "discovery" | "intro_sent" | "followup_1" | "followup_2",
                );
              }
            }
            sent++;
          } catch (e: unknown) {
            failed++;
            errors.push(`${entry.recipient.company}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return { sent, failed, errors };
      }),

    getNewServiceRequestCount: adminProcedure.query(async () => {
      const pgDb = await getDb();
      if (!pgDb) return { count: 0 };
      const rows = await pgDb.select({ n: count() }).from(serviceRequests).where(eq(serviceRequests.status, "new"));
      return { count: Number(rows[0]?.n ?? 0) };
    }),
    getDraftCount: adminProcedure
      .input(z.object({ audience: z.enum(["prospect", "partner", "all"]).optional() }).optional())
      .query(async ({ input }) => {
        return emailHelpers.getDraftCountByAudience(input?.audience ?? "all");
      }),

    getDailyBrief: adminProcedure.query(async () => {
      const { getDailyBrief } = await import("./dailyBrief");
      return getDailyBrief();
    }),

    getPipelineData: adminProcedure
      .input(z.object({ showFilter: z.string().optional() }))
      .query(async ({ input }) => {
        const pgDb = await getDb();
        if (!pgDb) return { columns: [], total: 0 };
        const allProspects = await pgDb.select().from(prospectsTable).orderBy(desc(prospectsTable.createdAt));
        const filtered = input.showFilter
          ? allProspects.filter((p: { shows: string[] | null }) =>
              Array.isArray(p.shows) && p.shows.includes(input.showFilter!)
            )
          : allProspects;
        const STAGES = ["new", "contacted", "responded", "scheduled", "converted"] as const;
        const columns = STAGES.map(status => ({
          status,
          items: filtered.filter((p: { status: string }) => p.status === status),
          count: filtered.filter((p: { status: string }) => p.status === status).length,
        }));
        return { columns, total: filtered.length };
      }),

    getProspectContext: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const pgDb = await getDb();
        if (!pgDb) throw new TRPCError({ code: "NOT_FOUND", message: "DB unavailable" });
        const [prospect] = await pgDb.select().from(prospectsTable).where(eq(prospectsTable.id, input.id));
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });
        const [research] = await pgDb.select().from(prospectResearch)
          .where(eq(prospectResearch.prospectId, input.id));
        const activities = await pgDb.select().from(prospectActivities)
          .where(eq(prospectActivities.prospectId, input.id))
          .orderBy(desc(prospectActivities.createdAt))
          .limit(20);
        return { prospect, research: research ?? null, activities };
      }),

    getSiteStats: adminProcedure.query(async () => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [users, orders, demos, quotes, leads, prospects, tradeShowRows, serviceRows, logisticsPartnerRows, xbotRows, agentRunRows, outreachRows, convRows, serviceRequestRows] = await Promise.all([
        db.getAllUsers(),
        db.getAllOrders(),
        db.getAllDemoRequests(),
        db.getAllQuoteRequests(),
        db.getAllLeads(),
        db.listProspects(),
        dbConn.select({ id: tradeShows.id, status: tradeShows.status }).from(tradeShows),
        dbConn.select({ id: servicesTable.id, isActive: servicesTable.isActive }).from(servicesTable),
        dbConn.select({ id: logisticsPartners.id }).from(logisticsPartners),
        dbConn.select({ id: xbotProjects.id }).from(xbotProjects),
        dbConn.select({ id: agentRuns.id }).from(agentRuns),
        dbConn.select({ id: outreachCampaigns.id }).from(outreachCampaigns),
        dbConn.select({ id: salesAgentConversations.id, state: salesAgentConversations.state }).from(salesAgentConversations),
        dbConn.select({ id: serviceRequests.id, status: serviceRequests.status }).from(serviceRequests),
      ]);
      const prospectsByStatus = prospects.reduce((acc: Record<string, number>, p: { status: string }) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const ordersByStatus = orders.reduce((acc: Record<string, number>, o: { status: string }) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const convsByState = convRows.reduce((acc: Record<string, number>, c: { state: string | null }) => {
        const s = c.state ?? "discovery";
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return {
        users: { total: users.length, admins: users.filter((u: { role: string }) => u.role === "admin").length },
        orders: { total: orders.length, byStatus: ordersByStatus },
        demos: { total: demos.length, pending: demos.filter((d: { status: string }) => d.status === "pending").length },
        quotes: { total: quotes.length, pending: quotes.filter((q: { status: string }) => q.status === "pending").length },
        leads: { total: leads.length },
        prospects: { total: prospects.length, byStatus: prospectsByStatus },
        // Pipeline health metrics
        tradeShows: { total: tradeShowRows.length, upcoming: tradeShowRows.filter((t: { status: string | null }) => t.status === "upcoming").length },
        services: { total: serviceRows.length, active: serviceRows.filter((s: { isActive: boolean | null }) => s.isActive !== false).length },
        logisticsPartners: { total: logisticsPartnerRows.length },
        xbotProjects: { total: xbotRows.length },
        agentRuns: { total: agentRunRows.length },
        outreachCampaigns: { total: outreachRows.length },
        conversations: { total: convRows.length, byState: convsByState, awaiting: convsByState["awaiting_reply"] ?? 0, active: (convsByState["in_conversation"] ?? 0) + (convsByState["awaiting_reply"] ?? 0) },
        serviceRequests: { total: serviceRequestRows.length, newCount: serviceRequestRows.filter((r: { status: string | null }) => r.status === "new").length },
      };
    }),

    /** Pull ReadyForRobots robot_companies into local prospects (canonical OEM source). */
    syncRfrProspects: adminProcedure.mutation(async () => {
      const { syncFromRfrRobotCompanies } = await import("./integrations/rfrRobotCompanies");
      const result = await syncFromRfrRobotCompanies({ force: true });
      return result;
    }),
  }),
  // ─── Bookings (public intake form) ───────────────────────────────────────────────────────────────────────────────────
  bookings: router({
    create: publicProcedure
      .input(z.object({
        company: z.string().min(1),
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        website: z.string().optional(),
        country: z.string().optional(),
        robotName: z.string().optional(),
        robotType: z.string().optional(),
        robotCount: z.number().int().min(1).default(1),
        robotDimensions: z.string().optional(),
        robotWeight: z.string().optional(),
        specialHandling: z.string().optional(),
        showName: z.string().optional(),
        showDate: z.string().optional(),
        boothNumber: z.string().optional(),
        services: z.array(z.string()).default([]),
        // v21: warehouse space matching
        robotSqft: z.number().int().positive().optional(),
        storageDays: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        // Auto-match warehouse bay if robot sqft + storage days provided
        let warehouseBayId: number | null = null;
        let warehouseEstimate: string | null = null;
        let warehouseMessage = "";
        if (input.robotSqft && input.storageDays) {
          const bays = await dbConn.select().from(warehouseBays)
            .where(eq(warehouseBays.isAvailable, true))
            .orderBy(warehouseBays.sqft);
          const match = bays.find((b) => b.sqft >= input.robotSqft!);
          if (match) {
            const rate = parseFloat(match.pricePerSqftPerDay);
            const total = rate * input.robotSqft! * input.storageDays!;
            warehouseBayId = match.id;
            warehouseEstimate = total.toFixed(2);
            warehouseMessage = `\nWarehouse: ${match.name} (${match.sqft} sqft) @ $${rate}/sqft/day × ${input.robotSqft} sqft × ${input.storageDays} days = $${total.toFixed(2)}`;
          }
        }
        await dbConn.insert(bookingRequests).values({
          company: input.company,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          website: input.website,
          country: input.country,
          robotName: input.robotName,
          robotType: input.robotType,
          robotCount: input.robotCount,
          robotDimensions: input.robotDimensions,
          robotWeight: input.robotWeight,
          specialHandling: input.specialHandling,
          showName: input.showName,
          showDate: input.showDate,
          boothNumber: input.boothNumber,
          services: input.services,
          robotSqft: input.robotSqft ?? null,
          storageDays: input.storageDays ?? null,
          warehouseBayId: warehouseBayId,
          warehouseEstimate: warehouseEstimate,
        });
        await notifyOwner({
          title: `📥 New Booking Request: ${input.company}`,
          content: `${input.contactName} (${input.contactEmail}) from ${input.company} submitted a logistics intake.\n\nRobot: ${input.robotName ?? "TBD"} (${input.robotType ?? "unknown type"})\nShow: ${input.showName ?? "TBD"}\nServices: ${input.services.join(", ") || "none selected"}${warehouseMessage}`,
        });
        return { success: true, warehouseBayId, warehouseEstimate };
      }),
    // Admin: list all booking requests (with optional status/show filters)
    list: adminProcedure
      .input(z.object({
        status: z.string().optional(),
        showName: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const rows = await dbConn.select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt));
        let filtered = rows;
        if (input?.status) filtered = filtered.filter(r => r.status === input.status);
        if (input?.showName) filtered = filtered.filter(r =>
          r.showName?.toLowerCase().includes(input.showName!.toLowerCase()));
        return filtered;
      }),

    // Admin: get single booking request
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const rows = await dbConn.select().from(bookingRequests).where(eq(bookingRequests.id, input.id));
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
        return rows[0];
      }),

    // Admin: count new (unreviewed) bookings for sidebar badge
    getNewCount: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return { count: 0 };
        const rows = await dbConn.select({ cnt: count() }).from(bookingRequests)
          .where(eq(bookingRequests.status, "new"));
        return { count: Number(rows[0]?.cnt ?? 0) };
      }),

    // Admin: convert approved booking to a service order
    convertToOrder: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        // Fetch the booking
        const bookingRows = await dbConn.select().from(bookingRequests).where(eq(bookingRequests.id, input.id));
        const booking = bookingRows[0];
        if (!booking) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
        if (booking.status === "converted") throw new TRPCError({ code: "BAD_REQUEST", message: "Booking already converted" });
        // Create a service order (userId=0 for unregistered intake, showId=0 as placeholder)
        const inserted = await dbConn.insert(serviceOrders).values({
          userId: 0,
          showId: 0,
          status: "pending",
          bookingId: booking.id,
          notes: [
            `Converted from booking #${booking.id}`,
            `Company: ${booking.company}`,
            `Robot: ${booking.robotName ?? "TBD"} (${booking.robotType ?? "unknown"})`,
            `Show: ${booking.showName ?? "TBD"} — Booth: ${booking.boothNumber ?? "TBD"}`,
            `Services: ${(booking.services as string[]).join(", ") || "none"}`,
            `Contact: ${booking.contactName} <${booking.contactEmail}>${booking.contactPhone ? " " + booking.contactPhone : ""}`,
          ].join("\n"),
        }).returning();
        const newOrder = inserted[0];
        // Mark booking as converted
        await dbConn.update(bookingRequests)
          .set({ status: "converted", updatedAt: new Date() })
          .where(eq(bookingRequests.id, input.id));
        await notifyOwner({
          title: `🎉 Booking #${booking.id} converted to Order #${newOrder.id}`,
          content: `${booking.company} booking has been converted to a service order.\nOrder ID: ${newOrder.id}\nStatus: pending`,
        });
        return { success: true, orderId: newOrder.id };
      }),

    // Admin: update booking status and notes
    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["new", "reviewed", "quoted", "confirmed", "cancelled"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await dbConn.update(bookingRequests)
          .set({
            status: input.status,
            ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}),
            updatedAt: new Date(),
          })
          .where(eq(bookingRequests.id, input.id));
        return { success: true };
      }),

    // v23: Generate a quote HTML document for a booking (includes warehouse estimate line item)
    generateQuoteHtml: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const rows = await dbConn.select().from(bookingRequests).where(eq(bookingRequests.id, input.id));
        const b = rows[0];
        if (!b) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });

        // Fetch bay name if warehouseBayId is set
        let bayName = "";
        if (b.warehouseBayId) {
          const [bay] = await dbConn.select().from(warehouseBays).where(eq(warehouseBays.id, b.warehouseBayId));
          bayName = bay?.name ?? `Bay #${b.warehouseBayId}`;
        }

        const services = Array.isArray(b.services) ? b.services as string[] : [];
        const quoteDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const quoteNumber = `SG-${String(b.id).padStart(5, "0")}`;

        // Build line items
        const lineItems: { description: string; amount: string }[] = [
          ...services.map(s => ({ description: s, amount: "TBD" })),
        ];
        if (b.warehouseEstimate && bayName) {
          lineItems.push({
            description: `Warehouse Storage — ${bayName}${b.robotSqft ? ` (${b.robotSqft} sqft)` : ""}${b.storageDays ? ` × ${b.storageDays} days` : ""}`,
            amount: `$${b.warehouseEstimate}`,
          });
        }

        const lineItemRows = lineItems.map((li, i) => `
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:10px 0;color:#111;font-size:14px">${i + 1}. ${li.description}</td>
            <td style="padding:10px 0;text-align:right;font-size:14px;font-weight:600;color:${li.amount === "TBD" ? "#888" : "#111"}">${li.amount}</td>
          </tr>`).join("");

        const warehouseSection = b.warehouseEstimate ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-top:20px">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">⌂ Warehouse Storage Estimate</p>
            <p style="margin:4px 0 0;font-size:13px;color:#78350f">
              ${bayName}${b.robotSqft ? ` &bull; ${b.robotSqft} sqft` : ""}${b.storageDays ? ` &bull; ${b.storageDays} days` : ""}
              &bull; <strong>$${b.warehouseEstimate}</strong>
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#a16207">Estimate based on best available bay at time of booking. Final pricing confirmed on contract.</p>
          </div>` : "";

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Quote ${quoteNumber} — StageGate</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:40px 20px; color:#111; }
    .card { background:#fff; max-width:720px; margin:0 auto; border-radius:12px; box-shadow:0 2px 16px rgba(0,0,0,0.08); padding:48px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; }
    .logo { font-size:22px; font-weight:800; letter-spacing:-0.5px; color:#111; }
    .logo span { color:#f59e0b; }
    .meta { text-align:right; font-size:13px; color:#666; }
    .meta strong { display:block; font-size:18px; color:#111; font-weight:700; margin-bottom:4px; }
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#999; margin-bottom:8px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:32px; }
    .field { font-size:13px; }
    .field .label { color:#888; margin-bottom:2px; }
    .field .value { color:#111; font-weight:500; }
    table { width:100%; border-collapse:collapse; }
    .total-row td { padding:12px 0; font-size:15px; font-weight:700; border-top:2px solid #111; }
    .footer { margin-top:40px; padding-top:24px; border-top:1px solid #eee; font-size:12px; color:#999; text-align:center; }
    @media print { body { background:#fff; padding:0; } .card { box-shadow:none; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="logo">${emailLogoHtml(44)}</div>
        <div style="font-size:12px;color:#888;margin-top:4px">Robotics Activation Infrastructure &bull; Las Vegas, NV</div>
      </div>
      <div class="meta">
        <strong>QUOTE ${quoteNumber}</strong>
        <div>Date: ${quoteDate}</div>
        <div>Valid for 30 days</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Bill To</div>
        <div class="field"><div class="value" style="font-size:15px;font-weight:700">${b.company}</div></div>
        <div class="field" style="margin-top:6px"><div class="value">${b.contactName}</div></div>
        <div class="field"><div class="value" style="color:#666">${b.contactEmail}</div></div>
        ${b.contactPhone ? `<div class="field"><div class="value" style="color:#666">${b.contactPhone}</div></div>` : ""}
      </div>
      <div>
        <div class="section-title">Event Details</div>
        <div class="field"><div class="label">Show</div><div class="value">${b.showName ?? "TBD"}</div></div>
        <div class="field" style="margin-top:6px"><div class="label">Show Date</div><div class="value">${b.showDate ?? "TBD"}</div></div>
        <div class="field" style="margin-top:6px"><div class="label">Booth</div><div class="value">${b.boothNumber ?? "TBD"}</div></div>
        <div class="field" style="margin-top:6px"><div class="label">Robot</div><div class="value">${b.robotName ?? b.robotType ?? "TBD"}</div></div>
      </div>
    </div>

    <div class="section-title">Services &amp; Pricing</div>
    <table>
      <tbody>
        ${lineItemRows || "<tr><td style='padding:10px 0;color:#888;font-size:14px'>No services selected</td></tr>"}
      </tbody>
      ${b.warehouseEstimate ? `<tfoot><tr class="total-row"><td>Warehouse Storage Subtotal</td><td style="text-align:right">$${b.warehouseEstimate}</td></tr></tfoot>` : ""}
    </table>

    ${warehouseSection}

    <div class="footer">
      StageGate &bull; onstage.bot &bull; info@onstage.bot<br>
      This quote is an estimate only. Final pricing is confirmed upon contract execution.
    </div>
  </div>
  <div style="text-align:center;margin-top:24px">
    <button onclick="window.print()" style="background:#f59e0b;color:#000;font-weight:700;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer">Print / Save as PDF</button>
  </div>
</body>
</html>`;

        return { html, quoteNumber };
      }),

    // v24: Send quote email to prospect and update booking status to "quoted"
    sendQuoteEmail: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const rows = await dbConn.select().from(bookingRequests).where(eq(bookingRequests.id, input.id));
        const b = rows[0];
        if (!b) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
        if (!b.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Booking has no contact email" });

        // Fetch bay name if warehouseBayId is set
        let bayName = "";
        if (b.warehouseBayId) {
          const [bay] = await dbConn.select().from(warehouseBays).where(eq(warehouseBays.id, b.warehouseBayId));
          bayName = bay?.name ?? `Bay #${b.warehouseBayId}`;
        }

        const services = Array.isArray(b.services) ? b.services as string[] : [];
        const quoteDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const quoteNumber = `SG-${String(b.id).padStart(5, "0")}`;

        // Build line items
        const lineItems: { description: string; amount: string }[] = [
          ...services.map(s => ({ description: s, amount: "TBD" })),
        ];
        if (b.warehouseEstimate && bayName) {
          lineItems.push({
            description: `Warehouse Storage — ${bayName}${b.robotSqft ? ` (${b.robotSqft} sqft)` : ""}${b.storageDays ? ` × ${b.storageDays} days` : ""}`,
            amount: `$${b.warehouseEstimate}`,
          });
        }

        const lineItemRows = lineItems.map((li, i) => `
          <tr style="border-bottom:1px solid #f0f0f0">
            <td style="padding:10px 0;color:#111;font-size:14px">${i + 1}. ${li.description}</td>
            <td style="padding:10px 0;text-align:right;font-size:14px;font-weight:600;color:${li.amount === "TBD" ? "#888" : "#111"}">${li.amount}</td>
          </tr>`).join("");

        const warehouseSection = b.warehouseEstimate ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin-top:20px">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">⌂ Warehouse Storage Estimate</p>
            <p style="margin:4px 0 0;font-size:13px;color:#78350f">
              ${bayName}${b.robotSqft ? ` &bull; ${b.robotSqft} sqft` : ""}${b.storageDays ? ` &bull; ${b.storageDays} days` : ""}
              &bull; <strong>$${b.warehouseEstimate}</strong>
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#a16207">Estimate based on best available bay at time of booking. Final pricing confirmed on contract.</p>
          </div>` : "";

        const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Quote ${quoteNumber} — StageGate</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f9f9f9; margin:0; padding:40px 20px; color:#111; }
    .card { background:#fff; max-width:720px; margin:0 auto; border-radius:12px; box-shadow:0 2px 16px rgba(0,0,0,0.08); padding:48px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:36px; }
    .logo { font-size:22px; font-weight:800; letter-spacing:-0.5px; color:#111; }
    .logo span { color:#f59e0b; }
    .meta { text-align:right; font-size:13px; color:#666; }
    .meta strong { display:block; font-size:18px; color:#111; font-weight:700; margin-bottom:4px; }
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#999; margin-bottom:8px; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:32px; }
    .field { font-size:13px; }
    .field .label { color:#888; margin-bottom:2px; }
    .field .value { color:#111; font-weight:500; }
    table { width:100%; border-collapse:collapse; }
    .total-row td { padding:12px 0; font-size:15px; font-weight:700; border-top:2px solid #111; }
    .footer { margin-top:40px; padding-top:24px; border-top:1px solid #eee; font-size:12px; color:#999; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="logo">${emailLogoHtml(44)}</div>
        <div style="font-size:12px;color:#888;margin-top:4px">Robotics Activation Infrastructure &bull; Las Vegas, NV</div>
      </div>
      <div class="meta">
        <strong>QUOTE ${quoteNumber}</strong>
        <div>Date: ${quoteDate}</div>
        <div>Valid for 30 days</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="section-title">Bill To</div>
        <div class="field"><div class="value" style="font-size:15px;font-weight:700">${b.company}</div></div>
        <div class="field" style="margin-top:6px"><div class="value">${b.contactName}</div></div>
        <div class="field"><div class="value" style="color:#666">${b.contactEmail}</div></div>
        ${b.contactPhone ? `<div class="field"><div class="value" style="color:#666">${b.contactPhone}</div></div>` : ""}
      </div>
      <div>
        <div class="section-title">Event Details</div>
        <div class="field"><div class="label">Show</div><div class="value">${b.showName ?? "TBD"}</div></div>
        <div class="field" style="margin-top:6px"><div class="label">Show Date</div><div class="value">${b.showDate ?? "TBD"}</div></div>
        <div class="field" style="margin-top:6px"><div class="label">Booth</div><div class="value">${b.boothNumber ?? "TBD"}</div></div>
        <div class="field" style="margin-top:6px"><div class="label">Robot</div><div class="value">${b.robotName ?? b.robotType ?? "TBD"}</div></div>
      </div>
    </div>

    <div class="section-title">Services &amp; Pricing</div>
    <table>
      <tbody>
        ${lineItemRows || "<tr><td style='padding:10px 0;color:#888;font-size:14px'>No services selected</td></tr>"}
      </tbody>
      ${b.warehouseEstimate ? `<tfoot><tr class="total-row"><td>Warehouse Storage Subtotal</td><td style="text-align:right">$${b.warehouseEstimate}</td></tr></tfoot>` : ""}
    </table>

    ${warehouseSection}

    <div class="footer">
      StageGate &bull; onstage.bot &bull; info@onstage.bot<br>
      This quote is an estimate only. Final pricing is confirmed upon contract execution.
    </div>
  </div>
</body>
</html>`;

        // Plain-text fallback
        const textBody = [
          `Quote ${quoteNumber} — StageGate`,
          `Date: ${quoteDate} | Valid for 30 days`,
          ``,
          `Bill To: ${b.company} — ${b.contactName} <${b.contactEmail}>`,
          `Show: ${b.showName ?? "TBD"} on ${b.showDate ?? "TBD"}`,
          ``,
          `Services:`,
          ...services.map((s, i) => `  ${i + 1}. ${s} — TBD`),
          ...(b.warehouseEstimate ? [`  Warehouse Storage (${bayName}) — $${b.warehouseEstimate}`] : []),
          ``,
          `Questions? Reply to this email or visit onstage.bot`,
        ].join("\n");

        // Send via Resend
        const sendResult = await emailHelpers.sendEmail({
          to: b.contactEmail,
          subject: `Your StageGate Quote ${quoteNumber} — ${b.company}`,
          body: textBody,
          htmlBody,
        });

        // Update booking status to "quoted" and record timestamp
        await dbConn
          .update(bookingRequests)
          .set({
            status: "quoted",
            quoteSentAt: new Date(),
            quoteResendMessageId: sendResult.id,
            updatedAt: new Date(),
          })
          .where(eq(bookingRequests.id, input.id));

        return { success: true, quoteNumber, sentTo: b.contactEmail, resendId: sendResult.id };
      }),
  }),
  // ─── Scheduling ────────────────────────────────────────────────────────────
  scheduling: router({
    // Public: get available slots for a date range
    getAvailableSlots: publicProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const { gte, lte, and: drizzleAnd, eq: drizzleEq } = await import("drizzle-orm");
        return dbConn
          .select()
          .from(schedulingSlots)
          .where(
            drizzleAnd(
              gte(schedulingSlots.slotStart, input.startDate),
              lte(schedulingSlots.slotStart, input.endDate),
              drizzleEq(schedulingSlots.isBooked, false)
            )
          )
          .orderBy(schedulingSlots.slotStart);
      }),

    // Public: book a slot
    bookSlot: publicProcedure
      .input(z.object({
        slotId: z.number(),
        prospectId: z.number().optional(),
        bookedByName: z.string().min(1),
        bookedByEmail: z.string().email(),
        company: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { eq: drizzleEq } = await import("drizzle-orm");
        const slots = await dbConn
          .select()
          .from(schedulingSlots)
          .where(drizzleEq(schedulingSlots.id, input.slotId))
          .limit(1);
        if (!slots[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Slot not found" });
        if (slots[0].isBooked) throw new TRPCError({ code: "CONFLICT", message: "Slot already booked" });
        await dbConn
          .update(schedulingSlots)
          .set({
            isBooked: true,
            bookedByProspectId: input.prospectId ?? null,
            bookedByName: input.bookedByName,
            bookedByEmail: input.bookedByEmail,
            bookedByCompany: input.company ?? null,
            updatedAt: new Date(),
          })
          .where(drizzleEq(schedulingSlots.id, input.slotId));
        // Send calendar invite emails to host + prospect
        const slot = slots[0];
        const startIso = slot.slotStart.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const endIso = slot.slotEnd.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const icsContent = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//StageGate//EN",
          "BEGIN:VEVENT",
          `UID:stagegate-call-${slot.id}-${Date.now()}@onstage.bot`,
          `DTSTART:${startIso}`,
          `DTEND:${endIso}`,
          `SUMMARY:StageGate Call — ${input.bookedByName} (${input.company ?? ""})`,
          `DESCRIPTION:Intro call with ${input.bookedByName} from ${input.company ?? "unknown company"}.\\nContact: ${input.bookedByEmail}`,
          `ORGANIZER;CN=StageGate:mailto:hello@onstage.bot`,
          `ATTENDEE;CN=${slot.hostName}:mailto:${slot.hostEmail}`,
          `ATTENDEE;CN=${input.bookedByName}:mailto:${input.bookedByEmail}`,
          "END:VEVENT",
          "END:VCALENDAR",
        ].join("\r\n");
        const startDisplay = slot.slotStart.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
        // Email to prospect
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "StageGate <hello@onstage.bot>",
              to: [input.bookedByEmail],
              subject: `Your StageGate call is confirmed — ${startDisplay}`,
              html: `<p>Hi ${input.bookedByName},</p><p>Your call with <strong>${slot.hostName}</strong> is confirmed for <strong>${startDisplay}</strong>.</p><p>We'll walk through your robot's logistics needs, upcoming shows, and how StageGate can handle everything from port to booth.</p><p>Questions? Reply to this email or reach us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a>.</p><p>— The StageGate Team</p>`,
              attachments: [{ filename: "invite.ics", content: Buffer.from(icsContent).toString("base64") }],
            }),
          });
          // Email to host
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "StageGate <hello@onstage.bot>",
              to: [slot.hostEmail],
              subject: `New call booked: ${input.bookedByName} (${input.company ?? ""}) — ${startDisplay}`,
              html: `<p>Hi ${slot.hostName},</p><p><strong>${input.bookedByName}</strong> from <strong>${input.company ?? "unknown"}</strong> has booked a call for <strong>${startDisplay}</strong>.</p><p>Contact: <a href="mailto:${input.bookedByEmail}">${input.bookedByEmail}</a></p>`,
              attachments: [{ filename: "invite.ics", content: Buffer.from(icsContent).toString("base64") }],
            }),
          });
        } catch (emailErr) {
          console.error("[bookSlot] Calendar invite email failed:", emailErr);
        }
        // Notify owner
        await notifyOwner({
          title: `📅 New call booked — ${input.bookedByName} (${input.company ?? "unknown company"})`,
          content: `${input.bookedByName} from ${input.company ?? "unknown"} booked a call for ${slot.slotStart.toLocaleString()}.\nHost: ${slot.hostName} (${slot.hostEmail})\nContact: ${input.bookedByEmail}`,
        });
        return { success: true, slot };
      }),

    // Admin: add availability slots
    addSlots: adminProcedure
      .input(z.object({
        slots: z.array(z.object({
          hostName: z.string(),
          hostEmail: z.string().email(),
          slotStart: z.date(),
          slotEnd: z.date(),
        })),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await dbConn.insert(schedulingSlots).values(input.slots);
        return { success: true, count: input.slots.length };
      }),

    // Admin: get all slots
    getAllSlots: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn
          .select()
          .from(schedulingSlots)
          .orderBy(schedulingSlots.slotStart);
      }),

    // Admin: update meeting notes on a booked slot
    updateMeetingNotes: adminProcedure
      .input(z.object({
        slotId: z.number(),
        meetingNotes: z.string(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { eq: drizzleEq } = await import("drizzle-orm");
        await dbConn
          .update(schedulingSlots)
          .set({ meetingNotes: input.meetingNotes, updatedAt: new Date() })
          .where(drizzleEq(schedulingSlots.id, input.slotId));
        return { success: true };
      }),

    // Admin: delete a slot
    deleteSlot: adminProcedure
      .input(z.object({ slotId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { eq: drizzleEq } = await import("drizzle-orm");
        await dbConn.delete(schedulingSlots).where(drizzleEq(schedulingSlots.id, input.slotId));
        return { success: true };
      }),
  }),

  // ─── Sales Agent ───────────────────────────────────────────────────────────
  salesAgent: router({
    // Admin: get recent agent runs
    getRuns: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const { desc: drizzleDesc } = await import("drizzle-orm");
        return dbConn
          .select()
          .from(salesAgentRuns)
          .orderBy(drizzleDesc(salesAgentRuns.startedAt))
          .limit(50);
      }),

    /** Actionable counts for Cal's 5-step workflow UI. */
    getWorkflowSummary: adminProcedure.query(async () => getCalWorkflowSummary()),

    // Admin: get conversations
    getConversations: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const { desc: drizzleDesc, sql: drizzleSql } = await import("drizzle-orm");
        // Fetch conversations with prospects
        const rows = await dbConn
          .select({
            conv: salesAgentConversations,
            prospect: prospectsTable,
          })
          .from(salesAgentConversations)
          .innerJoin(prospectsTable, eq(salesAgentConversations.prospectId, prospectsTable.id))
          .orderBy(drizzleDesc(salesAgentConversations.lastActivityAt))
          .limit(100);
        if (rows.length === 0) return [];
        // Fetch engagement counts for all prospects in one query
        const prospectIds = rows.map(r => r.conv.prospectId);
        const engRows = await dbConn
          .select({
            prospectId: emailTrackingEvents.prospectId,
            opens: drizzleSql<number>`SUM(CASE WHEN ${emailTrackingEvents.eventType} = 'email.opened' THEN 1 ELSE 0 END)`.as('opens'),
            clicks: drizzleSql<number>`SUM(CASE WHEN ${emailTrackingEvents.eventType} = 'email.clicked' THEN 1 ELSE 0 END)`.as('clicks'),
            lastOpenedAt: drizzleSql<Date | null>`MAX(CASE WHEN ${emailTrackingEvents.eventType} = 'email.opened' THEN ${emailTrackingEvents.occurredAt} END)`.as('lastOpenedAt'),
            lastClickedAt: drizzleSql<Date | null>`MAX(CASE WHEN ${emailTrackingEvents.eventType} = 'email.clicked' THEN ${emailTrackingEvents.occurredAt} END)`.as('lastClickedAt'),
          })
          .from(emailTrackingEvents)
          .where(drizzleSql`${emailTrackingEvents.prospectId} IN (${drizzleSql.join(prospectIds.map(id => drizzleSql`${id}`), drizzleSql`, `)})`)
          .groupBy(emailTrackingEvents.prospectId);
        const engMap = new Map<number, { opens: number; clicks: number; lastOpenedAt: Date | null; lastClickedAt: Date | null }>();
        for (const row of engRows) {
          if (row.prospectId !== null) {
            engMap.set(row.prospectId, {
              opens: Number(row.opens),
              clicks: Number(row.clicks),
              lastOpenedAt: row.lastOpenedAt,
              lastClickedAt: row.lastClickedAt,
            });
          }
        }
        return rows.map(r => ({
          ...r,
          engagement: engMap.get(r.conv.prospectId) ?? { opens: 0, clicks: 0, lastOpenedAt: null, lastClickedAt: null },
        }));
      }),

    // Admin: get email thread for a prospect
    getEmailThread: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const { desc: drizzleDesc } = await import("drizzle-orm");
        return dbConn
          .select()
          .from(emailThreads)
          .where(eq(emailThreads.prospectId, input.prospectId))
          .orderBy(drizzleDesc(emailThreads.receivedAt))
          .limit(50);
      }),

    // Admin: manually trigger Cal to send to a specific prospect
    manualSend: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await salesAgentManualSendCore(input.prospectId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("not found")) throw new TRPCError({ code: "NOT_FOUND", message });
          if (message.includes("No contact email")) throw new TRPCError({ code: "BAD_REQUEST", message });
          if (message.includes("db unavailable") || message.includes("Failed to generate")) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
          }
          // Unknown errors — surface but don't mask the original message
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),

    // Admin: preview a Cal email (LLM draft, not sent)
    // Replaces the old fetch to /api/scheduled/sales-agent-preview; returns subject, body, stage, nextStage.
    // Get Cal's existing draft for a prospect from draft_emails (no LLM call)
    getDraftForProspect: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return null;
        const [draft] = await dbConn
          .select()
          .from(draftEmails)
          .where(eq(draftEmails.prospectId, input.prospectId))
          .orderBy(desc(draftEmails.createdAt))
          .limit(1);
        if (!draft) return null;

        if (draft.status === "pending" && draft.body && isLegacyFrankDraft(draft.body, draft.subject)) {
          const repaired = await repairLegacyCalDraftCore(input.prospectId, draft);
          if (repaired.repaired) {
            return {
              ...draft,
              subject: repaired.subject,
              body: repaired.body,
              agentReasoning: "Cal auto-redraft — legacy sales voice removed",
              legacyRepaired: true as const,
            };
          }
        }

        return { ...draft, legacyRepaired: false as const };
      }),

    previewEmail: adminProcedure
      .input(z.object({
        prospectId: z.number(),
        stage: z.enum(["discovery", "intro_sent", "followup_1", "followup_2", "robot_guild"]).optional(),
        forceRegenerate: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        let replacePending = !!input.forceRegenerate;

        // 1. Return existing pending draft unless legacy Frank voice or explicitly regenerating
        if (!input.forceRegenerate) {
          const [existing] = await dbConn
            .select()
            .from(draftEmails)
            .where(and(eq(draftEmails.prospectId, input.prospectId), eq(draftEmails.status, "pending")))
            .orderBy(desc(draftEmails.createdAt))
            .limit(1);
          if (existing?.body && existing.body.trim().length > 0) {
            const legacy = isLegacyFrankDraft(existing.body, existing.subject);
            if (!legacy) {
              const [conv] = await dbConn
                .select()
                .from(salesAgentConversations)
                .where(eq(salesAgentConversations.prospectId, input.prospectId))
                .limit(1);
              const stage = input.stage ?? (conv?.state as "discovery" | "intro_sent" | "followup_1" | "followup_2" | "robot_guild") ?? "discovery";
              const NEXT: Record<string, string> = { discovery: "intro_sent", intro_sent: "followup_1", followup_1: "followup_2", followup_2: "followup_2" };
              return { subject: existing.subject ?? "", body: existing.body, stage, nextStage: NEXT[stage] ?? "intro_sent", fromCache: true };
            }
            replacePending = true;
          }
        }

        if (replacePending) {
          await dbConn
            .delete(draftEmails)
            .where(and(eq(draftEmails.prospectId, input.prospectId), eq(draftEmails.status, "pending")));
        }

        // 2. No cached draft — attempt LLM generation
        const [prospect] = await dbConn
          .select()
          .from(prospectsTable)
          .where(eq(prospectsTable.id, input.prospectId))
          .limit(1);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });

        const [conv] = await dbConn
          .select()
          .from(salesAgentConversations)
          .where(eq(salesAgentConversations.prospectId, input.prospectId))
          .limit(1);

        const stage = input.stage ?? (conv?.state as "discovery" | "intro_sent" | "followup_1" | "followup_2" | "robot_guild") ?? "discovery";

        try {
          const preview = await salesAgentPreviewCore(input.prospectId, stage);
          const { subject, body, nextStage } = preview;
          // Save the freshly generated draft so next time it loads instantly
          await dbConn.insert(draftEmails).values({
            prospectId: input.prospectId,
            subject,
            body,
            status: "pending",
          });
          return { subject, body, stage: preview.stage, nextStage, fromCache: false };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("429") || msg.includes("quota") || msg.includes("insufficient")) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "OpenAI quota exceeded. Please add billing at platform.openai.com or contact the admin. Existing drafts are still accessible.",
            });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: msg });
        }
      }),

    // Admin: update conversation stage manually
    updateConversationStage: adminProcedure
      .input(z.object({
        conversationId: z.number(),
        state: z.enum(["discovery", "intro_sent", "followup_1", "followup_2", "robot_guild", "email_opened", "link_clicked", "awaiting_reply", "responded", "scheduling", "booked", "not_interested", "converted"]),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [updated] = await dbConn
          .update(salesAgentConversations)
          .set({ state: input.state, updatedAt: new Date() })
          .where(eq(salesAgentConversations.id, input.conversationId))
          .returning();
        return updated;
      }),

    verifyProspectEmail: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [prospect] = await dbConn.select().from(prospectsTable).where(eq(prospectsTable.id, input.prospectId)).limit(1);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });

        const apolloKey = process.env.APOLLO_API_KEY;
        if (!apolloKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Apollo API key not configured" });

        interface ApolloOrg { id: string; name: string; website_url?: string; }
        interface ApolloPerson { id: string; name: string; title?: string; email?: string; email_status?: string; linkedin_url?: string; }

        // Step 1: Find the org in Apollo
        let orgId: string | null = null;
        try {
          const orgBody: Record<string, unknown> = { q_organization_name: prospect.company, page: 1, per_page: 1 };
          if (prospect.website) orgBody.q_organization_website_url = prospect.website;
          const orgRes = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
            method: "POST",
            headers: { "x-api-key": apolloKey, "Content-Type": "application/json" },
            body: JSON.stringify(orgBody),
          });
          const orgData = await orgRes.json() as { organizations?: ApolloOrg[] };
          orgId = orgData.organizations?.[0]?.id ?? null;
        } catch { /* ignore */ }

        // Step 2: Find people at the org
        let bestEmail: string | null = null;
        let bestConfidence: "high" | "medium" | "low" = "low";
        let bestName: string | null = null;
        let bestTitle: string | null = null;
        let bestLinkedIn: string | null = null;

        if (orgId) {
          try {
            const peopleRes = await fetch("https://api.apollo.io/v1/mixed_people/search", {
              method: "POST",
              headers: { "x-api-key": apolloKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                organization_ids: [orgId],
                person_titles: ["VP Sales", "Head of Sales", "Sales Director", "Head of Events", "Event Marketing", "Events Director", "VP Marketing", "Head of Marketing", "Marketing Director", "CEO", "COO", "Founder", "Co-Founder", "Business Development"],
                page: 1, per_page: 5,
              }),
            });
            const peopleData = await peopleRes.json() as { people?: ApolloPerson[] };
            const people = peopleData.people ?? [];
            const verified = people.find(p => p.email_status === "verified" && p.email);
            const guessed = people.find(p => p.email);
            const best = verified ?? guessed ?? people[0];
            if (best) {
              bestEmail = best.email ?? null;
              bestConfidence = best.email_status === "verified" ? "high" : best.email ? "medium" : "low";
              bestName = best.name ?? null;
              bestTitle = best.title ?? null;
              bestLinkedIn = best.linkedin_url ?? null;
            }
          } catch { /* ignore */ }
        }

        // Step 3: Fallback email pattern suggestions
        const suggestions: string[] = [];
        if (!bestEmail && prospect.company) {
          const domain = prospect.website
            ? prospect.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]
            : prospect.company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
          suggestions.push(`sales@${domain}`, `events@${domain}`, `marketing@${domain}`);
          if (bestName) {
            const parts = bestName.toLowerCase().split(" ");
            const first = parts[0] ?? "";
            const last = parts[parts.length - 1] ?? "";
            if (first && last) {
              suggestions.push(`${first}@${domain}`, `${last}@${domain}`, `${first}.${last}@${domain}`, `${first[0] ?? ""}${last}@${domain}`);
            }
          }
        }

        const fallbackRoleEmail = suggestions[0] ?? null;
        const selectedEmail = bestEmail ?? fallbackRoleEmail;

        // Step 4: Update prospect if Apollo found a person or we can derive a company-domain role inbox.
        if (selectedEmail && selectedEmail !== prospect.contactEmail) {
          await dbConn.update(prospectsTable).set({
            contactEmail: selectedEmail,
            emailConfidence: bestEmail ? bestConfidence : "medium",
            contactName: bestName ?? prospect.contactName,
            contactTitle: bestTitle ?? prospect.contactTitle,
            contactLinkedIn: bestLinkedIn ?? prospect.contactLinkedIn,
            updatedAt: new Date(),
          }).where(eq(prospectsTable.id, input.prospectId));
        }

        return {
          found: !!selectedEmail,
          email: selectedEmail,
          confidence: bestEmail ? bestConfidence : "medium",
          name: bestName,
          title: bestTitle,
          linkedIn: bestLinkedIn,
          suggestions,
          orgFound: !!orgId,
        };
      }),

    triggerDiscovery: adminProcedure
      .mutation(async () => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        // Count shows available
        const shows = await dbConn.select({ id: tradeShows.id, name: tradeShows.name }).from(tradeShows);
        // Create a discovery run record
        const [run] = await dbConn.insert(salesAgentRuns).values({
          runType: "discovery",
          status: "running",
        }).returning({ id: salesAgentRuns.id });
        const runId = run?.id;
        // Fire-and-forget: import and call the core discovery logic
        const { salesAgentDiscoveryCore } = await import("./agents/salesAgentDiscovery");
        salesAgentDiscoveryCore(runId).catch(async (err: unknown) => {
          if (runId) {
            await dbConn.update(salesAgentRuns).set({ status: "failed", errorMessage: String(err) }).where(eq(salesAgentRuns.id, runId));
          }
        });
        return { runId, showCount: shows.length, message: `Discovery started for ${shows.length} shows. Check Runs tab for progress.` };
      }),

    enrichContactsHunter: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { hunterEnabled } = await import("./integrations/hunter");
        if (!hunterEnabled()) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "HUNTER_API_KEY not configured" });
        }
        const { enrichProspectsBatch } = await import("./agents/prospectEnrichment");
        const result = await enrichProspectsBatch(dbConn, input?.limit ?? 25);
        return result;
      }),

    resolveWebsitesHunter: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { hunterEnabled } = await import("./integrations/hunter");
        if (!hunterEnabled()) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "HUNTER_API_KEY not configured" });
        }
        const { resolveProspectWebsitesBatch } = await import("./agents/prospectWebsiteResolution");
        const result = await resolveProspectWebsitesBatch(dbConn, input?.limit ?? 25);
        const msg =
          result.resolved > 0
            ? `Hunter found websites for ${result.resolved} of ${result.attempted} prospects.`
            : result.attempted === 0
              ? "No prospects missing a website."
              : result.dismissed > 0
                ? `No domain for ${result.attempted} names — ${result.dismissed} junk names auto-dismissed.`
                : `Hunter could not match domains for ${result.attempted} names (verify company names).`;
        return { ...result, message: msg };
      }),

    /** @deprecated Use resolveWebsitesHunter — Apollo removed from URL pipeline. */
    resolveWebsitesApollo: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { hunterEnabled } = await import("./integrations/hunter");
        if (!hunterEnabled()) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "HUNTER_API_KEY not configured" });
        }
        const { resolveProspectWebsitesBatch } = await import("./agents/prospectWebsiteResolution");
        return resolveProspectWebsitesBatch(dbConn, input?.limit ?? 25);
      }),

    runCalOperator: adminProcedure.mutation(async () => {
      const { executeCalOperatorRun } = await import("./agents/calOperator");
      // Manual runs skip LLM-heavy steps — faster feedback in the UI.
      return executeCalOperatorRun({ skipGrowthBrief: true, skipDraftRefresh: true, notify: false });
    }),

    getLatestOperatorRun: adminProcedure.query(async () => {
      const { getLatestCalOperatorRun } = await import("./agents/calOperator");
      return getLatestCalOperatorRun();
    }),

    runRelayLoop: adminProcedure.mutation(async () => {
      const { executeRelayRun } = await import("./agents/relayOperator");
      return executeRelayRun({ skipNotify: true, skipCalOperator: false });
    }),

    getLatestRelayRun: adminProcedure.query(async () => {
      const { getLatestRelayRun } = await import("./agents/relayOperator");
      return getLatestRelayRun();
    }),

    verifyAllUnverified: adminProcedure
      .mutation(async () => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const apolloKey = process.env.APOLLO_API_KEY;
        if (!apolloKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Apollo API key not configured" });

        // Fetch all low-confidence prospects
        const unverified = await dbConn
          .select()
          .from(prospectsTable)
          .where(eq(prospectsTable.emailConfidence, "low"))
          .limit(100); // cap at 100 per run to avoid rate limits

        // Generate a unique batchId and initialize progress state
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        batchVerifyProgress.set(batchId, {
          total: unverified.length,
          current: 0,
          verified: 0,
          notFound: 0,
          currentCompany: "",
          status: "running",
          startedAt: new Date(),
          errors: [],
        });

        // Fire-and-forget: run the Apollo loop in the background
        (async () => {
          const state = batchVerifyProgress.get(batchId)!;
          try {
            for (let i = 0; i < unverified.length; i++) {
              const prospect = unverified[i];
              state.current = i + 1;
              state.currentCompany = prospect.company;

              try {
                // Rate limit: 1 request per 300ms to stay within Apollo free tier
                await new Promise(r => setTimeout(r, 300));

                // Step 1: Find org
                let orgId: string | null = null;
                try {
                  const orgBody: Record<string, unknown> = { q_organization_name: prospect.company, page: 1, per_page: 1 };
                  if (prospect.website) orgBody.q_organization_website_url = prospect.website;
                  const orgRes = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
                    method: "POST",
                    headers: { "x-api-key": apolloKey, "Content-Type": "application/json" },
                    body: JSON.stringify(orgBody),
                  });
                  const orgData = await orgRes.json() as { organizations?: Array<{ id: string }> };
                  orgId = orgData.organizations?.[0]?.id ?? null;
                } catch { /* ignore */ }

                // Step 2: Find people
                let bestEmail: string | null = null;
                let bestConfidence: "high" | "medium" | "low" = "low";
                let bestName: string | null = null;
                let bestTitle: string | null = null;
                let bestLinkedIn: string | null = null;

                if (orgId) {
                  try {
                    const peopleRes = await fetch("https://api.apollo.io/v1/mixed_people/search", {
                      method: "POST",
                      headers: { "x-api-key": apolloKey, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        organization_ids: [orgId],
                        person_titles: ["VP Sales", "Head of Sales", "Sales Director", "Head of Events", "Event Marketing", "Events Director", "VP Marketing", "Head of Marketing", "Marketing Director", "CEO", "COO", "Founder", "Co-Founder", "Business Development"],
                        page: 1, per_page: 5,
                      }),
                    });
                    const peopleData = await peopleRes.json() as { people?: Array<{ id: string; name: string; title?: string; email?: string; email_status?: string; linkedin_url?: string }> };
                    const people = peopleData.people ?? [];
                    const best = people.find(p => p.email_status === "verified" && p.email) ?? people.find(p => p.email) ?? people[0];
                    if (best) {
                      bestEmail = best.email ?? null;
                      bestConfidence = best.email_status === "verified" ? "high" : best.email ? "medium" : "low";
                      bestName = best.name ?? null;
                      bestTitle = best.title ?? null;
                      bestLinkedIn = best.linkedin_url ?? null;
                    }
                  } catch { /* ignore */ }
                }

                const selectedEmail = bestEmail ?? emailHelpers.getProspectOutreachEmail(prospect);
                if (selectedEmail && selectedEmail !== prospect.contactEmail) {
                  await dbConn.update(prospectsTable).set({
                    contactEmail: selectedEmail,
                    emailConfidence: bestEmail ? bestConfidence : "medium",
                    contactName: bestName ?? prospect.contactName,
                    contactTitle: bestTitle ?? prospect.contactTitle,
                    contactLinkedIn: bestLinkedIn ?? prospect.contactLinkedIn,
                    updatedAt: new Date(),
                  }).where(eq(prospectsTable.id, prospect.id));
                  state.verified++;
                } else {
                  state.notFound++;
                }
              } catch (err) {
                state.errors.push(`${prospect.company}: ${String(err)}`);
              }
            }
            state.status = "complete";
            state.currentCompany = "";
          } catch (err) {
            state.status = "error";
            state.errors.push(`Fatal: ${String(err)}`);
          }
          // Clean up map after 10 minutes to avoid memory leak
          setTimeout(() => batchVerifyProgress.delete(batchId), 10 * 60 * 1000);
        })();

        return { batchId, total: unverified.length };
      }),

    getVerifyProgress: adminProcedure
      .input(z.object({ batchId: z.string() }))
      .query(({ input }) => {
        const state = batchVerifyProgress.get(input.batchId);
        if (!state) return null;
        return {
          total: state.total,
          current: state.current,
          verified: state.verified,
          notFound: state.notFound,
          currentCompany: state.currentCompany,
          status: state.status,
          startedAt: state.startedAt,
          errors: state.errors.slice(0, 5),
        };
      }),

    importProspects: adminProcedure
      .input(z.object({
        csvText: z.string().min(1),
        defaultShowId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const lines = input.csvText.trim().split(/\r?\n/);
        if (lines.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must have a header row and at least one data row" });

        const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
        const rows = lines.slice(1);

        const REQUIRED = ["company"];
        const missing = REQUIRED.filter(f => !header.includes(f));
        if (missing.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: `CSV missing required columns: ${missing.join(", ")}` });

        const col = (row: string[], name: string): string => {
          const idx = header.indexOf(name);
          return idx >= 0 ? (row[idx] ?? "").trim() : "";
        };

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const line of rows) {
          if (!line.trim()) continue;
          // Simple CSV split (handles basic cases; no quoted commas)
          const cells = line.split(",");
          const company = col(cells, "company");
          if (!company) { skipped++; continue; }

          const contactEmail = col(cells, "contact_email") || col(cells, "email");
          const contactName = col(cells, "contact_name") || col(cells, "name");
          const contactTitle = col(cells, "contact_title") || col(cells, "title");
          const website = col(cells, "website");
          const robotType = col(cells, "robot_type") || col(cells, "robottype");
          const rawCategory = col(cells, "robot_category") || col(cells, "robotcategory") || "light";
          const robotCategory = ["light", "heavy_industrial", "mixed"].includes(rawCategory) ? rawCategory as "light" | "heavy_industrial" | "mixed" : "light";
          const showNameHint = col(cells, "show_name") || col(cells, "showname");

          // Resolve showId
          // Resolve show name for the shows jsonb array
          let resolvedShowName: string | null = showNameHint || null;
          if (!resolvedShowName && input.defaultShowId) {
            const [show] = await dbConn.select({ name: tradeShows.name }).from(tradeShows)
              .where(eq(tradeShows.id, input.defaultShowId)).limit(1);
            if (show) resolvedShowName = show.name;
          }

          try {
            // Upsert by company name (case-insensitive)
            const [existing] = await dbConn.select({ id: prospectsTable.id })
              .from(prospectsTable)
              .where(sql`LOWER(${prospectsTable.company}) = LOWER(${company})`)
              .limit(1);

            if (existing) {
              // Update existing prospect with any new info
              await dbConn.update(prospectsTable).set({
                ...(contactEmail ? { contactEmail, emailConfidence: "medium" as const } : {}),
                ...(contactName ? { contactName } : {}),
                ...(contactTitle ? { contactTitle } : {}),
                ...(website ? { website } : {}),
                ...(robotType ? { robotType } : {}),
                robotCategory,
                ...(resolvedShowName ? { shows: [resolvedShowName] } : {}),
                updatedAt: new Date(),
              }).where(eq(prospectsTable.id, existing.id));
              skipped++; // counted as skipped (already existed)
            } else {
              await dbConn.insert(prospectsTable).values({
                company,
                contactEmail: contactEmail || null,
                contactName: contactName || null,
                contactTitle: contactTitle || null,
                website: website || null,
                robotType: robotType || null,
                robotCategory,
                shows: resolvedShowName ? [resolvedShowName] : [],
                emailConfidence: contactEmail ? "medium" : "low",
                status: "new",
                createdAt: new Date(),
                updatedAt: new Date(),
              });
              imported++;
            }
          } catch (err) {
            errors.push(`Row ${imported + skipped + errors.length + 1} (${company}): ${String(err)}`);
          }
        }

        return {
          imported,
          skipped,
          errors: errors.slice(0, 10),
          total: rows.filter(r => r.trim()).length,
          message: `Imported ${imported} new prospects, ${skipped} already existed, ${errors.length} errors.`,
        };
      }),

    // v38: update prospect notes
    updateProspectNotes: adminProcedure
      .input(z.object({
        prospectId: z.number(),
        notes: z.string().max(5000),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await dbConn
          .update(prospectsTable)
          .set({ notes: input.notes || null, updatedAt: new Date() })
          .where(eq(prospectsTable.id, input.prospectId));
        return { success: true };
      }),

    // v38: resume follow-ups for a prospect in awaiting_reply state
    resumeFollowUps: adminProcedure
      .input(z.object({ conversationId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [conv] = await dbConn
          .select({ id: salesAgentConversations.id, prospectId: salesAgentConversations.prospectId, state: salesAgentConversations.state })
          .from(salesAgentConversations)
          .where(eq(salesAgentConversations.id, input.conversationId))
          .limit(1);
        if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
        if (conv.state !== "awaiting_reply") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Conversation is not in awaiting_reply state" });
        }
        const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await dbConn
          .update(salesAgentConversations)
          .set({ state: "followup_1", nextFollowUpAt: oneDayFromNow, lastActivityAt: new Date(), updatedAt: new Date() })
          .where(eq(salesAgentConversations.id, conv.id));
        await dbConn.insert(prospectActivities).values({
          prospectId: conv.prospectId,
          type: "followup_resumed",
          title: "Follow-ups resumed",
          description: "Manually resumed automated follow-ups — moved back to Follow-up 1",
          metadata: { nextFollowUpAt: oneDayFromNow.toISOString(), resumedAt: new Date().toISOString() },
        });
        return { success: true, nextFollowUpAt: oneDayFromNow };
      }),

    // Parse contact email/website from the latest stored reply (backfill for pre-automation replies)
    applyContactFromLatestReply: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const [prospect] = await dbConn
          .select()
          .from(prospectsTable)
          .where(eq(prospectsTable.id, input.prospectId))
          .limit(1);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND", message: "Prospect not found" });

        const replyActivities = await dbConn
          .select()
          .from(prospectActivities)
          .where(and(
            eq(prospectActivities.prospectId, input.prospectId),
            eq(prospectActivities.type, "email_replied"),
          ))
          .orderBy(desc(prospectActivities.createdAt))
          .limit(10);

        let bodyText = "";
        let fromAddress = "";
        let subject = "";

        for (const act of replyActivities) {
          const meta = (act.metadata ?? {}) as Record<string, unknown>;
          const replyBody = typeof meta.replyBody === "string" ? meta.replyBody : "";
          if (replyBody.trim()) {
            bodyText = replyBody;
            fromAddress = typeof meta.fromAddress === "string" ? meta.fromAddress : "";
            subject = typeof meta.subject === "string" ? meta.subject : act.title ?? "";
            break;
          }
          if (!bodyText && act.description?.trim()) {
            bodyText = act.description;
            fromAddress = typeof meta.fromAddress === "string" ? meta.fromAddress : "";
            subject = typeof meta.subject === "string" ? meta.subject : act.title ?? "";
          }
        }

        if (!bodyText.trim()) {
          const [thread] = await dbConn
            .select()
            .from(emailThreads)
            .where(and(
              eq(emailThreads.prospectId, input.prospectId),
              eq(emailThreads.direction, "inbound"),
            ))
            .orderBy(desc(emailThreads.receivedAt))
            .limit(1);
          if (thread?.body?.trim()) {
            bodyText = thread.body;
            fromAddress = thread.fromAddress ?? "";
            subject = thread.subject ?? "";
          }
        }

        if (!bodyText.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No reply text found for this prospect — nothing to parse",
          });
        }

        return applyInboundContactUpdates(dbConn, prospect, {
          fromAddress: fromAddress || prospect.contactEmail || "",
          bodyText,
          subject,
        });
      }),

    // v38: get prospect activities for the detail panel timeline
    getProspectActivities: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn
          .select()
          .from(prospectActivities)
          .where(eq(prospectActivities.prospectId, input.prospectId))
          .orderBy(desc(prospectActivities.createdAt))
          .limit(50);
      }),
  }),

  // ─── Vendors ───────────────────────────────────────────────────────────────
  vendors: router({
    getAll: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn.select().from(vendors).orderBy(vendors.name);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(["freight", "customs_broker", "av", "rigging", "warehouse", "transport", "tech_support", "other"]),
        website: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [v] = await dbConn.insert(vendors).values(input).returning();
        return v;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        type: z.string().optional(),
        website: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        notes: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { id, ...rest } = input;
        await dbConn.update(vendors).set({ ...rest, updatedAt: new Date() }).where(eq(vendors.id, id));
        return { success: true };
      }),
  }),

  // ─── Logistics Agent ────────────────────────────────────────────────────────
  logistics: router({
    // P5: Create a workflow from a committed order (triggered after meeting handoff)
    createWorkflow: adminProcedure
      .input(z.object({
        orderId: z.number().optional(),        // optional — auto-generated if omitted
        prospectId: z.number().optional(),
        robotCompany: z.string(),
        clientName: z.string().optional(),     // alias for robotCompany display name
        robotName: z.string().optional(),
        robotModel: z.string().optional(),     // alias for robotName
        showName: z.string().optional(),
        showCity: z.string().optional(),
        showStartDate: z.string().optional(),  // ISO date string
        notes: z.string().optional(),
        warehouseBayId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        // Auto-generate a synthetic orderId if not supplied (admin quick-create flow)
        const orderId = input.orderId ?? (Date.now() % 2_000_000_000);
        const robotCompany = input.clientName || input.robotCompany;
        const robotName = input.robotModel || input.robotName;

        // Create the workflow
        const [workflow] = await dbConn.insert(logisticsWorkflows).values({
          orderId,
          prospectId: input.prospectId,
          robotCompany,
          robotName,
          showName: input.showName,
          showStartDate: input.showStartDate ? new Date(input.showStartDate) : undefined,
          notes: input.notes,
          status: "active",
          warehouseBayId: input.warehouseBayId ?? null,
        }).returning();

        // Auto-create the standard checkpoint sequence
        const CHECKPOINT_TYPES = [
          { type: "shipping_out",       title: "Robot Shipped by Company",          responsibleParty: "robot_company", daysFromNow: 0 },
          { type: "customs",            title: "Customs Clearance",                 responsibleParty: "vendor",        daysFromNow: 3 },
          { type: "airport_arrival",    title: "Robot Arrives at Airport/Freight",  responsibleParty: "vendor",        daysFromNow: 5 },
          { type: "receiving",          title: "StageGate Receives Robot",          responsibleParty: "stagegate",     daysFromNow: 7 },
          { type: "warehouse_in",       title: "Robot Checked into Warehouse",      responsibleParty: "stagegate",     daysFromNow: 7 },
          { type: "staging",            title: "Robot Unpacked and Staged",         responsibleParty: "stagegate",     daysFromNow: 10 },
          { type: "activation_test",    title: "Power-On & Calibration Test",       responsibleParty: "stagegate",     daysFromNow: 11 },
          { type: "booth_delivery",     title: "Robot Delivered to Trade Show Booth", responsibleParty: "stagegate",   daysFromNow: 14 },
          { type: "show_floor_checkin", title: "Show Floor Check-In (Day 1)",       responsibleParty: "stagegate",     daysFromNow: 15 },
          { type: "show_end",           title: "Show Ends — Robot Ready for Pickup", responsibleParty: "robot_company", daysFromNow: 18 },
          { type: "return_pickup",      title: "Robot Picked Up / Returned",        responsibleParty: "stagegate",     daysFromNow: 19 },
          { type: "warehouse_return",   title: "Robot Back in StageGate Warehouse", responsibleParty: "stagegate",     daysFromNow: 20 },
          { type: "completed",          title: "Lifecycle Complete",                responsibleParty: "stagegate",     daysFromNow: 21 },
        ];

        const now = Date.now();
        const checkpointValues = CHECKPOINT_TYPES.map(cp => ({
          workflowId: workflow.id,
          type: cp.type,
          title: cp.title,
          responsibleParty: cp.responsibleParty,
          dueAt: new Date(now + cp.daysFromNow * 24 * 60 * 60 * 1000),
          status: "pending" as const,
        }));

        await dbConn.insert(logisticsCheckpoints).values(checkpointValues);

        return { workflowId: workflow.id, checkpointsCreated: checkpointValues.length };
      }),

    // v21: Assign or reassign a warehouse bay to a workflow
    assignBay: adminProcedure
      .input(z.object({
        workflowId: z.number(),
        warehouseBayId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        // Fetch workflow for logging context
        const [wf] = await dbConn.select().from(logisticsWorkflows).where(eq(logisticsWorkflows.id, input.workflowId));
        if (!wf) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

        await dbConn
          .update(logisticsWorkflows)
          .set({ warehouseBayId: input.warehouseBayId, updatedAt: new Date() })
          .where(eq(logisticsWorkflows.id, input.workflowId));

        // Log the event
        if (input.warehouseBayId) {
          const [bay] = await dbConn.select().from(warehouseBays).where(eq(warehouseBays.id, input.warehouseBayId));
          if (bay) {
            await dbConn.insert(warehouseBayEvents).values({
              bayId: bay.id,
              bayName: bay.name,
              workflowId: input.workflowId,
              event: "assigned",
              robotCompany: wf.robotCompany ?? undefined,
              showName: wf.showName ?? undefined,
              notes: `Manually assigned via admin`,
            });
          }
        } else {
          // Unassigning — find the previous bay
          if (wf.warehouseBayId) {
            const [prevBay] = await dbConn.select().from(warehouseBays).where(eq(warehouseBays.id, wf.warehouseBayId));
            if (prevBay) {
              await dbConn.insert(warehouseBayEvents).values({
                bayId: prevBay.id,
                bayName: prevBay.name,
                workflowId: input.workflowId,
                event: "unassigned",
                robotCompany: wf.robotCompany ?? undefined,
                showName: wf.showName ?? undefined,
                notes: `Manually unassigned via admin`,
              });
            }
          }
        }

        return { success: true };
      }),

    // Get all workflows (admin)
    getWorkflows: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn.select().from(logisticsWorkflows).orderBy(desc(logisticsWorkflows.createdAt));
      }),

    // Get a single workflow with its checkpoints
    getWorkflow: adminProcedure
      .input(z.object({ workflowId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [workflow] = await dbConn
          .select()
          .from(logisticsWorkflows)
          .where(eq(logisticsWorkflows.id, input.workflowId));
        if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
        const checkpoints = await dbConn
          .select()
          .from(logisticsCheckpoints)
          .where(eq(logisticsCheckpoints.workflowId, input.workflowId))
          .orderBy(logisticsCheckpoints.dueAt);
        return { workflow, checkpoints };
      }),

    // Get workflow by orderId
    getWorkflowByOrder: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return null;
        const [workflow] = await dbConn
          .select()
          .from(logisticsWorkflows)
          .where(eq(logisticsWorkflows.orderId, input.orderId));
        if (!workflow) return null;
        const checkpoints = await dbConn
          .select()
          .from(logisticsCheckpoints)
          .where(eq(logisticsCheckpoints.workflowId, workflow.id))
          .orderBy(logisticsCheckpoints.dueAt);
        return { workflow, checkpoints };
      }),

    // Update a checkpoint status (admin)
    updateCheckpoint: adminProcedure
      .input(z.object({
        checkpointId: z.number(),
        status: z.enum(["pending", "in_progress", "completed", "blocked", "escalated"]),
        notes: z.string().optional(),
        trackingNumber: z.string().optional(),
        carrierName: z.string().optional(),
        problemDescription: z.string().optional(),
        problemSeverity: z.enum(["low", "medium", "high", "critical"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { checkpointId, status, ...rest } = input;
        const completedAt = status === "completed" ? new Date() : undefined;
        const escalatedAt = status === "escalated" ? new Date() : undefined;
        await dbConn
          .update(logisticsCheckpoints)
          .set({ status, ...rest, completedAt, escalatedAt, updatedAt: new Date() })
          .where(eq(logisticsCheckpoints.id, checkpointId));

        // v21: Auto-flip warehouse bay availability on warehouse_in / warehouse_return completion
        if (status === "completed") {
          const checkpoints = await dbConn
            .select()
            .from(logisticsCheckpoints)
            .where(eq(logisticsCheckpoints.id, checkpointId))
            .limit(1);
          const cp = checkpoints[0];
          if (cp && (cp.type === "warehouse_in" || cp.type === "warehouse_return")) {
            // Get the workflow to find the assigned bay
            const workflows = await dbConn
              .select()
              .from(logisticsWorkflows)
              .where(eq(logisticsWorkflows.id, cp.workflowId))
              .limit(1);
            const wf = workflows[0];
            if (wf?.warehouseBayId) {
              const isNowAvailable = cp.type === "warehouse_return"; // return = bay free again
              const [bay] = await dbConn.select().from(warehouseBays).where(eq(warehouseBays.id, wf.warehouseBayId)).limit(1);
              await dbConn
                .update(warehouseBays)
                .set({ isAvailable: isNowAvailable, updatedAt: new Date() })
                .where(eq(warehouseBays.id, wf.warehouseBayId));
              // Log occupancy event
              await dbConn.insert(warehouseBayEvents).values({
                bayId: wf.warehouseBayId,
                bayName: bay?.name ?? `Bay #${wf.warehouseBayId}`,
                workflowId: wf.id,
                event: isNowAvailable ? "released" : "occupied",
                robotCompany: wf.robotCompany ?? undefined,
                showName: wf.showName ?? undefined,
                notes: cp.type === "warehouse_in" ? "Robot checked in (warehouse_in checkpoint completed)" : "Robot returned (warehouse_return checkpoint completed)",
              });
              await notifyOwner({
                title: `🏭 Bay ${isNowAvailable ? "freed" : "occupied"}: ${cp.type === "warehouse_in" ? "Robot checked in" : "Robot returned"}`,
                content: `Workflow #${wf.id} (${wf.robotCompany ?? "unknown"}) — bay #${wf.warehouseBayId} is now ${isNowAvailable ? "available" : "occupied"}.`,
              });
            }
          }
        }

        return { success: true };
      }),

    // P8: Log a problem during activation/staging
    reportProblem: adminProcedure
      .input(z.object({
        checkpointId: z.number(),
        workflowId: z.number(),
        problemDescription: z.string().min(10),
        problemSeverity: z.enum(["low", "medium", "high", "critical"]),
        robotCompanyEmail: z.string().email(),
        robotCompanyName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        // Update checkpoint to escalated
        await dbConn
          .update(logisticsCheckpoints)
          .set({
            status: "escalated",
            problemDescription: input.problemDescription,
            problemSeverity: input.problemSeverity,
            escalatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(logisticsCheckpoints.id, input.checkpointId));

        // Generate AI problem report email
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are the StageGate operations team. Write a professional, clear problem report email to a robot company about an issue found during staging/activation. Be factual, helpful, and present two options: (1) video call support session with StageGate, or (2) send a technician on-site. Sign as "The StageGate Team".`,
            },
            {
              role: "user",
              content: `Robot company: ${input.robotCompanyName}\nProblem: ${input.problemDescription}\nSeverity: ${input.problemSeverity}\n\nWrite the problem report email.`,
            },
          ],
        });

        const emailBody = typeof llmResponse.choices[0].message.content === "string"
          ? llmResponse.choices[0].message.content
          : "We have identified an issue with your robot during our staging process. Please contact us to discuss resolution options.";

        // Send the problem report email
        await emailHelpers.sendEmail({
          to: input.robotCompanyEmail,
          subject: `[StageGate] Robot Staging Issue — Action Required (${input.problemSeverity.toUpperCase()})`,
          body: emailBody,
        });

        // Notify admins
        await notifyOwner({
          title: `🚨 Robot Problem Reported (${input.problemSeverity})`,
          content: `${input.robotCompanyName}: ${input.problemDescription}`,
        });

        return { success: true, emailSent: true };
      }),

    // P9: Send show-floor daily check-in email
    sendShowCheckin: adminProcedure
      .input(z.object({
        workflowId: z.number(),
        robotCompanyEmail: z.string().email(),
        robotCompanyName: z.string(),
        showName: z.string(),
        dayNumber: z.number().min(1),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are the StageGate team. Write a brief, friendly daily check-in email to a robot company during their trade show. Ask how the robot is performing, if they need any support, and remind them StageGate is available. Keep it under 100 words. Sign as "The StageGate Team".`,
            },
            {
              role: "user",
              content: `Robot company: ${input.robotCompanyName}\nShow: ${input.showName}\nDay: ${input.dayNumber}\n\nWrite the check-in email.`,
            },
          ],
        });

        const emailBody = typeof llmResponse.choices[0].message.content === "string"
          ? llmResponse.choices[0].message.content
          : `Hi ${input.robotCompanyName} team! Just checking in on Day ${input.dayNumber} of ${input.showName}. How is your robot performing? Let us know if you need anything. — The StageGate Team`;

        await emailHelpers.sendEmail({
          to: input.robotCompanyEmail,
          subject: `Day ${input.dayNumber} Check-In — ${input.showName} | StageGate`,
          body: emailBody,
        });

        // Mark the show_floor_checkin checkpoint as in_progress
        await dbConn
          .update(logisticsCheckpoints)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(
            eq(logisticsCheckpoints.workflowId, input.workflowId)
          );

        return { success: true };
      }),

    // P9: Prompt robot company for post-show pickup
    sendPickupPrompt: adminProcedure
      .input(z.object({
        workflowId: z.number(),
        robotCompanyEmail: z.string().email(),
        robotCompanyName: z.string(),
        showName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are the StageGate team. Write a post-show email to a robot company asking if they are ready for StageGate to pick up their robot, or if they will be shipping it back themselves. Mention StageGate can handle return logistics. Keep it friendly and professional. Sign as "The StageGate Team".`,
            },
            {
              role: "user",
              content: `Robot company: ${input.robotCompanyName}\nShow: ${input.showName}\n\nWrite the post-show pickup prompt email.`,
            },
          ],
        });

        const emailBody = typeof llmResponse.choices[0].message.content === "string"
          ? llmResponse.choices[0].message.content
          : `Hi ${input.robotCompanyName} team! ${input.showName} has wrapped up — great show! Please let us know if you are ready for StageGate to arrange pickup of your robot, or if you have other return logistics planned. We are here to help. — The StageGate Team`;

        await emailHelpers.sendEmail({
          to: input.robotCompanyEmail,
          subject: `Post-Show Pickup — ${input.showName} | StageGate`,
          body: emailBody,
        });

        // Update return_pickup checkpoint to in_progress
        await dbConn
          .update(logisticsCheckpoints)
          .set({ status: "in_progress", updatedAt: new Date() })
          .where(eq(logisticsCheckpoints.workflowId, input.workflowId));

        return { success: true };
      }),

    // Get all workflows with their checkpoints (admin overview)
    getAllWorkflows: adminProcedure
      .query(async () => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        const workflows = await dbConn
          .select()
          .from(logisticsWorkflows)
          .orderBy(desc(logisticsWorkflows.createdAt));
        if (workflows.length === 0) return [];
        const allCheckpoints = await dbConn
          .select()
          .from(logisticsCheckpoints)
          .where(inArray(logisticsCheckpoints.workflowId, workflows.map(w => w.id)))
          .orderBy(logisticsCheckpoints.dueAt);
        return workflows.map(workflow => ({
          workflow,
          checkpoints: allCheckpoints.filter(cp => cp.workflowId === workflow.id),
        }));
      }),

    // P5: AI summarizes meeting notes and updates prospect to committed
    summarizeMeetingAndHandoff: adminProcedure
      .input(z.object({
        prospectId: z.number(),
        meetingNotes: z.string().min(10),
        orderId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        // AI summarizes notes and extracts next steps
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a CRM assistant. Given raw meeting notes from a sales call with a robot company, extract: (1) a 2-3 sentence summary, (2) a list of 3-5 concrete next steps, (3) the robot company's primary concern or interest. Return JSON with keys: summary, nextSteps (array of strings), primaryInterest.`,
            },
            {
              role: "user",
              content: `Meeting notes:\n${input.meetingNotes}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "meeting_summary",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  nextSteps: { type: "array", items: { type: "string" } },
                  primaryInterest: { type: "string" },
                },
                required: ["summary", "nextSteps", "primaryInterest"],
                additionalProperties: false,
              },
            },
          },
        });

        let parsed: { summary: string; nextSteps: string[]; primaryInterest: string };
        try {
          const raw = typeof llmResponse.choices[0].message.content === "string"
            ? llmResponse.choices[0].message.content
            : JSON.stringify(llmResponse.choices[0].message.content);
          parsed = JSON.parse(raw);
        } catch {
          parsed = { summary: input.meetingNotes.slice(0, 200), nextSteps: ["Follow up with proposal"], primaryInterest: "Robotics activation services" };
        }

        // Update prospect status to committed
        await dbConn
          .update(prospectsTable)
          .set({ status: "converted", updatedAt: new Date() })
          .where(eq(prospectsTable.id, input.prospectId));

        // Log activity
        await dbConn.insert(prospectActivities).values({
          prospectId: input.prospectId,
          type: "meeting_completed",
          title: "Meeting Completed — Committed",
          description: parsed.summary,
          metadata: { nextSteps: parsed.nextSteps, primaryInterest: parsed.primaryInterest },
        });

        return { success: true, summary: parsed.summary, nextSteps: parsed.nextSteps, primaryInterest: parsed.primaryInterest };
      }),
  }),

  warehouse: router({
    listBays: adminProcedure.query(async () => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return dbConn.select().from(warehouseBays).orderBy(warehouseBays.name);
    }),

    upsertBay: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        sqft: z.number().int().positive(),
        pricePerSqftPerDay: z.string(),
        isAvailable: z.boolean(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        if (input.id) {
          await dbConn.update(warehouseBays)
            .set({ name: input.name, sqft: input.sqft, pricePerSqftPerDay: input.pricePerSqftPerDay, isAvailable: input.isAvailable, notes: input.notes ?? null })
            .where(eq(warehouseBays.id, input.id));
          return { success: true, id: input.id };
        } else {
          const [row] = await dbConn.insert(warehouseBays)
            .values({ name: input.name, sqft: input.sqft, pricePerSqftPerDay: input.pricePerSqftPerDay, isAvailable: input.isAvailable, notes: input.notes ?? null })
            .returning({ id: warehouseBays.id });
          return { success: true, id: row.id };
        }
      }),

    deleteBay: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await dbConn.delete(warehouseBays).where(eq(warehouseBays.id, input.id));
        return { success: true };
      }),

    getBayHistory: adminProcedure
      .input(z.object({ bayId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        return dbConn
          .select()
          .from(warehouseBayEvents)
          .where(eq(warehouseBayEvents.bayId, input.bayId))
          .orderBy(desc(warehouseBayEvents.createdAt));
      }),

    getOccupancyReport: adminProcedure.query(async () => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const events = await dbConn
        .select()
        .from(warehouseBayEvents)
        .orderBy(desc(warehouseBayEvents.createdAt));

      // Compute duration per occupied→released pair per bay
      const byBay: Record<number, typeof events> = {};
      events.forEach(e => {
        if (!byBay[e.bayId]) byBay[e.bayId] = [];
        byBay[e.bayId].push(e);
      });

      const report = Object.entries(byBay).map(([bayIdStr, evts]) => {
        const bayId = Number(bayIdStr);
        const bayName = evts[0]?.bayName ?? `Bay #${bayId}`;
        // Pair occupied→released events
        const sessions: { robotCompany: string | null; showName: string | null; occupiedAt: Date; releasedAt: Date | null; durationHours: number | null }[] = [];
        const occupiedEvents = evts.filter(e => e.event === "occupied").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        occupiedEvents.forEach(occ => {
          const rel = evts.find(e => e.event === "released" && e.createdAt > occ.createdAt);
          const durationMs = rel ? rel.createdAt.getTime() - occ.createdAt.getTime() : null;
          sessions.push({
            robotCompany: occ.robotCompany ?? null,
            showName: occ.showName ?? null,
            occupiedAt: occ.createdAt,
            releasedAt: rel?.createdAt ?? null,
            durationHours: durationMs ? Math.round(durationMs / 3600000 * 10) / 10 : null,
          });
        });
        return { bayId, bayName, sessions, totalEvents: evts.length };
      });

      return { report, allEvents: events };
    }),

    matchSpace: adminProcedure
      .input(z.object({ robotSqft: z.number().positive(), days: z.number().int().positive() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const bays = await dbConn.select().from(warehouseBays)
          .where(eq(warehouseBays.isAvailable, true))
          .orderBy(warehouseBays.sqft);
        // Find smallest bay that fits the robot
        const match = bays.find((b: typeof warehouseBays.$inferSelect) => b.sqft >= input.robotSqft);
        if (!match) return { match: null, estimatedTotal: null, message: "No available bay large enough for this robot" };
        const rate = parseFloat(match.pricePerSqftPerDay);
        const estimatedTotal = rate * input.robotSqft * input.days;
        return {
          match: { id: match.id, name: match.name, sqft: match.sqft, pricePerSqftPerDay: match.pricePerSqftPerDay },
          estimatedTotal: estimatedTotal.toFixed(2),
          message: `${match.name} (${match.sqft} sqft) @ $${rate}/sqft/day × ${input.robotSqft} sqft × ${input.days} days = $${estimatedTotal.toFixed(2)}`,
        };
      }),

    // ── Robot specs + customer fields ─────────────────────────────────────────
    updateRobotSpecs: adminProcedure
      .input(z.object({
        workflowId: z.number(),
        robotModel: z.string().optional(),
        robotSerialNumber: z.string().optional(),
        originCountry: z.string().optional(),
        robotWeightKg: z.string().optional(),
        robotLengthCm: z.string().optional(),
        robotWidthCm: z.string().optional(),
        robotHeightCm: z.string().optional(),
        declaredValueUsd: z.string().optional(),
        batteryType: z.string().optional(),
        batteryWh: z.string().optional(),
        hasWirelessRadio: z.boolean().optional(),
        hasCameras: z.boolean().optional(),
        requiresFccDocs: z.boolean().optional(),
        requiresFdaDocs: z.boolean().optional(),
        ataCarnetRequired: z.boolean().optional(),
        hsTariffCode: z.string().optional(),
        customerEmail: z.string().optional(),
        customerName: z.string().optional(),
        showEndDate: z.string().optional(),
        targetArrivalDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { workflowId, ...fields } = input;
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        for (const [k, v] of Object.entries(fields)) {
          if (v !== undefined) updateData[k] = k.endsWith("Date") ? new Date(v as string) : v;
        }
        await dbConn.update(logisticsWorkflows).set(updateData).where(eq(logisticsWorkflows.id, workflowId));
        return { success: true };
      }),

    // ── Generate tracking token for a workflow ────────────────────────────────
    generateTrackingToken: adminProcedure
      .input(z.object({ workflowId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const token = crypto.randomBytes(24).toString("hex");
        await dbConn.update(logisticsWorkflows)
          .set({ trackingToken: token, updatedAt: new Date() })
          .where(eq(logisticsWorkflows.id, input.workflowId));
        return { token };
      }),

    // ── Generate cost estimate for a workflow ─────────────────────────────────
    generateCostEstimate: adminProcedure
      .input(z.object({ workflowId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [wf] = await dbConn.select().from(logisticsWorkflows).where(eq(logisticsWorkflows.id, input.workflowId));
        if (!wf) throw new TRPCError({ code: "NOT_FOUND" });

        const declaredValue = parseFloat(wf.declaredValueUsd ?? "0");
        const weightKg = parseFloat(wf.robotWeightKg ?? "50");
        const originCountry = (wf.originCountry ?? "China").toLowerCase();
        const hasLithium = ["lithium-ion", "lithium-polymer"].includes((wf.batteryType ?? "").toLowerCase());

        const isAir = weightKg < 200; // heuristic: air for robots under 200 kg
        const insurancePct = 0.02; // 2% of declared value
        const airFreightBase = isAir ? Math.max(2500, weightKg * 18) : Math.max(4000, weightKg * 8);
        const customsBroker = hasLithium ? 600 : 350;
        const liveSupport = 4500; // per-show default

        const estimates: Array<{ phaseNumber: number; phaseName: string; costType: string; description: string; estimatedAmountUsd: number }> = [
          { phaseNumber: 1, phaseName: "Origin Country", costType: "crating", description: "Custom crate design & shock protection", estimatedAmountUsd: weightKg > 100 ? 3500 : 1200 },
          { phaseNumber: 1, phaseName: "Origin Country", costType: "export_prep", description: "Export docs, HS codes, serial registration", estimatedAmountUsd: 750 },
          { phaseNumber: 1, phaseName: "Origin Country", costType: "freight_forwarding", description: "Origin freight forwarder coordination", estimatedAmountUsd: 2000 },
          { phaseNumber: 1, phaseName: "Origin Country", costType: "insurance", description: `Cargo insurance (2% of $${declaredValue.toLocaleString()})`, estimatedAmountUsd: Math.max(500, declaredValue * insurancePct) },
          ...(wf.ataCarnetRequired ? [{ phaseNumber: 1, phaseName: "Origin Country", costType: "ata_carnet", description: "ATA Carnet bond & processing", estimatedAmountUsd: 700 }] : []),
          { phaseNumber: 2, phaseName: "International Freight", costType: isAir ? "air_freight" : "ocean_freight", description: `${isAir ? "Air" : "Ocean"} freight — ${originCountry} to Las Vegas`, estimatedAmountUsd: airFreightBase },
          ...(hasLithium ? [{ phaseNumber: 2, phaseName: "International Freight", costType: "lithium_surcharge", description: "Lithium battery DG surcharge", estimatedAmountUsd: 600 }] : []),
          { phaseNumber: 3, phaseName: "U.S. Customs", costType: "customs_brokerage", description: "Licensed customs broker — entry filing", estimatedAmountUsd: customsBroker },
          { phaseNumber: 3, phaseName: "U.S. Customs", costType: "customs_exam", description: "Customs exam & inspection (estimated)", estimatedAmountUsd: 800 },
          { phaseNumber: 3, phaseName: "U.S. Customs", costType: "airport_handling", description: "Airport cargo handling & drayage to terminal", estimatedAmountUsd: 500 },
          { phaseNumber: 4, phaseName: "Airport Recovery", costType: "airport_recovery", description: "StageGate airport pickup, intake & transport", estimatedAmountUsd: 1200 },
          { phaseNumber: 5, phaseName: "Warehouse & Storage", costType: "warehouse_storage", description: "Climate-controlled storage (estimated 14 days)", estimatedAmountUsd: 1400 },
          { phaseNumber: 5, phaseName: "Warehouse & Storage", costType: "charging_infrastructure", description: "Charging setup & battery monitoring", estimatedAmountUsd: 350 },
          { phaseNumber: 6, phaseName: "Staging & Activation", costType: "activation", description: "Full activation: mechanical, electrical, software, demo", estimatedAmountUsd: 4500 },
          { phaseNumber: 7, phaseName: "Show Delivery", costType: "drayage", description: "Convention center drayage & floor placement", estimatedAmountUsd: 2500 },
          { phaseNumber: 8, phaseName: "Live Show Support", costType: "live_support", description: "StageGate on-site support (per show)", estimatedAmountUsd: liveSupport },
          { phaseNumber: 9, phaseName: "Packdown & Storage", costType: "packdown", description: "Packdown, recrating & return coordination", estimatedAmountUsd: 1500 },
        ];

        // Clear existing estimated costs for this workflow, then insert fresh
        await dbConn.delete(logisticsCosts).where(eq(logisticsCosts.workflowId, input.workflowId));
        await dbConn.insert(logisticsCosts).values(
          estimates.map(e => ({ ...e, workflowId: input.workflowId, estimatedAmountUsd: e.estimatedAmountUsd.toFixed(2) }))
        );

        const total = estimates.reduce((s, e) => s + e.estimatedAmountUsd, 0);
        await dbConn.update(logisticsWorkflows)
          .set({ totalEstimatedCostUsd: total.toFixed(2), updatedAt: new Date() })
          .where(eq(logisticsWorkflows.id, input.workflowId));

        return { total: total.toFixed(2), lineItems: estimates.length };
      }),

    // ── Cost CRUD ─────────────────────────────────────────────────────────────
    getCosts: adminProcedure
      .input(z.object({ workflowId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn.select().from(logisticsCosts)
          .where(eq(logisticsCosts.workflowId, input.workflowId))
          .orderBy(logisticsCosts.phaseNumber);
      }),

    updateCostItem: adminProcedure
      .input(z.object({
        id: z.number(),
        actualAmountUsd: z.string().optional(),
        vendorName: z.string().optional(),
        invoiceNumber: z.string().optional(),
        notes: z.string().optional(),
        paidAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { id, paidAt, ...rest } = input;
        await dbConn.update(logisticsCosts)
          .set({ ...rest, ...(paidAt ? { paidAt: new Date(paidAt) } : {}), updatedAt: new Date() })
          .where(eq(logisticsCosts.id, id));
        return { success: true };
      }),

    acceptCostEstimate: adminProcedure
      .input(z.object({ workflowId: z.number(), acceptedBy: z.string() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        await dbConn.update(logisticsWorkflows)
          .set({ costEstimateAcceptedAt: new Date(), costEstimateAcceptedBy: input.acceptedBy, updatedAt: new Date() })
          .where(eq(logisticsWorkflows.id, input.workflowId));
        return { success: true };
      }),

    // ── Carrier tracking ──────────────────────────────────────────────────────
    addTrackingNumber: adminProcedure
      .input(z.object({
        workflowId: z.number(),
        checkpointId: z.number().optional(),
        carrier: z.enum(["dhl", "fedex", "ups", "manual", "other"]),
        trackingNumber: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        if (input.checkpointId) {
          await dbConn.update(logisticsCheckpoints)
            .set({ trackingNumber: input.trackingNumber, carrierName: input.carrier, updatedAt: new Date() })
            .where(eq(logisticsCheckpoints.id, input.checkpointId));
        }
        await dbConn.insert(carrierTrackingEvents).values({
          workflowId: input.workflowId,
          checkpointId: input.checkpointId ?? null,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          statusSummary: "Tracking number registered — awaiting first scan",
          polledAt: new Date(),
        });
        return { success: true };
      }),

    pollCarrierTracking: adminProcedure
      .input(z.object({ workflowId: z.number(), trackingNumber: z.string(), carrier: z.string() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        let statusSummary = "Status unavailable — check carrier site";
        let location = "";
        let eventCode = "";

        // DHL Tracking API (requires SHIPPING_DHL_API_KEY in env)
        if (input.carrier === "dhl" && process.env.SHIPPING_DHL_API_KEY) {
          try {
            const res = await fetch(
              `https://api.dhl.com/track/shipments?trackingNumber=${encodeURIComponent(input.trackingNumber)}`,
              { headers: { "DHL-API-Key": process.env.SHIPPING_DHL_API_KEY, Accept: "application/json" } }
            );
            if (res.ok) {
              const data = await res.json() as Record<string, unknown>;
              const shipments = (data as { shipments?: unknown[] }).shipments ?? [];
              const first = shipments[0] as Record<string, unknown> | undefined;
              const events = first ? (first.events as unknown[]) ?? [] : [];
              const latest = events[0] as Record<string, unknown> | undefined;
              statusSummary = (latest?.description as string) ?? "In transit";
              location = ((latest?.location as Record<string, unknown>)?.address as Record<string, unknown>)?.addressLocality as string ?? "";
              eventCode = (latest?.typeCode as string) ?? "";
            }
          } catch { /* fall through to manual */ }
        }

        // FedEx Tracking API (requires SHIPPING_FEDEX_API_KEY + SHIPPING_FEDEX_SECRET)
        if (input.carrier === "fedex" && process.env.SHIPPING_FEDEX_API_KEY) {
          try {
            const tokenRes = await fetch("https://apis.fedex.com/oauth/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `grant_type=client_credentials&client_id=${process.env.SHIPPING_FEDEX_API_KEY}&client_secret=${process.env.SHIPPING_FEDEX_SECRET}`,
            });
            const tokenData = await tokenRes.json() as { access_token?: string };
            if (tokenData.access_token) {
              const trackRes = await fetch("https://apis.fedex.com/track/v1/trackingnumbers", {
                method: "POST",
                headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ trackingInfo: [{ trackingNumberInfo: { trackingNumber: input.trackingNumber } }] }),
              });
              if (trackRes.ok) {
                const td = await trackRes.json() as Record<string, unknown>;
                const pkg = ((td.output as Record<string, unknown>)?.completeTrackResults as unknown[])?.[0] as Record<string, unknown> | undefined;
                const events = (pkg?.trackResults as Record<string, unknown>[])?.[0]?.dateAndTimes as unknown[];
                statusSummary = ((pkg?.trackResults as Record<string, unknown>[])?.[0]?.latestStatusDetail as Record<string, unknown>)?.description as string ?? "In transit";
                eventCode = ((pkg?.trackResults as Record<string, unknown>[])?.[0]?.latestStatusDetail as Record<string, unknown>)?.code as string ?? "";
              }
            }
          } catch { /* fall through */ }
        }

        await dbConn.insert(carrierTrackingEvents).values({
          workflowId: input.workflowId,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          statusSummary,
          location: location || null,
          eventCode: eventCode || null,
          eventTimestamp: new Date(),
          polledAt: new Date(),
        });

        return { statusSummary, location, eventCode };
      }),

    getTrackingHistory: adminProcedure
      .input(z.object({ workflowId: z.number() }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) return [];
        return dbConn.select().from(carrierTrackingEvents)
          .where(eq(carrierTrackingEvents.workflowId, input.workflowId))
          .orderBy(desc(carrierTrackingEvents.polledAt));
      }),

    // ── Public tracker (no auth — token-gated) ────────────────────────────────
    getPublicTracker: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [wf] = await dbConn.select().from(logisticsWorkflows)
          .where(eq(logisticsWorkflows.trackingToken, input.token));
        if (!wf) throw new TRPCError({ code: "NOT_FOUND", message: "Tracking link not found or expired" });
        const checkpoints = await dbConn.select().from(logisticsCheckpoints)
          .where(eq(logisticsCheckpoints.workflowId, wf.id))
          .orderBy(logisticsCheckpoints.dueAt);
        const costs = wf.costEstimateAcceptedAt
          ? await dbConn.select().from(logisticsCosts)
              .where(eq(logisticsCosts.workflowId, wf.id))
              .orderBy(logisticsCosts.phaseNumber)
          : [];
        const latestTracking = await dbConn.select().from(carrierTrackingEvents)
          .where(eq(carrierTrackingEvents.workflowId, wf.id))
          .orderBy(desc(carrierTrackingEvents.polledAt))
          .limit(5);
        return {
          workflow: {
            id: wf.id,
            robotCompany: wf.robotCompany,
            robotName: wf.robotName,
            robotModel: wf.robotModel,
            showName: wf.showName,
            showStartDate: wf.showStartDate,
            showEndDate: wf.showEndDate,
            targetArrivalDate: wf.targetArrivalDate,
            status: wf.status,
            totalEstimatedCostUsd: wf.totalEstimatedCostUsd,
            costEstimateAcceptedAt: wf.costEstimateAcceptedAt,
          },
          checkpoints: checkpoints.map(cp => ({
            id: cp.id,
            type: cp.type,
            phaseNumber: cp.phaseNumber,
            title: cp.title,
            status: cp.status,
            dueAt: cp.dueAt,
            completedAt: cp.completedAt,
            responsibleParty: cp.responsibleParty,
            customerVisibleNote: cp.customerVisibleNote,
          })),
          costs,
          latestTracking,
        };
      }),

    // ── Customer accepts cost estimate (public, token-gated) ─────────────────
    acceptCostEstimatePublic: publicProcedure
      .input(z.object({ token: z.string(), acceptedBy: z.string() }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const [wf] = await dbConn.select().from(logisticsWorkflows)
          .where(eq(logisticsWorkflows.trackingToken, input.token));
        if (!wf) throw new TRPCError({ code: "NOT_FOUND" });
        if (wf.costEstimateAcceptedAt) return { success: true, alreadyAccepted: true };
        await dbConn.update(logisticsWorkflows)
          .set({ costEstimateAcceptedAt: new Date(), costEstimateAcceptedBy: input.acceptedBy, updatedAt: new Date() })
          .where(eq(logisticsWorkflows.id, wf.id));
        return { success: true, alreadyAccepted: false };
      }),
  }),

  // ─── Calendar ───────────────────────────────────────────────────────────────────
  calendar: router({
    // Admin: list all events with optional filters
    list: adminProcedure
      .input(z.object({
        from: z.string().optional(), // ISO date string
        to: z.string().optional(),
        type: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const events = await db.listCalendarEvents({
          from: input.from ? new Date(input.from) : undefined,
          to: input.to ? new Date(input.to) : undefined,
          type: input.type,
        });
        return { events };
      }),

    // Admin: get single event by id
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const event = await db.getCalendarEventById(input.id);
        if (!event) throw new TRPCError({ code: "NOT_FOUND" });
        return { event };
      }),

    // Public: get event by share token (for prospect-facing share link)
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const event = await db.getCalendarEventByToken(input.token);
        if (!event || event.status === "cancelled") throw new TRPCError({ code: "NOT_FOUND" });
        // Return only public-safe fields
        return {
          event: {
            id: event.id,
            title: event.title,
            description: event.description,
            startAt: event.startAt,
            endAt: event.endAt,
            type: event.type,
            status: event.status,
            prospectName: event.prospectName,
            companyName: event.companyName,
          },
        };
      }),

    // Admin: create event
    create: adminProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startAt: z.string(), // ISO datetime
        endAt: z.string(),
        type: z.enum(["meeting", "demo", "call", "event", "follow_up"]).default("meeting"),
        status: z.enum(["scheduled", "confirmed", "cancelled", "completed"]).default("scheduled"),
        prospectId: z.number().optional(),
        prospectEmail: z.string().optional(),
        prospectName: z.string().optional(),
        companyName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const shareToken = crypto.randomBytes(24).toString("hex");
        const event = await db.createCalendarEvent({
          title: input.title,
          description: input.description ?? null,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          type: input.type,
          status: input.status,
          prospectId: input.prospectId ?? null,
          prospectEmail: input.prospectEmail ?? null,
          prospectName: input.prospectName ?? null,
          companyName: input.companyName ?? null,
          notes: input.notes ?? null,
          shareToken,
          createdBy: ctx.user.id,
        });
        return { event };
      }),

    // Admin: update event
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        startAt: z.string().optional(),
        endAt: z.string().optional(),
        type: z.enum(["meeting", "demo", "call", "event", "follow_up"]).optional(),
        status: z.enum(["scheduled", "confirmed", "cancelled", "completed"]).optional(),
        prospectEmail: z.string().optional(),
        prospectName: z.string().optional(),
        companyName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, startAt, endAt, ...rest } = input;
        const event = await db.updateCalendarEvent(id, {
          ...rest,
          ...(startAt ? { startAt: new Date(startAt) } : {}),
          ...(endAt ? { endAt: new Date(endAt) } : {}),
        });
        if (!event) throw new TRPCError({ code: "NOT_FOUND" });
        return { event };
      }),

    // Admin: delete event
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCalendarEvent(input.id);
        return { success: true };
      }),

    // Agent read access (cron-auth or admin)
    agentList: publicProcedure
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        apiKey: z.string().optional(), // simple shared secret for agent access
      }))
      .query(async ({ input, ctx }) => {
        const isAdmin = ctx.user?.role === "admin";
        const isCron = (ctx.user as { isCron?: boolean })?.isCron === true;
        const expectedApiKey = process.env.BUILT_IN_FORGE_API_KEY;
        const validApiKey = Boolean(expectedApiKey && input.apiKey && input.apiKey === expectedApiKey);
        if (!isAdmin && !isCron && !validApiKey) throw new TRPCError({ code: "FORBIDDEN" });
        const events = await db.listCalendarEvents({
          from: input.from ? new Date(input.from) : undefined,
          to: input.to ? new Date(input.to) : undefined,
        });
        return { events };
      }),

    // Admin: confirm event (scheduled → confirmed)
    confirm: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const event = await db.updateCalendarEvent(input.id, { status: "confirmed" });
        if (!event) throw new TRPCError({ code: "NOT_FOUND" });
        return { event };
      }),

    // Admin: reschedule event — update times, reset status, re-send emails
    reschedule: adminProcedure
      .input(z.object({
        id: z.number(),
        startAt: z.string(), // ISO datetime
        endAt: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getCalendarEventById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const startAt = new Date(input.startAt);
        const endAt = new Date(input.endAt);
        const event = await db.updateCalendarEvent(input.id, {
          startAt,
          endAt,
          status: "scheduled",
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        });
        if (!event) throw new TRPCError({ code: "NOT_FOUND" });

        const startDisplay = startAt.toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          dateStyle: "full",
          timeStyle: "short",
        });
        const shareUrl = event.shareToken
          ? `https://onstage.bot/calendar/${event.shareToken}`
          : "https://onstage.bot";

        const rescheduleHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#00E87A;">Meeting Rescheduled — ${event.companyName ?? event.title}</h2>
  <p>Your meeting has been rescheduled to a new time:</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>New Date &amp; Time</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
    <tr><td style="padding:0.5rem 0;color:#555;"><strong>Title</strong></td><td style="padding:0.5rem 0;">${event.title}</td></tr>
    ${event.notes ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Notes</strong></td><td style="padding:0.5rem 0;">${event.notes}</td></tr>` : ""}
  </table>
  <p><a href="${shareUrl}" style="display:inline-block;background:#00E87A;color:#1C1E22;padding:0.6rem 1.2rem;border-radius:0.25rem;text-decoration:none;font-weight:600;">View Updated Event →</a></p>
  <p style="color:#555;">Questions? Reply to this email or reach us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a>.</p>
  <hr style="border-color:#eee;">
  <p style="color:#999;font-size:12px;">StageGate — Robotics Activation Infrastructure • <a href="https://onstage.bot" style="color:#999;">onstage.bot</a></p>
</div>`;

        const subject = `[StageGate] Meeting Rescheduled: ${event.title} — ${startDisplay} PT`;
        const textBody = `Your meeting "${event.title}" has been rescheduled to ${startDisplay} PT.\n\nView updated event: ${shareUrl}\n\n— StageGate Team`;

        // Email Tommy
        try {
          await emailHelpers.sendEmail({
            to: "tom@starsupportinc.com",
            subject,
            body: textBody,
            htmlBody: rescheduleHtml,
          });
        } catch (e) { console.warn("[Calendar] Reschedule email to Tommy failed:", e); }

        // Email owner
        try {
          await emailHelpers.sendEmail({
            to: "ugobe07@gmail.com",
            subject,
            body: textBody,
            htmlBody: rescheduleHtml,
          });
        } catch (e) { console.warn("[Calendar] Reschedule email to owner failed:", e); }

        // Email prospect if we have their address
        if (event.prospectEmail) {
          const prospectRescheduleHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">Your Meeting Has Been Rescheduled</h2>
  <p>Hi ${event.prospectName ?? "there"},</p>
  <p>We've updated your meeting with the StageGate team to a new time:</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>New Date &amp; Time</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
    ${event.notes ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Notes</strong></td><td style="padding:0.5rem 0;">${event.notes}</td></tr>` : ""}
  </table>
  <p><a href="${shareUrl}" style="display:inline-block;background:#00E87A;color:#1C1E22;padding:0.6rem 1.2rem;border-radius:0.25rem;text-decoration:none;font-weight:600;">View Updated Event →</a></p>
  <p style="color:#555;">If this time no longer works, reply to this email or reach us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a>.</p>
  <hr style="border-color:#eee;">
  <p style="color:#999;font-size:12px;">StageGate — Robotics Activation Infrastructure • <a href="https://onstage.bot" style="color:#999;">onstage.bot</a></p>
</div>`;
          try {
            await emailHelpers.sendEmail({
              to: event.prospectEmail,
              subject: `Your Meeting with StageGate Has Been Rescheduled — ${startDisplay} PT`,
              body: `Hi ${event.prospectName ?? "there"},\n\nYour meeting with StageGate has been rescheduled to ${startDisplay} PT.\n\nView updated event: ${shareUrl}\n\n— StageGate Team\nhello@onstage.bot`,
              htmlBody: prospectRescheduleHtml,
            });
          } catch (e) { console.warn("[Calendar] Reschedule email to prospect failed:", e); }
        }

        return { event };
      }),

    // Admin: cancel event — set status=cancelled, send cancellation emails
    cancel: adminProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().optional(), // optional cancellation reason
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getCalendarEventById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        if (existing.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Event is already cancelled" });

        const event = await db.updateCalendarEvent(input.id, { status: "cancelled" });
        if (!event) throw new TRPCError({ code: "NOT_FOUND" });

        const shareUrl = event.shareToken
          ? `https://onstage.bot/calendar/${event.shareToken}`
          : "https://onstage.bot";

        const startDisplay = new Date(event.startAt as Date).toLocaleString("en-US", {
          timeZone: "America/Los_Angeles",
          dateStyle: "full",
          timeStyle: "short",
        });

        const cancelHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#ef4444;">Meeting Cancelled — ${event.companyName ?? event.title}</h2>
  <p>The following meeting has been cancelled:</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>Title</strong></td><td style="padding:0.5rem 0;">${event.title}</td></tr>
    <tr><td style="padding:0.5rem 0;color:#555;"><strong>Was Scheduled</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
    ${input.reason ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Reason</strong></td><td style="padding:0.5rem 0;">${input.reason}</td></tr>` : ""}
  </table>
  <p style="color:#555;">Questions? Reply to this email or reach us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a>.</p>
  <hr style="border-color:#eee;">
  <p style="color:#999;font-size:12px;">StageGate — Robotics Activation Infrastructure • <a href="https://onstage.bot" style="color:#999;">onstage.bot</a></p>
</div>`;

        const subject = `[StageGate] Meeting Cancelled: ${event.title}`;
        const textBody = `The meeting "${event.title}" scheduled for ${startDisplay} PT has been cancelled.${input.reason ? `\n\nReason: ${input.reason}` : ""}\n\n— StageGate Team\nhello@onstage.bot`;

        // Email Tommy
        try {
          await emailHelpers.sendEmail({ to: "tom@starsupportinc.com", subject, body: textBody, htmlBody: cancelHtml });
        } catch (e) { console.warn("[Calendar] Cancel email to Tommy failed:", e); }

        // Email owner
        try {
          await emailHelpers.sendEmail({ to: "ugobe07@gmail.com", subject, body: textBody, htmlBody: cancelHtml });
        } catch (e) { console.warn("[Calendar] Cancel email to owner failed:", e); }

        // Email prospect if we have their address
        if (event.prospectEmail) {
          const prospectCancelHtml = `
<div style="font-family:sans-serif;max-width:600px;">
  <h2 style="color:#1a1a1a;">Your Meeting Has Been Cancelled</h2>
  <p>Hi ${event.prospectName ?? "there"},</p>
  <p>We regret to inform you that the following meeting has been cancelled:</p>
  <table style="border-collapse:collapse;width:100%;margin:1rem 0;">
    <tr><td style="padding:0.5rem 0;color:#555;width:120px;"><strong>Meeting</strong></td><td style="padding:0.5rem 0;">${event.title}</td></tr>
    <tr><td style="padding:0.5rem 0;color:#555;"><strong>Was Scheduled</strong></td><td style="padding:0.5rem 0;">${startDisplay} (Pacific Time)</td></tr>
    ${input.reason ? `<tr><td style="padding:0.5rem 0;color:#555;"><strong>Reason</strong></td><td style="padding:0.5rem 0;">${input.reason}</td></tr>` : ""}
  </table>
  <p style="color:#555;">We apologize for any inconvenience. Please reply to this email or contact us at <a href="mailto:hello@onstage.bot">hello@onstage.bot</a> to reschedule.</p>
  <hr style="border-color:#eee;">
  <p style="color:#999;font-size:12px;">StageGate — Robotics Activation Infrastructure • <a href="https://onstage.bot" style="color:#999;">onstage.bot</a></p>
</div>`;
          try {
            await emailHelpers.sendEmail({
              to: event.prospectEmail,
              subject: `Your Meeting with StageGate Has Been Cancelled`,
              body: `Hi ${event.prospectName ?? "there"},\n\nYour meeting "${event.title}" scheduled for ${startDisplay} PT has been cancelled.${input.reason ? `\n\nReason: ${input.reason}` : ""}\n\nPlease reply to reschedule.\n\n— StageGate Team\nhello@onstage.bot`,
              htmlBody: prospectCancelHtml,
            });
          } catch (e) { console.warn("[Calendar] Cancel email to prospect failed:", e); }
        }

        return { event };
      }),

    // Admin: count of upcoming scheduled/confirmed events (for sidebar badge)
    upcomingCount: adminProcedure
      .query(async () => {
        const now = new Date();
        const events = await db.listCalendarEvents({ from: now });
        const count = events.filter(e => e.status === "scheduled" || e.status === "confirmed").length;
        return { count };
      }),

    // Agent write access (cron-auth or admin)
    agentUpsert: publicProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        startAt: z.string(),
        endAt: z.string(),
        type: z.enum(["meeting", "demo", "call", "event", "follow_up"]).default("meeting"),
        status: z.enum(["scheduled", "confirmed", "cancelled", "completed"]).default("scheduled"),
        prospectEmail: z.string().optional(),
        prospectName: z.string().optional(),
        companyName: z.string().optional(),
        notes: z.string().optional(),
        apiKey: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ctx.user?.role === "admin";
        const isCron = (ctx.user as { isCron?: boolean })?.isCron === true;
        const validApiKey = input.apiKey === process.env.BUILT_IN_FORGE_API_KEY;
        if (!isAdmin && !isCron && !validApiKey) throw new TRPCError({ code: "FORBIDDEN" });
        const shareToken = crypto.randomBytes(24).toString("hex");
        const event = await db.createCalendarEvent({
          title: input.title,
          description: input.description ?? null,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          type: input.type,
          status: input.status,
          prospectEmail: input.prospectEmail ?? null,
          prospectName: input.prospectName ?? null,
          companyName: input.companyName ?? null,
          notes: input.notes ?? null,
          shareToken,
          createdBy: null,
        });
        return { event };
      }),
  }),
});
export type AppRouter = typeof appRouter;