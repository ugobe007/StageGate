import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { CheckCircle, ArrowRight, Loader2, Building2, Bot } from "lucide-react";
import { toast } from "sonner";

const ROBOT_TYPES = [
  "Humanoid Robot", "Industrial Robot", "Collaborative Robot (Cobot)",
  "Delivery Robot", "Service Robot", "Drone / UAV", "Medical Robot",
  "Agricultural Robot", "Security Robot", "Other",
];

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 500, color: "#64748b", display: "block", marginBottom: "0.375rem",
};

const sectionStyle: React.CSSProperties = {
  padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)", background: "#fff",
};

export default function Register() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: existingProfile } = trpc.company.getMyProfile.useQuery(undefined, { enabled: isAuthenticated });

  const [form, setForm] = useState({
    companyName: "",
    website: "",
    contactName: user?.name ?? "",
    contactEmail: user?.email ?? "",
    contactPhone: "",
    country: "",
    description: "",
    robotTypes: [] as string[],
  });

  const upsertProfile = trpc.company.upsertProfile.useMutation({
    onSuccess: () => {
      toast.success("Company profile saved! Welcome to StageGate.");
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save profile");
    },
  });

  const toggleRobotType = (type: string) => {
    setForm(prev => ({
      ...prev,
      robotTypes: prev.robotTypes.includes(type)
        ? prev.robotTypes.filter(t => t !== type)
        : [...prev.robotTypes, type],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName) { toast.error("Company name is required"); return; }
    upsertProfile.mutate({ ...form, robotTypes: JSON.stringify(form.robotTypes) });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080808" }}>
        <Loader2 size={28} style={{ color: "#00ff87", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808" }}>
        <Navbar />
        <div style={{ paddingTop: "8rem", paddingBottom: "4rem" }}>
          <div style={{ maxWidth: "28rem", margin: "0 auto", padding: "0 1rem", textAlign: "center" }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "3rem 2rem", background: "#fff" }}>
              <div style={{ width: "3rem", height: "3rem", borderRadius: "0.5rem", background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
                <Bot size={22} style={{ color: "#00ff87" }} />
              </div>
              <h1 style={{ fontSize: "1.625rem", fontWeight: 700, color: "#ececec", marginBottom: "0.625rem" }}>Register Your Company</h1>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "2rem" }}>
                Create a free StageGate account to register your company and access our full service catalog.
              </p>
              <a href={getLoginUrl()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1.5rem", background: "#00ff87", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", borderRadius: "0.375rem", textDecoration: "none" }}>
                Sign In to Continue <ArrowRight size={16} />
              </a>
              <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>Free forever · No credit card required</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (existingProfile) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808" }}>
        <Navbar />
        <div style={{ paddingTop: "8rem", paddingBottom: "4rem" }}>
          <div style={{ maxWidth: "28rem", margin: "0 auto", padding: "0 1rem", textAlign: "center" }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", padding: "3rem 2rem", background: "#fff" }}>
              <div style={{ width: "3rem", height: "3rem", borderRadius: "9999px", background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
                <CheckCircle size={22} style={{ color: "#00ff87" }} />
              </div>
              <h1 style={{ fontSize: "1.625rem", fontWeight: 700, color: "#ececec", marginBottom: "0.5rem" }}>Already Registered</h1>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.375rem" }}>
                <strong style={{ color: "#ececec" }}>{existingProfile.companyName}</strong> is registered on StageGate.
              </p>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "2rem" }}>
                Head to your dashboard to view orders, book services, or update your profile.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link href="/dashboard">
                  <a style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.625rem 1.25rem", background: "#00ff87", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", borderRadius: "0.375rem", textDecoration: "none" }}>
                    Go to My Dashboard <ArrowRight size={15} />
                  </a>
                </Link>
                <Link href="/order">
                  <a style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.625rem 1.25rem", border: "1px solid rgba(255,255,255,0.08)", background: "#fff", color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: "0.9375rem", borderRadius: "0.375rem", textDecoration: "none" }}>
                    Book Services
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080808" }}>
      <Navbar />
      <div style={{ paddingTop: "6rem", paddingBottom: "4rem" }}>
        <div style={{ maxWidth: "42rem", margin: "0 auto", padding: "0 1rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 500, color: "#00ff87", background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.2)", borderRadius: "0.25rem", padding: "0.25rem 0.75rem", marginBottom: "1rem" }}>
              Free Registration
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#ececec", marginBottom: "0.5rem" }}>Register Your Company</h1>
            <p style={{ fontSize: "0.9375rem", color: "#64748b" }}>Tell us about your company and robots. This takes about 3 minutes.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Company Info */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <Building2 size={15} style={{ color: "#00ff87" }} />
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec", margin: 0 }}>Company Information</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Company Name *</label>
                  <Input value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Robotics Inc." required />
                </div>
                <div>
                  <label style={labelStyle}>Website</label>
                  <Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://acmerobotics.com" />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="United States" />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Company Description</label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of your company and the robots you make..."
                    className="resize-none" rows={3} />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec", margin: 0 }}>Primary Contact</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                <div>
                  <label style={labelStyle}>Contact Name</label>
                  <Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="Jane Smith" />
                </div>
                <div>
                  <label style={labelStyle}>Contact Email</label>
                  <Input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} placeholder="jane@acmerobotics.com" />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone</label>
                  <Input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} placeholder="+1 (555) 000-0000" />
                </div>
              </div>
            </div>

            {/* Robot Types */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                <Bot size={15} style={{ color: "#00ff87" }} />
                <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#ececec", margin: 0 }}>Robot Types</h2>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)", marginBottom: "1rem" }}>Select all robot types your company makes or sells.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {ROBOT_TYPES.map(type => {
                  const selected = form.robotTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleRobotType(type)}
                      style={{
                        padding: "0.3125rem 0.75rem",
                        fontSize: "0.8125rem",
                        fontWeight: selected ? 500 : 400,
                        border: `1px solid ${selected ? "#00ff87" : "rgba(255,255,255,0.08)"}`,
                        borderRadius: "0.25rem",
                        background: selected ? "rgba(62,207,142,0.08)" : "#fff",
                        color: selected ? "#00ff87" : "#64748b",
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="submit"
                disabled={upsertProfile.isPending}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", background: "#00ff87", color: "#fff", fontWeight: 700, fontSize: "0.9375rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", opacity: upsertProfile.isPending ? 0.7 : 1 }}
              >
                {upsertProfile.isPending ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <>Complete Registration <ArrowRight size={15} /></>}
              </button>
              <Link href="/">
                <a style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.25rem", border: "1px solid rgba(255,255,255,0.08)", background: "#fff", color: "#64748b", fontWeight: 500, fontSize: "0.9375rem", borderRadius: "0.375rem", textDecoration: "none" }}>
                  Cancel
                </a>
              </Link>
            </div>
            <p style={{ fontSize: "0.75rem", textAlign: "center", color: "rgba(255,255,255,0.30)" }}>
              Free forever · No credit card required · You can update your profile anytime
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
