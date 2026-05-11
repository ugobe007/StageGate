import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Menu, X, Zap } from "lucide-react";
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
    { href: "/services",  label: "Services" },
    { href: "/stagehand", label: "StageHand™" },
    { href: "/stagepro",  label: "StagePro™" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const navBg = scrolled
    ? "rgba(10,11,15,0.92)"
    : "rgba(8,9,13,0.75)";
  const navBorder = scrolled
    ? "1px solid oklch(0.20 0.010 240)"
    : "1px solid oklch(0.13 0.008 240)";

  return (
    <>
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: navBg,
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderBottom: navBorder,
        boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.35)" : "none",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link href="/">
            <div className="flex items-center gap-2.5 group cursor-pointer">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: "oklch(0.72 0.21 145)" }}
              >
                <Zap size={13} className="text-[oklch(0.08_0.006_240)]" />
              </div>
              <span className="font-semibold text-sm text-white tracking-tight">StageGate</span>
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
                      ? "oklch(0.74 0.23 145)"
                      : "oklch(0.62 0.010 240)",
                    background: isActive(href)
                      ? "oklch(0.74 0.23 145 / 0.08)"
                      : "transparent",
                  }}
                  onMouseEnter={e => {
                    if (!isActive(href)) {
                      (e.currentTarget as HTMLElement).style.color = "oklch(0.88 0.010 240)";
                      (e.currentTarget as HTMLElement).style.background = "oklch(0.74 0.23 145 / 0.05)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive(href)) {
                      (e.currentTarget as HTMLElement).style.color = "oklch(0.62 0.010 240)";
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
                      color: isActive("/dashboard") ? "oklch(0.74 0.23 145)" : "oklch(0.62 0.010 240)",
                      background: isActive("/dashboard") ? "oklch(0.74 0.23 145 / 0.08)" : "transparent",
                    }}
                  >
                    Dashboard
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                  style={{ color: "oklch(0.48 0.010 240)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.74 0.23 145)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.48 0.010 240)")}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <span
                    className="px-3.5 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 block"
                    style={{ color: "oklch(0.62 0.010 240)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.88 0.010 240)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.62 0.010 240)")}
                  >
                    Sign In
                  </span>
                </a>
                <button
                    onClick={() => setQuoteOpen(true)}
                    className="px-4 py-2 rounded-lg text-sm font-display font-semibold transition-all duration-200 cursor-pointer border"
                    style={{
                      borderColor: "oklch(0.72 0.21 145)",
                      color: "oklch(0.72 0.21 145)",
                      background: "transparent",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.72 0.21 145 / 0.10)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    Get a Quote
                  </button>
                <Link href="/register">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-display font-bold transition-all duration-200 cursor-pointer"
                    style={{
                      background: "oklch(0.72 0.21 145)",
                      color: "oklch(0.08 0.006 240)",
                    }}
                  >
                    Register Free
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile toggle ── */}
          <button
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: "oklch(0.60 0.010 240)" }}
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
            background: "oklch(0.07 0.008 240 / 0.97)",
            backdropFilter: "blur(16px)",
            borderColor: "oklch(0.16 0.010 240)",
          }}
        >
          <div className="container py-4 flex flex-col gap-1">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    color: isActive(href) ? "oklch(0.74 0.23 145)" : "oklch(0.62 0.010 240)",
                    background: isActive(href) ? "oklch(0.74 0.23 145 / 0.08)" : "transparent",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </span>
              </Link>
            ))}
            <div
              className="border-t mt-2 pt-3 flex flex-col gap-2"
              style={{ borderColor: "oklch(0.16 0.010 240)" }}
            >
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <span
                      className="block px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                      style={{ color: "oklch(0.62 0.010 240)" }}
                      onClick={() => setMobileOpen(false)}
                    >
                      Dashboard
                    </span>
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="text-left px-3 py-2.5 rounded-lg text-sm font-medium"
                    style={{ color: "oklch(0.48 0.010 240)" }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <a href={getLoginUrl()} onClick={() => setMobileOpen(false)}>
                    <span className="block px-3 py-2.5 rounded-lg text-sm font-medium" style={{ color: "oklch(0.62 0.010 240)" }}>
                      Sign In
                    </span>
                  </a>
                  <Link href="/register">
                    <button
                      className="w-full px-4 py-2.5 rounded-lg text-sm font-display font-bold text-center"
                      style={{
                        background: "oklch(0.74 0.23 145)",
                        color: "oklch(0.06 0.008 240)",
                      }}
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
