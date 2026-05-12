import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Play } from "lucide-react";

const ROBOT_TYPES = [
  "Humanoid / Bipedal",
  "Quadruped / Dog-style",
  "Wheeled Mobile Robot",
  "Robotic Arm / Manipulator",
  "Collaborative Robot (Cobot)",
  "Autonomous Mobile Robot (AMR)",
  "Drone / Aerial Robot",
  "Service Robot",
  "Exoskeleton",
  "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DemoRequestModal({ open, onOpenChange }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    robotType: "",
    preferredShowName: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: shows } = trpc.shows.lasVegas2026.useQuery();

  const submit = trpc.demos.submit.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.company.trim()) e.company = "Company is required";
    if (!form.robotType) e.robotType = "Select your robot type";
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});

    // Try to match preferredShowName to a show ID
    const matchedShow = shows?.find(
      (s) => s.name === form.preferredShowName
    );

    submit.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      robotType: form.robotType,
      preferredShowId: matchedShow?.id,
      preferredShowName: form.preferredShowName || undefined,
      message: form.message.trim() || undefined,
    });
  }

  function handleClose(val: boolean) {
    if (!val) {
      // Reset on close
      setTimeout(() => {
        setForm({ name: "", email: "", company: "", robotType: "", preferredShowName: "", message: "" });
        setErrors({});
        setSubmitted(false);
      }, 300);
    }
    onOpenChange(val);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "0.625rem 0.875rem",
    fontSize: "0.9375rem",
    color: "#fff",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: "rgba(255,255,255,0.55)",
    marginBottom: "0.375rem",
    letterSpacing: "0.02em",
  };

  const errorStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "#f87171",
    marginTop: "0.25rem",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        style={{
          background: "#0d0f14",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 16,
          maxWidth: 520,
          padding: "2rem",
          color: "#fff",
        }}
      >
        {submitted ? (
          /* ── Success state ─────────────────────────────────────── */
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <CheckCircle2
              size={48}
              style={{ color: "#818cf8", margin: "0 auto 1.25rem" }}
            />
            <h3
              style={{
                fontSize: "1.375rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                marginBottom: "0.75rem",
              }}
            >
              Demo request received
            </h3>
            <p style={{ color: "rgba(255,255,255,0.50)", lineHeight: 1.65, maxWidth: "34ch", margin: "0 auto 2rem" }}>
              We'll reach out within one business day to schedule your Las Vegas demo walkthrough.
            </p>
            <button
              className="btn-primary"
              onClick={() => handleClose(false)}
              style={{ padding: "0.625rem 2rem" }}
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Form ──────────────────────────────────────────────── */
          <>
            <DialogHeader style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "rgba(129,140,248,0.10)",
                  border: "1px solid rgba(129,140,248,0.25)",
                  borderRadius: 6,
                  padding: "0.25rem 0.625rem",
                  marginBottom: "0.75rem",
                  width: "fit-content",
                }}
              >
                <Play size={11} style={{ color: "#818cf8" }} />
                <span style={{ fontSize: "0.75rem", color: "#818cf8", fontWeight: 600, letterSpacing: "0.06em" }}>
                  REQUEST A DEMO
                </span>
              </div>
              <DialogTitle
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#fff",
                  lineHeight: 1.2,
                }}
              >
                See StageGate in action
              </DialogTitle>
              <DialogDescription
                style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", lineHeight: 1.6 }}
              >
                Tell us about your robot and your Las Vegas show schedule. We'll walk you through exactly how we'd stage and activate it.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} noValidate>
              {/* Row: Name + Company */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label style={labelStyle}>Your name *</label>
                  <input
                    style={{ ...inputStyle, ...(errors.name ? { borderColor: "#f87171" } : {}) }}
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.6)")}
                    onBlur={e => (e.target.style.borderColor = errors.name ? "#f87171" : "rgba(255,255,255,0.12)")}
                  />
                  {errors.name && <p style={errorStyle}>{errors.name}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Company *</label>
                  <input
                    style={{ ...inputStyle, ...(errors.company ? { borderColor: "#f87171" } : {}) }}
                    placeholder="Unitree Robotics"
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.6)")}
                    onBlur={e => (e.target.style.borderColor = errors.company ? "#f87171" : "rgba(255,255,255,0.12)")}
                  />
                  {errors.company && <p style={errorStyle}>{errors.company}</p>}
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Work email *</label>
                <input
                  type="email"
                  style={{ ...inputStyle, ...(errors.email ? { borderColor: "#f87171" } : {}) }}
                  placeholder="jane@yourcompany.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.6)")}
                  onBlur={e => (e.target.style.borderColor = errors.email ? "#f87171" : "rgba(255,255,255,0.12)")}
                />
                {errors.email && <p style={errorStyle}>{errors.email}</p>}
              </div>

              {/* Robot type */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Robot type *</label>
                <select
                  style={{
                    ...inputStyle,
                    cursor: "pointer",
                    ...(errors.robotType ? { borderColor: "#f87171" } : {}),
                  }}
                  value={form.robotType}
                  onChange={e => setForm(f => ({ ...f, robotType: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.6)")}
                  onBlur={e => (e.target.style.borderColor = errors.robotType ? "#f87171" : "rgba(255,255,255,0.12)")}
                >
                  <option value="" style={{ background: "#0d0f14" }}>Select robot type…</option>
                  {ROBOT_TYPES.map(t => (
                    <option key={t} value={t} style={{ background: "#0d0f14" }}>{t}</option>
                  ))}
                </select>
                {errors.robotType && <p style={errorStyle}>{errors.robotType}</p>}
              </div>

              {/* Preferred show */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Preferred Las Vegas show</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.preferredShowName}
                  onChange={e => setForm(f => ({ ...f, preferredShowName: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.6)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                >
                  <option value="" style={{ background: "#0d0f14" }}>Any upcoming show</option>
                  {shows?.map(s => (
                    <option key={s.id} value={s.name} style={{ background: "#0d0f14" }}>
                      {s.name}{s.startDate ? ` — ${new Date(s.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional message */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={labelStyle}>Anything else we should know? <span style={{ opacity: 0.4 }}>(optional)</span></label>
                <textarea
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: 72,
                    fontFamily: "inherit",
                  }}
                  placeholder="Robot dimensions, special requirements, timeline…"
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  onFocus={e => (e.target.style.borderColor = "rgba(129,140,248,0.6)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary"
                disabled={submit.isPending}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.9375rem",
                  justifyContent: "center",
                  opacity: submit.isPending ? 0.7 : 1,
                }}
              >
                {submit.isPending ? (
                  <>
                    <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                    Sending…
                  </>
                ) : (
                  "Request demo"
                )}
              </button>

              {submit.isError && (
                <p style={{ ...errorStyle, textAlign: "center", marginTop: "0.75rem" }}>
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
