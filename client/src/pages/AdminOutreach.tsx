import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DbStatusBanner from "@/components/DbStatusBanner";
import OutreachDraftQueue from "@/components/OutreachDraftQueue";
import { RefreshCw, ArrowLeft } from "lucide-react";

export default function AdminOutreach() {
  const [, setLocation] = useLocation();
  const [generating, setGenerating] = useState(false);
  const utils = trpc.useUtils();

  const generateMutation = trpc.admin.generateDrafts.useMutation({
    onSuccess: (res) => {
      const r = res.result as { generated?: number; skipped?: number; conversationsSeeded?: number; errors?: string[] } | undefined;
      const generated = r?.generated ?? 0;
      const seeded = r?.conversationsSeeded ?? 0;
      const errs = r?.errors?.length ?? 0;
      let msg = `Cal drafted ${generated} email${generated !== 1 ? "s" : ""}`;
      if (seeded > 0) msg += ` · queued ${seeded} new prospect${seeded !== 1 ? "s" : ""} for follow-ups`;
      if (errs > 0) msg += ` · ${errs} error${errs !== 1 ? "s" : ""}`;
      toast.success(msg);
      utils.admin.getDrafts.invalidate();
      utils.admin.getDraftCount.invalidate();
      setGenerating(false);
    },
    onError: (e) => { toast.error(e.message); setGenerating(false); },
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateMutation.mutate({});
  };

  return (
    <>
      <DbStatusBanner />
      <div style={{ padding: "2rem", maxWidth: "52rem", margin: "0 auto", color: "#ececec" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.30)", margin: "0 0 0.25rem" }}>OUTREACH</p>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#ececec", margin: 0 }}>Review Cal&apos;s drafts</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0.25rem 0 0" }}>
            OEM prospects — review, approve, then send individually or in bulk
          </p>
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem",
        }}>
          <button
            onClick={() => setLocation("/admin/prospects")}
            style={{
              display: "flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.75rem",
              border: "1px solid rgba(255,255,255,0.10)", background: "#111111",
              color: "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer",
            }}
          >
            <ArrowLeft size={13} /> Prospects
          </button>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              onClick={() => setLocation("/admin/partner-outreach")}
              style={{
                fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.75rem",
                border: "1px solid rgba(255,255,255,0.12)", background: "#111111",
                color: "#cbd5e1", borderRadius: "0.375rem", cursor: "pointer",
              }}
            >
              Partner & vendor outreach →
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || generateMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: "0.35rem",
                fontSize: "0.8125rem", fontWeight: 600, padding: "0.375rem 0.875rem",
                border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24",
                background: "rgba(251,191,36,0.06)", borderRadius: "0.375rem",
                cursor: generating ? "wait" : "pointer", opacity: generating ? 0.7 : 1,
              }}
            >
              <RefreshCw size={13} style={generating ? { animation: "spin 1s linear infinite" } : undefined} />
              {generating ? "Drafting…" : "Draft new with Cal"}
            </button>
          </div>
        </div>

        <OutreachDraftQueue
          audience="prospect"
          emptyPending={(
            <div>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.5rem" }}>No drafts yet</p>
              <p style={{ marginBottom: "1rem" }}>Pick prospects and ask Cal to draft — or use Draft new with Cal above.</p>
              <button onClick={() => setLocation("/admin/prospects")} style={{ fontSize: "0.8125rem", fontWeight: 600, padding: "0.5rem 1rem", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", background: "transparent", borderRadius: "0.375rem", cursor: "pointer" }}>
                ← Go to Prospects
              </button>
            </div>
          )}
        />
      </div>
    </>
  );
}
