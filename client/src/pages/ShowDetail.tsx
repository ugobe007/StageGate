import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import GetQuoteModal from "@/components/GetQuoteModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Globe,
  Users,
  Bot,
  Star,
  Bell,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Package,
  Wrench,
  Zap,
  HeadphonesIcon,
  BarChart3,
  ShoppingCart,
  Warehouse,
  Truck,
} from "lucide-react";
import { Link } from "wouter";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  logistics: Truck,
  activation: Zap,
  support: HeadphonesIcon,
  marketing: BarChart3,
  training: Users,
  showroom: ShoppingCart,
  storage: Warehouse,
};

function RelevanceBar({ score }: { score: number }) {
  const labels = ["", "Low", "Moderate", "Good", "High", "Exceptional"];
  const colors = ["", "#6b7280", "#f59e0b", "#3b82f6", "#10b981", "#22c55e"];
  const pct = (score / 5) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[oklch(0.55_0.010_240)]">Robotics Relevance</span>
        <span className="font-semibold" style={{ color: colors[score] }}>
          {labels[score]} ({score}/5)
        </span>
      </div>
      <div className="h-2 rounded-full bg-[oklch(0.18_0.008_240)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: colors[score] }}
        />
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={14}
            className={i <= score ? "fill-current" : "opacity-20"}
            style={{ color: i <= score ? colors[score] : undefined }}
          />
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
      <div className="flex items-center gap-2 text-sm text-green-400">
        <CheckCircle2 size={16} />
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
        className="flex-1 px-3 py-2 text-sm rounded-lg border bg-transparent"
        style={{
          borderColor: "oklch(0.22 0.010 240)",
          color: "oklch(0.90 0.005 240)",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && email) {
            notifyMutation.mutate({ showId, email });
          }
        }}
      />
      <Button
        size="sm"
        onClick={() => notifyMutation.mutate({ showId, email })}
        disabled={!email || notifyMutation.isPending}
        className="btn-primary"
      >
        {notifyMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Notify Me"}
      </Button>
    </div>
  );
}

export default function ShowDetail() {
  const params = useParams<{ id: string }>();
  const showId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const { data: show, isLoading: showLoading } = trpc.shows.get.useQuery(
    { id: showId },
    { enabled: !!showId }
  );
  const { data: services = [] } = trpc.services.list.useQuery();

  const submitOrder = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("Service order submitted! Check your dashboard for updates.");
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err.message || "Failed to submit order."),
  });

  const toggleService = (id: number) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "TBD";
    return new Date(d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusColor: Record<string, string> = {
    upcoming: "oklch(0.72 0.21 145)",
    active: "oklch(0.65 0.18 220)",
    completed: "oklch(0.55 0.010 240)",
  };

  const handleBooking = () => {
    if (!isAuthenticated) {
      navigate(getLoginUrl());
      return;
    }
    if (selectedServices.length === 0) {
      toast.error("Please select at least one service.");
      return;
    }
    setOrderSubmitting(true);
    submitOrder.mutate(
      { showId, serviceIds: selectedServices, notes: orderNotes },
      { onSettled: () => setOrderSubmitting(false) }
    );
  };

  if (showLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.09 0.006 240)" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "oklch(0.72 0.21 145)" }} />
        </div>
      </>
    );
  }

  if (!show) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "oklch(0.09 0.006 240)" }}>
          <p className="text-lg" style={{ color: "oklch(0.62 0.010 240)" }}>Show not found.</p>
          <Link href="/shows">
            <Button variant="outline" className="btn-default">
              <ArrowLeft size={16} className="mr-2" /> Back to Shows
            </Button>
          </Link>
        </div>
      </>
    );
  }

  const relevance = show.roboticsRelevance ?? 3;
  const relevanceBadgeColor =
    relevance >= 5 ? "#22c55e" :
    relevance >= 4 ? "#10b981" :
    relevance >= 3 ? "#3b82f6" :
    relevance >= 2 ? "#f59e0b" : "#6b7280";

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-16" style={{ background: "oklch(0.09 0.006 240)" }}>

        {/* ── Hero ── */}
        <div
          className="border-b"
          style={{
            background: "linear-gradient(135deg, oklch(0.11 0.008 240) 0%, oklch(0.10 0.012 240) 100%)",
            borderColor: "oklch(0.16 0.008 240)",
          }}
        >
          <div className="container py-10">
            {/* Breadcrumb */}
            <Link href="/shows">
              <button className="flex items-center gap-1.5 text-sm mb-6 transition-colors hover:opacity-80"
                style={{ color: "oklch(0.55 0.010 240)" }}>
                <ArrowLeft size={14} />
                Back to 2026 Show Calendar
              </button>
            </Link>

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1 min-w-0">
                {/* Status + relevance badges */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide"
                    style={{
                      background: `${statusColor[show.status] ?? statusColor.upcoming}18`,
                      color: statusColor[show.status] ?? statusColor.upcoming,
                      border: `1px solid ${statusColor[show.status] ?? statusColor.upcoming}40`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "currentColor" }} />
                    {show.status}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: `${relevanceBadgeColor}15`,
                      color: relevanceBadgeColor,
                      border: `1px solid ${relevanceBadgeColor}35`,
                    }}
                  >
                    <Bot size={11} />
                    {relevance >= 4 ? "High Robotics Activity" : relevance >= 3 ? "Moderate Robotics Activity" : "Emerging Robotics Presence"}
                  </span>
                </div>

                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-3">
                  {show.name}
                </h1>

                <div className="flex flex-wrap gap-4 text-sm" style={{ color: "oklch(0.62 0.010 240)" }}>
                  {(show.startDate || show.endDate) && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {formatDate(show.startDate)}
                      {show.endDate && show.endDate !== show.startDate && ` – ${formatDate(show.endDate)}`}
                    </span>
                  )}
                  {show.venue && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} />
                      {show.venue}{show.city ? `, ${show.city}` : ""}
                    </span>
                  )}
                  {show.website && (
                    <a
                      href={show.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:underline"
                      style={{ color: "oklch(0.72 0.21 145)" }}
                    >
                      <Globe size={14} />
                      Official Website
                    </a>
                  )}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-2 lg:items-end shrink-0">
                {show.status === "upcoming" ? (
                  <div className="w-full lg:w-72">
                    <p className="text-xs mb-2" style={{ color: "oklch(0.55 0.010 240)" }}>
                      <Bell size={11} className="inline mr-1" />
                      Bookings not yet open — get notified:
                    </p>
                    <NotifyMeInline showId={show.id} />
                  </div>
                ) : (
                  <Button
                    className="btn-primary w-full lg:w-auto"
                    onClick={() => document.getElementById("booking-form")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Book Services <ChevronRight size={16} className="ml-1" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="btn-default w-full lg:w-auto"
                  onClick={() => setQuoteOpen(true)}
                >
                  Get a Quote
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="container py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left column — show info */}
            <div className="lg:col-span-2 space-y-8">

              {/* Description */}
              {show.description && (
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">About This Show</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.65 0.010 240)" }}>
                    {show.description}
                  </p>
                </section>
              )}

              {/* Robotics relevance detail */}
              <section
                className="rounded-xl p-5 border"
                style={{
                  background: "oklch(0.11 0.008 240)",
                  borderColor: "oklch(0.18 0.008 240)",
                }}
              >
                <h2 className="text-lg font-semibold text-white mb-4">Robotics Activity</h2>
                <RelevanceBar score={relevance} />
                {(show.estimatedExhibitors || show.roboticsExhibitors) && (
                  <div className="grid grid-cols-2 gap-4 mt-5">
                    {show.estimatedExhibitors && (
                      <div className="text-center p-3 rounded-lg" style={{ background: "oklch(0.14 0.008 240)" }}>
                        <div className="text-2xl font-bold text-white">
                          {show.estimatedExhibitors.toLocaleString()}+
                        </div>
                        <div className="text-xs mt-1" style={{ color: "oklch(0.55 0.010 240)" }}>
                          Total Exhibitors
                        </div>
                      </div>
                    )}
                    {show.roboticsExhibitors && (
                      <div className="text-center p-3 rounded-lg" style={{ background: "oklch(0.14 0.008 240)" }}>
                        <div className="text-2xl font-bold" style={{ color: "oklch(0.72 0.21 145)" }}>
                          {show.roboticsExhibitors}+
                        </div>
                        <div className="text-xs mt-1" style={{ color: "oklch(0.55 0.010 240)" }}>
                          Robotics Exhibitors
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {show.roboticsExhibitors && show.estimatedExhibitors && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1" style={{ color: "oklch(0.55 0.010 240)" }}>
                      <span>Robotics share of floor</span>
                      <span>{Math.round((show.roboticsExhibitors / show.estimatedExhibitors) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[oklch(0.18_0.008_240)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((show.roboticsExhibitors / show.estimatedExhibitors) * 100)}%`,
                          background: "oklch(0.72 0.21 145)",
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Why StageGate for this show */}
              <section
                className="rounded-xl p-5 border"
                style={{
                  background: "oklch(0.11 0.008 240)",
                  borderColor: "oklch(0.18 0.008 240)",
                }}
              >
                <h2 className="text-lg font-semibold text-white mb-3">Why Use StageGate at This Show</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Truck, text: "Airport & customs pickup for robot crates" },
                    { icon: Warehouse, text: "Secure Las Vegas warehouse storage" },
                    { icon: Zap, text: "On-site unpacking, assembly & power-up" },
                    { icon: HeadphonesIcon, text: "24/7 technical support during the show" },
                    { icon: Package, text: "Return shipping & re-crating after the show" },
                    { icon: BarChart3, text: "Brand promotion and booth traffic support" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "oklch(0.65 0.010 240)" }}>
                      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: "oklch(0.72 0.21 145)" }} />
                      {text}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column — booking form */}
            <div className="space-y-4">
              <div
                id="booking-form"
                className="rounded-xl border p-5 sticky top-20"
                style={{
                  background: "oklch(0.11 0.008 240)",
                  borderColor: "oklch(0.18 0.008 240)",
                }}
              >
                <h2 className="text-base font-semibold text-white mb-1">Book Services</h2>
                <p className="text-xs mb-4" style={{ color: "oklch(0.55 0.010 240)" }}>
                  Select the services you need for <span className="text-white font-medium">{show.name}</span>.
                </p>

                {show.status === "upcoming" ? (
                  <div className="text-center py-6 space-y-3">
                    <Bell size={28} className="mx-auto opacity-40" style={{ color: "oklch(0.72 0.21 145)" }} />
                    <p className="text-sm" style={{ color: "oklch(0.55 0.010 240)" }}>
                      Bookings are not yet open for this show.
                    </p>
                    <p className="text-xs" style={{ color: "oklch(0.45 0.008 240)" }}>
                      Enter your email above to be notified when they open.
                    </p>
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
                            className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
                            style={{
                              background: isSelected ? "oklch(0.72 0.21 145 / 0.08)" : "transparent",
                              border: `1px solid ${isSelected ? "oklch(0.72 0.21 145 / 0.30)" : "oklch(0.18 0.008 240)"}`,
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
                                <Icon size={13} style={{ color: isSelected ? "oklch(0.72 0.21 145)" : "oklch(0.55 0.010 240)" }} />
                                <span className="text-sm font-medium text-white">{svc.name}</span>
                              </div>
                              {svc.basePrice && (
                                <span className="text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
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
                      style={{
                        background: "oklch(0.14 0.008 240)",
                        borderColor: "oklch(0.22 0.010 240)",
                        color: "oklch(0.88 0.005 240)",
                      }}
                    />

                    {/* Submit */}
                    {isAuthenticated ? (
                      <Button
                        className="btn-primary w-full"
                        onClick={handleBooking}
                        disabled={selectedServices.length === 0 || orderSubmitting}
                      >
                        {orderSubmitting ? (
                          <><Loader2 size={15} className="animate-spin mr-2" /> Submitting…</>
                        ) : (
                          <>Submit Order ({selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""})</>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          className="btn-primary w-full"
                          onClick={() => navigate(getLoginUrl())}
                        >
                          Sign In to Book
                        </Button>
                        <p className="text-xs text-center" style={{ color: "oklch(0.45 0.008 240)" }}>
                          Free registration — no credit card required
                        </p>
                      </div>
                    )}

                    {selectedServices.length > 0 && (
                      <p className="text-xs text-center mt-2" style={{ color: "oklch(0.55 0.010 240)" }}>
                        {selectedServices.length} service{selectedServices.length !== 1 ? "s" : ""} selected
                        — our team will follow up with a detailed quote
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Quick quote CTA */}
              <div
                className="rounded-xl border p-4 text-center"
                style={{
                  background: "oklch(0.11 0.008 240)",
                  borderColor: "oklch(0.18 0.008 240)",
                }}
              >
                <p className="text-sm font-medium text-white mb-1">Not sure what you need?</p>
                <p className="text-xs mb-3" style={{ color: "oklch(0.55 0.010 240)" }}>
                  Get a personalized quote in 2 minutes.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="btn-default w-full"
                  onClick={() => setQuoteOpen(true)}
                >
                  Get a Free Quote
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GetQuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} preselectedShowId={show.id} />
    </>
  );
}
