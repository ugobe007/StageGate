import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Menu, X } from "lucide-react";
import GetQuoteModal from "@/components/GetQuoteModal";
import NewsTicker from "@/components/NewsTicker";

export default function Navbar({ darkBg = false }: { darkBg?: boolean }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isAdmin = user?.role === "admin";

  const navLinks = [
    { href: "/services",  label: "Services" },
    { href: "/shows",     label: "Shows" },
    { href: "/xbot",      label: "XBOT" },
    { href: "/stagehand", label: "StageHand™" },
    { href: "/stagepro",  label: "StagePro™" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const navBg = (scrolled || darkBg)
    ? "rgba(8,8,8,0.96)"
    : "transparent";

  const navBorder = (scrolled || darkBg)
    ? "1px solid rgba(255,255,255,0.07)"
    : "1px solid transparent";

  return (
    <>
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: navBg,
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: navBorder,
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between" style={{ height: "3.5rem" }}>

          {/* ── Logo ── */}
          <Link href="/">
            <div className="flex items-center cursor-pointer">
              <img
                src="/stagegate-logo.png"
                alt="StageGate"
                style={{ height: "34px", width: "auto", display: "block" }}
              />
            </div>
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  style={{
                    display: "block",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    fontWeight: isActive(href) ? 500 : 400,
                    color: isActive(href) ? "#fff" : "rgba(255,255,255,0.45)",
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => {
                    if (!isActive(href)) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.80)";
                  }}
                  onMouseLeave={e => {
                    if (!isActive(href)) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
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
                <Link href={isAdmin ? "/admin" : "/dashboard"}>
                  <span
                    style={{
                      display: "block",
                      padding: "0.375rem 0.75rem",
                      fontSize: "0.875rem",
                      color: (isAdmin ? isActive("/admin") : isActive("/dashboard")) ? "#fff" : "rgba(255,255,255,0.45)",
                      cursor: "pointer",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.80)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = (isAdmin ? isActive("/admin") : isActive("/dashboard")) ? "#fff" : "rgba(255,255,255,0.45)"; }}
                  >
                    {isAdmin ? "Admin Panel" : "My Dashboard"}
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  style={{
                    padding: "0.375rem 0.75rem",
                    fontSize: "0.875rem",
                    color: "rgba(255,255,255,0.40)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.color = "rgba(255,255,255,0.75)"); }}
                  onMouseLeave={e => { (e.currentTarget.style.color = "rgba(255,255,255,0.40)"); }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <button
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.375rem 0.9rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      color: "rgba(255,255,255,0.75)",
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.22)",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.22)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
                  >
                    Sign In
                  </button>
                </a>
                <Link href="/tour">
                  <button
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      padding: "0.375rem 0.9rem",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      color: "#000",
                      background: "#f59e0b",
                      border: "1px solid #f59e0b",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#d97706"; (e.currentTarget as HTMLElement).style.borderColor = "#d97706"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f59e0b"; (e.currentTarget as HTMLElement).style.borderColor = "#f59e0b"; }}
                  >
                    Book a Tour
                  </button>
                </Link>
                <Link href="/register">
                  <button className="btn-nav-primary">
                    Register Free
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile toggle ── */}
          <button
            className="md:hidden p-2"
            style={{ color: "rgba(255,255,255,0.55)", background: "transparent", border: "none", cursor: "pointer" }}
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
          style={{
            background: "rgba(0,0,0,0.95)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="container" style={{ paddingTop: "1rem", paddingBottom: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
              {navLinks.map(({ href, label }) => (
                <Link key={href} href={href}>
                  <span
                    style={{
                      display: "block",
                      padding: "0.75rem",
                      fontSize: "0.9375rem",
                      color: isActive(href) ? "#fff" : "rgba(255,255,255,0.50)",
                      cursor: "pointer",
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </span>
                </Link>
              ))}
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                marginTop: "0.75rem",
                paddingTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {isAuthenticated ? (
                <>
                  <Link href={isAdmin ? "/admin" : "/dashboard"}>
                    <span
                      style={{ display: "block", padding: "0.75rem", fontSize: "0.9375rem", color: "rgba(255,255,255,0.50)", cursor: "pointer" }}
                      onClick={() => setMobileOpen(false)}
                    >
                      {isAdmin ? "Admin Panel" : "My Dashboard"}
                    </span>
                  </Link>
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    style={{ textAlign: "left", padding: "0.75rem", fontSize: "0.9375rem", color: "rgba(255,255,255,0.40)", background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <a href={getLoginUrl()} onClick={() => setMobileOpen(false)}>
                    <span style={{ display: "block", padding: "0.75rem", fontSize: "0.9375rem", color: "rgba(255,255,255,0.50)", cursor: "pointer" }}>
                      Sign in
                    </span>
                  </a>
                  <Link href="/tour">
                    <button
                      onClick={() => setMobileOpen(false)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "0.75rem",
                        fontSize: "0.9375rem",
                        fontWeight: 600,
                        color: "#000",
                        background: "#f59e0b",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      Book a Showroom Tour
                    </button>
                  </Link>
                  <button
                    onClick={() => { setQuoteOpen(true); setMobileOpen(false); }}
                    className="btn-nav"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Get a quote
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
    <NewsTicker />
    <GetQuoteModal open={quoteOpen} onOpenChange={setQuoteOpen} />
    </>
  );
}
