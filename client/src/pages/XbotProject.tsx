import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineItem {
  date: string;
  label: string;
  description: string;
  critical: boolean;
}

interface CustomsItem {
  item: string;
  required: boolean;
  notes: string;
}

interface GroundTransportOption {
  name: string;
  type: string;
  contact: string;
  website: string;
  notes: string;
}

interface ServicePackageItem {
  service: string;
  description: string;
  included: boolean;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "border-white/20 text-white/50",
    brief_generated: "border-emerald-500/60/50 text-emerald-400",
    submitted: "border-amber-500/50 text-amber-400",
    in_review: "border-blue-500/50 text-blue-400",
    confirmed: "border-green-500/50 text-green-400",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    brief_generated: "Brief Ready",
    submitted: "Submitted",
    in_review: "In Review",
    confirmed: "Confirmed",
  };
  return (
    <span
      className={`text-xs font-mono border px-2 py-0.5 rounded ${styles[status] ?? "border-white/20 text-white/50"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 rounded-xl bg-white/3 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function XbotProject() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const projectId = parseInt(id ?? "0");

  // Get sessionToken from URL query param (for anonymous users)
  const searchParams = new URLSearchParams(window.location.search);
  const sessionToken = searchParams.get("token") ?? undefined;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const utils = trpc.useUtils();

  const projectQuery = trpc.xbot.getProject.useQuery(
    { projectId, sessionToken },
    { enabled: !!projectId, retry: false }
  );

  const generateBrief = trpc.xbot.generateBrief.useMutation({
    onSuccess: () => {
      utils.xbot.getProject.invalidate({ projectId, sessionToken });
      toast.success("Logistics brief generated successfully!");
      setIsGenerating(false);
    },
    onError: (err) => {
      toast.error(`Failed to generate brief: ${err.message}`);
      setIsGenerating(false);
    },
  });

  const submitRequest = trpc.xbot.submitServiceRequest.useMutation({
    onSuccess: () => {
      utils.xbot.getProject.invalidate({ projectId, sessionToken });
      toast.success("Service request submitted! StageGate will contact you within 24 hours.");
      setIsSubmitting(false);
    },
    onError: (err) => {
      toast.error(`Failed to submit: ${err.message}`);
      setIsSubmitting(false);
    },
  });

  const handleGenerateBrief = () => {
    setIsGenerating(true);
    generateBrief.mutate({ projectId, sessionToken });
  };

  const handleSubmitRequest = () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    setIsSubmitting(true);
    submitRequest.mutate({ projectId });
  };

  if (projectQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f14] text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-36 pb-20">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (projectQuery.error) {
    return (
      <div className="min-h-screen bg-[#0d0f14] text-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-36 pb-20 text-center">
          <p className="text-white/50 mb-4">Unable to load this project.</p>
          <Button
            variant="ghost"
            onClick={() => navigate("/xbot")}
            className="text-white/50 hover:text-white"
          >
            ← Back to XBOT
          </Button>
        </div>
      </div>
    );
  }

  const { project, brief } = projectQuery.data ?? {};
  if (!project) return null;

  const contacts = project.contacts as {
    primary?: { name?: string; email?: string; phone?: string };
    onsite?: { name?: string; email?: string; phone?: string };
    emergency?: { name?: string; phone?: string };
  } | null;

  const timeline = brief?.timeline as TimelineItem[] | null;
  const customsChecklist = brief?.customsChecklist as CustomsItem[] | null;
  const groundTransportOptions = brief?.groundTransportOptions as GroundTransportOption[] | null;
  const servicePackage = brief?.servicePackage as ServicePackageItem[] | null;

  const isSubmitted = ["submitted", "in_review", "confirmed"].includes(project.status);

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-32 pb-20">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate("/xbot")}
              className="text-white/40 text-xs hover:text-white/70 mb-3 flex items-center gap-1 transition-colors"
            >
              ← Back to XBOT
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono text-emerald-400 border border-emerald-500/60/40 px-2 py-0.5 rounded">
                XBOT
              </span>
              <StatusBadge status={project.status} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {project.robotMake || "Robot"} {project.robotModel || ""}
            </h1>
            <p className="text-white/40 text-sm mt-1">
              {project.originCity && project.originCountry
                ? `${project.originCity}, ${project.originCountry}`
                : "Origin not specified"}{" "}
              → Las Vegas, NV
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {project.status === "draft" && (
              <Button
                onClick={() => navigate(`/xbot/new`)}
                variant="ghost"
                className="text-white/50 border border-white/15 hover:bg-white/5 text-sm"
              >
                Edit Details
              </Button>
            )}
          </div>
        </div>

        {/* Generate Brief CTA — shown when no brief exists */}
        {!brief && (
          <div className="border border-emerald-500/60/30 rounded-xl bg-emerald-500/5 p-6 mb-8 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <h2 className="text-lg font-semibold text-white mb-2">Ready to Generate Your Logistics Brief</h2>
            <p className="text-white/50 text-sm mb-5 max-w-lg mx-auto">
              XBOT will analyze your robot's profile, origin, customs requirements, and target show
              to generate a custom logistics brief with timeline, customs checklist, and service package.
            </p>
            <Button
              onClick={handleGenerateBrief}
              disabled={isGenerating}
              className="bg-emerald-600/80 hover:bg-emerald-500 text-white border-0 px-8 py-2.5"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating Brief (30–60s)…
                </span>
              ) : (
                "Generate Logistics Brief →"
              )}
            </Button>
            {isGenerating && (
              <p className="text-white/30 text-xs mt-3">
                XBOT is analyzing your shipment details. This may take up to 60 seconds.
              </p>
            )}
          </div>
        )}

        {/* Brief Content */}
        {brief && (
          <div className="space-y-6">
            {/* Summary Banner */}
            <div className="border border-emerald-500/60/30 rounded-xl bg-emerald-500/5 p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-emerald-400">XBOT BRIEF</span>
                    <span className="text-white/30 text-xs">
                      Generated {new Date(brief.generatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {brief.summaryNotes && (
                    <p className="text-white/70 text-sm leading-relaxed">{brief.summaryNotes}</p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-3">
                    {brief.shipByDeadline && (
                      <div>
                        <p className="text-white/40 text-xs">Ship By Deadline</p>
                        <p className="text-amber-400 font-semibold text-sm">
                          {new Date(brief.shipByDeadline).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                    {brief.hsCodeSuggestion && (
                      <div>
                        <p className="text-white/40 text-xs">Suggested HS Code</p>
                        <p className="text-white font-mono text-sm">{brief.hsCodeSuggestion}</p>
                      </div>
                    )}
                    {brief.ataCarnetEligible !== null && (
                      <div>
                        <p className="text-white/40 text-xs">ATA Carnet Eligible</p>
                        <p className={`text-sm font-medium ${brief.ataCarnetEligible ? "text-green-400" : "text-white/50"}`}>
                          {brief.ataCarnetEligible ? "✓ Yes" : "✗ No"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleGenerateBrief}
                  disabled={isGenerating}
                  variant="ghost"
                  className="text-white/40 border border-white/15 hover:bg-white/5 text-xs shrink-0"
                >
                  {isGenerating ? "Regenerating…" : "↻ Regenerate"}
                </Button>
              </div>
            </div>

            {/* Timeline */}
            {timeline && timeline.length > 0 && (
              <SectionCard title="Logistics Timeline" icon="📅">
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
                  <div className="space-y-4">
                    {timeline.map((item, i) => (
                      <div key={i} className="flex gap-4 pl-10 relative">
                        <div
                          className={`absolute left-2.5 w-3 h-3 rounded-full border-2 top-1 ${
                            item.critical
                              ? "border-amber-500 bg-amber-500/20"
                              : "border-emerald-500/60 bg-emerald-500/20"
                          }`}
                        />
                        <div className="flex-1 pb-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-mono text-white/40">
                              {item.date
                                ? new Date(item.date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "TBD"}
                            </span>
                            {item.critical && (
                              <span className="text-[10px] border border-amber-500/50 text-amber-400 px-1.5 py-0.5 rounded">
                                CRITICAL
                              </span>
                            )}
                          </div>
                          <p className="text-white/90 text-sm font-medium">{item.label}</p>
                          <p className="text-white/50 text-xs mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Customs Checklist */}
            {customsChecklist && customsChecklist.length > 0 && (
              <SectionCard title="Customs Checklist" icon="🛃">
                <div className="space-y-3">
                  {customsChecklist.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/8"
                    >
                      <div
                        className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                          item.required
                            ? "border-amber-500/60 bg-amber-500/10"
                            : "border-white/20 bg-white/5"
                        }`}
                      >
                        {item.required ? (
                          <span className="text-amber-400 text-xs">!</span>
                        ) : (
                          <span className="text-white/30 text-xs">○</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white/90 text-sm font-medium">{item.item}</p>
                        {item.notes && (
                          <p className="text-white/40 text-xs mt-0.5">{item.notes}</p>
                        )}
                      </div>
                      {item.required && (
                        <span className="text-[10px] border border-amber-500/40 text-amber-400 px-1.5 py-0.5 rounded shrink-0">
                          REQUIRED
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Service Package */}
            {servicePackage && servicePackage.length > 0 && (
              <SectionCard title="Service Package" icon="⚙️">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {servicePackage.map((item, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        item.included
                          ? "border-emerald-500/60/30 bg-emerald-500/5"
                          : "border-white/8 bg-white/2 opacity-50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`text-sm mt-0.5 ${item.included ? "text-emerald-400" : "text-white/30"}`}>
                          {item.included ? "✓" : "○"}
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${item.included ? "text-white/90" : "text-white/40"}`}>
                            {item.service}
                          </p>
                          <p className="text-white/40 text-xs mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Ground Transport Options */}
            {groundTransportOptions && groundTransportOptions.length > 0 && (
              <SectionCard title="Ground Transport Options" icon="🚛">
                <div className="space-y-3">
                  {groundTransportOptions.map((opt, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border border-white/10 bg-white/3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-white/90 text-sm font-medium">{opt.name}</p>
                          <p className="text-white/40 text-xs mt-0.5">{opt.type}</p>
                          {opt.notes && (
                            <p className="text-white/50 text-xs mt-1">{opt.notes}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {opt.contact && (
                            <p className="text-white/60 text-xs">{opt.contact}</p>
                          )}
                          {opt.website && (
                            <a
                              href={opt.website.startsWith("http") ? opt.website : `https://${opt.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 text-xs hover:underline"
                            >
                              {opt.website}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Submit Service Request CTA */}
            {!isSubmitted && (
              <div className="border border-amber-500/30 rounded-xl bg-amber-500/5 p-6 text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Ready to Proceed?</h3>
                <p className="text-white/50 text-sm mb-5 max-w-md mx-auto">
                  Submit your service request and a StageGate logistics coordinator will contact you
                  within 24 hours to confirm your package and pricing.
                </p>
                {showAuthPrompt ? (
                  <div className="space-y-3">
                    <p className="text-amber-400 text-sm">
                      Please sign in to submit your service request.
                    </p>
                    <a href={getLoginUrl()}>
                      <Button className="border border-amber-500 text-amber-400 bg-transparent hover:bg-amber-500/10 px-8">
                        Sign In to Submit →
                      </Button>
                    </a>
                  </div>
                ) : (
                  <Button
                    onClick={handleSubmitRequest}
                    disabled={isSubmitting}
                    className="border border-amber-500 text-amber-400 bg-transparent hover:bg-amber-500/10 px-8 py-2.5"
                  >
                    {isSubmitting ? "Submitting…" : "Submit Service Request →"}
                  </Button>
                )}
              </div>
            )}

            {isSubmitted && (
              <div className="border border-green-500/30 rounded-xl bg-green-500/5 p-6 text-center">
                <div className="text-3xl mb-2">✓</div>
                <h3 className="text-lg font-semibold text-white mb-1">Request Submitted</h3>
                <p className="text-white/50 text-sm">
                  Your logistics brief has been submitted to StageGate. A coordinator will reach
                  out within 24 hours.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Project Details Summary */}
        <div className="mt-8 border border-white/8 rounded-xl bg-white/2 p-5">
          <h3 className="text-white/60 text-xs font-mono mb-4">PROJECT DETAILS</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/40 text-xs">Robot</p>
              <p className="text-white/80">{project.robotMake} {project.robotModel}</p>
            </div>
            {project.robotWeight && (
              <div>
                <p className="text-white/40 text-xs">Weight</p>
                <p className="text-white/80">{project.robotWeight} kg</p>
              </div>
            )}
            {project.shippingMethod && (
              <div>
                <p className="text-white/40 text-xs">Shipping</p>
                <p className="text-white/80 capitalize">{project.shippingMethod}</p>
              </div>
            )}
            {project.eta && (
              <div>
                <p className="text-white/40 text-xs">ETA</p>
                <p className="text-white/80">
                  {new Date(project.eta).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            )}
            {project.customsBroker && (
              <div>
                <p className="text-white/40 text-xs">Customs Broker</p>
                <p className="text-white/80 capitalize">{project.customsBroker}</p>
              </div>
            )}
            {contacts?.primary?.name && (
              <div>
                <p className="text-white/40 text-xs">Primary Contact</p>
                <p className="text-white/80">{contacts.primary.name}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
