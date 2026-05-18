import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowRight, Check, Radio, Bot, Package, Truck, Zap } from "lucide-react";
import Navbar from "@/components/Navbar";

/* ── Palette ─────────────────────────────────────────────────────── */
const BG     = "oklch(0.11 0.012 262)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const INDIGO = "oklch(0.72 0.20 262)";
const TEXT_HI  = "oklch(0.93 0.005 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";
const TEXT_DIM = "oklch(0.50 0.010 240)";

const INTEREST_OPTIONS = [
  { id: "humanoid",        label: "Humanoid Robots" },
  { id: "industrial_arms", label: "Industrial Arms & Cobots" },
  { id: "amr",             label: "Wheeled AMRs & Mobile Robots" },
  { id: "drones",          label: "Drones & UAVs" },
  { id: "medical",         label: "Medical & Surgical Robots" },
  { id: "service",         label: "Service & Hospitality Robots" },
  { id: "all",             label: "All Robotics" },
];

const WHAT_YOU_GET = [
  {
    icon: <Radio size={16} />,
    title: "Show floor alerts",
    desc: "Upcoming trade show dates, exhibitor deadlines, and booth logistics timelines — before they sell out.",
  },
  {
    icon: <Bot size={16} />,
    title: "Robot industry news",
    desc: "Key OEM launches, funding rounds, new humanoid deployments, and US market entries — curated weekly.",
  },
  {
    icon: <Package size={16} />,
    title: "XBOT findings",
    desc: "Which robot companies are heading to which shows, based on our XBOT pipeline scanning the web in real time.",
  },
  {
    icon: <Truck size={16} />,
    title: "Operational intel",
    desc: "Battery shipping regulations, customs updates, Li-ion rules for specific shows — the stuff that catches teams off guard.",
  },
];

export default function Newsletter() {
  const [email, setEmail]           = useState("");
  const [firstName, setFirstName]   = useState("");
  const [interests, setInterests]   = useState<Set<string>>(new Set(["all"]));
  const [submitted, setSubmitted]   = useState(false);
  const [alreadySubbed, setAlreadySubbed] = useState(false);

  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setAlreadySubbed(data.alreadySubscribed);
    },
  });

  function toggleInterest(id: string) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (id === "all") {
        return next.has("all") ? new Set() : new Set(["all"]);
      }
      next.delete("all");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    subscribe.mutate({
      email,
      firstName: firstName || undefined,
      interests: Array.from(interests).join(",") || undefined,
    });
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen" style={{ background: BG, color: TEXT_HI }}>

        {/* ── Header ── */}
        <section className="border-b pt-36 pb-16" style={{ borderColor: BORDER, background: CARD }}>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="section-label mb-4 flex items-center justify-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: INDIGO }} />
              StageGate Intelligence
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold leading-tight"
              style={{ color: TEXT_HI, letterSpacing: "-0.035em" }}
            >
              Stay ahead of the show floor
            </h1>
            <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: TEXT_MID }}>
              Show alerts, robot industry news, and XBOT findings — delivered to your inbox. Built for robot companies, logistics teams, and show operators.
            </p>
          </div>
        </section>

        {/* ── What you get ── */}
        <section className="max-w-4xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {WHAT_YOU_GET.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border p-5 flex gap-4"
                style={{ background: CARD, borderColor: BORDER }}
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${INDIGO}18`, color: INDIGO }}
                >
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1" style={{ color: TEXT_HI }}>{item.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT_DIM }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Signup form ── */}
        <section className="max-w-xl mx-auto px-6 pb-20">
          <div
            className="rounded-2xl border p-8"
            style={{ background: CARD, borderColor: BORDER }}
          >
            {submitted ? (
              <div className="text-center py-6">
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
                  style={{ background: `${INDIGO}18` }}
                >
                  <Check size={24} style={{ color: INDIGO }} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: TEXT_HI }}>
                  {alreadySubbed ? "You're already subscribed" : "You're in."}
                </h2>
                <p className="text-sm mb-6" style={{ color: TEXT_DIM }}>
                  {alreadySubbed
                    ? "We already have your email. You'll keep getting show alerts and robot news."
                    : "Welcome to the StageGate intel list. First show alert goes out before the next major robotics event."}
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link href="/shows">
                    <span className="btn-primary cursor-pointer">View shows <ArrowRight size={14} /></span>
                  </Link>
                  <Link href="/register">
                    <span className="btn-default cursor-pointer">Register free <ArrowRight size={14} /></span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: TEXT_HI }}>Subscribe</h2>
                  <p className="text-xs" style={{ color: TEXT_DIM }}>No spam. Unsubscribe anytime.</p>
                </div>

                {/* First name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT_MID }}>
                    First name <span style={{ color: TEXT_DIM }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Alex"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 transition-all"
                    style={{
                      background: BG,
                      border: `1px solid ${BORDER}`,
                      color: TEXT_HI,
                    }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: TEXT_MID }}>
                    Email <span style={{ color: "oklch(0.65 0.18 25)" }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 transition-all"
                    style={{
                      background: BG,
                      border: `1px solid ${BORDER}`,
                      color: TEXT_HI,
                    }}
                  />
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-xs font-medium mb-2.5" style={{ color: TEXT_MID }}>
                    Robot types you care about
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((opt) => {
                      const active = interests.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleInterest(opt.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-mono border transition-all"
                          style={{
                            borderColor: active ? `${INDIGO}66` : BORDER,
                            background: active ? `${INDIGO}14` : "transparent",
                            color: active ? INDIGO : TEXT_DIM,
                          }}
                        >
                          {active && <Check size={9} className="inline mr-1" />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Error */}
                {subscribe.isError && (
                  <p className="text-xs" style={{ color: "oklch(0.65 0.18 25)" }}>
                    {subscribe.error.message || "Something went wrong. Please try again."}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={subscribe.isPending || !email}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {subscribe.isPending ? (
                    <>
                      <Zap size={14} className="animate-pulse" /> Subscribing...
                    </>
                  ) : (
                    <>
                      Subscribe <ArrowRight size={14} />
                    </>
                  )}
                </button>

                <p className="text-center text-xs" style={{ color: TEXT_DIM }}>
                  Already have an account?{" "}
                  <Link href="/register">
                    <span className="cursor-pointer hover:opacity-80 transition-opacity" style={{ color: INDIGO }}>Register free →</span>
                  </Link>
                </p>
              </form>
            )}
          </div>
        </section>

      </div>
    </>
  );
}
