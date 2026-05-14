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
      .mutation(async ({ input, ctx }) => {
        const runId = await db.createAgentRun({ agentName: "Lead Discovery", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `Show ID: ${input.showId}, ${input.exhibitorListText.slice(0, 80)}...`, status: "running" });
        try {
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
          await db.completeAgentRun(runId, "success", { outputSummary: `Discovered ${created.length} robotics leads` });
          return { count: created.length, leadIds: created };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await db.completeAgentRun(runId, "error", { errorMessage: errMsg });
          await notifyOwner({ title: "⚠️ Agent Error: Lead Discovery", content: `Lead discovery agent failed.\n\nError: ${errMsg}` }).catch(() => {});
          throw err;
        }
      }),
    // AI: Generate personalized outreach email for a lead
    generateEmail: adminProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const lead = await db.getLeadById(input.leadId);
        if (!lead) throw new TRPCError({ code: "NOT_FOUND" });
        const runId = await db.createAgentRun({ agentName: "Lead Email Generator", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `Lead: ${lead.companyName}`, status: "running" });
        try {
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
        await db.completeAgentRun(runId, "success", { outputSummary: `Email draft generated for ${lead.companyName}` });
        return { emailDraft };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await db.completeAgentRun(runId, "error", { errorMessage: errMsg });
          await notifyOwner({ title: "⚠️ Agent Error: Email Drafting", content: `Email drafting agent failed.\n\nError: ${errMsg}` }).catch(() => {});
          throw err;
        }
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
        return { prospects: items };
      }),

    // Get single prospect
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const prospect = await db.getProspectById(input.id);
        if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });
        return { prospect };
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
        const runId = await db.createAgentRun({ agentName: "XBOT Outreach", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `Prospect: ${prospect.company}`, status: "running" });

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

         await db.completeAgentRun(runId, "success", { outputSummary: `Email sent to ${prospect.company}` });
         return { success: true, emailSubject, emailBody };
      }),
    bulkSendEmails: adminProcedure
      .input(z.object({ prospectIds: z.array(z.number()).min(1).max(50) }))
      .mutation(async ({ input, ctx }) => {
        const runId = await db.createAgentRun({ agentName: "XBOT Bulk Outreach", triggeredBy: ctx.user?.name ?? "admin", inputSummary: `${input.prospectIds.length} prospects`, status: "running" });
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
        await db.completeAgentRun(runId, failed === results.length ? "error" : "success", { outputSummary: `Sent: ${sent}, Failed: ${failed}` });
        return { sent, failed, results };
      }),
  }),
  // ─── Video Message Intake (public — for prospects to submit) ────────────────
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
    getSiteStats: adminProcedure.query(async () => {
      const [users, orders, demos, quotes, leads, prospects] = await Promise.all([
        db.getAllUsers(),
        db.getAllOrders(),
        db.getAllDemoRequests(),
        db.getAllQuoteRequests(),
        db.getAllLeads(),
        db.listProspects(),
      ]);
      const prospectsByStatus = prospects.reduce((acc: Record<string, number>, p: { status: string }) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const ordersByStatus = orders.reduce((acc: Record<string, number>, o: { status: string }) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return {
        users: { total: users.length, admins: users.filter((u: { role: string }) => u.role === "admin").length },
        orders: { total: orders.length, byStatus: ordersByStatus },
        demos: { total: demos.length, pending: demos.filter((d: { status: string }) => d.status === "pending").length },
        quotes: { total: quotes.length, pending: quotes.filter((q: { status: string }) => q.status === "pending").length },
        leads: { total: leads.length },
        prospects: { total: prospects.length, byStatus: prospectsByStatus },
      };
    }),
  }),
});
export type AppRouter = typeof appRouter;
