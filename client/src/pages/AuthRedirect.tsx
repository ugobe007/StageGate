import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

/**
 * Intermediate page that handles post-login routing:
 *   - Admin → /admin
 *   - User with completed profile → /dashboard
 *   - User without profile → /onboarding
 */
export default function AuthRedirect() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  const { data: profile, isLoading: profileLoading } = trpc.company.getMyProfile.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  useEffect(() => {
    if (loading || profileLoading) return;

    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    if (user?.role === "admin") {
      navigate("/admin");
      return;
    }

    if (profile?.onboardingComplete) {
      navigate("/dashboard");
    } else {
      navigate("/onboarding");
    }
  }, [loading, profileLoading, isAuthenticated, user, profile, navigate]);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <Loader2 size={28} style={{ color: "#00ff87", animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)" }}>Setting up your workspace…</p>
      </div>
    </div>
  );
}
