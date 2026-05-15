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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm">Setting up your workspace…</p>
      </div>
    </div>
  );
}
