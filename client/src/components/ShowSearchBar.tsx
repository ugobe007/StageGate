import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Search, Calendar, MapPin, ArrowRight, Loader2, X, Bell, CheckCircle2, Mail } from "lucide-react";

type Show = {
  id: number;
  name: string;
  venue: string | null;
  city: string | null;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: "upcoming" | "active" | "completed";
};

function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start) return "Date TBD";
  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!end) return fmt(start);
  const s = new Date(start);
  const e = new Date(end);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${new Date(end).toLocaleDateString("en-US", { day: "numeric", year: "numeric" })}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

const STATUS_COLORS: Record<string, string> = {
  upcoming:  "oklch(0.55 0.18 145)",
  active:    "oklch(0.70 0.20 55)",
  completed: "oklch(0.50 0.008 240)",
};

const STATUS_BG: Record<string, string> = {
  upcoming:  "oklch(0.55 0.18 145 / 0.12)",
  active:    "oklch(0.70 0.20 55 / 0.12)",
  completed: "oklch(0.50 0.008 240 / 0.12)",
};

interface ShowSearchBarProps {
  showCityFilter?: boolean;
  placeholder?: string;
  onSelect?: (show: Show) => void;
}

const CITY_FILTERS = [
  { label: "All Cities", value: "" },
  { label: "Las Vegas", value: "las vegas" },
  { label: "Orlando",   value: "orlando" },
  { label: "Chicago",   value: "chicago" },
  { label: "New York",  value: "new york" },
];

// ── Inline Notify Me widget ────────────────────────────────────────────────────
function NotifyMeRow({ show }: { show: Show }) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const notifyMutation = trpc.shows.notifyMe.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setAlreadyExists(data.alreadyExists);
    },
    onError: (err) => {
      setEmailError(err.message || "Something went wrong. Please try again.");
    },
  });

  function handleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEmailError("");
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    notifyMutation.mutate({ showId: show.id, email: trimmed });
  }

  if (submitted) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1.5"
        style={{ background: alreadyExists ? "oklch(0.65 0.18 245 / 0.10)" : "oklch(0.55 0.18 145 / 0.10)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircle2 size={13} style={{ color: alreadyExists ? "oklch(0.65 0.18 245)" : "oklch(0.55 0.18 145)", flexShrink: 0 }} />
        <span className="text-xs" style={{ color: alreadyExists ? "oklch(0.65 0.18 245)" : "oklch(0.72 0.21 145)" }}>
          {alreadyExists
            ? "You're already on the list for this show."
            : "Got it! We'll email you when bookings open."}
        </span>
      </div>
    );
  }

  if (expanded) {
    return (
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col gap-1.5 mt-1.5"
      >
        <div className="flex items-center gap-1.5">
          <div
            className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
            style={{
              background: "oklch(0.13 0.006 240)",
              borderColor: emailError ? "oklch(0.65 0.20 25 / 0.60)" : "oklch(0.55 0.18 145 / 0.40)",
            }}
          >
            <Mail size={11} style={{ color: "oklch(0.45 0.008 240)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="your@email.com"
              className="flex-1 bg-transparent outline-none text-xs"
              style={{ color: "oklch(0.90 0.004 240)" }}
              aria-label="Email for booking notification"
            />
          </div>
          <button
            type="submit"
            disabled={notifyMutation.isPending}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150"
            style={{
              background: "oklch(0.55 0.18 145)",
              color: "oklch(0.08 0.006 240)",
              opacity: notifyMutation.isPending ? 0.7 : 1,
            }}
          >
            {notifyMutation.isPending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <>Notify me</>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); setEmail(""); setEmailError(""); }}
            className="flex-shrink-0 p-1 rounded transition-opacity hover:opacity-60"
            aria-label="Cancel"
          >
            <X size={11} style={{ color: "oklch(0.45 0.008 240)" }} />
          </button>
        </div>
        {emailError && (
          <p className="text-[10px] pl-1" style={{ color: "oklch(0.65 0.20 25)" }}>
            {emailError}
          </p>
        )}
      </form>
    );
  }

  return (
    <button
      onClick={handleExpand}
      className="flex items-center gap-1.5 mt-1.5 text-[11px] transition-opacity hover:opacity-80"
      style={{ color: "oklch(0.50 0.008 240)" }}
      aria-label={`Get notified when bookings open for ${show.name}`}
    >
      <Bell size={10} style={{ color: "oklch(0.55 0.18 145)" }} />
      Notify me when bookings open
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShowSearchBar({
  showCityFilter = true,
  placeholder = "Search trade shows — CES, NAB, MODEX, AWS re:Invent…",
  onSelect,
}: ShowSearchBarProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching } = trpc.shows.search.useQuery(
    { query: debouncedQuery, city: cityFilter || undefined },
    { enabled: open }
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = useCallback(
    (show: Show) => {
      setOpen(false);
      setQuery(show.name);
      setActiveIdx(-1);
      if (onSelect) {
        onSelect(show);
      } else {
        navigate(`/order?showId=${show.id}`);
      }
    },
    [navigate, onSelect]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        handleSelect(results[activeIdx] as Show);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  function clearQuery() {
    setQuery("");
    setDebouncedQuery("");
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto">
      {/* City filter pills */}
      {showCityFilter && (
        <div className="flex flex-wrap gap-2 mb-3">
          {CITY_FILTERS.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCityFilter(c.value); setOpen(true); }}
              className="px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150"
              style={
                cityFilter === c.value
                  ? { background: "oklch(0.55 0.18 145 / 0.15)", borderColor: "oklch(0.55 0.18 145 / 0.50)", color: "oklch(0.72 0.18 145)" }
                  : { background: "transparent", borderColor: "oklch(0.22 0.008 240)", color: "oklch(0.52 0.008 240)" }
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200"
          style={{
            background: "oklch(0.11 0.006 240)",
            borderColor: open ? "oklch(0.55 0.18 145 / 0.55)" : "oklch(0.22 0.008 240)",
            boxShadow: open ? "0 0 0 3px oklch(0.55 0.18 145 / 0.10)" : "none",
          }}
        >
          {isFetching ? (
            <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: "oklch(0.55 0.18 145)" }} />
          ) : (
            <Search size={16} className="flex-shrink-0" style={{ color: "oklch(0.45 0.008 240)" }} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(-1); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "oklch(0.90 0.004 240)" }}
            aria-label="Search trade shows"
            aria-autocomplete="list"
            aria-expanded={open}
            role="combobox"
          />
          {query && (
            <button onClick={clearQuery} className="flex-shrink-0 p-0.5 rounded transition-opacity hover:opacity-70" aria-label="Clear search">
              <X size={13} style={{ color: "oklch(0.45 0.008 240)" }} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-xl border overflow-hidden z-50"
            style={{
              background: "oklch(0.10 0.006 240)",
              borderColor: "oklch(0.20 0.008 240)",
              boxShadow: "0 16px 40px oklch(0 0 0 / 0.50)",
            }}
            role="listbox"
          >
            {isFetching && results.length === 0 ? (
              /* Loading skeleton */
              <ul className="divide-y" style={{ borderColor: "oklch(0.14 0.008 240)" }}>
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-start gap-3 px-4 py-3.5 animate-pulse">
                    <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: "oklch(0.16 0.008 240)" }} />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 rounded" style={{ background: "oklch(0.16 0.008 240)", width: `${50 + n * 10}%` }} />
                      <div className="h-2.5 rounded" style={{ background: "oklch(0.13 0.008 240)", width: "40%" }} />
                    </div>
                    <div className="h-7 w-24 rounded-lg flex-shrink-0" style={{ background: "oklch(0.16 0.008 240)" }} />
                  </li>
                ))}
              </ul>
            ) : results.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Search size={22} className="mx-auto mb-2 opacity-30" style={{ color: "oklch(0.55 0.18 145)" }} />
                <p className="text-sm font-medium" style={{ color: "oklch(0.60 0.008 240)" }}>
                  {query ? `No shows matching "${query}"` : "No upcoming shows found"}
                </p>
                <p className="text-xs mt-1" style={{ color: "oklch(0.40 0.008 240)" }}>
                  Try a different search or{" "}
                  <a href="/admin/shows" className="underline" style={{ color: "oklch(0.55 0.18 145)" }}>
                    add a show
                  </a>
                </p>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div
                  className="px-4 py-2 flex items-center justify-between border-b"
                  style={{ borderColor: "oklch(0.16 0.008 240)" }}
                >
                  <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "oklch(0.40 0.008 240)" }}>
                    {results.length} show{results.length !== 1 ? "s" : ""} found
                  </span>
                  <span className="text-[10px]" style={{ color: "oklch(0.35 0.008 240)" }}>
                    ↑↓ navigate · Enter select · Esc close
                  </span>
                </div>

                {/* Results list */}
                <ul className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: "oklch(0.14 0.008 240)" }}>
                  {(results as Show[]).map((show, idx) => (
                    <li
                      key={show.id}
                      role="option"
                      aria-selected={idx === activeIdx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className="px-4 py-3 transition-colors duration-100"
                      style={{
                        background: idx === activeIdx ? "oklch(0.55 0.18 145 / 0.06)" : "transparent",
                      }}
                    >
                      {/* Top row: date block + info + CTA */}
                      <div
                        className="flex items-start gap-3 cursor-pointer"
                        onClick={() => handleSelect(show)}
                      >
                        {/* Date block */}
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center text-center"
                          style={{
                            background: STATUS_BG[show.status] ?? STATUS_BG.upcoming,
                            border: `1px solid ${STATUS_COLORS[show.status] ?? STATUS_COLORS.upcoming}33`,
                          }}
                        >
                          {show.startDate ? (
                            <>
                              <span className="text-[9px] font-mono uppercase leading-none" style={{ color: STATUS_COLORS[show.status] }}>
                                {new Date(show.startDate).toLocaleDateString("en-US", { month: "short" })}
                              </span>
                              <span className="text-sm font-bold leading-none mt-0.5" style={{ color: STATUS_COLORS[show.status] }}>
                                {new Date(show.startDate).getDate()}
                              </span>
                            </>
                          ) : (
                            <Calendar size={14} style={{ color: STATUS_COLORS[show.status] }} />
                          )}
                        </div>

                        {/* Show info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate" style={{ color: "oklch(0.92 0.004 240)" }}>
                              {show.name}
                            </span>
                            <span
                              className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full border uppercase tracking-wide flex-shrink-0"
                              style={{
                                color: STATUS_COLORS[show.status],
                                background: STATUS_BG[show.status],
                                borderColor: `${STATUS_COLORS[show.status]}44`,
                              }}
                            >
                              {show.status}
                            </span>
                            {show.city && (
                              <span
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border flex-shrink-0 flex items-center gap-0.5"
                                style={{
                                  color: "oklch(0.65 0.18 245)",
                                  background: "oklch(0.65 0.18 245 / 0.10)",
                                  borderColor: "oklch(0.65 0.18 245 / 0.30)",
                                }}
                              >
                                <MapPin size={7} />
                                {show.city}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {show.venue && (
                              <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.50 0.008 240)" }}>
                                <MapPin size={10} />
                                {show.venue}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.45 0.008 240)" }}>
                              <Calendar size={10} />
                              {formatDateRange(show.startDate, show.endDate)}
                            </span>
                          </div>
                        </div>

                        {/* Book Services CTA — only for active shows */}
                        {show.status !== "upcoming" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSelect(show); }}
                            className="flex-shrink-0 self-center flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all duration-150"
                            style={{
                              color: idx === activeIdx ? "oklch(0.08 0.006 240)" : "oklch(0.55 0.18 145)",
                              background: idx === activeIdx ? "oklch(0.55 0.18 145)" : "transparent",
                              borderColor: "oklch(0.55 0.18 145 / 0.40)",
                            }}
                            aria-label={`Book services for ${show.name}`}
                          >
                            Book <ArrowRight size={10} />
                          </button>
                        ) : (
                          <div className="flex-shrink-0 self-start">
                            <span
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] border"
                              style={{
                                color: "oklch(0.55 0.18 145)",
                                borderColor: "oklch(0.55 0.18 145 / 0.25)",
                                background: "oklch(0.55 0.18 145 / 0.06)",
                              }}
                            >
                              <Bell size={9} />
                              Coming soon
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Notify Me — only for upcoming shows */}
                      {show.status === "upcoming" && (
                        <NotifyMeRow show={show} />
                      )}
                    </li>
                  ))}
                </ul>

                {/* Footer CTA */}
                <div
                  className="px-4 py-3 border-t flex items-center justify-between"
                  style={{ borderColor: "oklch(0.16 0.008 240)", background: "oklch(0.09 0.006 240)" }}
                >
                  <span className="text-xs" style={{ color: "oklch(0.40 0.008 240)" }}>
                    Don't see your show?
                  </span>
                  <a
                    href="/register"
                    className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ color: "oklch(0.55 0.18 145)" }}
                  >
                    Register & request <ArrowRight size={10} />
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
