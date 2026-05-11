import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Package, Calendar, CheckCircle, Clock, AlertCircle, XCircle,
  ArrowRight, Loader2, User, Building2, Globe, Phone, Mail
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: CheckCircle },
  in_progress: { label: "In Progress", color: "bg-primary/20 text-primary border-primary/30", icon: AlertCircle },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
};

export default function ClientDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: profile, isLoading: profileLoading } = trpc.company.getMyProfile.useQuery(undefined, { enabled: isAuthenticated });
  const { data: orders, isLoading: ordersLoading } = trpc.orders.myOrders.useQuery(undefined, { enabled: isAuthenticated });
  const { data: shows } = trpc.shows.list.useQuery();

  if (loading || profileLoading) {
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
            <h1 className="text-3xl font-display font-bold mb-4">Sign In Required</h1>
            <p className="text-muted-foreground mb-8">Please sign in to access your dashboard.</p>
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
            <h1 className="text-3xl font-display font-bold mb-4">Complete Your Profile</h1>
            <p className="text-muted-foreground mb-8">
              You need to register your company before accessing the dashboard.
            </p>
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

  const robotTypes = profile.robotTypes ? JSON.parse(profile.robotTypes) : [];
  const upcomingShows = (shows || []).filter(s => s.status === "upcoming");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 pb-16">
        <div className="container">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">{profile.companyName}</h1>
              <p className="text-muted-foreground mt-1">Welcome back, {user?.name || "there"}</p>
            </div>
            <div className="flex gap-3">
              <Link href="/order">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
                  Book Services <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="border-border text-muted-foreground hover:text-foreground">
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Company Profile */}
            <div className="lg:col-span-1 space-y-6">
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-display font-semibold text-foreground mb-5 flex items-center gap-2">
                  <Building2 size={16} className="text-primary" />
                  Company Profile
                </h2>
                <div className="space-y-3">
                  {profile.contactName && (
                    <div className="flex items-start gap-2">
                      <User size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground">{profile.contactName}</span>
                    </div>
                  )}
                  {profile.contactEmail && (
                    <div className="flex items-start gap-2">
                      <Mail size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground">{profile.contactEmail}</span>
                    </div>
                  )}
                  {profile.contactPhone && (
                    <div className="flex items-start gap-2">
                      <Phone size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                      <span className="text-sm text-foreground">{profile.contactPhone}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-start gap-2">
                      <Globe size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                        {profile.website}
                      </a>
                    </div>
                  )}
                  {profile.country && (
                    <div className="text-sm text-muted-foreground">📍 {profile.country}</div>
                  )}
                </div>
                {robotTypes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Robot Types</p>
                    <div className="flex flex-wrap gap-1.5">
                      {robotTypes.map((t: string) => (
                        <Badge key={t} className="bg-secondary text-muted-foreground border-border text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {profile.description && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground leading-relaxed">{profile.description}</p>
                  </div>
                )}
              </div>

              {/* Upcoming Shows */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Calendar size={16} className="text-primary" />
                  Upcoming Shows
                </h2>
                <div className="space-y-3">
                  {upcomingShows.slice(0, 4).map((show) => (
                    <div key={show.id} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                      <div className="font-medium text-sm text-foreground">{show.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{show.venue}</div>
                      {show.startDate && (
                        <div className="text-xs text-primary mt-1">
                          {new Date(show.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Link href="/order" className="block mt-4">
                  <Button variant="outline" size="sm" className="w-full border-primary/30 text-primary hover:bg-primary/10 gap-1.5">
                    Book a Show <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right: Orders */}
            <div className="lg:col-span-2">
              <div className="p-6 rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                    <Package size={16} className="text-primary" />
                    Service Orders
                  </h2>
                  <Link href="/order">
                    <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5">
                      New Order <ArrowRight size={14} />
                    </Button>
                  </Link>
                </div>

                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : !orders || orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package size={40} className="text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">No orders yet</p>
                    <p className="text-sm text-muted-foreground/70 mt-1 mb-6">Book your first service to get started.</p>
                    <Link href="/order">
                      <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2">
                        Book Services <ArrowRight size={16} />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => {
                      const show = (shows || []).find(s => s.id === order.showId);
                      const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                      const StatusIcon = status.icon;
                      return (
                        <div key={order.id} className="p-4 rounded-xl border border-border bg-secondary/30 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-foreground">Order #{order.id}</span>
                              <Badge className={`text-xs ${status.color}`}>
                                <StatusIcon size={10} className="mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{show?.name || `Show #${order.showId}`}</div>
                            {order.notes && (
                              <div className="text-xs text-muted-foreground/70 mt-1 truncate">{order.notes}</div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {order.totalAmount && (
                              <div className="font-semibold text-sm text-foreground">
                                ${parseFloat(order.totalAmount).toLocaleString()}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
