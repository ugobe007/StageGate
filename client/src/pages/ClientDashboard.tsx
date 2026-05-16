import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import Navbar from "@/components/Navbar";
import EditProfileSheet from "@/components/EditProfileSheet";
import {
  Package, Calendar, CheckCircle, Clock, AlertCircle, XCircle,
  ArrowRight, Loader2, User, Building2, Globe, Phone, Mail,
  Bot, Zap, FileText, Send, Plus, ChevronDown, ChevronUp, Star,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
  new:         { label: "New",         color: "#3b82f6", icon: Clock },
  reviewing:   { label: "Reviewing",   color: "#f59e0b", icon: AlertCircle },
  quoted:      { label: "Quoted",      color: "#8b5cf6", icon: FileText },
  approved:    { label: "Approved",    color: "#00ff87", icon: CheckCircle },
  in_progress: { label: "In Progress", color: "#f97316", icon: Zap },
  completed:   { label: "Completed",   color: "#00ff87", icon: CheckCircle },
  cancelled:   { label: "Cancelled",   color: "#ef4444", icon: XCircle },
};

const REQUEST_TYPES = [
  "Robot Receiving", "Unpacking & Inspection", "Staging & Setup",
  "Show Floor Activation", "Booth Delivery", "Warehousing",
  "Customs & Freight", "Technical Support", "General Inquiry",
];

const URGENCY_OPTIONS = [
  { value: "low",    label: "Low — no rush" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High — upcoming show" },
  { value: "urgent", label: "Urgent — ASAP" },
];

export default function ClientDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [showName, setShowName] = useState("");
  const [showDate, setShowDate] = useState("");
  const [robotName, setRobotName] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [attachment, setAttachment] = useState<{ url: string; key: string; name: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: profile, isLoading: profileLoading } = trpc.company.getMyProfile.useQuery(undefined, { enabled: isAuthenticated });
  const { data: serviceReqs, isLoading: reqsLoading } = trpc.company.getMyServiceRequests.useQuery(undefined, { enabled: isAuthenticated });
  const { data: shows } = trpc.shows.list.useQuery();

  const submitRequest = trpc.company.submitServiceRequest.useMutation({
    onSuccess: () => {
      utils.company.getMyServiceRequests.invalidate();
      setShowRequestForm(false);
      setRequestType(""); setShowName(""); setShowDate("");
      setRobotName(""); setDetails(""); setUrgency("normal"); setAttachment(null);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { alert("File must be under 16MB"); return; }
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/service-request-attachment", { method: "POST", body: fd });
      const data = await res.json() as { url?: string; key?: string; name?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Upload failed");
      setAttachment({ url: data.url!, key: data.key!, name: data.name! });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading || profileLoading) {
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 4rem)", padding: "2rem 1rem" }}>
          <div style={{ maxWidth: "26rem", width: "100%", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,255,135,0.10)", border: "1px solid rgba(0,255,135,0.20)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
              <ArrowRight size={20} style={{ color: "#00ff87" }} />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", marginBottom: "0.5rem", letterSpacing: "-0.02em" }}>Sign In Required</h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9375rem", marginBottom: "2rem", lineHeight: 1.6 }}>Please sign in to access your dashboard.</p>
            <a href={getLoginUrl()} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 2rem", background: "#f59e0b", color: "#080808", fontWeight: 800, fontSize: "0.875rem", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: "0.25rem", textDecoration: "none" }}>
              Sign In <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !profile.onboardingComplete) {
    return (
      <div style={{ minHeight: "100vh", background: "#080808" }}>
        <Navbar />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 4rem)", padding: "2rem 1rem" }}>
          <div style={{ maxWidth: "26rem", width: "100%", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,255,135,0.08)", border: "1px solid rgba(0,255,135,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
              <Bot size={24} style={{ color: "#00ff87" }} />
            </div>
            <p style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: "0.75rem", fontFamily: "'JetBrains Mono', monospace" }}>Client Portal</p>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 700, color: "#ececec", marginBottom: "0.625rem", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Set Up Your Profile</h1>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9375rem", marginBottom: "2rem", lineHeight: 1.65 }}>
              Complete your company profile so StageGate can prepare the right logistics for your robots.
            </p>
            <Link href="/onboarding" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.75rem 2rem", background: "#f59e0b", color: "#080808", fontWeight: 800, fontSize: "0.875rem", letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: "0.25rem", textDecoration: "none" }}>
              Start Setup <ArrowRight size={14} />
            </Link>
            <p style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "rgba(255,255,255,0.25)" }}>Takes about 3 minutes</p>
          </div>
        </div>
      </div>
    );
  }

  const robots = profile.robots ? JSON.parse(profile.robots) as Array<{ name: string; type: string; weight: string; dimensions: string; powerReq: string; notes: string }> : [];
  const showsAttending = profile.showsAttending ? JSON.parse(profile.showsAttending) as Array<{ showName: string; boothNumber: string; year: string }> : [];
  const servicesNeeded = profile.servicesNeeded ? JSON.parse(profile.servicesNeeded) as string[] : [];

  const inputStyle: React.CSSProperties = {
    width: "100%", height: "2.25rem", borderRadius: "0.375rem",
    border: "1px solid rgba(255,255,255,0.12)", background: "#111",
    padding: "0 0.75rem", fontSize: "0.875rem", color: "#ececec", outline: "none",
    appearance: "none", WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ececec' opacity='0.4' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.75rem center",
    paddingRight: "2rem",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080808" }}>
      <Navbar darkBg />
      <div style={{ paddingTop: "5rem", paddingBottom: "4rem" }}>
        <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "2rem 1rem" }}>

          {/* Welcome header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem" }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ececec", margin: "0 0 0.25rem" }}>
                Welcome back, {profile.contactName?.split(" ")[0] ?? user?.name ?? "there"}
              </h1>
              <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", margin: 0 }}>{profile.companyName} · StageGate Client Portal</p>
            </div>
            <button
              onClick={() => setEditProfileOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 500, padding: "0.375rem 0.75rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111", color: "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer" }}
            >
              <User size={12} /> Edit Profile
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>

            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Company card */}
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", background: "#111", padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.375rem", background: "rgba(62,207,142,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Building2 size={16} style={{ color: "#00ff87" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>{profile.companyName}</div>
                    <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)" }}>{profile.country ?? "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                  {profile.contactEmail && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.45)" }}>
                      <Mail size={12} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.contactEmail}</span>
                    </div>
                  )}
                  {profile.contactPhone && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.45)" }}>
                      <Phone size={12} /> {profile.contactPhone}
                    </div>
                  )}
                  {profile.website && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "rgba(255,255,255,0.45)" }}>
                      <Globe size={12} />
                      <a href={profile.website} target="_blank" rel="noreferrer" style={{ color: "#00ff87", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {profile.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Robots */}
              {robots.length > 0 && (
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", background: "#111", padding: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Bot size={13} style={{ color: "#00ff87" }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec" }}>Your Robots</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {robots.map((r, i) => (
                      <div key={i} style={{ padding: "0.625rem 0.75rem", borderRadius: "0.375rem", background: "#080808", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontWeight: 500, fontSize: "0.875rem", color: "#ececec" }}>{r.name || "Unnamed Robot"}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                          {r.type && <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>{r.type}</span>}
                          {r.weight && <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>{r.weight}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shows */}
              {showsAttending.length > 0 && (
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", background: "#111", padding: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Calendar size={13} style={{ color: "#00ff87" }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec" }}>Upcoming Shows</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {showsAttending.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#ececec" }}>{s.showName}</div>
                          {s.boothNumber && <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)" }}>{s.boothNumber}</div>}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>{s.year}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services needed */}
              {servicesNeeded.length > 0 && (
                <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", background: "#111", padding: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <Star size={13} style={{ color: "#00ff87" }} />
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#ececec" }}>Services Requested</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                    {servicesNeeded.map(s => (
                      <span key={s} style={{ fontSize: "0.8125rem", color: "#00ff87", background: "rgba(62,207,142,0.08)", border: "1px solid rgba(62,207,142,0.2)", borderRadius: "0.25rem", padding: "0.125rem 0.5rem" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — Service Requests */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

              {/* Submit new request */}
              <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.5rem", background: "#111", overflow: "hidden" }}>
                <button
                  onClick={() => setShowRequestForm(v => !v)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.125rem 1.25rem", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "2rem", height: "2rem", borderRadius: "0.375rem", background: "#00ff87", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={15} style={{ color: "#fff" }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#ececec" }}>Submit a Service Request</div>
                      <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.45)" }}>Request logistics, staging, or support for your next show</div>
                    </div>
                  </div>
                  {showRequestForm ? <ChevronUp size={15} style={{ color: "rgba(255,255,255,0.30)" }} /> : <ChevronDown size={15} style={{ color: "rgba(255,255,255,0.30)" }} />}
                </button>

                {showRequestForm && (
                  <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }} className="dark-page-inputs">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>Service Type *</label>
                        <select value={requestType} onChange={e => setRequestType(e.target.value)} style={inputStyle}>
                          <option value="">Select service...</option>
                          {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>Show Name</label>
                        <Input value={showName} onChange={e => setShowName(e.target.value)} placeholder="e.g. CES 2026" className="text-sm" />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>Show Date</label>
                        <Input value={showDate} onChange={e => setShowDate(e.target.value)} placeholder="e.g. Jan 7–10, 2026" className="text-sm" />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>Robot Name</label>
                        <Input value={robotName} onChange={e => setRobotName(e.target.value)} placeholder="e.g. Spot" className="text-sm" />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>Urgency</label>
                        <select value={urgency} onChange={e => setUrgency(e.target.value as "low" | "normal" | "high" | "urgent")} style={inputStyle}>
                          {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>Details</label>
                        <Textarea value={details} onChange={e => setDetails(e.target.value)}
                          placeholder="Describe what you need, timeline, any special requirements..."
                          className="resize-none text-sm" rows={3} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "0.375rem" }}>
                          Attachment <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.30)" }}>(optional — spec sheet, crate dims, robot manual · PDF/image · max 16MB)</span>
                        </label>
                        {attachment ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                            <a href={attachment.url} target="_blank" rel="noopener noreferrer" style={{ color: "#00ff87", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "18rem" }}>{attachment.name}</a>
                            <button type="button" onClick={() => setAttachment(null)} style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", background: "none", border: "none", cursor: "pointer", marginLeft: "0.25rem" }}>Remove</button>
                          </div>
                        ) : (
                          <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "0.375rem", padding: "0.5rem 0.875rem" }}>
                            {uploadingFile ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : <span>Choose file</span>}
                            <input type="file" style={{ display: "none" }} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.xlsx,.csv" onChange={handleFileUpload} disabled={uploadingFile} />
                          </label>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                      <button
                        onClick={() => setShowRequestForm(false)}
                        style={{ fontSize: "0.875rem", fontWeight: 500, padding: "0.5rem 1rem", border: "1px solid rgba(255,255,255,0.08)", background: "#111", color: "rgba(255,255,255,0.55)", borderRadius: "0.375rem", cursor: "pointer" }}
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!requestType || submitRequest.isPending || uploadingFile}
                        onClick={() => submitRequest.mutate({ requestType, showName: showName || undefined, showDate: showDate || undefined, robotName: robotName || undefined, details: details || undefined, urgency, attachmentUrl: attachment?.url, attachmentKey: attachment?.key, attachmentName: attachment?.name })}
                        style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.5rem 1rem", border: "none", background: "#00ff87", color: "#fff", borderRadius: "0.375rem", cursor: "pointer", opacity: (!requestType || submitRequest.isPending || uploadingFile) ? 0.6 : 1 }}
                      >
                        {submitRequest.isPending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
                        Submit Request
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Service request list */}
              <div>
                <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "rgba(255,255,255,0.45)", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText size={13} /> Your Service Requests
                  {serviceReqs && serviceReqs.length > 0 && (
                    <span style={{ fontSize: "0.75rem", background: "#1a1a1a", color: "rgba(255,255,255,0.45)", padding: "0.0625rem 0.4375rem", borderRadius: "0.25rem" }}>{serviceReqs.length}</span>
                  )}
                </h2>

                {reqsLoading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 0" }}>
                    <Loader2 size={20} style={{ color: "rgba(255,255,255,0.30)", animation: "spin 1s linear infinite" }} />
                  </div>
                ) : !serviceReqs || serviceReqs.length === 0 ? (
                  <div style={{ border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "0.5rem", padding: "2.5rem 1rem", textAlign: "center" }}>
                    <Package size={28} style={{ color: "#cbd5e1", margin: "0 auto 0.75rem" }} />
                    <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.30)" }}>No service requests yet.</p>
                    <p style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)", marginTop: "0.25rem" }}>Submit your first request above to get started.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {serviceReqs.map(req => {
                      const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.new;
                      const Icon = cfg.icon;
                      const isExpanded = expandedRequest === req.id;
                      return (
                        <div key={req.id} style={{ border: `1px solid ${isExpanded ? "#00ff87" : "rgba(255,255,255,0.08)"}`, borderRadius: "0.5rem", background: "#111", overflow: "hidden", transition: "border-color 0.1s" }}>
                          <button
                            onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                              <div style={{ width: "1.875rem", height: "1.875rem", borderRadius: "0.375rem", background: `${cfg.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon size={13} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 500, fontSize: "0.9375rem", color: "#ececec", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{req.requestType}</div>
                                <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.30)" }}>
                                  {req.showName && <span>{req.showName} · </span>}
                                  {new Date(req.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                              <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
                              {isExpanded ? <ChevronUp size={13} style={{ color: "rgba(255,255,255,0.30)" }} /> : <ChevronDown size={13} style={{ color: "rgba(255,255,255,0.30)" }} />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div style={{ padding: "0.875rem 1rem", borderTop: "1px solid rgba(255,255,255,0.08)", background: "#080808", display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                              {req.robotName && <div style={{ color: "rgba(255,255,255,0.55)" }}><span style={{ color: "rgba(255,255,255,0.30)" }}>Robot: </span>{req.robotName}</div>}
                              {req.showDate && <div style={{ color: "rgba(255,255,255,0.55)" }}><span style={{ color: "rgba(255,255,255,0.30)" }}>Date: </span>{req.showDate}</div>}
                              {req.urgency && req.urgency !== "normal" && (
                                <div style={{ color: "rgba(255,255,255,0.55)" }}><span style={{ color: "rgba(255,255,255,0.30)" }}>Urgency: </span><span style={{ textTransform: "capitalize" }}>{req.urgency}</span></div>
                              )}
                              {req.details && <div style={{ color: "rgba(255,255,255,0.45)" }}>{req.details}</div>}
                              {(req as any).attachmentUrl && (
                                <div>
                                  <span style={{ color: "rgba(255,255,255,0.30)" }}>Attachment: </span>
                                  <a href={(req as any).attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#00ff87", textDecoration: "underline" }}>
                                    {(req as any).attachmentName ?? "View file"}
                                  </a>
                                </div>
                              )}
                              {req.quotedPrice && (
                                <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "0.375rem", background: "rgba(62,207,142,0.06)", border: "1px solid rgba(62,207,142,0.2)" }}>
                                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", marginBottom: "0.25rem" }}>Quoted Price</div>
                                  <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#00ff87" }}>{req.quotedPrice}</div>
                                </div>
                              )}
                              {req.adminNotes && (
                                <div style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "0.375rem", background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.08)" }}>
                                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.30)", marginBottom: "0.25rem" }}>StageGate Note</div>
                                  <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.55)" }}>{req.adminNotes}</div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Edit Profile Sheet */}
      <EditProfileSheet
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
      />
    </div>
  );
}
