import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Menu, X } from "lucide-react";
import GetQuoteModal from "@/components/GetQuoteModal";

// Deep slate palette constants
const BG_BASE    = "oklch(0.11 0.012 262)";
const BG_SCROLL  = "oklch(0.12 0.014 262 / 0.96)";
const BORDER     = "oklch(0.22 0.016 262)";
const INDIGO     = "oklch(0.72 0.20 262)";
const INDIGO_BG  = "oklch(0.62 0.24 262 / 0.10)";
const TEXT_DIM   = "oklch(0.55 0.010 240)";
const TEXT_MID   = "oklch(0.70 0.008 240)";
const TEXT_BRIGHT= "oklch(0.90 0.005 240)";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isAdmin = user?.role === "admin";

  const navLinks = [
    { href: "/shows",     label: "Shows" },
    { href: "/services",  label: "Services" },
    { href: "/stagehand", label: "StageHand™" },
    { href: "/stagepro",  label: "StagePro™" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <>
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        background: scrolled ? BG_SCROLL : BG_BASE,
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-14">

          {/* ── Logo ── */}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              {/* Stroke-only logo mark */}
              <div
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ border: `1.5px solid ${INDIGO}`, color: INDIGO }}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L2 8h5l-1 5 6-7H7l1-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <span
                className="font-bold text-sm tracking-tight"
                style={{ color: TEXT_BRIGHT, letterSpacing: "-0.02em" }}
              >
                StageGate
              </span>
            </div>
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className="px-3 py-1.5 rounded text-sm cursor-pointer transition-all duration-150 block"
                  style={{
                    color: isActive(href) ? INDIGO : TEXT_DIM,
                    fontWeight: isActive(href) ? 500 : 400,
                    background: isActive(href) ? INDIGO_BG : "transparent",
                  }}
                  onMouseEnter={e => {
                    if (!isActive(href)) {
                      (e.currentTarget as HTMLElement).style.color = TEXT_MID;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive(href)) {
                      (e.currentTarget as HTMLElement).style.color = TEXT_DIM;
                    }
                  }}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>

          {/* ── Desktop auth ── */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <span
                    className="px-3 py-1.5 rounded text-sm cursor-pointer transition-colors block"
                    style={{ color: isActive("/dashboard") ? INDIGO : TEXT_DIM }}
                  >
                    Dashboard
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="px-3 py-1.5 rounded text-sm transition-colors"
                  style={{ color: TEXT_DIM }}
                  onMouseEnter={e => { (e.currentTarget.style.color = TEXT_MID); }}
                  onMouseLeave={e => { (e.currentTarget.style.color = TEXT_DIM); }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <span
                    className="px-3 py-1.5 rounded text-sm cursor-pointer transition-colors block"
                    style={{ color: TEXT_DIM }}
                    onMouseEnter={e => { (e.currentTarget.style.color = TEXT_MID); }}
                    onMouseLeave={e => { (e.currentTarget.style.color = TEXT_DIM); }}
                  >
                    Sign in
                  </span>
                </a>
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="btn-default text-sm"
                >
                  Get a quote
                </button>
                <Link href="/register">
                  <button className="btn-primary text-sm">
                    Start free →
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile toggle ── */}
          <button
            className="md:hidden p-2 rounded transition-colors"
            style={{ color: TEXT_DIM }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{ background: BG_SCROLL, backdropFilter: "blur(16px)", borderColor: BORDER }}
        >
          <div className="container py-4 flex flex-col gap-0.5">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className="block px-3 py-2.5 rounded text-sm cursor-pointer transition-colors"
                  style={{
                    color: isActive(href) ? INDIGO : TEXT_DIM,
                    background: isActive(href) ? INDIGO_BG : "transparent",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </span>
              </Link>
            ))}
            <div className="border-t mt-2 pt-3 flex flex-col gap-2" style={{ borderColor: BORDER }}>
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <span
                      className="block px-3 py-2.5 rounded text-sm cursor-pointer"
                      style={{ color: TEXT_DIM }}
                      onClick={() => setMobileOpen(false)}
                    >
                      Dashboard
                    </span>
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left px-3 py-2.5 rounded text-sm"
                    style={{ color: TEXT_DIM }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <a href={getLoginUrl()} onClick={() => setMobileOpen(false)}>
                    <span className="block px-3 py-2.5 rounded text-sm" style={{ color: TEXT_DIM }}>
                      Sign in
                    </span>
                  </a>
                  <button
                    onClick={() => { setQuoteOpen(true); setMobileOpen(false); }}
                    className="btn-default w-full justify-center"
                  >
                    Get a quote
                  </button>
                  <Link href="/register">
                    <button
                      className="btn-primary w-full justify-center"
                      onClick={() => setMobileOpen(false)}
                    >
                      Start free →
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
    <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
