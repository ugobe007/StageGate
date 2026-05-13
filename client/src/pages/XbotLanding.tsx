import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Robot Profile",
    desc: "Tell XBOT about your robot — make, model, dimensions, weight, and any special handling requirements.",
    icon: "🤖",
  },
  {
    num: "02",
    title: "Origin & Shipping",
    desc: "Enter your origin country, city, preferred shipping method (air/sea/ground), and estimated arrival date.",
    icon: "✈️",
  },
  {
    num: "03",
    title: "Customs Details",
    desc: "Provide HS codes, ATA Carnet eligibility, and customs broker preference. XBOT suggests codes if unknown.",
    icon: "🛃",
  },
  {
    num: "04",
    title: "Target Show",
    desc: "Select your Las Vegas trade show, booth number, and setup/teardown dates.",
    icon: "🎪",
  },
  {
    num: "05",
    title: "Services",
    desc: "Choose from warehousing, staging, activation, drayage, crating, and ground transport options.",
    icon: "⚙️",
  },
  {
    num: "06",
    title: "Contacts",
    desc: "Add primary, on-site, and emergency contacts for the logistics team to coordinate with.",
    icon: "👤",
  },
];

const BRIEF_OUTPUTS = [
  {
    title: "Logistics Timeline",
    desc: "Date-by-date plan from ship-by deadline through teardown, with critical milestones flagged.",
    icon: "📅",
  },
  {
    title: "Customs Checklist",
    desc: "Required documents and steps for US customs clearance, specific to your robot type and origin.",
    icon: "🛃",
  },
  {
    title: "Service Package",
    desc: "Confirmed list of StageGate services included in your logistics plan.",
    icon: "⚙️",
  },
  {
    title: "Ground Transport Options",
    desc: "Las Vegas freight and drayage companies if you need to arrange your own transport.",
    icon: "🚛",
  },
  {
    title: "HS Code Suggestion",
    desc: "AI-suggested Harmonized System code for your specific robot type to streamline customs.",
    icon: "📋",
  },
  {
    title: "ATA Carnet Eligibility",
    desc: "Determination of whether your shipment qualifies for temporary duty-free import.",
    icon: "📄",
  },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  brief_generated: "Brief Ready",
  submitted: "Submitted",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function XbotLanding() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: projectsData } = trpc.xbot.listProjects.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-mono text-indigo-400 border border-indigo-500/40 px-2 py-0.5 rounded">
              XBOT
            </span>
            <span className="text-white/30 text-xs">Automated Logistics Workflow Engine</span>
          </div>
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
              <span className="text-white">Your Robot's Journey</span>
              <br />
              <span className="text-indigo-400">Planned in Minutes.</span>
            </h1>
            <p className="text-white/60 text-lg sm:text-xl leading-relaxed mb-8 max-w-2xl">
              XBOT guides you through a 6-step intake form and generates a complete inbound
              logistics brief — customs checklist, timeline, service package, and ground transport
              options — automatically.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => navigate("/xbot/new")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 px-8 py-3 text-base font-semibold"
              >
                Start Logistics Intake →
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="border border-white/20 text-white/70 hover:bg-white/5 hover:text-white px-8 py-3 text-base"
              >
                How It Works
              </Button>
            </div>
            <p className="text-white/30 text-sm mt-4">
              No account required to start. Registration only needed to submit your service request.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-t border-b border-white/8 py-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: "6", label: "Intake Steps" },
            { value: "~60s", label: "Brief Generation" },
            { value: "15+", label: "Las Vegas Shows" },
            { value: "24h", label: "Coordinator Response" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-black text-white">{stat.value}</p>
              <p className="text-white/40 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Saved Projects (authenticated users only) */}
      {isAuthenticated && projectsData && projectsData.projects.length > 0 && (
        <section className="py-10 px-4 border-t border-white/8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-mono text-indigo-400 mb-1">YOUR PROJECTS</p>
                <h2 className="text-xl font-bold text-white">Saved Logistics Plans</h2>
              </div>
              <Button
                onClick={() => navigate("/xbot/new")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 text-sm"
              >
                + New Project
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectsData.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/xbot/project/${p.id}`)}
                  className="text-left border border-white/10 rounded-xl bg-white/3 p-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-white/90 font-semibold text-sm">
                      {p.robotMake && p.robotModel
                        ? `${p.robotMake} ${p.robotModel}`
                        : `Project #${p.id}`}
                    </p>
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-white/15 text-white/50">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  {p.originCountry && (
                    <p className="text-white/40 text-xs">
                      From {p.originCity ? `${p.originCity}, ` : ""}{p.originCountry}
                    </p>
                  )}
                  <p className="text-white/30 text-xs mt-1">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-mono text-indigo-400 mb-3">HOW IT WORKS</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Six Steps. One Brief.
            </h2>
            <p className="text-white/50 mt-3 max-w-xl">
              XBOT collects everything it needs to generate a complete logistics plan for your robot's
              journey from anywhere in the world to Las Vegas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.num}
                className="border border-white/10 rounded-xl bg-white/3 p-5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-xs font-mono text-indigo-400/60 group-hover:text-indigo-400 transition-colors mt-1">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-white/90 font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What XBOT Generates */}
      <section className="py-20 px-4 border-t border-white/8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-mono text-amber-500 mb-3">LOGISTICS BRIEF</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              What XBOT Generates
            </h2>
            <p className="text-white/50 mt-3 max-w-xl">
              After completing the intake form, XBOT's AI engine produces a comprehensive brief
              tailored to your robot, origin, and target show.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BRIEF_OUTPUTS.map((output) => (
              <div
                key={output.title}
                className="border border-white/10 rounded-xl bg-white/3 p-5"
              >
                <span className="text-2xl mb-3 block">{output.icon}</span>
                <h3 className="text-white/90 font-semibold text-sm mb-1">{output.title}</h3>
                <p className="text-white/45 text-xs leading-relaxed">{output.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 border-t border-white/8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-mono text-indigo-400 mb-4">GET STARTED</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
            Ready to Plan Your Robot's Arrival?
          </h2>
          <p className="text-white/50 mb-8 max-w-lg mx-auto">
            Start the XBOT intake form now — no account required. Your progress is saved
            automatically so you can return and finish later.
          </p>
          <Button
            onClick={() => navigate("/xbot/new")}
            className="border border-amber-500 text-amber-400 bg-transparent hover:bg-amber-500/10 px-10 py-3 text-base font-semibold"
          >
            Start XBOT Intake →
          </Button>
          <p className="text-white/25 text-xs mt-4">
            Supports robots from any country. Las Vegas shows only.
          </p>
        </div>
      </section>
    </div>
  );
}
