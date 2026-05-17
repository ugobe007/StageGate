import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Package, Warehouse, Zap, Wrench, Clock, GraduationCap, Monitor, TrendingUp, ArrowRight, CheckCircle, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

const SERVICE_ICONS: Record<string, React.ComponentType<any>> = {
  "inbound-logistics": Package,
  "warehousing-storage": Warehouse,
  "staging-activation": Zap,
  "live-technical-support": Wrench,
  "stagehand-247": Clock,
  "stagepro-training": GraduationCap,
  "showroom-demo": Monitor,
  "robot-sales-marketing": TrendingUp,
};

export default function ServiceOrder() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedShow, setSelectedShow] = useState<number | null>(null);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [notes, setNotes] = useState("");

  const { data: shows } = trpc.shows.list.useQuery();
  const { data: services } = trpc.services.list.useQuery();
  const { data: profile } = trpc.company.getMyProfile.useQuery(undefined, { enabled: isAuthenticated });

  const createOrder = trpc.orders.create.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data) => {
      toast.success(`Order #${data.orderId} placed successfully!`);
      navigate(`/orders/${data.orderId}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to place order");
    },
  });

  const toggleService = (id: number) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectedServiceDetails = (services || []).filter(s => selectedServices.includes(s.id));
  const total = selectedServiceDetails.reduce((sum, s) => sum + parseFloat(s.basePrice || "0"), 0);

  const handleSubmit = () => {
    if (!selectedShow) { toast.error("Please select a trade show"); return; }
    if (selectedServices.length === 0) { toast.error("Please select at least one service"); return; }
    createOrder.mutate({ showId: selectedShow, serviceIds: selectedServices, notes });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 container max-w-lg mx-auto text-center">
          <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
            <h1 className="text-3xl font-display font-bold mb-4">Sign In to Book Services</h1>
            <p className="text-muted-foreground mb-8">You need to be signed in and have a company profile to book services.</p>
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full gap-2">
                Sign In <ArrowRight size={16} />
              </Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="pt-32 pb-16 container max-w-lg mx-auto text-center">
          <div className="p-12 rounded-2xl border border-primary/30 bg-primary/5">
            <h1 className="text-3xl font-display font-bold mb-4">Register First</h1>
            <p className="text-muted-foreground mb-8">Please complete your company registration before booking services.</p>
            <Link href="/register">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold w-full gap-2">
                Register Your Company <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const upcomingShows = (shows || []).filter(s => s.status === "upcoming");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container max-w-4xl mx-auto">
          <div className="mb-10">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/30">Book Services</Badge>
            <h1 className="text-4xl font-display font-bold mb-2">Configure Your Service Order</h1>
            <p className="text-muted-foreground">Select a trade show and the services you need for <strong className="text-foreground">{profile.companyName}</strong>.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1: Select Show */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                  Select Trade Show
                </h2>
                <div className="space-y-2">
                  {upcomingShows.map((show) => (
                    <button
                      key={show.id}
                      type="button"
                      onClick={() => setSelectedShow(show.id)}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        selectedShow === show.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{show.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{show.venue} · {show.city}</div>
                        </div>
                        <div className="text-right shrink-0">
                          {show.startDate && (
                            <div className="text-xs text-primary font-medium">
                              {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                          )}
                          {selectedShow === show.id && (
                            <CheckCircle size={14} className="text-primary ml-auto mt-1" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Services */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
                  Select Services
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(services || []).map((svc) => {
                    const Icon = SERVICE_ICONS[svc.slug] || Package;
                    const selected = selectedServices.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => toggleService(svc.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-secondary/30 hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${selected ? "bg-primary/20" : ""}`}>
                            <Icon size={16} className={selected ? "text-primary" : "text-muted-foreground"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium text-xs leading-tight ${selected ? "text-primary" : "text-foreground"}`}>
                              {svc.name}
                            </div>
                            {svc.basePrice && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                From ${parseFloat(svc.basePrice).toLocaleString()} {svc.priceUnit}
                              </div>
                            )}
                          </div>
                          {selected && <CheckCircle size={14} className="text-primary shrink-0 mt-0.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Notes */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
                  Additional Notes
                </h2>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Robot model, special requirements, crate dimensions, power needs, etc."
                  className="bg-input border-border resize-none"
                  rows={4}
                />
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 p-6 rounded-xl border border-border bg-card">
                <h2 className="font-display font-semibold text-foreground mb-4">Order Summary</h2>

                <div className="text-sm text-muted-foreground mb-3">
                  <span className="font-medium text-foreground">{profile.companyName}</span>
                </div>

                {selectedShow && (
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {(shows || []).find(s => s.id === selectedShow)?.name}
                      </span>
                    </div>
                  </div>
                )}

                {selectedServiceDetails.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {selectedServiceDetails.map((svc) => (
                      <div key={svc.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground truncate mr-2">{svc.name}</span>
                        <span className="text-foreground font-medium shrink-0">
                          {svc.basePrice ? `$${parseFloat(svc.basePrice).toLocaleString()}` : "Custom"}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 flex items-center justify-between font-semibold">
                      <span className="text-foreground">Estimated Total</span>
                      <span className="text-primary text-lg">${total.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No services selected yet
                  </div>
                )}

                <p className="text-xs text-muted-foreground mb-4">
                  Final pricing confirmed after review. Custom quotes available for multi-show packages.
                </p>

                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-2"
                  onClick={handleSubmit}
                  disabled={createOrder.isPending || !selectedShow || selectedServices.length === 0}
                >
                  {createOrder.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Placing Order...</>
                  ) : (
                    <>Place Order <ArrowRight size={16} /></>
                  )}
                </Button>

                <Link href="/dashboard" className="block mt-3">
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
