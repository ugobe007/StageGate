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

const BLUE = "oklch(0.52 0.22 262)";
const BLUE_BG = "oklch(0.52 0.22 262 / 0.08)";
const BLUE_BORDER = "oklch(0.52 0.22 262 / 0.25)";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  upcoming:  { bg: "oklch(0.52 0.22 262 / 0.08)", text: "oklch(0.52 0.22 262)", border: "oklch(0.52 0.22 262 / 0.25)", label: "Upcoming" },
  active:    { bg: "oklch(0.45 0.18 145 / 0.08)", text: "oklch(0.45 0.18 145)", border: "oklch(0.45 0.18 145 / 0.25)", label: "Open Now" },
  completed: { bg: "oklch(0.92 0.004 240)",        text: "oklch(0.55 0.010 240)", border: "oklch(0.85 0.006 240)",       label: "Completed" },
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

  const venues = useMemo(() => {
    const set = new Set<string>();
    shows.forEach((s) => { if (s.venue) set.add(s.venue); });
    return Array.from(set).sort();
  }, [shows]);

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
      <div className="min-h-screen" style={{ background: "oklch(0.98 0.002 240)", color: "oklch(0.10 0.010 240)" }}>

        {/* ── Page Header ── */}
        <section
          className="border-b pt-28 pb-12"
          style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(1.00 0.000 0)" }}
        >
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p
                  className="text-xs font-mono tracking-widest uppercase mb-3 flex items-center gap-2"
                  style={{ color: BLUE }}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />
                  2026 Las Vegas Show Calendar
                </p>
                <h1
                  className="text-4xl md:text-5xl font-extrabold leading-tight"
                  style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.035em" }}
                >
                  Trade Shows &amp; Events
                </h1>
                <p className="mt-3 text-lg max-w-xl" style={{ color: "oklch(0.45 0.010 240)" }}>
                  Every major Las Vegas trade show where robots are exhibited in 2026. Find your show, book StageGate services, and arrive ready.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Button className="btn-primary gap-2" onClick={() => setQuoteOpen(true)}>
                  Get a Quote <ArrowRight size={14} />
                </Button>
              </div>
            </div>

            {/* Stats strip */}
            <div
              className="flex flex-wrap gap-6 mt-8 pt-8 border-t"
              style={{ borderColor: "oklch(0.90 0.005 240)" }}
            >
              {[
                { label: "Shows Listed", value: shows.length },
                { label: "Unique Venues", value: venues.length },
                { label: "Las Vegas, NV", value: "2026" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p
                    className="text-2xl font-extrabold"
                    style={{ color: "oklch(0.08 0.010 240)", letterSpacing: "-0.03em" }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="text-xs mt-0.5 font-mono tracking-wide uppercase"
                    style={{ color: "oklch(0.55 0.010 240)" }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Filters ── */}
        <section
          className="sticky top-16 z-30 border-b"
          style={{
            background: "oklch(1.00 0.000 0 / 0.95)",
            backdropFilter: "blur(8px)",
            borderColor: "oklch(0.90 0.005 240)",
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.60 0.010 240)" }} />
              <Input
                placeholder="Search shows, venues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
                style={{
                  background: "oklch(0.97 0.003 240)",
                  borderColor: "oklch(0.88 0.006 240)",
                  color: "oklch(0.10 0.010 240)",
                }}
              />
            </div>

            {/* Venue filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={13} style={{ color: "oklch(0.60 0.010 240)" }} className="flex-shrink-0" />
              {["all", ...venues].map((v) => (
                <button
                  key={v}
                  onClick={() => setSelectedVenue(v)}
                  className="px-3 py-1 rounded-full text-xs font-mono tracking-wide border transition-all"
                  style={{
                    borderColor: selectedVenue === v ? BLUE : "oklch(0.85 0.006 240)",
                    background: selectedVenue === v ? BLUE_BG : "transparent",
                    color: selectedVenue === v ? BLUE : "oklch(0.50 0.010 240)",
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
                borderColor: selectedMonth === "all" ? BLUE : "oklch(0.85 0.006 240)",
                background: selectedMonth === "all" ? BLUE_BG : "transparent",
                color: selectedMonth === "all" ? BLUE : "oklch(0.50 0.010 240)",
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
                  borderColor: selectedMonth === i ? BLUE : "oklch(0.85 0.006 240)",
                  background: selectedMonth === i ? BLUE_BG : "transparent",
                  color: selectedMonth === i ? BLUE : "oklch(0.50 0.010 240)",
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
                  className="rounded-xl border p-5 animate-pulse"
                  style={{ background: "oklch(0.94 0.004 240)", borderColor: "oklch(0.90 0.005 240)" }}
                >
                  <div className="h-4 rounded w-3/4 mb-3" style={{ background: "oklch(0.88 0.006 240)" }} />
                  <div className="h-3 rounded w-1/2 mb-2" style={{ background: "oklch(0.90 0.005 240)" }} />
                  <div className="h-3 rounded w-2/3" style={{ background: "oklch(0.90 0.005 240)" }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">📅</p>
              <p className="font-bold text-lg" style={{ color: "oklch(0.10 0.010 240)" }}>No shows match your filters</p>
              <p className="text-sm mt-2" style={{ color: "oklch(0.52 0.010 240)" }}>Try adjusting the venue or month filter, or clear the search.</p>
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
                    <span
                      className="font-extrabold text-lg"
                      style={{ color: "oklch(0.10 0.010 240)", letterSpacing: "-0.025em" }}
                    >
                      {monthLabel}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "oklch(0.88 0.006 240)" }} />
                    <span className="text-xs font-mono" style={{ color: "oklch(0.55 0.010 240)" }}>
                      {monthShows.length} show{monthShows.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {monthShows.map((show) => {
                      const statusStyle = STATUS_COLORS[show.status] ?? STATUS_COLORS.upcoming;
                      return (
                        <div
                          key={show.id}
                          className="group rounded-xl border p-5 flex flex-col gap-4 transition-all"
                          style={{
                            background: "oklch(1.00 0.000 0)",
                            borderColor: "oklch(0.90 0.005 240)",
                            boxShadow: "0 1px 4px oklch(0 0 0 / 0.04)",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = BLUE_BORDER;
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px oklch(0 0 0 / 0.08)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.90 0.005 240)";
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px oklch(0 0 0 / 0.04)";
                          }}
                        >
                          {/* Top row: name + status */}
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/shows/${show.id}`}>
                              <h3
                                className="font-bold text-base leading-snug cursor-pointer transition-colors"
                                style={{ color: "oklch(0.10 0.010 240)" }}
                              >
                                {show.name}
                              </h3>
                            </Link>
                            <span
                              className="flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
                              style={{ background: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}
                            >
                              {statusStyle.label}
                            </span>
                          </div>

                          {/* Meta */}
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.52 0.010 240)" }}>
                              <Calendar size={12} className="flex-shrink-0" />
                              <span>{formatDateRange(show.startDate, show.endDate)}</span>
                            </div>
                            {show.venue && (
                              <div className="flex items-start gap-2 text-xs" style={{ color: "oklch(0.52 0.010 240)" }}>
                                <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                                <span>{show.venue}{show.city ? `, ${show.city}` : ""}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div
                            className="flex items-center gap-2 pt-3 border-t"
                            style={{ borderColor: "oklch(0.92 0.004 240)" }}
                          >
                            <Link
                              href={`/order?showId=${show.id}`}
                              className="flex-1 text-center text-xs font-bold py-2 rounded-lg border transition-all"
                              style={{
                                borderColor: BLUE_BORDER,
                                color: BLUE,
                                background: BLUE_BG,
                              }}
                            >
                              Book Services
                            </Link>
                            <button
                              onClick={() => setQuoteOpen(true)}
                              className="flex-1 text-xs font-semibold py-2 rounded-lg border transition-all"
                              style={{
                                borderColor: "oklch(0.88 0.006 240)",
                                color: "oklch(0.45 0.010 240)",
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
                                className="p-2 rounded-lg border transition-all"
                                style={{ borderColor: "oklch(0.88 0.006 240)", color: "oklch(0.55 0.010 240)" }}
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
        <section
          className="border-t py-16"
          style={{ borderColor: "oklch(0.90 0.005 240)", background: "oklch(0.10 0.010 240)" }}
        >
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2
              className="text-3xl font-extrabold mb-3"
              style={{ color: "oklch(0.97 0.002 240)", letterSpacing: "-0.03em" }}
            >
              Don't see your show?
            </h2>
            <p className="mb-6" style={{ color: "oklch(0.60 0.010 240)" }}>
              We support events across Las Vegas, Orlando, Chicago, and more. Get a quote and we'll confirm availability for your specific event.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button className="btn-primary gap-2" onClick={() => setQuoteOpen(true)}>
                Get a Quote <ArrowRight size={14} />
              </Button>
              <Link href="/register">
                <Button
                  variant="outline"
                  className="btn-default gap-2"
                  style={{
                    background: "oklch(1.00 0.000 0 / 0.08)",
                    borderColor: "oklch(1.00 0.000 0 / 0.20)",
                    color: "oklch(0.88 0.005 240)",
                  }}
                >
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
