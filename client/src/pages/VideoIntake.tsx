import { useState } from "react";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { Upload, Video, Check, AlertCircle } from "lucide-react";
import { BRAND, emeraldAlpha } from "@/lib/brand";
// Client-side upload helper — POSTs to the built-in storage endpoint
async function uploadVideoFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json() as { url: string };
  return json.url;
}

export default function VideoIntake() {
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [robotName, setRobotName] = useState("");
  const [notes, setNotes] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submit = trpc.videoIntake.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(e.message),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      setUploadError("Video must be under 16 MB");
      return;
    }
    setVideoFile(file);
    setUploadError("");
    setUploading(true);
    try {
      const url = await uploadVideoFile(file);
      setVideoUrl(url);
    } catch {
      setUploadError("Upload failed — please try a URL instead");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const finalUrl = videoUrl.trim();
    if (!finalUrl) {
      setError("Please upload a video or paste a video URL");
      return;
    }
    submit.mutate({ company, contactName: contactName || undefined, contactEmail: contactEmail || undefined, robotName: robotName || undefined, videoUrl: finalUrl, notes: notes || undefined });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "0.125rem",
    color: "#e8e8e8",
    fontSize: "0.9375rem",
    padding: "0.75rem 1rem",
    fontFamily: "var(--font-sans)",
    outline: "none",
    transition: "border-color 0.15s",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "0.5625rem",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.35)",
    display: "block",
    marginBottom: "0.4rem",
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#1C1E22" }}>
        <Navbar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", gap: "1.5rem", textAlign: "center" }}>
          <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: emeraldAlpha(0.10), border: `1px solid ${emeraldAlpha(0.30)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={20} style={{ color: `${BRAND.emerald}` }} />
          </div>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", margin: 0 }}>Message Received</h2>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.55)", maxWidth: "36ch", lineHeight: 1.65 }}>
            The StageGate team will review your video and reach out within 24 hours to discuss your robot's logistics needs.
          </p>
          <a href="/xbot" className="btn-primary">Back to XBOT</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1C1E22" }}>
      <Navbar />
      <div className="container" style={{ paddingTop: "6rem", paddingBottom: "6rem", maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", marginBottom: "0.75rem" }}>
            XBOT / VIDEO REQUEST
          </p>
          <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#fff", marginBottom: "1rem" }}>
            Tell Us About Your Robot
          </h1>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.60)", lineHeight: 1.65 }}>
            Record a short video (under 16 MB) showing your robot and explaining what you need for your next trade show. The StageGate team will review it and reach out within 24 hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Company */}
          <div>
            <label style={labelStyle}>Company Name *</label>
            <input required value={company} onChange={e => setCompany(e.target.value)} placeholder="Acme Robotics" style={inputStyle} />
          </div>

          {/* Robot */}
          <div>
            <label style={labelStyle}>Robot Name / Product</label>
            <input value={robotName} onChange={e => setRobotName(e.target.value)} placeholder="e.g. Atlas, Spot, G1..." style={inputStyle} />
          </div>

          {/* Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Your Name</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@acmerobotics.com" style={inputStyle} />
            </div>
          </div>

          {/* Video upload */}
          <div>
            <label style={labelStyle}>Video Message</label>
            <div style={{ border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "0.25rem", padding: "2rem", textAlign: "center", position: "relative" }}>
              {videoFile && !uploadError ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                  <Video size={24} style={{ color: `${BRAND.emerald}` }} />
                  <span style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.70)" }}>{videoFile.name}</span>
                  {uploading && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "#f59e0b" }}>Uploading...</span>}
                  {!uploading && videoUrl && <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: `${BRAND.emerald}` }}>✓ Uploaded</span>}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                  <Upload size={24} style={{ color: "rgba(255,255,255,0.25)" }} />
                  <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.45)", margin: 0 }}>Drop a video file here or click to browse</p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.25)", margin: 0 }}>MP4, MOV, WEBM · max 16 MB</p>
                </div>
              )}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/ogg"
                onChange={handleFileChange}
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
              />
            </div>
            {uploadError && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: "#f87171", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <AlertCircle size={11} /> {uploadError}
              </p>
            )}
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.5625rem", color: "rgba(255,255,255,0.25)", marginTop: "0.75rem" }}>
              Or paste a video URL (YouTube, Loom, Dropbox, etc.)
            </p>
            <input
              type="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              style={{ ...inputStyle, marginTop: "0.4rem" }}
            />
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Additional Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe your robot's dimensions, weight, special handling requirements, target show, timeline..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {error && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#f87171", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <AlertCircle size={13} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submit.isPending || uploading}
            className="btn-primary"
            style={{ alignSelf: "flex-start", opacity: submit.isPending || uploading ? 0.6 : 1 }}
          >
            {submit.isPending ? "Submitting..." : "Send Video Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
