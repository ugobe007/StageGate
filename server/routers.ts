import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

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
          contactEmail: z.string().email().optional(),
          contactPhone: z.string().optional(),
          country: z.string().optional(),
          robotTypes: z.string().optional(), // JSON array as string
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isNew = !(await db.getCompanyProfileByUserId(ctx.user.id));
        const id = await db.upsertCompanyProfile({ ...input, userId: ctx.user.id });
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
      .mutation(async ({ input }) => {
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
      }),

    // AI: Generate personalized outreach email for a lead
    generateEmail: adminProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input }) => {
        const lead = await db.getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
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
});
export type AppRouter = typeof appRouter;
