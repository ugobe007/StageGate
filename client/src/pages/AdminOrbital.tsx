import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BatteryCharging, Bot, CircleStop, Cpu, Gauge, KeyRound,
  Loader2, Lock, Play, RefreshCw, Radio, ShieldAlert, Thermometer, X,
} from "lucide-react";
import { BRAND, emeraldAlpha } from "@/lib/brand";

// ── Types (mirror orbital_cloud/models.py) ────────────────────────────────────
interface Pose { x: number; y: number; theta: number }
interface RobotSummary {
  id: string; vendor: string; model: string; industry: string;
  state: "active" | "idle" | "charging" | "halted" | "offline";
  battery_pct: number; pose_external: Pose; pose_internal: Pose;
  drift_delta_m: number; current_task?: string | null; error_code?: string | null;
}
interface BatteryTelemetry { pct?: number | null; temperature_c?: number | null; voltage_v?: number | null; current_a?: number | null; cycles?: number | null }
interface MotorTelemetry { joint: string; temperature_c?: number | null; current_a?: number | null; torque_nm?: number | null; position_rad?: number | null; velocity_rad_s?: number | null }
interface ImuTelemetry { accel: number[]; gyro: number[] }
interface SpatialTelemetry { x: number; y: number; z: number; roll: number; pitch: number; yaw: number; linear_velocity_mps?: number | null; angular_velocity_rps?: number | null }
interface SensorSnapshot {
  ts?: number | null; battery?: BatteryTelemetry | null; motors: MotorTelemetry[];
  imu?: ImuTelemetry | null; spatial?: SpatialTelemetry | null;
  temperatures_c: Record<string, number>; extra: Record<string, number>;
}
interface ControlGrants { managed: boolean; estop: boolean; velocity: boolean; mission: boolean }
interface RobotDetail extends RobotSummary {
  facility_id: string; mtbd_seconds?: number | null;
  recovery_latency_seconds?: number | null; env_degradation_score?: number | null;
  oem_brief: string; uptime_seconds: number;
  sensors?: SensorSnapshot | null; control?: ControlGrants;
}
interface OEMProfile {
  oem_id: string; company_name: string; vendor: string; transport: string;
  status: "pending" | "active" | "suspended";
  ceiling_scopes: string[]; granted_scopes: string[]; missing_scopes: string[];
  control_ready: boolean; monitor_ready: boolean;
}
interface Alert {
  id: string; robot_id: string; type: string; severity: "critical" | "warning" | "info";
  delta_meters?: number | null; message: string; acknowledged: boolean;
}
interface FleetResponse {
  facility: { id: string; name: string };
  industries: string[];
  vendors: string[];
  robots: RobotSummary[];
}
interface OrchestratorDecision {
  id: string; ts: number; robot_id?: string | null;
  action: "auto_estop" | "dispatch_charge" | "recommend_review" | "monitor";
  severity: "critical" | "warning" | "info"; rationale: string; auto_executed: boolean;
}
interface OrchestratorStatus {
  enabled: boolean; llm_enabled: boolean; last_run_ts?: number | null;
  narrative: string; decisions: OrchestratorDecision[];
  summary?: { total: number; active: number; halted: number; unacked_alerts: number } | null;
}

const STATE_COLOR: Record<RobotSummary["state"], string> = {
  active: BRAND.emerald,
  idle: "rgba(255,255,255,0.45)",
  charging: "#f59e0b",
  halted: "#ef4444",
  offline: "rgba(255,255,255,0.20)",
};

const SEVERITY_COLOR: Record<Alert["severity"], string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "rgba(255,255,255,0.55)",
};

const DRIFT_DEGRADED_M = 0.1;
const DRIFT_HALT_M = 0.5;

const ALL_SCOPES = [
  "telemetry.read", "state.read", "control.velocity", "control.estop",
  "control.teleop", "mission.dispatch", "camera.read", "map.read",
];
const OEM_STATUS_COLOR: Record<OEMProfile["status"], string> = {
  active: BRAND.emerald, pending: "#f59e0b", suspended: "#ef4444",
};
function tempColor(t: number | null | undefined, warn: number, hot: number): string {
  if (t == null) return BRAND.white;
  return t >= hot ? "#ef4444" : t >= warn ? "#f59e0b" : BRAND.emerald;
}

async function orbitalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/orbital${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { configured?: boolean; error?: string; detail?: string };
  if (!res.ok) {
    const err = new Error(body?.error || body?.detail || `Orbital request failed (${res.status})`) as Error & { configured?: boolean; status?: number };
    err.configured = body?.configured;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

function driftColor(m: number): string {
  if (m >= DRIFT_HALT_M) return "#ef4444";
  if (m >= DRIFT_DEGRADED_M) return "#f59e0b";
  return BRAND.emerald;
}

export default function AdminOrbital() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [orchestrator, setOrchestrator] = useState<OrchestratorStatus | null>(null);
  const [industry, setIndustry] = useState<string>("All");
  const [selected, setSelected] = useState<RobotDetail | null>(null);
  const [oems, setOems] = useState<OEMProfile[]>([]);
  const [manageOem, setManageOem] = useState<OEMProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [f, a, o, oem] = await Promise.all([
        orbitalFetch<FleetResponse>("/fleet"),
        orbitalFetch<Alert[]>("/alerts?limit=25"),
        orbitalFetch<OrchestratorStatus>("/orchestrator").catch(() => null),
        orbitalFetch<OEMProfile[]>("/oems").catch(() => [] as OEMProfile[]),
      ]);
      setFleet(f);
      setAlerts(Array.isArray(a) ? a : []);
      if (o) setOrchestrator(o);
      setOems(Array.isArray(oem) ? oem : []);
      setError(null);
      setLastSync(new Date());
    } catch (e) {
      const err = e as Error & { configured?: boolean };
      if (err.configured === false) setConfigured(false);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await orbitalFetch<{ configured: boolean }>("/status");
        if (cancelled) return;
        setConfigured(status.configured);
        if (status.configured) await refresh();
      } catch {
        if (!cancelled) setConfigured(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    if (!configured) return;
    pollRef.current = setInterval(refresh, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [configured, refresh]);

  const openRobot = useCallback(async (id: string) => {
    try {
      const detail = await orbitalFetch<RobotDetail>(`/robot/${encodeURIComponent(id)}`);
      setSelected(detail);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const control = useCallback(async (id: string, action: "estop" | "resume") => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await orbitalFetch(`/robot/${encodeURIComponent(id)}/${action}`, { method: "POST" });
      await refresh();
      if (selected?.id === id) await openRobot(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }, [refresh, selected, openRobot]);

  const ackAlert = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    try { await orbitalFetch(`/alerts/${encodeURIComponent(id)}/ack`, { method: "POST" }); }
    catch { await refresh(); }
  }, [refresh]);

  const saveOemScopes = useCallback(async (oem: OEMProfile, want: Set<string>) => {
    const granted = new Set(oem.granted_scopes);
    const toGrant = [...want].filter((s) => !granted.has(s));
    const toRevoke = [...granted].filter((s) => !want.has(s));
    try {
      if (toGrant.length) await orbitalFetch(`/oems/${encodeURIComponent(oem.oem_id)}/grant`, { method: "POST", body: JSON.stringify({ scopes: toGrant }) });
      if (toRevoke.length) await orbitalFetch(`/oems/${encodeURIComponent(oem.oem_id)}/revoke`, { method: "POST", body: JSON.stringify({ scopes: toRevoke }) });
      setManageOem(null);
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }, [refresh]);

  const toggleOemStatus = useCallback(async (oem: OEMProfile) => {
    const action = oem.status === "suspended" ? "reactivate" : "suspend";
    try {
      await orbitalFetch(`/oems/${encodeURIComponent(oem.oem_id)}/${action}`, { method: "POST" });
      setManageOem(null);
      await refresh();
    } catch (e) { setError((e as Error).message); }
  }, [refresh]);

  // Mirror cloud scope resolution so grid controls can disable + explain locally.
  const vendorControl = useCallback((vendor: string): ControlGrants => {
    const matches = oems.filter((o) => o.vendor.toLowerCase() === vendor.toLowerCase());
    if (!matches.length) return { managed: false, estop: true, velocity: true, mission: true };
    const p = matches.find((x) => x.status === "active") ?? matches[0];
    if (p.status === "suspended") return { managed: true, estop: false, velocity: false, mission: false };
    const g = new Set(p.granted_scopes);
    return { managed: true, estop: g.has("control.estop"), velocity: g.has("control.velocity"), mission: g.has("mission.dispatch") };
  }, [oems]);

  const cardBg = "#22252A";
  const border = "1px solid rgba(255,255,255,0.08)";

  if (configured === false) {
    return (
      <div style={{ padding: "2rem", color: BRAND.white }}>
        <Header facilityName={null} lastSync={null} onRefresh={refresh} />
        <div style={{ marginTop: "2rem", padding: "2rem", background: cardBg, border, borderRadius: 12, maxWidth: 620 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <Radio size={22} color={BRAND.emerald} />
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Orbital AI is not connected yet</h2>
          </div>
          <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>
            Set <code style={{ color: BRAND.emerald }}>ORBITAL_API_URL</code> on the StageGate
            server to your Orbital AI Cloud endpoint (and optionally{" "}
            <code style={{ color: BRAND.emerald }}>ORBITAL_API_KEY</code>). Once connected, this
            page shows the live fleet, drift, alerts, and E-Stop / resume controls.
          </p>
        </div>
      </div>
    );
  }

  if (configured === null || (!fleet && !error)) {
    return (
      <div style={{ padding: "2rem", color: BRAND.white, display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 className="animate-spin" size={18} /> Connecting to Orbital AI…
      </div>
    );
  }

  const robots = (fleet?.robots ?? []).filter((r) => industry === "All" || r.industry === industry);
  const tabs = ["All", ...(fleet?.industries ?? [])];
  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const counts = {
    active: fleet?.robots.filter((r) => r.state === "active").length ?? 0,
    halted: fleet?.robots.filter((r) => r.state === "halted").length ?? 0,
    total: fleet?.robots.length ?? 0,
  };

  return (
    <div style={{ padding: "2rem", color: BRAND.white }}>
      <Header facilityName={fleet?.facility?.name ?? null} lastSync={lastSync} onRefresh={refresh} />

      {error && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#fca5a5", fontSize: ".85rem" }}>
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <Kpi label="Robots online" value={`${counts.active}/${counts.total}`} icon={<Activity size={16} color={BRAND.emerald} />} />
        <Kpi label="E-Stopped" value={counts.halted} icon={<CircleStop size={16} color="#ef4444" />} accent={counts.halted > 0 ? "#ef4444" : undefined} />
        <Kpi label="Active alerts" value={activeAlerts.length} icon={<AlertTriangle size={16} color="#f59e0b" />} accent={activeAlerts.length > 0 ? "#f59e0b" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, marginTop: 20, alignItems: "start" }}>
        <div>
          {/* Industry tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setIndustry(t)} style={{
                padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: ".8rem",
                border: industry === t ? `1px solid ${BRAND.emerald}` : border,
                background: industry === t ? emeraldAlpha(0.14) : "transparent",
                color: industry === t ? BRAND.emerald : "rgba(255,255,255,0.7)",
              }}>{t}</button>
            ))}
          </div>

          {/* Robot grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {robots.map((r) => (
              <div key={r.id} onClick={() => openRobot(r.id)} style={{ background: cardBg, border, borderRadius: 12, padding: 16, cursor: "pointer", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Bot size={16} color={STATE_COLOR[r.state]} />
                      <span style={{ fontWeight: 600 }}>{r.vendor} {r.model}</span>
                    </div>
                    <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{r.id} · {r.industry}</div>
                  </div>
                  <span style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".5px", color: STATE_COLOR[r.state], fontWeight: 700 }}>{r.state}</span>
                </div>

                <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: ".78rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.7)" }}>
                    <BatteryCharging size={14} /> {r.battery_pct.toFixed(0)}%
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: driftColor(r.drift_delta_m) }} title="ARIA drift Δ (external vs internal pose)">
                    <ShieldAlert size={14} /> {r.drift_delta_m.toFixed(3)} m
                  </span>
                </div>
                {r.current_task && (
                  <div style={{ marginTop: 10, fontSize: ".72rem", color: "rgba(255,255,255,0.5)" }}>▸ {r.current_task}</div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  {(() => {
                    const canControl = vendorControl(r.vendor).estop;
                    if (!canControl) {
                      return <ControlBtn label={r.state === "halted" ? "Resume" : "E-Stop"} locked
                        icon={<CircleStop size={13} />} color="rgba(255,255,255,0.4)"
                        title="OEM has not granted control.estop" onClick={(e) => e.stopPropagation()} />;
                    }
                    return r.state === "halted" ? (
                      <ControlBtn label="Resume" icon={<Play size={13} />} color={BRAND.emerald}
                        busy={busy[r.id]} onClick={(e) => { e.stopPropagation(); control(r.id, "resume"); }} />
                    ) : (
                      <ControlBtn label="E-Stop" icon={<CircleStop size={13} />} color="#ef4444"
                        busy={busy[r.id]} onClick={(e) => { e.stopPropagation(); control(r.id, "estop"); }} />
                    );
                  })()}
                </div>
              </div>
            ))}
            {robots.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".85rem" }}>No robots in this view.</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Autonomy (orchestrator) rail */}
        <div style={{ background: cardBg, border, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Bot size={16} color={BRAND.emerald} />
            <h3 style={{ margin: 0, fontSize: ".95rem" }}>Autonomy</h3>
            {orchestrator && (
              <span style={{ marginLeft: "auto", fontSize: ".64rem", textTransform: "uppercase", letterSpacing: ".5px", color: orchestrator.enabled ? BRAND.emerald : "rgba(255,255,255,0.4)" }}>
                {orchestrator.enabled ? "supervising" : "off"}
              </span>
            )}
          </div>
          {!orchestrator ? (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".8rem" }}>Orchestrator not reporting.</div>
          ) : (
            <>
              <p style={{ margin: "0 0 10px", fontSize: ".8rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                {orchestrator.narrative || "Fleet nominal."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orchestrator.decisions.slice(0, 6).map((d) => (
                  <div key={d.id} style={{ borderLeft: `3px solid ${SEVERITY_COLOR[d.severity]}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: ".74rem", fontWeight: 600, color: d.auto_executed ? BRAND.emerald : "rgba(255,255,255,0.75)" }}>
                      {d.action.replace(/_/g, " ")}{d.auto_executed ? " ✓" : ""}
                    </div>
                    <div style={{ fontSize: ".7rem", color: "rgba(255,255,255,0.55)" }}>{d.rationale}</div>
                  </div>
                ))}
                {orchestrator.decisions.length === 0 && (
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".76rem" }}>No supervisory actions taken.</div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Alerts rail */}
        <div style={{ background: cardBg, border, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: ".95rem" }}>Alerts</h3>
          </div>
          {alerts.length === 0 && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".8rem" }}>No alerts — fleet nominal.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.slice(0, 25).map((a) => (
              <div key={a.id} style={{ opacity: a.acknowledged ? 0.45 : 1, borderLeft: `3px solid ${SEVERITY_COLOR[a.severity]}`, paddingLeft: 10 }}>
                <div style={{ fontSize: ".78rem", fontWeight: 600, color: SEVERITY_COLOR[a.severity] }}>
                  {a.type.replace(/_/g, " ")}
                </div>
                <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.6)" }}>{a.robot_id}{a.message ? ` — ${a.message}` : ""}</div>
                {!a.acknowledged && (
                  <button onClick={() => ackAlert(a.id)} style={{ marginTop: 4, fontSize: ".68rem", color: BRAND.emerald, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* OEM governance */}
      <div style={{ background: cardBg, border, borderRadius: 12, padding: 16, marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <KeyRound size={16} color={BRAND.emerald} />
          <h3 style={{ margin: 0, fontSize: ".95rem" }}>OEM Partners &amp; API Scopes</h3>
          <span style={{ marginLeft: "auto", fontSize: ".72rem", color: "rgba(255,255,255,0.4)" }}>
            control Orbital exercises is bounded by what each OEM unlocks
          </span>
        </div>
        {oems.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".82rem", marginTop: 10 }}>
            No OEM partners registered yet. Onboard one with <code style={{ color: BRAND.emerald }}>scripts/oem_onboard.py register</code>.
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(255,255,255,0.45)" }}>
                  {["Company", "Vendor", "Transport", "Status", "Granted / Ceiling", "Readiness", ""].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oems.map((o) => (
                  <tr key={o.oem_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{o.company_name}</td>
                    <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.6)" }}>{o.vendor}</td>
                    <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.6)" }}>{o.transport}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".5px", color: OEM_STATUS_COLOR[o.status], fontWeight: 700 }}>{o.status}</span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.75)" }}>{o.granted_scopes.length} / {o.ceiling_scopes.length}</td>
                    <td style={{ padding: "8px 10px", fontSize: ".72rem" }}>
                      <span style={{ color: o.monitor_ready ? BRAND.emerald : "rgba(255,255,255,0.35)" }}>monitor</span>
                      <span style={{ color: "rgba(255,255,255,0.3)" }}> · </span>
                      <span style={{ color: o.control_ready ? BRAND.emerald : "rgba(255,255,255,0.35)" }}>control</span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      <button onClick={() => setManageOem(o)} style={{ padding: "5px 12px", borderRadius: 7, border, background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: ".74rem" }}>Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RobotModal detail={selected} busy={busy[selected.id]} onClose={() => setSelected(null)}
          onControl={(action) => control(selected.id, action)} />
      )}
      {manageOem && (
        <OEMModal oem={manageOem} onClose={() => setManageOem(null)}
          onSave={(want) => saveOemScopes(manageOem, want)} onToggleStatus={() => toggleOemStatus(manageOem)} />
      )}
    </div>
  );
}

function Header({ facilityName, lastSync, onRefresh }: { facilityName: string | null; lastSync: Date | null; onRefresh: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Radio size={22} color={BRAND.emerald} />
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Orbital AI — Fleet Control</h1>
        </div>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.45)", fontSize: ".85rem" }}>
          {facilityName ? `${facilityName} · ` : ""}Live monitor & control for deployed robots
          {lastSync ? ` · synced ${lastSync.toLocaleTimeString()}` : ""}
        </p>
      </div>
      <button onClick={onRefresh} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: ".82rem" }}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: React.ReactNode; icon: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: "#22252A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 18px", minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.5)", fontSize: ".72rem" }}>{icon}{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: 4, color: accent ?? BRAND.white }}>{value}</div>
    </div>
  );
}

function ControlBtn({ label, icon, color, busy, locked, title, onClick }: { label: string; icon: React.ReactNode; color: string; busy?: boolean; locked?: boolean; title?: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button disabled={busy || locked} onClick={onClick} title={title} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7,
      border: `1px solid ${locked ? "rgba(255,255,255,0.15)" : color}`, background: locked ? "rgba(255,255,255,0.04)" : `${color}1A`,
      color, cursor: locked ? "not-allowed" : busy ? "wait" : "pointer",
      fontSize: ".76rem", fontWeight: 600, opacity: busy ? 0.6 : 1,
    }}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : locked ? <Lock size={12} /> : icon} {label}
    </button>
  );
}

function ScopeChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ fontSize: ".68rem", padding: "2px 8px", borderRadius: 999, background: ok ? emeraldAlpha(0.14) : "rgba(239,68,68,0.14)", color: ok ? BRAND.emerald : "#fca5a5" }}>
      {ok ? "✓" : "✕"} {label}
    </span>
  );
}

function Vitals({ s }: { s?: SensorSnapshot | null }) {
  if (!s) return <div style={{ marginTop: 14, fontSize: ".78rem", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>No live sensor telemetry yet.</div>;
  const cells: React.ReactNode[] = [];
  const cell = (label: string, value: React.ReactNode, color = BRAND.white, icon?: React.ReactNode) => (
    <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: ".68rem", color: "rgba(255,255,255,0.5)" }}>{icon}{label}</div>
      <div style={{ fontWeight: 600, marginTop: 3, color, fontSize: ".82rem" }}>{value}</div>
    </div>
  );
  const b = s.battery;
  if (b) {
    if (b.pct != null) cells.push(cell("Battery", `${Math.round(b.pct)}%`, undefined, <BatteryCharging size={12} />));
    if (b.temperature_c != null) cells.push(cell("Batt temp", `${b.temperature_c.toFixed(1)} °C`, tempColor(b.temperature_c, 45, 55), <Thermometer size={12} />));
    if (b.voltage_v != null) cells.push(cell("Voltage", `${b.voltage_v.toFixed(1)} V`));
    if (b.current_a != null) cells.push(cell("Current", `${b.current_a.toFixed(1)} A`));
  }
  if (s.motors?.length) {
    const hottest = s.motors.reduce((m, x) => ((x.temperature_c ?? -1) > (m.temperature_c ?? -1) ? x : m), s.motors[0]);
    cells.push(cell(`Hottest motor (${s.motors.length})`, hottest.temperature_c != null ? `${hottest.joint} ${hottest.temperature_c.toFixed(0)}°C` : hottest.joint, tempColor(hottest.temperature_c, 60, 75), <Gauge size={12} />));
  }
  if (s.spatial) {
    const sp = s.spatial;
    cells.push(cell("Position x,y,z", `${sp.x.toFixed(1)}, ${sp.y.toFixed(1)}, ${sp.z.toFixed(1)}`));
    cells.push(cell("Yaw", `${(sp.yaw ?? 0).toFixed(2)} rad`));
    if (sp.linear_velocity_mps != null) cells.push(cell("Lin. vel", `${sp.linear_velocity_mps.toFixed(2)} m/s`));
  }
  if (s.imu?.accel?.length === 3) {
    const mag = Math.hypot(...s.imu.accel);
    cells.push(cell("IMU |a|", `${mag.toFixed(2)} m/s²`, undefined, <Cpu size={12} />));
  }
  Object.entries(s.temperatures_c ?? {}).forEach(([k, v]) => cells.push(cell(`Temp: ${k}`, `${Number(v).toFixed(1)} °C`, tempColor(Number(v), 65, 80), <Thermometer size={12} />)));
  Object.entries(s.extra ?? {}).forEach(([k, v]) => cells.push(cell(k, typeof v === "number" ? v.toFixed(1) : String(v))));
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".5px", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
        Live vitals{s.ts ? ` · ${new Date(s.ts * 1000).toLocaleTimeString()}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>{cells}</div>
    </div>
  );
}

function RobotModal({ detail, busy, onClose, onControl }: {
  detail: RobotDetail; busy?: boolean; onClose: () => void; onControl: (action: "estop" | "resume") => void;
}) {
  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: ".82rem" }}>
      <span style={{ color: "rgba(255,255,255,0.5)" }}>{k}</span>
      <span style={{ color: BRAND.white }}>{v}</span>
    </div>
  );
  const secs = (s?: number | null) => (s == null ? "—" : s >= 3600 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s)}s`);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1C1E22", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 24, width: 460, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={18} color={STATE_COLOR[detail.state]} />
              <h2 style={{ margin: 0, fontSize: "1.15rem", color: BRAND.white }}>{detail.vendor} {detail.model}</h2>
            </div>
            <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{detail.id} · {detail.industry}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ marginTop: 16 }}>
          {row("State", <span style={{ color: STATE_COLOR[detail.state], fontWeight: 600, textTransform: "uppercase" }}>{detail.state}</span>)}
          {row("Battery", `${detail.battery_pct.toFixed(0)}%`)}
          {row("Drift Δ (ARIA)", <span style={{ color: driftColor(detail.drift_delta_m) }}>{detail.drift_delta_m.toFixed(3)} m</span>)}
          {row("Pose (external)", `x ${detail.pose_external.x.toFixed(2)}, y ${detail.pose_external.y.toFixed(2)}`)}
          {row("Pose (internal)", `x ${detail.pose_internal.x.toFixed(2)}, y ${detail.pose_internal.y.toFixed(2)}`)}
          {row("Current task", detail.current_task || "—")}
          {row("MTBD", secs(detail.mtbd_seconds))}
          {row("Recovery latency", secs(detail.recovery_latency_seconds))}
          {row("Uptime", secs(detail.uptime_seconds))}
          {detail.error_code && row("Error", <span style={{ color: "#ef4444" }}>{detail.error_code}</span>)}
        </div>

        {detail.oem_brief && (
          <div style={{ marginTop: 14, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: ".78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
            {detail.oem_brief}
          </div>
        )}

        <Vitals s={detail.sensors} />

        {detail.control?.managed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.45)" }}>OEM grants:</span>
            <ScopeChip ok={detail.control.estop} label="E-Stop" />
            <ScopeChip ok={detail.control.velocity} label="Velocity" />
            <ScopeChip ok={detail.control.mission} label="Mission" />
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          {detail.control && !detail.control.estop ? (
            <ControlBtn label={detail.state === "halted" ? "Resume robot" : "Emergency stop"} locked
              icon={<CircleStop size={14} />} color="rgba(255,255,255,0.4)"
              title="OEM has not granted control.estop" onClick={() => {}} />
          ) : detail.state === "halted" ? (
            <ControlBtn label="Resume robot" icon={<Play size={14} />} color={BRAND.emerald} busy={busy} onClick={() => onControl("resume")} />
          ) : (
            <ControlBtn label="Emergency stop" icon={<CircleStop size={14} />} color="#ef4444" busy={busy} onClick={() => onControl("estop")} />
          )}
        </div>
      </div>
    </div>
  );
}

function OEMModal({ oem, onClose, onSave, onToggleStatus }: {
  oem: OEMProfile; onClose: () => void; onSave: (want: Set<string>) => void; onToggleStatus: () => void;
}) {
  const ceiling = new Set(oem.ceiling_scopes);
  const [want, setWant] = useState<Set<string>>(new Set(oem.granted_scopes));
  const suspended = oem.status === "suspended";
  const toggle = (s: string) => setWant((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1C1E22", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 24, width: 480, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: BRAND.white }}>{oem.company_name}</h2>
            <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
              {oem.oem_id} · {oem.vendor} · {oem.transport} · <span style={{ color: OEM_STATUS_COLOR[oem.status], textTransform: "uppercase" }}>{oem.status}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: ".76rem", color: "rgba(255,255,255,0.55)", marginTop: 10, lineHeight: 1.5 }}>
          Toggle the API scopes this OEM has unlocked. Scopes outside their protocol's capability ceiling can't be granted.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginTop: 14 }}>
          {ALL_SCOPES.map((s) => {
            const inCeiling = ceiling.has(s);
            return (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", opacity: inCeiling ? 1 : 0.4, cursor: inCeiling ? "pointer" : "not-allowed" }}>
                <input type="checkbox" disabled={!inCeiling} checked={want.has(s)} onChange={() => toggle(s)} style={{ accentColor: BRAND.emerald }} />
                <span style={{ fontSize: ".8rem", color: BRAND.white }}>{s}</span>
                {!inCeiling && <span style={{ fontSize: ".64rem", color: "rgba(255,255,255,0.35)" }}>(outside ceiling)</span>}
              </label>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button onClick={onToggleStatus} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: suspended ? BRAND.emerald : "#fca5a5", cursor: "pointer", fontSize: ".78rem" }}>
            {suspended ? "Reactivate access" : "Suspend access"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: ".78rem" }}>Cancel</button>
            <button onClick={() => onSave(want)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: BRAND.emerald, color: "#0b0f14", cursor: "pointer", fontSize: ".78rem", fontWeight: 700 }}>Save scopes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
