import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Calendar, MapPin, ExternalLink, ArrowRight, Search, Filter, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import GetQuoteModal from "@/components/GetQuoteModal";
import Navbar from "@/components/Navbar";

/* ── Palette ─────────────────────────────────────────────────────────── */
const BG     = "oklch(0.11 0.012 262)";
const CARD   = "oklch(0.14 0.014 262)";
const BORDER = "oklch(0.22 0.016 262)";
const INDIGO = "oklch(0.72 0.20 262)";
const AMBER  = "oklch(0.78 0.18 75)";
const TEXT_HI  = "oklch(0.93 0.005 240)";
const TEXT_MID = "oklch(0.70 0.008 240)";
const TEXT_DIM = "oklch(0.50 0.010 240)";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
  upcoming:  { color: INDIGO,                   label: "Upcoming" },
  active:    { color: "oklch(0.62 0.18 145)",   label: "Open Now" },
  completed: { color: TEXT_DIM,                  label: "Completed" },
};

type CalendarMode = "lasvegas" | "other";

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
  const [quoteOpen, setQuoteOpen]     = useState(false);
  const [search, setSearch]           = useState("");
  const [selectedVenue, setSelectedVenue]   = useState<string>("all");
  const [selectedMonth, setSelectedMonth]   = useState<number | "all">("all");
  const [mode, setMode]               = useState<CalendarMode>("lasvegas");

  const { data: lvShows = [], isLoading: lvLoading } = trpc.shows.lasVegas2026.useQuery();
  const { data: otherShows = [], isLoading: otherLoading } = trpc.shows.otherShows.useQuery();

  const shows = mode === "lasvegas" ? lvShows : otherShows;
  const isLoading = mode === "lasvegas" ? lvLoading : otherLoading;

  // For Las Vegas mode: group by venue; for other mode: group by city
  const venues = useMemo(() => {
    if (mode !== "lasvegas") return [];
    const set = new Set<string>();
    lvShows.forEach((s) => { if (s.venue) set.add(s.venue); });
    return Array.from(set).sort();
  }, [lvShows, mode]);

  const cities = useMemo(() => {
    if (mode !== "other") return [];
    const set = new Set<string>();
    otherShows.forEach((s) => { if (s.city) set.add(s.city); });
    return Array.from(set).sort();
  }, [otherShows, mode]);

  const activeMonths = useMemo(() => {
    const set = new Set<number>();
    shows.forEach((s) => { if (s.startDate) set.add(new Date(s.startDate).getMonth()); });
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
        if (mode === "lasvegas" && selectedVenue !== "all" && s.venue !== selectedVenue) return false;
        if (mode === "other" && selectedVenue !== "all" && (s.city ?? "") !== selectedVenue) return false;
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
  }, [shows, search, selectedVenue, selectedMonth, mode]);

  // Group by month for LV; group by city then month for other
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((s) => {
      let key: string;
      if (mode === "other") {
        key = s.city ?? "Location TBD";
      } else {
        key = s.startDate
          ? new Date(s.startDate).toLocaleString("en-US", { month: "long", year: "numeric" })
          : "Date TBD";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [filtered, mode]);

  function switchMode(next: CalendarMode) {
    setMode(next);
    setSearch("");
    setSelectedVenue("all");
    setSelectedMonth("all");
  }

  const accentColor = mode === "lasvegas" ? INDIGO : AMBER;

  return (
    <>
      <Navbar />
      <div className="min-h-screen" style={{ background: BG, color: TEXT_HI }}>

        {/* ── Page Header ── */}
        <section className="border-b pt-36 pb-12" style={{ borderColor: BORDER, background: CARD }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="section-label mb-3 flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
                  {mode === "lasvegas" ? "2026 Las Vegas Show Calendar" : "National & International Shows"}
                </p>
                <h1
                  className="text-4xl md:text-5xl font-bold leading-tight"
                  style={{ color: TEXT_HI, letterSpacing: "-0.035em" }}
                >
                  Trade Shows &amp; Events
                </h1>
                <p className="mt-3 text-base max-w-xl" style={{ color: TEXT_MID }}>
                  {mode === "lasvegas"
                    ? "Every major Las Vegas trade show where robots are exhibited in 2026. Find your show, book StageGate services, and arrive ready."
                    : "National and international trade shows with significant robotics presence. We can support your team wherever you exhibit."}
                </p>
              </div>

              <div className="flex flex-col items-start md:items-end gap-3">
                {/* ── Calendar mode toggle ── */}
                <div
                  className="flex rounded-lg border p-0.5 gap-0.5"
                  style={{ borderColor: BORDER, background: BG }}
                >
                  <button
                    onClick={() => switchMode("lasvegas")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                    style={{
                      background: mode === "lasvegas" ? `${INDIGO}18` : "transparent",
                      color: mode === "lasvegas" ? INDIGO : TEXT_DIM,
                      borderRight: `1px solid ${BORDER}`,
                    }}
                  >
                    <MapPin size={11} />
                    Las Vegas Shows
                  </button>
                  <button
                    onClick={() => switchMode("other")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
                    style={{
                      background: mode === "other" ? `${AMBER}18` : "transparent",
                      color: mode === "other" ? AMBER : TEXT_DIM,
                    }}
                  >
                    <Globe size={11} />
                    All Other Shows
                  </button>
                </div>

                <button className="btn-primary flex-shrink-0" onClick={() => setQuoteOpen(true)}>
                  Get a quote <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="flex flex-wrap gap-8 mt-8 pt-8 border-t" style={{ borderColor: BORDER }}>
              {(mode === "lasvegas" ? [
                { label: "Shows Listed", value: lvShows.length },
                { label: "Unique Venues", value: venues.length },
                { label: "Location", value: "Las Vegas, NV" },
              ] : [
                { label: "Shows Listed", value: otherShows.length },
                { label: "Cities", value: cities.length },
                { label: "Coverage", value: "US & International" },
              ]).map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold" style={{ color: TEXT_HI, letterSpacing: "-0.03em" }}>
                    {stat.value}
                  </p>
                  <p className="text-xs mt-0.5 font-mono tracking-wide uppercase" style={{ color: TEXT_DIM }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Filters ── */}
        <section
          className="sticky top-20 z-30 border-b"
          style={{ background: `${CARD}f5`, backdropFilter: "blur(12px)", borderColor: BORDER }}
        >
          <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEXT_DIM }} />
              <Input
                placeholder={mode === "lasvegas" ? "Search shows, venues..." : "Search shows, cities..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                style={{ background: BG, borderColor: BORDER, color: TEXT_HI }}
              />
            </div>

            {/* Venue / City filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={12} style={{ color: TEXT_DIM }} className="flex-shrink-0" />
              {["all", ...(mode === "lasvegas" ? venues : cities)].map((v) => {
                const active = selectedVenue === v;
                return (
                  <button
                    key={v}
                    onClick={() => setSelectedVenue(v)}
                    className="px-2.5 py-1 rounded-full text-xs font-mono border transition-all"
                    style={{
                      borderColor: active ? `${accentColor}55` : BORDER,
                      background: active ? `${accentColor}0d` : "transparent",
                      color: active ? accentColor : TEXT_DIM,
                    }}
                  >
                    {v === "all"
                      ? (mode === "lasvegas" ? "All Venues" : "All Cities")
                      : mode === "lasvegas"
                        ? v.replace(" & Convention Center", "").replace(" Convention Center", "").replace(" Expo & Convention Center", " Expo")
                        : v}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month filter */}
          <div className="max-w-6xl mx-auto px-6 pb-3 flex gap-1.5 flex-wrap">
            {(["all", ...MONTHS.map((_, i) => i)] as Array<"all" | number>).map((val) => {
              const label = val === "all" ? "All" : MONTHS[val as number].slice(0, 3);
              const active = selectedMonth === val;
              const disabled = val !== "all" && !activeMonths.has(val as number);
              return (
                <button
                  key={String(val)}
                  onClick={() => !disabled && setSelectedMonth(val)}
                  disabled={disabled}
                  className="px-2.5 py-1 rounded-full text-xs font-mono border transition-all disabled:opacity-25 disabled:cursor-not-allowed"
                  style={{
                    borderColor: active ? `${accentColor}55` : BORDER,
                    background: active ? `${accentColor}0d` : "transparent",
                    color: active ? accentColor : TEXT_DIM,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Show Grid ── */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-5 animate-pulse" style={{ background: CARD, borderColor: BORDER, height: "160px" }} />
              ))}
            </div>
          ) : filtered.length === 0 && shows.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">📅</p>
              <p className="font-semibold text-lg" style={{ color: TEXT_HI }}>
                {mode === "lasvegas" ? "2026 Show Calendar Coming Soon" : "Other Shows Coming Soon"}
              </p>
              <p className="text-sm mt-2 max-w-sm mx-auto" style={{ color: TEXT_DIM }}>
                Get a quote now and we'll confirm availability for your specific event.
              </p>
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                <button className="btn-primary" onClick={() => setQuoteOpen(true)}>
                  Get a quote <ArrowRight size={14} />
                </button>
                <Link href="/register">
                  <span className="btn-default">Register free <ArrowRight size={14} /></span>
                </Link>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">📅</p>
              <p className="font-semibold text-lg" style={{ color: TEXT_HI }}>No shows match your filters</p>
              <p className="text-sm mt-2" style={{ color: TEXT_DIM }}>Try adjusting the filters, or clear the search.</p>
              <button
                className="btn-default mt-5"
                onClick={() => { setSearch(""); setSelectedVenue("all"); setSelectedMonth("all"); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {Array.from(grouped.entries()).map(([groupLabel, groupShows]) => (
                <div key={groupLabel}>
                  {/* Group divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-bold text-base" style={{ color: TEXT_HI, letterSpacing: "-0.02em" }}>
                      {groupLabel}
                    </span>
                    <div className="flex-1 h-px" style={{ background: BORDER }} />
                    <span className="text-xs font-mono" style={{ color: TEXT_DIM }}>
                      {groupShows.length} show{groupShows.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {groupShows.map((show) => {
                      const statusStyle = STATUS_COLORS[show.status] ?? STATUS_COLORS.upcoming;
                      return (
                        <div
                          key={show.id}
                          className="rounded-xl border p-5 flex flex-col gap-4 transition-colors"
                          style={{ background: CARD, borderColor: BORDER }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${accentColor}44`; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
                        >
                          {/* Top row: name + status */}
                          <div className="flex items-start justify-between gap-2">
                            <Link href={`/shows/${show.id}`}>
                              <h3 className="font-semibold text-sm leading-snug cursor-pointer hover:opacity-80 transition-opacity" style={{ color: TEXT_HI }}>
                                {show.name}
                              </h3>
                            </Link>
                            <span
                              className="flex-shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full border"
                              style={{ color: statusStyle.color, borderColor: `${statusStyle.color}44`, background: `${statusStyle.color}0d` }}
                            >
                              {statusStyle.label}
                            </span>
                          </div>

                          {/* Meta */}
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 text-xs" style={{ color: TEXT_DIM }}>
                              <Calendar size={11} className="flex-shrink-0" />
                              <span>{formatDateRange(show.startDate, show.endDate)}</span>
                            </div>
                            {show.venue && (
                              <div className="flex items-start gap-2 text-xs" style={{ color: TEXT_DIM }}>
                                <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                                <span>{show.venue}{show.city ? `, ${show.city}` : ""}</span>
                              </div>
                            )}
                            {!show.venue && show.city && (
                              <div className="flex items-start gap-2 text-xs" style={{ color: TEXT_DIM }}>
                                <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                                <span>{show.city}</span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: BORDER }}>
                            <Link
                              href={`/order?showId=${show.id}`}
                              className="flex-1 text-center text-xs font-medium py-1.5 rounded border transition-all"
                              style={{ borderColor: `${accentColor}44`, color: accentColor, background: `${accentColor}0d` }}
                            >
                              Book services
                            </Link>
                            <button
                              onClick={() => setQuoteOpen(true)}
                              className="flex-1 text-xs font-medium py-1.5 rounded border transition-all"
                              style={{ borderColor: BORDER, color: TEXT_DIM, background: "transparent" }}
                            >
                              Get a quote
                            </button>
                            {show.website && (
                              <a
                                href={show.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded border transition-all"
                                style={{ borderColor: BORDER, color: TEXT_DIM }}
                                title="Show website"
                              >
                                <ExternalLink size={12} />
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
        <section className="border-t py-16" style={{ borderColor: BORDER, background: CARD }}>
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-3" style={{ color: TEXT_HI, letterSpacing: "-0.025em" }}>
              Don't see your show?
            </h2>
            <p className="mb-6 text-sm" style={{ color: TEXT_DIM }}>
              {mode === "lasvegas"
                ? "We support events across Las Vegas, Orlando, Chicago, and more. Get a quote and we'll confirm availability for your specific event."
                : "We can support your robot at any show, anywhere. Get a quote and we'll build a logistics plan for your team."}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button className="btn-primary" onClick={() => setQuoteOpen(true)}>
                Get a quote <ArrowRight size={14} />
              </button>
              <Link href="/register">
                <span className="btn-default">Register free <ArrowRight size={14} /></span>
              </Link>
            </div>
            <p className="mt-5 text-xs" style={{ color: TEXT_DIM }}>
              <Link href="/newsletter">
                <span className="cursor-pointer hover:opacity-80 transition-opacity" style={{ color: INDIGO }}>
                  Get show alerts &amp; robotics news →
                </span>
              </Link>
            </p>
          </div>
        </section>
      </div>
      <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
