import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Calendar, MapPin, ExternalLink, ArrowRight, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GetQuoteModal from "@/components/GetQuoteModal";
import Navbar from "@/components/Navbar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: "oklch(0.55 0.18 240 / 0.12)", text: "oklch(0.65 0.18 240)", label: "Upcoming" },
  active:   { bg: "oklch(0.55 0.18 145 / 0.12)", text: "oklch(0.65 0.18 145)", label: "Open Now" },
  completed:{ bg: "oklch(0.45 0.01 240 / 0.12)", text: "oklch(0.55 0.01 240)", label: "Completed" },
};

function formatDateRange(start: Date | string | null, end: Date | string | null): string {
  if (!start) return "Date TBD";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const yearOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (!e) return s.toLocaleDateString("en-US", yearOpts);
  if (s.getMonth() === e.getMonth()) {
    return `${s.toLocaleDateString("en-US", opts)}–${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", yearOpts)}`;
}

export default function ShowsCalendar() {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");

  const { data: shows = [], isLoading } = trpc.shows.lasVegas2026.useQuery();

  // Derive unique venues from the data
  const venues = useMemo(() => {
    const set = new Set<string>();
    shows.forEach((s) => { if (s.venue) set.add(s.venue); });
    return Array.from(set).sort();
  }, [shows]);

  // Derive which months have shows
  const activeMonths = useMemo(() => {
    const set = new Set<number>();
    shows.forEach((s) => {
      if (s.startDate) set.add(new Date(s.startDate).getMonth());
    });
    return set;
  }, [shows]);

  const filtered = useMemo(() => {
    return shows
      .filter((s) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !s.name.toLowerCase().includes(q) &&
            !(s.venue ?? "").toLowerCase().includes(q) &&
            !(s.city ?? "").toLowerCase().includes(q)
          ) return false;
        }
        if (selectedVenue !== "all" && s.venue !== selectedVenue) return false;
        if (selectedMonth !== "all" && s.startDate) {
          if (new Date(s.startDate).getMonth() !== selectedMonth) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const db = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        return da - db;
      });
  }, [shows, search, selectedVenue, selectedMonth]);

  // Group by month for the grid header
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((s) => {
      const key = s.startDate
        ? new Date(s.startDate).toLocaleString("en-US", { month: "long", year: "numeric" })
        : "Date TBD";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filtered]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        {/* ── Page Header ── */}
        <section className="border-b border-border pt-28 pb-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p
                  className="text-xs font-mono tracking-widest uppercase mb-3 flex items-center gap-2"
                  style={{ color: "oklch(0.55 0.18 145)" }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "oklch(0.55 0.18 145)" }}
                  />
                  2026 Las Vegas Show Calendar
                </p>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-tight">
                  Trade Shows &amp; Events
                </h1>
                <p className="text-muted-foreground mt-3 text-lg max-w-xl">
                  Every major Las Vegas trade show where robots are exhibited in 2026. Find your show, book StageGate services, and arrive ready.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Button
                  className="btn-primary gap-2"
                  onClick={() => setQuoteOpen(true)}
                >
                  Get a Quote <ArrowRight size={14} />
                </Button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="flex flex-wrap gap-6 mt-8 pt-8 border-t border-border">
              {[
                { label: "Shows Listed", value: shows.length },
                { label: "Unique Venues", value: venues.length },
                { label: "Las Vegas, NV", value: "2026" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono tracking-wide uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Filters ── */}
        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shows, venues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm bg-input border-border"
              />
            </div>

            {/* Venue filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={13} className="text-muted-foreground flex-shrink-0" />
              {["all", ...venues].map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVenue(v)}
                  className="px-3 py-1 rounded-full text-xs font-mono tracking-wide border transition-all"
                  style={{
                    borderColor: selectedVenue === v ? "oklch(0.55 0.18 145)" : "oklch(0.25 0.004 240)",
                    background: selectedVenue === v ? "oklch(0.55 0.18 145 / 0.10)" : "transparent",
                    color: selectedVenue === v ? "oklch(0.72 0.21 145)" : "oklch(0.55 0.008 240)",
                  }}
                >
                  {v === "all" ? "All Venues" : v.replace(" & Convention Center", "").replace(" Convention Center", "").replace(" Expo & Convention Center", " Expo")}
                </button>
              ))}
            </div>
          </div>

          {/* Month filter row */}
          <div className="max-w-6xl mx-auto px-6 pb-3 flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedMonth("all")}
              className="px-3 py-1 rounded-full text-xs font-mono border transition-all"
              style={{
                borderColor: selectedMonth === "all" ? "oklch(0.55 0.18 145)" : "oklch(0.22 0.004 240)",
                background: selectedMonth === "all" ? "oklch(0.55 0.18 145 / 0.10)" : "transparent",
                color: selectedMonth === "all" ? "oklch(0.72 0.21 145)" : "oklch(0.45 0.008 240)",
              }}
            >
              All Months
            </button>
            {MONTHS.map((m, i) => (
              <button
                key={m}
                onClick={() => setSelectedMonth(i)}
                disabled={!activeMonths.has(i)}
                className="px-3 py-1 rounded-full text-xs font-mono border transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  borderColor: selectedMonth === i ? "oklch(0.55 0.18 145)" : "oklch(0.22 0.004 240)",
                  background: selectedMonth === i ? "oklch(0.55 0.18 145 / 0.10)" : "transparent",
                  color: selectedMonth === i ? "oklch(0.72 0.21 145)" : "oklch(0.45 0.008 240)",
                }}
              >
                {m.slice(0, 3)}
              </button>
            ))}
          </div>
        </section>

        {/* ── Show Grid ── */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border p-5 animate-pulse"
                  style={{ background: "oklch(0.14 0.004 240)" }}
                >
                  <div className="h-4 rounded w-3/4 mb-3" style={{ background: "oklch(0.20 0.004 240)" }} />
                  <div className="h-3 rounded w-1/2 mb-2" style={{ background: "oklch(0.18 0.004 240)" }} />
                  <div className="h-3 rounded w-2/3" style={{ background: "oklch(0.18 0.004 240)" }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">📅</p>
              <p className="font-display font-semibold text-foreground text-lg">No shows match your filters</p>
              <p className="text-muted-foreground text-sm mt-2">Try adjusting the venue or month filter, or clear the search.</p>
              <Button
                variant="outline"
                className="mt-5 btn-default"
                onClick={() => { setSearch(""); setSelectedVenue("all"); setSelectedMonth("all"); }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-10">
              {Array.from(grouped.entries()).map(([monthLabel, monthShows]) => (
                <div key={monthLabel}>
                  {/* Month divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-display font-bold text-foreground text-lg">{monthLabel}</span>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-mono">{monthShows.length} show{monthShows.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {monthShows.map((show) => {
                      const statusStyle = STATUS_COLORS[show.status] ?? STATUS_COLORS.upcoming;
                      return (
                        <div
                          key={show.id}
                          className="group rounded-xl border border-border p-5 flex flex-col gap-4 transition-all hover:border-primary/40"
                          style={{ background: "oklch(0.12 0.004 240)" }}
                        >
                          {/* Top row: name + status */}
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/shows/${show.id}`}>
                              <h3 className="font-display font-semibold text-foreground text-base leading-snug group-hover:text-primary transition-colors cursor-pointer">
                                {show.name}
                              </h3>
                            </Link>
                            <span
                              className="flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full"
                              style={{ background: statusStyle.bg, color: statusStyle.text }}
                            >
                              {statusStyle.label}
                            </span>
                          </div>

                          {/* Meta */}
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar size={12} className="flex-shrink-0" />
                              <span>{formatDateRange(show.startDate, show.endDate)}</span>
                            </div>
                            {show.venue && (
                              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                                <span>{show.venue}{show.city ? `, ${show.city}` : ""}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1 border-t border-border">
                            <Link
                              href={`/order?showId=${show.id}`}
                              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg border transition-all"
                              style={{
                                borderColor: "oklch(0.55 0.18 145)",
                                color: "oklch(0.72 0.21 145)",
                                background: "oklch(0.55 0.18 145 / 0.07)",
                              }}
                            >
                              Book Services
                            </Link>
                            <button
                              onClick={() => setQuoteOpen(true)}
                              className="flex-1 text-xs font-semibold py-2 rounded-lg border transition-all"
                              style={{
                                borderColor: "oklch(0.28 0.004 240)",
                                color: "oklch(0.65 0.008 240)",
                                background: "transparent",
                              }}
                            >
                              Get a Quote
                            </button>
                            {show.website && (
                              <a
                                href={show.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg border transition-all hover:border-primary/40"
                                style={{ borderColor: "oklch(0.22 0.004 240)", color: "oklch(0.50 0.008 240)" }}
                                title="Show website"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Bottom CTA ── */}
        <section className="border-t border-border py-16">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="font-display text-3xl font-bold text-foreground mb-3">
              Don't see your show?
            </h2>
            <p className="text-muted-foreground mb-6">
              We support events across Las Vegas, Orlando, Chicago, and more. Get a quote and we'll confirm availability for your specific event.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button className="btn-primary gap-2" onClick={() => setQuoteOpen(true)}>
                Get a Quote <ArrowRight size={14} />
              </Button>
              <Link href="/register">
                <Button variant="outline" className="btn-default gap-2">
                  Register Free <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
