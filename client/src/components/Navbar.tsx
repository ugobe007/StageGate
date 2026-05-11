import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "admin";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">SG</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">
              Stage<span className="text-primary">Gate</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/services" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/services" ? "text-primary" : "text-muted-foreground"}`}>
              Services
            </Link>
            <Link href="/stagehand" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/stagehand" ? "text-primary" : "text-muted-foreground"}`}>
              StageHand&#8482;
            </Link>
            <Link href="/stagepro" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/stagepro" ? "text-primary" : "text-muted-foreground"}`}>
              StagePro&#8482;
            </Link>
            {isAdmin && (
              <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}>
                Admin
              </Link>
            )}
          </div>

          {/* Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Dashboard
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => logout()} className="border-border text-muted-foreground hover:text-foreground">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Sign In
                  </Button>
                </a>
                <Link href="/register">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    Register Free
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden text-muted-foreground hover:text-foreground p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-3">
            <Link href="/services" className="block px-2 py-2 text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>Services</Link>
            <Link href="/stagehand" className="block px-2 py-2 text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>StageHand&#8482;</Link>
            <Link href="/stagepro" className="block px-2 py-2 text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>StagePro&#8482;</Link>
            {isAdmin && <Link href="/admin" className="block px-2 py-2 text-sm text-muted-foreground hover:text-primary" onClick={() => setMobileOpen(false)}>Admin</Link>}
            <div className="pt-2 border-t border-border flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">Dashboard</Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => { logout(); setMobileOpen(false); }} className="w-full">Sign Out</Button>
                </>
              ) : (
                <>
                  <a href={getLoginUrl()} className="w-full">
                    <Button variant="ghost" size="sm" className="w-full">Sign In</Button>
                  </a>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="w-full">
                    <Button size="sm" className="w-full bg-primary text-primary-foreground">Register Free</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
