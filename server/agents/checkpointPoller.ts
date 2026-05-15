/**
 * Checkpoint Poller — Daily heartbeat handler (P7)
 * Scans all active logistics workflows for overdue checkpoints,
 * sends nudge emails to responsible parties, and escalates critical blockers.
 */
import { getDb } from "../db";
import { logisticsWorkflows, logisticsCheckpoints } from "../../drizzle/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { sendEmail } from "../email";
import { notifyOwner } from "../_core/notification";
import { invokeLLM } from "../_core/llm";

const STAGEGATE_EMAIL = "hello@onstage.bot";

/**
 * Main entry point — called by POST /api/scheduled/logistics-checkpoint-poll
 */
export async function runCheckpointPoller(): Promise<{
  checked: number;
  overdue: number;
  nudgesSent: number;
  escalated: number;
}> {
  const db = await getDb();
  if (!db) return { checked: 0, overdue: 0, nudgesSent: 0, escalated: 0 };

  // Get all active workflows
  const activeWorkflows = await db
    .select()
    .from(logisticsWorkflows)
    .where(eq(logisticsWorkflows.status, "active"));

  if (activeWorkflows.length === 0) {
    return { checked: 0, overdue: 0, nudgesSent: 0, escalated: 0 };
  }

  const workflowIds = activeWorkflows.map(w => w.id);
  const now = new Date();

  // Get all pending/in_progress checkpoints that are overdue
  const overdueCheckpoints = await db
    .select()
    .from(logisticsCheckpoints)
    .where(
      and(
        inArray(logisticsCheckpoints.workflowId, workflowIds),
        inArray(logisticsCheckpoints.status, ["pending", "in_progress"]),
        lt(logisticsCheckpoints.dueAt, now)
      )
    );

  let nudgesSent = 0;
  let escalated = 0;

  for (const cp of overdueCheckpoints) {
    const workflow = activeWorkflows.find(w => w.id === cp.workflowId);
    if (!workflow) continue;

    const hoursOverdue = cp.dueAt
      ? Math.floor((now.getTime() - new Date(cp.dueAt).getTime()) / (1000 * 60 * 60))
      : 0;

    // Escalate if overdue by more than 48 hours
    if (hoursOverdue > 48 && cp.status !== "escalated") {
      await db
        .update(logisticsCheckpoints)
        .set({ status: "escalated", escalatedAt: now, updatedAt: now })
        .where(eq(logisticsCheckpoints.id, cp.id));

      await notifyOwner({
        title: `🚨 Checkpoint Escalated: ${cp.title}`,
        content: `Workflow: ${workflow.robotCompany} / ${workflow.showName ?? "Unknown Show"}\nCheckpoint: ${cp.title}\nOverdue by: ${hoursOverdue} hours\nResponsible: ${cp.responsibleParty}`,
      });
      escalated++;
      continue;
    }

    // Send a nudge email for checkpoints overdue by 2–48 hours
    if (hoursOverdue >= 2 && hoursOverdue <= 48) {
      try {
        const nudgeEmail = await generateNudgeEmail(cp, workflow, hoursOverdue);

        // Determine recipient based on responsible party
        if (cp.responsibleParty === "robot_company" && workflow.robotCompany) {
          // We don't have the robot company email directly on the workflow,
          // so notify the admin to follow up
          await notifyOwner({
            title: `⏰ Checkpoint Overdue: ${cp.title}`,
            content: `${workflow.robotCompany} needs to complete: ${cp.title}\nShow: ${workflow.showName ?? "TBD"}\nOverdue by: ${hoursOverdue}h\n\nSuggested nudge:\n${nudgeEmail}`,
          });
        } else if (cp.responsibleParty === "stagegate" || cp.responsibleParty === "robot_team") {
          // Notify the StageGate team directly
          await notifyOwner({
            title: `⏰ Action Required: ${cp.title}`,
            content: `StageGate action overdue for ${workflow.robotCompany}.\nCheckpoint: ${cp.title}\nShow: ${workflow.showName ?? "TBD"}\nOverdue by: ${hoursOverdue}h`,
          });
        } else if (cp.responsibleParty === "vendor" && cp.vendorId) {
          // Vendor nudge — notify admin to contact vendor
          await notifyOwner({
            title: `⏰ Vendor Action Overdue: ${cp.title}`,
            content: `Vendor checkpoint overdue for ${workflow.robotCompany}.\nCheckpoint: ${cp.title}\nOverdue by: ${hoursOverdue}h\nPlease contact the assigned vendor.`,
          });
        }

        nudgesSent++;
      } catch (err) {
        console.error(`[checkpointPoller] Failed to send nudge for cp ${cp.id}:`, err);
      }
    }
  }

  return {
    checked: overdueCheckpoints.length + (activeWorkflows.length > 0 ? 1 : 0),
    overdue: overdueCheckpoints.length,
    nudgesSent,
    escalated,
  };
}

async function generateNudgeEmail(
  cp: typeof logisticsCheckpoints.$inferSelect,
  workflow: typeof logisticsWorkflows.$inferSelect,
  hoursOverdue: number
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are the StageGate operations team. Write a brief, professional nudge message (2-3 sentences) reminding a party that a logistics checkpoint is overdue. Be polite but direct. Do not sign the message.`,
        },
        {
          role: "user",
          content: `Checkpoint: ${cp.title}\nRobot company: ${workflow.robotCompany}\nShow: ${workflow.showName ?? "upcoming show"}\nOverdue by: ${hoursOverdue} hours\nResponsible party: ${cp.responsibleParty}\n\nWrite the nudge message.`,
        },
      ],
    });
    const content = response.choices[0].message.content;
    return typeof content === "string" ? content : `Reminder: The "${cp.title}" checkpoint for ${workflow.robotCompany} is ${hoursOverdue} hours overdue. Please update the status as soon as possible.`;
  } catch {
    return `Reminder: The "${cp.title}" checkpoint for ${workflow.robotCompany} is ${hoursOverdue} hours overdue.`;
  }
}
