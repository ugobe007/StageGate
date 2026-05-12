import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Menu, X } from "lucide-react";
import GetQuoteModal from "@/components/GetQuoteModal";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isAdmin = user?.role === "admin";
  const [quoteOpen, setQuoteOpen] = useState(false);

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
        background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px) saturate(180%)",
        WebkitBackdropFilter: "blur(12px) saturate(180%)",
        borderBottom: scrolled
          ? "1px solid oklch(0.88 0.006 240)"
          : "1px solid oklch(0.92 0.004 240)",
        boxShadow: scrolled ? "0 1px 12px oklch(0 0 0 / 0.06)" : "none",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link href="/">
            <div className="flex items-center gap-2.5 group cursor-pointer">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: "oklch(0.52 0.22 262)" }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L2 8h5l-1 5 6-7H7l1-5z" fill="white" />
                </svg>
              </div>
              <span
                className="font-bold text-sm tracking-tight"
                style={{ color: "oklch(0.10 0.010 240)" }}
              >
                StageGate
              </span>
            </div>
          </Link>

          {/* ── Desktop links ── */}
          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className="px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 block"
                  style={{
                    color: isActive(href)
                      ? "oklch(0.52 0.22 262)"
                      : "oklch(0.40 0.010 240)",
                    background: isActive(href)
                      ? "oklch(0.52 0.22 262 / 0.08)"
                      : "transparent",
                    fontWeight: isActive(href) ? 600 : 500,
                  }}
                  onMouseEnter={e => {
                    if (!isActive(href)) {
                      (e.currentTarget as HTMLElement).style.color = "oklch(0.10 0.010 240)";
                      (e.currentTarget as HTMLElement).style.background = "oklch(0.94 0.004 240)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive(href)) {
                      (e.currentTarget as HTMLElement).style.color = "oklch(0.40 0.010 240)";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
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
                    className="px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 block"
                    style={{
                      color: isActive("/dashboard") ? "oklch(0.52 0.22 262)" : "oklch(0.40 0.010 240)",
                      background: isActive("/dashboard") ? "oklch(0.52 0.22 262 / 0.08)" : "transparent",
                    }}
                  >
                    Dashboard
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{ color: "oklch(0.50 0.010 240)" }}
                  onMouseEnter={e => {
                    (e.currentTarget.style.color = "oklch(0.10 0.010 240)");
                    (e.currentTarget.style.background = "oklch(0.94 0.004 240)");
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget.style.color = "oklch(0.50 0.010 240)");
                    (e.currentTarget.style.background = "transparent");
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <span
                    className="px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 block"
                    style={{ color: "oklch(0.40 0.010 240)" }}
                    onMouseEnter={e => {
                      (e.currentTarget.style.color = "oklch(0.10 0.010 240)");
                      (e.currentTarget.style.background = "oklch(0.94 0.004 240)");
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget.style.color = "oklch(0.40 0.010 240)");
                      (e.currentTarget.style.background = "transparent");
                    }}
                  >
                    Sign In
                  </span>
                </a>
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="btn-default text-sm"
                >
                  Get a Quote
                </button>
                <Link href="/register">
                  <button className="btn-primary text-sm">
                    Register Free
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile toggle ── */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: "oklch(0.40 0.010 240)" }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(12px)",
            borderColor: "oklch(0.90 0.005 240)",
          }}
        >
          <div className="container py-4 flex flex-col gap-1">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    color: isActive(href) ? "oklch(0.52 0.22 262)" : "oklch(0.35 0.010 240)",
                    background: isActive(href) ? "oklch(0.52 0.22 262 / 0.08)" : "transparent",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </span>
              </Link>
            ))}
            <div
              className="border-t mt-2 pt-3 flex flex-col gap-2"
              style={{ borderColor: "oklch(0.90 0.005 240)" }}
            >
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <span
                      className="block px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                      style={{ color: "oklch(0.35 0.010 240)" }}
                      onClick={() => setMobileOpen(false)}
                    >
                      Dashboard
                    </span>
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{ color: "oklch(0.50 0.010 240)" }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <a href={getLoginUrl()} onClick={() => setMobileOpen(false)}>
                    <span className="block px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: "oklch(0.35 0.010 240)" }}>
                      Sign In
                    </span>
                  </a>
                  <button
                    onClick={() => { setQuoteOpen(true); setMobileOpen(false); }}
                    className="btn-default w-full justify-center"
                  >
                    Get a Quote
                  </button>
                  <Link href="/register">
                    <button
                      className="btn-primary w-full justify-center"
                      onClick={() => setMobileOpen(false)}
                    >
                      Register Free
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
