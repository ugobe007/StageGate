import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import * as workflows from "./workflows";
import * as emailHelpers from "./email";
import { eq, desc, count, sql, inArray } from "drizzle-orm";
import { draftEmails, prospectResearch, prospectActivities, bookingRequests, prospects as prospectsTable, serviceOrders, emailTrackingEvents, orderItems, schedulingSlots, salesAgentConversations, salesAgentRuns, vendors, emailThreads, logisticsWorkflows, logisticsCheckpoints, warehouseBays, warehouseBayEvents, tradeShows, services as servicesTable, logisticsPartners, xbotProjects, agentRuns, outreachCampaigns } from "../drizzle/schema";
import { getDb } from "./db";
import { researchProspect } from "./research-agent";

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
        // Fetch engagement counts for all prospects in one query
        const engagementRows = await dbConn
          .select({
            prospectId: emailTrackingEvents.prospectId,
            opens: sql<number>`SUM(CASE WHEN ${emailTrackingEvents.eventType} = 'email.opened' THEN 1 ELSE 0 END)`.as('opens'),
            clicks: sql<number>`SUM(CASE WHEN ${emailTrackingEvents.eventType} = 'email.clicked' THEN 1 ELSE 0 END)`.as('clicks'),
          })
          .from(emailTrackingEvents)
          .groupBy(emailTrackingEvents.prospectId);
        // Build a lookup map
        const engMap = new Map<number, { opens: number; clicks: number }>();
        for (const row of engagementRows) {
          if (row.prospectId !== null) {
            engMap.set(row.prospectId, { opens: Number(row.opens), clicks: Number(row.clicks) });
          }
        }
        // Merge engagement score into each prospect
        const withScore = items.map(p => {
          const eng = engMap.get(p.id) ?? { opens: 0, clicks: 0 };
          return { ...p, engagementScore: eng.opens * 1 + eng.clicks * 2, opens: eng.opens, clicks: eng.clicks };
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

    // AI-generated company brief + draft outreach message
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
              content: `You are a sharp B2B sales intelligence assistant for StageGate — a robotics activation company that handles robot receiving, unpacking, testing, staging, and delivery at trade shows. You write concise, factual, and actionable briefs about robotics companies. Be specific. No fluff. No filler sentences. Output valid JSON only.`,
            },
            {
              role: "user",
              content: `Write a CRM brief for this robotics company:\n\nCompany: ${prospect.company}\nRobot: ${robot}\n${country}${contact}Shows: ${showList}\n\nReturn JSON with exactly these fields:\n- summary: 2 sentences max. What the company does and what robot they're bringing.\n- showIntel: 1 sentence per show. What they likely need at each event.\n- whyStageGate: 1 sentence. Why StageGate is the right fit.\n- draftMessage: A short outreach email (4-6 sentences). Personalized to their robot and show. End with a soft CTA to schedule a StageGate intake call. Sign off as the StageGate team. No subject line.`,
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
                  draftMessage: { type: "string" },
                },
                required: ["summary", "showIntel", "whyStageGate", "draftMessage"],
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
          draftMessage: string;
        };

        return { brief, prospect };
      }),

    // Regenerate just the draft message with optional tone
    regenerateDraft: adminProcedure
      .input(z.object({
        id: z.number(),
        tone: z.enum(["professional", "friendly", "concise", "bold"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const prospect = await db.getProspectById(input.id);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

        const shows = (prospect.shows as string[] | null) ?? [];
        const showList = shows.length ? shows.join(", ") : "upcoming trade shows";
        const robot = [prospect.robotName, prospect.robotType].filter(Boolean).join(" — ") || "robot";
        const toneInstruction = input.tone
          ? `Tone: ${input.tone}. `
          : "Tone: professional but warm. ";

        const isPartnerRegen = (prospect as Record<string, unknown>).outreachAngle === "partner" || ((prospect as Record<string, unknown>).vendorType && (prospect as Record<string, unknown>).vendorType !== "robot_oem");
        const vendorLabelRegen = (prospect as Record<string, unknown>).vendorType ? String((prospect as Record<string, unknown>).vendorType).replace(/_/g, " ") : "trade show vendor";

        const regenSystemPrompt = isPartnerRegen
          ? `You are a B2B sales writer for StageGate — the robotics technical operations layer for trade shows. StageGate is NOT a competitor to exhibit houses, freight companies, AV firms, or venues. We plug into the workflow of ${vendorLabelRegen} companies to handle robot-specific complexity. Write short, punchy partnership outreach. No fluff. ${toneInstruction}Output plain text only, no subject line, no JSON wrapper.`
          : `You are a B2B sales writer for StageGate — a robotics activation company that handles robot receiving, unpacking, testing, staging, and delivery at trade shows. Write short, punchy outreach emails. No fluff. ${toneInstruction}Output plain text only, no subject line, no JSON wrapper.`;

        const regenUserPrompt = isPartnerRegen
          ? `Write a fresh partnership outreach email for this prospect:\n\nCompany: ${prospect.company} (${vendorLabelRegen})\nShows: ${showList}\n${prospect.contactName ? `Contact: ${prospect.contactName}` : ""}\n\nRequirements:\n- 4-6 sentences\n- Position StageGate as the robotics technical operations layer that plugs into their workflow\n- Mention that their robotics clients need specialist robot handling they are not equipped for\n- End with a soft CTA to connect and explore a referral/subcontractor relationship\n- Sign off as the StageGate team\n- No subject line`
          : `Write a fresh outreach email for this prospect:\n\nCompany: ${prospect.company}\nRobot: ${robot}\nShows: ${showList}\n${prospect.contactName ? `Contact: ${prospect.contactName}` : ""}\n\nRequirements:\n- 4-6 sentences\n- Reference their specific robot and show\n- Mention one concrete StageGate service (receiving, staging, or delivery)\n- End with a soft CTA to schedule a StageGate intake call\n- Sign off as the StageGate team\n- No subject line`;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: regenSystemPrompt },
            { role: "user", content: regenUserPrompt },
          ],
        });

        const draft = result.choices?.[0]?.message?.content ?? "";
        const text = typeof draft === "string" ? draft.trim() : JSON.stringify(draft);
        return { draft: text };
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
    markReplied: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateProspect(input.id, { status: "responded", repliedAt: new Date() });
        return { success: true };
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
            if (!prospect.contactEmail) { results.push({ id: prospectId, success: false, company: prospect.company, error: "No email address" }); continue; }
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
        followUpDays: z.number().default(3),
      }))
      .mutation(async ({ input, ctx }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const prospect = await db.getProspectById(input.prospectId);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

        // 1. Save draft email record
        await dbConn.insert(draftEmails).values({
          prospectId: input.prospectId,
          subject: input.subject,
          body: input.body,
          status: "sent",
          sentAt: new Date(),
        });

        // 2. Log activity
        await dbConn.insert(prospectActivities).values({
          prospectId: input.prospectId,
          type: "email_sent",
          title: `Email sent: ${input.subject}`,
          description: input.body.slice(0, 200) + (input.body.length > 200 ? "..." : ""),
          metadata: { subject: input.subject, sentBy: ctx.user?.name ?? "admin" },
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
          content: `Email sent to ${prospect.company} (${prospect.contactName ?? prospect.contactEmail ?? "no contact"}).\n\nSubject: ${input.subject}\n\nFollow-up scheduled in ${input.followUpDays} days.`,
        });

        return { success: true };
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
    runMigration: adminProcedure.mutation(async ({ ctx }) => {
      return workflows.withAgentRun(
        { agentName: "MySQL→Supabase Migration", triggeredBy: ctx.user?.name ?? "admin", inputSummary: "Full sync: prospects, trade_shows, services, logistics_partners, xbot_projects, users" },
        async () => {
          const mysql = await import("mysql2/promise");
          const pg = await import("pg");
          const MYSQL_URL = process.env.DATABASE_URL!;
          const PG_URL = process.env.SUPABASE_DATABASE_URL!;
          if (!PG_URL) throw new Error("SUPABASE_DATABASE_URL not set");

          const myConn = await (mysql as any).default.createConnection({ uri: MYSQL_URL, ssl: { rejectUnauthorized: false } });
          const pool = new (pg as any).default.Pool({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
          const client = await pool.connect();
          const migrated: Record<string, number> = {};

          const jdump = (v: unknown) => {
            if (v === null || v === undefined) return null;
            if (typeof v === "string") { try { JSON.parse(v); return v; } catch { return JSON.stringify(v); } }
            return JSON.stringify(v);
          };
          const ts = (v: unknown) => (v instanceof Date ? v : v ? new Date(v as string) : null);
          const now = () => new Date();

          try {
            await client.query("BEGIN");

            // users
            const [users] = await myConn.execute("SELECT * FROM users");
            for (const r of users as Record<string, unknown>[]) {
              await client.query(`INSERT INTO users (id,"openId",name,email,"loginMethod",role,"createdAt","updatedAt","lastSignedIn") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT ("openId") DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role,"lastSignedIn"=EXCLUDED."lastSignedIn","updatedAt"=EXCLUDED."updatedAt"`,
                [r.id,r.openId,r.name,r.email,r.loginMethod,r.role||'user',ts(r.createdAt)||now(),ts(r.updatedAt)||now(),ts(r.lastSignedIn)||now()]);
            }
            await client.query(`SELECT setval(pg_get_serial_sequence('users','id'),MAX(id)) FROM users`);
            migrated.users = (users as unknown[]).length;

            // trade_shows
            const [shows] = await myConn.execute("SELECT * FROM trade_shows");
            for (const r of shows as Record<string, unknown>[]) {
              await client.query(`INSERT INTO trade_shows (id,name,location,venue,city,"startDate","endDate",website,"exhibitorListUrl",status,description,"roboticsRelevance","estimatedExhibitors","roboticsExhibitors","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status`,
                [r.id,r.name,r.location,r.venue,r.city,ts(r.startDate),ts(r.endDate),r.website,r.exhibitorListUrl,r.status||'upcoming',r.description,r.roboticsRelevance||3,r.estimatedExhibitors,r.roboticsExhibitors,ts(r.createdAt)||now()]);
            }
            await client.query(`SELECT setval(pg_get_serial_sequence('trade_shows','id'),MAX(id)) FROM trade_shows`);
            migrated.trade_shows = (shows as unknown[]).length;

            // services
            const [services] = await myConn.execute("SELECT * FROM services");
            for (const r of services as Record<string, unknown>[]) {
              await client.query(`INSERT INTO services (id,slug,name,brand,category,description,"basePrice","priceUnit","pricingTiers",phase,"isActive","sortOrder") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,"isActive"=EXCLUDED."isActive"`,
                [r.id,r.slug,r.name,r.brand||'stagegate',r.category||'',r.description,r.basePrice,r.priceUnit,r.pricingTiers,r.phase||'phase1',Boolean(r.isActive),r.sortOrder||0]);
            }
            await client.query(`SELECT setval(pg_get_serial_sequence('services','id'),MAX(id)) FROM services`);
            migrated.services = (services as unknown[]).length;

            // logistics_partners
            const [partners] = await myConn.execute("SELECT * FROM logistics_partners");
            for (const r of partners as Record<string, unknown>[]) {
              await client.query(`INSERT INTO logistics_partners (id,name,"serviceType","contactName","contactEmail","contactPhone",website,city,notes,"isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name`,
                [r.id,r.name,r.serviceType||'',r.contactName,r.contactEmail,r.contactPhone,r.website,r.city,r.notes,Boolean(r.isActive),ts(r.createdAt)||now(),ts(r.updatedAt)||now()]);
            }
            await client.query(`SELECT setval(pg_get_serial_sequence('logistics_partners','id'),MAX(id)) FROM logistics_partners`);
            migrated.logistics_partners = (partners as unknown[]).length;

            // prospects
            const [prospects] = await myConn.execute("SELECT * FROM prospects");
            for (const r of prospects as Record<string, unknown>[]) {
              await client.query(`INSERT INTO prospects (id,company,"robotName","robotType","hqCountry","attendsLasVegas","contactName","contactEmail","contactTitle","contactDept",website,shows,notes,status,"videoMessageUrl","scheduledCallAt","contactLinkedIn","emailConfidence","repliedAt","followUpDate","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"updatedAt"=EXCLUDED."updatedAt"`,
                [r.id,r.company,r.robotName,r.robotType,r.hqCountry,r.attendsLasVegas||'unknown',r.contactName,r.contactEmail,r.contactTitle,r.contactDept,r.website,jdump(r.shows)||'[]',r.notes,r.status||'new',r.videoMessageUrl,ts(r.scheduledCallAt),r.contactLinkedIn,r.emailConfidence||'low',ts(r.repliedAt),ts(r.followUpDate),ts(r.createdAt)||now(),ts(r.updatedAt)||now()]);
            }
            await client.query(`SELECT setval(pg_get_serial_sequence('prospects','id'),MAX(id)) FROM prospects`);
            migrated.prospects = (prospects as unknown[]).length;

            // xbot_projects
            const [xbots] = await myConn.execute("SELECT * FROM xbot_projects");
            for (const r of xbots as Record<string, unknown>[]) {
              await client.query(`INSERT INTO xbot_projects (id,"sessionToken","userId","robotMake","robotModel","robotDimensions","robotWeight","powerRequirements","specialHandling","originCountry","originCity","shippingMethod","flightVesselNumber",eta,"portOfEntry","hsCode","ataCarnet","customsBroker","customsBrokerName","showId","boothNumber","setupDate","teardownDate","selectedServices","groundTransportProvider",contacts,"currentStep",status,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26::jsonb,$27,$28,$29,$30) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"updatedAt"=EXCLUDED."updatedAt"`,
                [r.id,r.sessionToken,r.userId,r.robotMake,r.robotModel,r.robotDimensions,r.robotWeight,r.powerRequirements,r.specialHandling,r.originCountry,r.originCity,r.shippingMethod,r.flightVesselNumber,ts(r.eta),r.portOfEntry,r.hsCode,Boolean(r.ataCarnet),r.customsBroker||'tbd',r.customsBrokerName,r.showId,r.boothNumber,ts(r.setupDate),ts(r.teardownDate),jdump(r.selectedServices),r.groundTransportProvider,jdump(r.contacts),r.currentStep||1,r.status||'draft',ts(r.createdAt)||now(),ts(r.updatedAt)||now()]);
            }
            await client.query(`SELECT setval(pg_get_serial_sequence('xbot_projects','id'),MAX(id)) FROM xbot_projects`);
            migrated.xbot_projects = (xbots as unknown[]).length;

            await client.query("COMMIT");
            await notifyOwner({ title: "✅ Migration Complete", content: `MySQL→Supabase sync finished.\n\n${Object.entries(migrated).map(([k,v]) => `${k}: ${v} rows`).join('\n')}` }).catch(() => {});
            return { success: true, migrated };
          } catch (err) {
            await client.query("ROLLBACK");
            throw err;
          } finally {
            client.release();
            await pool.end();
            await myConn.end();
          }
        }
      );
    }),
    // ─── Outreach / Draft Email procedures ──────────────────────────────────

    // Generate AI draft emails for all prospects that don't have a pending draft
    generateDrafts: adminProcedure
      .input(z.object({ prospectIds: z.array(z.number()).optional() }))
      .mutation(async ({ input, ctx }) => {
        return workflows.withAgentRun(
          { agentName: "Draft Email Generator", triggeredBy: ctx.user?.name ?? "admin", inputSummary: input.prospectIds ? `${input.prospectIds.length} selected prospects` : "all prospects" },
          async () => {
            const allProspects = await db.listProspects();
            const targets = input.prospectIds
              ? allProspects.filter((p: { id: number }) => input.prospectIds!.includes(p.id))
              : allProspects;

            const upcomingShows = await workflows.getUpcomingShows();
            const showNames = upcomingShows.map((s: { name: string }) => s.name).join(", ") || "upcoming trade shows";

            let generated = 0;
            for (const prospect of targets as Array<{ id: number; company: string; contactName: string | null; contactEmail: string | null; robotName: string | null; robotType: string | null; shows: string[] | null; notes: string | null; outreachAngle?: string | null; vendorType?: string | null }>) {
              if (!prospect.contactEmail) continue;

              // Check if a pending/approved draft already exists
              const existing = await emailHelpers.getDraftsForProspect(prospect.id);
              const hasPending = existing.some((d: { status: string }) => d.status === "pending" || d.status === "approved");
              if (hasPending) continue;

              const showContext = prospect.shows?.length ? `They service trade shows including: ${prospect.shows.join(", ")}.` : "";
              const robotContext = prospect.robotName ? `Their robot is the ${prospect.robotName}${prospect.robotType ? ` (${prospect.robotType})` : ""}.` : "";
              const isPartner = (prospect.outreachAngle === "partner") || (prospect.vendorType && prospect.vendorType !== "robot_oem");
              const vendorLabel = prospect.vendorType ? prospect.vendorType.replace(/_/g, " ") : "trade show vendor";

              // ── Partner pitch (exhibit houses, freight, AV, venues) ──────────────
              // ── Customer pitch (robot OEMs) ──────────────────────────────────────
              const systemPrompt = isPartner
                ? `You are an outreach specialist for StageGate — the robotics technical operations layer for trade shows. StageGate is NOT a competitor to exhibit houses, freight companies, AV firms, or venues. We are a specialist subcontractor that handles robot-specific logistics: receiving, customs, staging, testing, and on-site robot support. We plug into the existing workflow of ${vendorLabel} companies to handle the robot-specific complexity they are not equipped for. Write concise, professional B2B partnership emails. Under 150 words. No fluff. Sign off as "Bob Christopher, StageGate".`
                : `You are an outreach specialist for StageGate, the first warehouse, staging, and activation service built for robotics companies exhibiting at trade shows. Write concise, professional cold outreach emails. Be specific about the company's robot. Keep emails under 150 words. No fluff, no marketing speak. Sign off as "Bob Christopher, StageGate".`;

              const userPrompt = isPartner
                ? `Write a cold outreach email to ${prospect.contactName ?? "the team"} at ${prospect.company} (a ${vendorLabel} company). ${showContext} StageGate is the robotics technical operations layer that plugs into your workflow — we handle all robot-specific logistics (receiving, customs, staging, testing, on-site support) so your team can focus on what you do best. We want to introduce ourselves as a specialist partner for your robotics clients at ${showNames}. Subject line and email body only. Format: SUBJECT: ...\n\nBODY: ...`
                : `Write a cold outreach email to ${prospect.contactName ?? "the team"} at ${prospect.company}. ${robotContext} ${showContext} We are reaching out because StageGate handles all trade show logistics for robotics companies — shipping, customs, warehousing, booth setup, and on-site support — at ${showNames}. Subject line and email body only. Format: SUBJECT: ...\n\nBODY: ...`;

              const llmRes = await invokeLLM({
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
              });
              const rawContent = llmRes.choices?.[0]?.message?.content;
              const content: string = typeof rawContent === "string" ? rawContent : "";
              const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
              const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

              const subject = subjectMatch?.[1]?.trim() ?? (isPartner ? `Partnership Opportunity — StageGate × ${prospect.company}` : `Trade Show Logistics for ${prospect.company}`);
              const body = bodyMatch?.[1]?.trim() ?? content.trim();
              const reasoning = isPartner
                ? `${prospect.company} is a ${vendorLabel} partner prospect. Pitch: robotics technical operations layer. ${showContext}`.trim()
                : `${prospect.company} matched because: ${robotContext} ${showContext} Outreach for ${showNames}.`.trim();

              await emailHelpers.createDraft({ prospectId: prospect.id, subject, body, agentReasoning: reasoning });
              generated++;
            }

            return { generated, total: targets.length };
          }
        );
      }),

    // Get all drafts with their prospect data
    getDrafts: adminProcedure
      .input(z.object({ statuses: z.array(z.string()).optional() }))
      .query(async ({ input }) => {
        return emailHelpers.getDraftsWithProspects(input.statuses ?? ["pending", "approved"]);
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
        const drafts = await emailHelpers.getDraftsWithProspects(["pending", "approved"]);
        const entry = drafts.find((d: { draft: { id: number } }) => d.draft.id === input.draftId);
        if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found" });
        if (!entry.prospect.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Prospect has no email address" });

        const sendResult = await emailHelpers.sendEmail({
          to: entry.prospect.contactEmail,
          subject: entry.draft.subject,
          body: entry.draft.body,
        });

        await emailHelpers.markDraftSent(entry.draft.id, sendResult?.id);
        await db.updateProspectStatus(entry.prospect.id, "contacted");

        return { success: true, sentTo: entry.prospect.contactEmail, messageId: sendResult?.id };
      }),

    // Bulk send multiple approved drafts
    bulkSendDrafts: adminProcedure
      .input(z.object({ draftIds: z.array(z.number()) }))
      .mutation(async ({ input }) => {
        const drafts = await emailHelpers.getDraftsWithProspects(["pending", "approved"]);
        const targets = drafts.filter((d: { draft: { id: number } }) => input.draftIds.includes(d.draft.id));

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const entry of targets) {
          if (!entry.prospect.contactEmail) { failed++; continue; }
          try {
            const sendResult = await emailHelpers.sendEmail({
              to: entry.prospect.contactEmail,
              subject: entry.draft.subject,
              body: entry.draft.body,
            });
            await emailHelpers.markDraftSent(entry.draft.id, sendResult?.id);
            await db.updateProspectStatus(entry.prospect.id, "contacted");
            sent++;
          } catch (e: unknown) {
            failed++;
            errors.push(`${entry.prospect.company}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return { sent, failed, errors };
      }),

    getDraftCount: adminProcedure.query(async () => {
      const pgDb = await getDb();
      if (!pgDb) return { pending: 0, approved: 0, sent: 0, lastSentAt: null };
      const [pendingRows, approvedRows, sentRows, lastSentRows] = await Promise.all([
        pgDb.select({ n: count() }).from(draftEmails).where(eq(draftEmails.status, "pending")),
        pgDb.select({ n: count() }).from(draftEmails).where(eq(draftEmails.status, "approved")),
        pgDb.select({ n: count() }).from(draftEmails).where(eq(draftEmails.status, "sent")),
        pgDb.select({ sentAt: draftEmails.sentAt }).from(draftEmails)
          .where(eq(draftEmails.status, "sent"))
          .orderBy(desc(draftEmails.sentAt))
          .limit(1),
      ]);
      return {
        pending: Number(pendingRows[0]?.n ?? 0),
        approved: Number(approvedRows[0]?.n ?? 0),
        sent: Number(sentRows[0]?.n ?? 0),
        lastSentAt: lastSentRows[0]?.sentAt ?? null,
      };
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
      const [users, orders, demos, quotes, leads, prospects, tradeShowRows, serviceRows, logisticsPartnerRows, xbotRows, agentRunRows, outreachRows, convRows] = await Promise.all([
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
      };
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
        <div class="logo">Stage<span>Gate</span></div>
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
        <div class="logo">Stage<span>Gate</span></div>
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

    // Admin: manually trigger Frank to send to a specific prospect
    manualSend: adminProcedure
      .input(z.object({ prospectId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const res = await fetch(
          `http://localhost:${process.env.PORT ?? 3000}/api/scheduled/sales-agent-manual`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Pass admin session cookie so the handler can authenticate
              Cookie: ctx.req.headers.cookie ?? "",
            },
            body: JSON.stringify({ prospectId: input.prospectId }),
          }
        );
        if (!res.ok) {
          const err = await res.text();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err });
        }
        return res.json() as Promise<{ ok: boolean; subject: string; messageId: string | null; nextStage: string }>;
      }),

    // Admin: preview a Frank email (LLM draft, not sent)
    previewEmail: adminProcedure
      .input(z.object({
        prospectId: z.number(),
        stage: z.enum(["discovery", "intro_sent", "followup_1", "followup_2", "robot_guild"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

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

        // Call the preview endpoint
        const res = await fetch(
          `http://localhost:${process.env.PORT ?? 3000}/api/scheduled/sales-agent-preview`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY ?? ""}`,
              "x-heartbeat-cron": "true",
            },
            body: JSON.stringify({ prospectId: input.prospectId, stage }),
          }
        );
        if (!res.ok) {
          const err = await res.text();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err });
        }
        return res.json() as Promise<{ subject: string; body: string; stage: string; nextStage: string }>;
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
                person_titles: ["CEO", "CTO", "COO", "VP", "Director", "Head of", "Chief", "President", "Founder", "Co-Founder", "Business Development", "Sales"],
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
          suggestions.push(`support@${domain}`, `info@${domain}`, `hello@${domain}`);
          if (bestName) {
            const parts = bestName.toLowerCase().split(" ");
            const first = parts[0] ?? "";
            const last = parts[parts.length - 1] ?? "";
            if (first && last) {
              suggestions.push(`${first}@${domain}`, `${last}@${domain}`, `${first}.${last}@${domain}`, `${first[0] ?? ""}${last}@${domain}`);
            }
          }
        }

        // Step 4: Update prospect if we found a better email
        if (bestEmail && bestEmail !== prospect.contactEmail) {
          await dbConn.update(prospectsTable).set({
            contactEmail: bestEmail,
            emailConfidence: bestConfidence,
            contactName: bestName ?? prospect.contactName,
            contactTitle: bestTitle ?? prospect.contactTitle,
            contactLinkedIn: bestLinkedIn ?? prospect.contactLinkedIn,
            updatedAt: new Date(),
          }).where(eq(prospectsTable.id, input.prospectId));
        }

        return {
          found: !!bestEmail,
          email: bestEmail,
          confidence: bestConfidence,
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
                        person_titles: ["CEO", "CTO", "COO", "VP", "Director", "Head of", "Chief", "President", "Founder", "Co-Founder", "Business Development", "Sales"],
                        page: 1, per_page: 3,
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

                if (bestEmail && bestEmail !== prospect.contactEmail) {
                  await dbConn.update(prospectsTable).set({
                    contactEmail: bestEmail,
                    emailConfidence: bestConfidence,
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
        orderId: z.number(),
        prospectId: z.number().optional(),
        robotCompany: z.string(),
        robotName: z.string().optional(),
        showName: z.string().optional(),
        showStartDate: z.string().optional(), // ISO date string
        notes: z.string().optional(),
        warehouseBayId: z.number().optional(), // v21: pre-assign a bay
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

        // Create the workflow
        const [workflow] = await dbConn.insert(logisticsWorkflows).values({
          orderId: input.orderId,
          prospectId: input.prospectId,
          robotCompany: input.robotCompany,
          robotName: input.robotName,
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
  }),
});
export type AppRouter = typeof appRouter;