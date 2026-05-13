import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import GetQuoteModal from "@/components/GetQuoteModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, MapPin, Globe, Users, Bot, Star, Bell,
  CheckCircle2, Loader2, ChevronRight, Package, Wrench, Zap,
  HeadphonesIcon, BarChart3, ShoppingCart, Warehouse, Truck,
} from "lucide-react";
import { Link } from "wouter";

/* ── Palette ─────────────────────────────────────────────────────────── */
const BG     = "oklch(0.11 0.012 262)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const INDIGO = "oklch(0.72 0.20 262)";
const TEXT_HI  = "oklch(0.93 0.005 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";
const TEXT_DIM = "oklch(0.50 0.010 240)";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  logistics: Truck, activation: Zap, support: HeadphonesIcon,
  marketing: BarChart3, training: Users, showroom: ShoppingCart, storage: Warehouse,
};

function RelevanceBar({ score }: { score: number }) {
  const labels = ["", "Low", "Moderate", "Good", "High", "Exceptional"];
  const colors = ["", TEXT_DIM, "oklch(0.70 0.17 55)", INDIGO, "oklch(0.62 0.18 145)", "oklch(0.65 0.18 145)"];
  const pct = (score / 5) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: TEXT_DIM }}>Robotics Relevance</span>
        <span className="font-semibold" style={{ color: colors[score] }}>
          {labels[score]} ({score}/5)
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[score] }} />
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={13} className={i <= score ? "fill-current" : "opacity-20"} style={{ color: i <= score ? colors[score] : TEXT_DIM }} />
        ))}
      </div>
    </div>
  );
}

function NotifyMeInline({ showId }: { showId: number }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const notifyMutation = trpc.shows.notifyMe.useMutation({
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast.info("You're already on the list for this show.");
      } else {
        setSubmitted(true);
        toast.success("You're on the list! We'll notify you when bookings open.");
      }
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(0.62 0.18 145)" }}>
        <CheckCircle2 size={15} />
        <span>You're on the list! We'll email you when bookings open.</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 px-3 py-2 text-sm rounded border outline-none focus:border-emerald-400"
        style={{ borderColor: BORDER, background: BG, color: TEXT_HI }}
        onKeyDown={(e) => { if (e.key === "Enter" && email) notifyMutation.mutate({ showId, email }); }}
      />
      <button
        className="btn-primary px-3 py-1.5 text-sm"
        onClick={() => notifyMutation.mutate({ showId, email })}
        disabled={!email || notifyMutation.isPending}
      >
        {notifyMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : "Notify me"}
      </button>
    </div>
  );
}

export default function ShowDetail() {
  const params = useParams<{ id: string }>();
  const showId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const { data: show, isLoading: showLoading } = trpc.shows.get.useQuery({ id: showId }, { enabled: !!showId });
  const { data: services = [] } = trpc.services.list.useQuery();

  const submitOrder = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("Service order submitted! Check your dashboard for updates.");
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err.message || "Failed to submit order."),
  });

  const toggleService = (id: number) => {
    setSelectedServices((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "TBD";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const statusConfig: Record<string, { color: string }> = {
    upcoming:  { color: INDIGO },
    active:    { color: "oklch(0.62 0.18 145)" },
    completed: { color: TEXT_DIM },
  };

  const handleBooking = () => {
    if (!isAuthenticated) { navigate(getLoginUrl()); return; }
    if (selectedServices.length === 0) { toast.error("Please select at least one service."); return; }
    setOrderSubmitting(true);
    submitOrder.mutate({ showId, serviceIds: selectedServices, notes: orderNotes }, { onSettled: () => setOrderSubmitting(false) });
  };

  if (showLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
          <Loader2 size={28} className="animate-spin" style={{ color: INDIGO }} />
        </div>
      </>
    );
  }

  if (!show) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: BG }}>
          <p className="text-base" style={{ color: TEXT_DIM }}>Show not found.</p>
          <Link href="/shows">
            <span className="btn-default flex items-center gap-2"><ArrowLeft size={14} /> Back to Shows</span>
          </Link>
        </div>
      </>
    );
  }

  const relevance = show.roboticsRelevance ?? 3;
  const relevanceBadgeColor =
    relevance >= 5 ? "oklch(0.65 0.18 145)" :
    relevance >= 4 ? "oklch(0.62 0.18 145)" :
    relevance >= 3 ? INDIGO :
    relevance >= 2 ? "oklch(0.70 0.17 55)" : TEXT_DIM;

  const sc = statusConfig[show.status] ?? statusConfig.upcoming;

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-14" style={{ background: BG, color: TEXT_HI }}>

        {/* ── Hero ── */}
        <div className="border-b" style={{ background: CARD, borderColor: BORDER }}>
          <div className="container py-10">
            {/* Breadcrumb */}
            <Link href="/shows">
              <button className="flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-60" style={{ color: TEXT_DIM }}>
                <ArrowLeft size={13} /> Back to 2026 Show Calendar
              </button>
            </Link>

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1 min-w-0">
                {/* Status + relevance badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono uppercase tracking-wide border"
                    style={{ color: sc.color, borderColor: `${sc.color}44`, background: `${sc.color}0d` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "currentColor" }} />
                    {show.status}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border"
                    style={{ color: relevanceBadgeColor, borderColor: `${relevanceBadgeColor}44`, background: `${relevanceBadgeColor}0d` }}
                  >
                    <Bot size={11} />
                    {relevance >= 4 ? "High Robotics Activity" : relevance >= 3 ? "Moderate Robotics Activity" : "Emerging Robotics Presence"}
                  </span>
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold mb-3" style={{ color: TEXT_HI, letterSpacing: "-0.03em" }}>
                  {show.name}
                </h1>

                <div className="flex flex-wrap gap-4 text-sm" style={{ color: TEXT_DIM }}>
                  {(show.startDate || show.endDate) && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {formatDate(show.startDate)}
                      {show.endDate && show.endDate !== show.startDate && ` – ${formatDate(show.endDate)}`}
                    </span>
                  )}
                  {show.venue && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} />
                      {show.venue}{show.city ? `, ${show.city}` : ""}
                    </span>
                  )}
                  {show.website && (
                    <a href={show.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                      style={{ color: INDIGO }}>
                      <Globe size={13} /> Official Website
                    </a>
                  )}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-2 lg:items-end shrink-0">
                {show.status === "upcoming" ? (
                  <div className="w-full lg:w-72">
                    <p className="text-xs mb-2" style={{ color: TEXT_DIM }}>
                      <Bell size={11} className="inline mr-1" />
                      Bookings not yet open — get notified:
                    </p>
                    <NotifyMeInline showId={show.id} />
                  </div>
                ) : (
                  <button
                    className="btn-primary w-full lg:w-auto"
                    onClick={() => document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Book services <ChevronRight size={15} className="ml-1" />
                  </button>
                )}
                <button className="btn-default w-full lg:w-auto" onClick={() => setQuoteOpen(true)}>
                  Get a quote
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="container py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left column — show info */}
            <div className="lg:col-span-2 space-y-6">

              {/* Description */}
              {show.description && (
                <section>
                  <h2 className="text-base font-semibold mb-2" style={{ color: TEXT_HI }}>About This Show</h2>
                  <p className="text-sm leading-relaxed" style={{ color: TEXT_MID }}>{show.description}</p>
                </section>
              )}

              {/* Robotics relevance */}
              <section className="rounded-xl p-5 border" style={{ background: CARD, borderColor: BORDER }}>
                <h2 className="text-base font-semibold mb-4" style={{ color: TEXT_HI }}>Robotics Activity</h2>
                <RelevanceBar score={relevance} />
                {(show.estimatedExhibitors || show.roboticsExhibitors) && (
                  <div className="grid grid-cols-2 gap-4 mt-5">
                    {show.estimatedExhibitors && (
                      <div className="text-center p-3 rounded border" style={{ background: BG, borderColor: BORDER }}>
                        <div className="text-2xl font-bold" style={{ color: TEXT_HI }}>{show.estimatedExhibitors.toLocaleString()}+</div>
                        <div className="text-xs mt-1" style={{ color: TEXT_DIM }}>Total Exhibitors</div>
                      </div>
                    )}
                    {show.roboticsExhibitors && (
                      <div className="text-center p-3 rounded border" style={{ background: `${INDIGO}0d`, borderColor: `${INDIGO}44` }}>
                        <div className="text-2xl font-bold" style={{ color: INDIGO }}>{show.roboticsExhibitors}+</div>
                        <div className="text-xs mt-1" style={{ color: TEXT_DIM }}>Robotics Exhibitors</div>
                      </div>
                    )}
                  </div>
                )}
                {show.roboticsExhibitors && show.estimatedExhibitors && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1" style={{ color: TEXT_DIM }}>
                      <span>Robotics share of floor</span>
                      <span>{Math.round((show.roboticsExhibitors / show.estimatedExhibitors) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: BORDER }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.round((show.roboticsExhibitors / show.estimatedExhibitors) * 100)}%`, background: INDIGO }} />
                    </div>
                  </div>
                )}
              </section>

              {/* Why StageGate */}
              <section className="rounded-xl p-5 border" style={{ background: CARD, borderColor: BORDER }}>
                <h2 className="text-base font-semibold mb-3" style={{ color: TEXT_HI }}>Why Use StageGate at This Show</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Truck,          text: "Airport & customs pickup for robot crates" },
                    { icon: Warehouse,      text: "Secure Las Vegas warehouse storage" },
                    { icon: Zap,            text: "On-site unpacking, assembly & power-up" },
                    { icon: HeadphonesIcon, text: "24/7 technical support during the show" },
                    { icon: Package,        text: "Return shipping & re-crating after the show" },
                    { icon: BarChart3,      text: "Brand promotion and booth traffic support" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm" style={{ color: TEXT_MID }}>
                      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: INDIGO }} />
                      {text}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column — booking form */}
            <div className="space-y-4">
              <div id="booking-form" className="rounded-xl border p-5 sticky top-20" style={{ background: CARD, borderColor: BORDER }}>
                <h2 className="text-base font-semibold mb-1" style={{ color: TEXT_HI }}>Book Services</h2>
                <p className="text-xs mb-4" style={{ color: TEXT_DIM }}>
                  Select the services you need for{" "}
                  <span className="font-medium" style={{ color: TEXT_MID }}>{show.name}</span>.
                </p>

                {show.status === "upcoming" ? (
                  <div className="text-center py-6 space-y-3">
                    <Bell size={26} className="mx-auto opacity-25" style={{ color: INDIGO }} />
                    <p className="text-sm" style={{ color: TEXT_DIM }}>Bookings are not yet open for this show.</p>
                    <p className="text-xs" style={{ color: TEXT_DIM }}>Enter your email above to be notified when they open.</p>
                  </div>
                ) : (
                  <>
                    {/* Service checkboxes */}
                    <div className="space-y-2 mb-4">
                      {services.map((svc) => {
                        const Icon = SERVICE_ICONS[svc.category] ?? Wrench;
                        const isSelected = selectedServices.includes(svc.id);
                        return (
                          <label
                            key={svc.id}
                            className="flex items-start gap-3 p-2.5 rounded border cursor-pointer transition-colors"
                            style={{
                              background: isSelected ? `${INDIGO}0d` : BG,
                              borderColor: isSelected ? `${INDIGO}44` : BORDER,
                            }}
                          >
                            <Checkbox
                              id={`svc-${svc.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleService(svc.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Icon size={12} style={{ color: isSelected ? INDIGO : TEXT_DIM }} />
                                <span className="text-sm font-medium" style={{ color: TEXT_HI }}>{svc.name}</span>
                              </div>
                              {svc.basePrice && (
                                <span className="text-xs" style={{ color: TEXT_DIM }}>
                                  From ${Number(svc.basePrice).toLocaleString()} {svc.priceUnit ?? ""}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Notes */}
                    <Textarea
                      placeholder="Special requirements, robot dimensions, power needs..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="text-sm mb-4 resize-none"
                      rows={3}
                      style={{ background: BG, borderColor: BORDER, color: TEXT_HI }}
                    />

                    {/* Submit */}
                    {isAuthenticated ? (
                      <button
                        className="btn-primary w-full justify-center"
                        onClick={handleBooking}
                        disabled={selectedServices.length === 0 || orderSubmitting}
                      >
                        {orderSubmitting ? (
                          <><Loader2 size={14} className="animate-spin mr-2" /> Submitting…</>
                        ) : (
                          <>Submit order ({selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""})</>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <button className="btn-primary w-full justify-center" onClick={() => navigate(getLoginUrl())}>
                          Sign in to book
                        </button>
                        <p className="text-xs text-center" style={{ color: TEXT_DIM }}>Free registration — no credit card required</p>
                      </div>
                    )}

                    {selectedServices.length > 0 && (
                      <p className="text-xs text-center mt-2" style={{ color: TEXT_DIM }}>
                        {selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""} selected
                        — our team will follow up with a detailed quote
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Quick quote CTA */}
              <div className="rounded-xl border p-4 text-center" style={{ background: CARD, borderColor: BORDER }}>
                <p className="text-sm font-medium mb-1" style={{ color: TEXT_HI }}>Not sure what you need?</p>
                <p className="text-xs mb-3" style={{ color: TEXT_DIM }}>Get a personalized quote in 2 minutes.</p>
                <button className="btn-default w-full justify-center text-sm" onClick={() => setQuoteOpen(true)}>
                  Get a free quote
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GetQuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} preselectedShowId={show.id} />
    </>
  );
}
