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
import { eq, desc, count } from "drizzle-orm";
import { draftEmails, prospectResearch, prospectActivities, bookingRequests, prospects as prospectsTable } from "../drizzle/schema";
import { getDb } from "./db";
import { researchProspect } from "./research-agent";

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

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a B2B sales writer for StageGate — a robotics activation company that handles robot receiving, unpacking, testing, staging, and delivery at trade shows. Write short, punchy outreach emails. No fluff. ${toneInstruction}Output plain text only, no subject line, no JSON wrapper.`,
            },
            {
              role: "user",
              content: `Write a fresh outreach email for this prospect:\n\nCompany: ${prospect.company}\nRobot: ${robot}\nShows: ${showList}\n${prospect.contactName ? `Contact: ${prospect.contactName}` : ""}\n\nRequirements:\n- 4-6 sentences\n- Reference their specific robot and show\n- Mention one concrete StageGate service (receiving, staging, or delivery)\n- End with a soft CTA to schedule a StageGate intake call\n- Sign off as the StageGate team\n- No subject line`,
            },
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
            for (const prospect of targets as Array<{ id: number; company: string; contactName: string | null; contactEmail: string | null; robotName: string | null; robotType: string | null; shows: string[] | null; notes: string | null }>) {
              if (!prospect.contactEmail) continue;

              // Check if a pending/approved draft already exists
              const existing = await emailHelpers.getDraftsForProspect(prospect.id);
              const hasPending = existing.some((d: { status: string }) => d.status === "pending" || d.status === "approved");
              if (hasPending) continue;

              const showContext = prospect.shows?.length ? `They have exhibited at: ${prospect.shows.join(", ")}.` : "";
              const robotContext = prospect.robotName ? `Their robot is the ${prospect.robotName}${prospect.robotType ? ` (${prospect.robotType})` : ""}.` : "";

              const llmRes = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `You are an outreach specialist for StageGate, the first warehouse, staging, and activation service built for robotics companies exhibiting at trade shows. Write concise, professional cold outreach emails. Be specific about the company's robot. Keep emails under 150 words. No fluff, no marketing speak. Sign off as "Bob Christopher, StageGate".`,
                  },
                  {
                    role: "user",
                    content: `Write a cold outreach email to ${prospect.contactName ?? "the team"} at ${prospect.company}. ${robotContext} ${showContext} We are reaching out because StageGate handles all trade show logistics for robotics companies — shipping, customs, warehousing, booth setup, and on-site support — at ${showNames}. Subject line and email body only. Format: SUBJECT: ...\n\nBODY: ...`,
                  },
                ],
              });
              const rawContent = llmRes.choices?.[0]?.message?.content;
              const content: string = typeof rawContent === "string" ? rawContent : "";
              const subjectMatch = content.match(/SUBJECT:\s*(.+)/i);
              const bodyMatch = content.match(/BODY:\s*([\s\S]+)/i);

              const subject = subjectMatch?.[1]?.trim() ?? `Trade Show Logistics for ${prospect.company}`;
              const body = bodyMatch?.[1]?.trim() ?? content.trim();
              const reasoning = `${prospect.company} matched because: ${robotContext} ${showContext} Outreach for ${showNames}.`.trim();

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

        await emailHelpers.sendEmail({
          to: entry.prospect.contactEmail,
          subject: entry.draft.subject,
          body: entry.draft.body,
        });

        await emailHelpers.markDraftSent(entry.draft.id);
        await db.updateProspectStatus(entry.prospect.id, "contacted");

        return { success: true, sentTo: entry.prospect.contactEmail };
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
            await emailHelpers.sendEmail({
              to: entry.prospect.contactEmail,
              subject: entry.draft.subject,
              body: entry.draft.body,
            });
            await emailHelpers.markDraftSent(entry.draft.id);
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
      }))
      .mutation(async ({ input }) => {
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
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
        });
        await notifyOwner({
          title: `📥 New Booking Request: ${input.company}`,
          content: `${input.contactName} (${input.contactEmail}) from ${input.company} submitted a logistics intake.\n\nRobot: ${input.robotName ?? "TBD"} (${input.robotType ?? "unknown type"})\nShow: ${input.showName ?? "TBD"}\nServices: ${input.services.join(", ") || "none selected"}`,
        });
        return { success: true };
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
  }),
});
export type AppRouter = typeof appRouter;
