import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, X, Database, RefreshCw } from "lucide-react";

/**
 * DbStatusBanner — polls trpc.admin.dbHealth every 30 s.
 * Shows a dismissible red banner when Supabase is disconnected.
 * Renders nothing when connected or when the user is not an admin.
 */
export default function DbStatusBanner() {
  const { user, isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading, refetch, isFetching } = trpc.admin.dbHealth.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchInterval: 30_000,
    // Don't throw — silently treat fetch errors as disconnected
    retry: 1,
  });

  // Not admin, still loading, connected, or dismissed → render nothing
  if (!isAuthenticated || user?.role !== "admin") return null;
  if (isLoading) return null;
  if (dismissed) return null;
  if (!data || data.connected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 px-4 py-2.5 bg-destructive text-destructive-foreground text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle size={15} className="shrink-0" />
        <Database size={14} className="shrink-0 opacity-70" />
        <span className="truncate">
          Supabase database is <strong>unreachable</strong> — admin features may not work correctly.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs opacity-80 hover:opacity-100 transition-opacity disabled:opacity-50"
          title="Retry connection"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Retry
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="opacity-70 hover:opacity-100 transition-opacity ml-1"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
