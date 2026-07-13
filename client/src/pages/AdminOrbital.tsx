import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BatteryCharging, Bot, CircleStop, Cpu, Crosshair, Gauge, Heart,
  KeyRound, LayoutDashboard, Loader2, Lock, Map, Navigation, Play, RefreshCw, Radio, Send,
  Settings, ShieldAlert, SlidersHorizontal, Thermometer, Users, Video, X,
} from "lucide-react";
import { BRAND, emeraldAlpha } from "@/lib/brand";

// "Mission Control" palette — obsidian surfaces + semantic accents (azure=telemetry,
// emerald=healthy, amber=CTA/warn, crimson=critical). Mirrors the standalone Orbital console.
const MC = {
  bg: "#0a0d14",
  panel: "#0c0f17",
  card: "#10141d",
  raised: "#161c28",
  input: "#1b2230",
  line: "#242c3a",
  lineStrong: "#2f3a4c",
  ink: "#e6eaef",
  inkMut: "#aab4c1",
  inkDim: "#828c9b",
  azure: "#00a5da",
  azureLight: "#3dbfe2",
  green: BRAND.emerald,
  amber: "#ffa01f",
  crimson: "#e5484d",
} as const;
const MONO = "'JetBrains Mono', ui-monospace, 'Space Mono', monospace";
const SG = "'Space Grotesk', ui-sans-serif, system-ui";

// ── Types (mirror orbital_cloud/models.py) ────────────────────────────────────
interface Pose { x: number; y: number; theta: number }
interface Point { x: number; y: number }
type ControlMode = "patrol" | "visual_nav" | "manual" | "charging" | "halted" | "idle";
interface RobotSummary {
  id: string; vendor: string; model: string; industry: string;
  state: "active" | "idle" | "charging" | "halted" | "offline";
  battery_pct: number; pose_external: Pose; pose_internal: Pose;
  drift_delta_m: number; current_task?: string | null; error_code?: string | null;
  visual_nav?: boolean; nav_goal?: Point | null; waypoints?: Point[];
  speed_mps?: number; manual_drive?: boolean; control_mode?: ControlMode;
}
interface WarehouseRack { id: string; x: number; y: number; w: number; h: number }
interface WarehouseMap {
  name: string; width_m: number; height_m: number;
  racks: WarehouseRack[];
  charge_stations: { id: string; x: number; y: number }[];
  dock?: { x: number; y: number; w: number; h: number };
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
  active: MC.green,
  idle: MC.amber,
  charging: MC.azure,
  halted: MC.crimson,
  offline: "rgba(255,255,255,0.20)",
};

const SEVERITY_COLOR: Record<Alert["severity"], string> = {
  critical: MC.crimson,
  warning: MC.amber,
  info: "rgba(255,255,255,0.55)",
};

const DRIFT_DEGRADED_M = 0.1;
const DRIFT_HALT_M = 0.5;
const MAX_SPEED = 2.5; // mirrors ORBITAL_MAX_SPEED_MPS

const MODE_LABEL: Record<ControlMode, string> = {
  patrol: "Autonomous patrol", visual_nav: "Visual-nav (SLAM bypass)", manual: "Manual jog",
  charging: "Charging", halted: "Halted", idle: "Idle",
};
const MODE_COLOR: Record<ControlMode, string> = {
  patrol: "rgba(255,255,255,0.55)", visual_nav: MC.azure, manual: MC.amber,
  charging: MC.azure, halted: MC.crimson, idle: MC.amber,
};
// 3×3 direction pad → heading in degrees (world y-up, 0 = east, CCW). null = stop.
const DIRS: [string, number | null][] = [
  ["↖", 135], ["↑", 90], ["↗", 45],
  ["←", 180], ["■", null], ["→", 0],
  ["↙", 225], ["↓", 270], ["↘", 315],
];

const ALL_SCOPES = [
  "telemetry.read", "state.read", "control.velocity", "control.estop",
  "control.teleop", "mission.dispatch", "camera.read", "map.read",
];
const OEM_STATUS_COLOR: Record<OEMProfile["status"], string> = {
  active: MC.green, pending: MC.amber, suspended: MC.crimson,
};

// The control surface Orbital exposes to operators. Each capability is gated by an API scope
// the OEM must unlock — this is the contract 3rd-party robot vendors integrate against.
type Capability = { scope: string; label: string; kind: "monitor" | "control"; desc: string; icon: React.ReactNode };
const CAPABILITIES: Capability[] = [
  { scope: "telemetry.read", label: "Telemetry", kind: "monitor", desc: "Live sensor + drift stream", icon: <Radio size={14} /> },
  { scope: "state.read", label: "State", kind: "monitor", desc: "Battery, mode, health", icon: <Heart size={14} /> },
  { scope: "map.read", label: "Spatial map", kind: "monitor", desc: "Facility floor + localization", icon: <Map size={14} /> },
  { scope: "camera.read", label: "Camera", kind: "monitor", desc: "Overhead + onboard feeds", icon: <Video size={14} /> },
  { scope: "control.velocity", label: "Drive", kind: "control", desc: "Speed, direction & visual waypoints", icon: <Navigation size={14} /> },
  { scope: "control.estop", label: "Safety stop", kind: "control", desc: "Emergency stop / resume", icon: <CircleStop size={14} /> },
  { scope: "control.teleop", label: "Teleop", kind: "control", desc: "Direct remote operation", icon: <Crosshair size={14} /> },
  { scope: "mission.dispatch", label: "Mission", kind: "control", desc: "Assign tasks & routes", icon: <Send size={14} /> },
];
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
  const [map, setMap] = useState<WarehouseMap | null>(null);
  const [mapSel, setMapSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Left nav rail: section anchors + scroll-spy
  const [activeSec, setActiveSec] = useState<string>("overview");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reg = (id: string) => (el: HTMLDivElement | null) => { sectionRefs.current[id] = el; };
  const scrollToSec = (id: string) => sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (vis.length) setActiveSec((vis[0].target as HTMLElement).dataset.sec || "overview");
    }, { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5] });
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [map, fleet, oems, configured]);

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

  useEffect(() => {
    if (!configured) return;
    orbitalFetch<WarehouseMap>("/map").then(setMap).catch(() => {});
  }, [configured]);

  // Auto-select a live robot the first time the fleet loads so the control surface is
  // populated on arrival instead of showing an empty "select a robot" state.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || !fleet?.robots?.length) return;
    autoSelected.current = true;
    const r = fleet.robots.find((x) => x.state !== "halted") ?? fleet.robots[0];
    setMapSel(r?.id ?? null);
  }, [fleet]);

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

  const navigate = useCallback(async (id: string, waypoints: Point[]) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await orbitalFetch(`/robot/${encodeURIComponent(id)}/navigate`, { method: "POST", body: JSON.stringify({ waypoints }) });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }, [refresh]);

  const clearRoute = useCallback(async (id: string) => {
    try { await orbitalFetch(`/robot/${encodeURIComponent(id)}/navigate/clear`, { method: "POST" }); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }, [refresh]);

  const setSpeed = useCallback(async (id: string, mps: number) => {
    try { await orbitalFetch(`/robot/${encodeURIComponent(id)}/speed`, { method: "POST", body: JSON.stringify({ speed_mps: mps }) }); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }, [refresh]);

  const drive = useCallback(async (id: string, heading_deg: number, speed_mps: number) => {
    try { await orbitalFetch(`/robot/${encodeURIComponent(id)}/drive`, { method: "POST", body: JSON.stringify({ heading_deg, speed_mps }) }); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }, [refresh]);

  const stopDrive = useCallback(async (id: string) => {
    try { await orbitalFetch(`/robot/${encodeURIComponent(id)}/drive/stop`, { method: "POST" }); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }, [refresh]);

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

  // Generic scope check for any capability (unmanaged vendors are open; suspended grant nothing).
  const vendorHasScope = useCallback((vendor: string, scope: string): boolean => {
    const matches = oems.filter((o) => o.vendor.toLowerCase() === vendor.toLowerCase());
    if (!matches.length) return true;
    const p = matches.find((x) => x.status === "active") ?? matches[0];
    if (p.status === "suspended") return false;
    return new Set(p.granted_scopes).has(scope);
  }, [oems]);

  // Click the floor with a robot selected → set a visual-control waypoint (shift = append).
  const handleFloorClick = useCallback((x: number, y: number, append: boolean) => {
    if (!mapSel) return;
    const r = fleet?.robots.find((rr) => rr.id === mapSel);
    if (!r) return;
    if (!vendorControl(r.vendor).velocity) {
      setError(`${r.vendor} hasn't granted control.velocity — grant it in OEM Partners to set waypoints for ${r.id}.`);
      return;
    }
    const existing = append ? (r.waypoints ?? []).map((w) => ({ x: w.x, y: w.y })) : [];
    void navigate(mapSel, [...existing, { x: +x.toFixed(2), y: +y.toFixed(2) }]);
  }, [mapSel, fleet, vendorControl, navigate]);

  const cardBg = MC.card;
  const border = `1px solid ${MC.line}`;

  if (configured === false) {
    return (
      <div style={{ padding: "2rem", color: MC.ink, background: MC.bg, minHeight: "100vh", fontFamily: SG }}>
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
      <div style={{ padding: "2rem", color: MC.ink, background: MC.bg, minHeight: "100vh", fontFamily: SG, display: "flex", alignItems: "center", gap: 10 }}>
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
    <div style={{ padding: "2rem", paddingLeft: "calc(2rem + 56px)", color: MC.ink, background: MC.bg, minHeight: "100vh", fontFamily: SG }}>
      <NavRail active={activeSec} onSelect={scrollToSec} />
      <Header facilityName={fleet?.facility?.name ?? null} lastSync={lastSync} onRefresh={refresh} />

      {error && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#fca5a5", fontSize: ".85rem" }}>
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div ref={reg("overview")} data-sec="overview" style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap", scrollMarginTop: 80 }}>
        <Kpi label="Robots online" value={`${counts.active}/${counts.total}`} icon={<Activity size={16} color={BRAND.emerald} />} />
        <Kpi label="E-Stopped" value={counts.halted} icon={<CircleStop size={16} color="#ef4444" />} accent={counts.halted > 0 ? "#ef4444" : undefined} />
        <Kpi label="Active alerts" value={activeAlerts.length} icon={<AlertTriangle size={16} color="#f59e0b" />} accent={activeAlerts.length > 0 ? "#f59e0b" : undefined} />
      </div>

      {/* Warehouse map */}
      {map && (
        <div ref={reg("map")} data-sec="map" style={{ background: cardBg, border, borderRadius: 12, padding: 16, marginTop: 20, scrollMarginTop: 80 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <Map size={16} color={BRAND.emerald} />
            <h3 style={{ margin: 0, fontSize: ".95rem" }}>Warehouse — Global Spatial Map</h3>
            <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.4)" }}>
              select a robot, then click the floor to set a visual-control waypoint (bypasses onboard SLAM) · shift-click to chain
            </span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {mapSel && (() => {
                const r = fleet?.robots.find((x) => x.id === mapSel);
                const routing = !!(r?.waypoints?.length);
                return (
                  <>
                    <span style={{ fontSize: ".72rem", padding: "3px 10px", borderRadius: 999, background: emeraldAlpha(0.14), color: BRAND.emerald }}>
                      {mapSel}{routing ? " · en route" : ""}
                    </span>
                    {routing && (
                      <button onClick={() => clearRoute(mapSel)} style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 7, border, background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>Clear route</button>
                    )}
                    <button onClick={() => setMapSel(null)} style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 7, border, background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>Deselect</button>
                  </>
                );
              })()}
            </div>
          </div>
          <WarehouseMapView map={map} robots={fleet?.robots ?? []} selectedId={mapSel}
            onSelectRobot={setMapSel} onFloorClick={handleFloorClick} />
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: ".68rem", color: "rgba(255,255,255,0.5)" }}>
            <Legend color={BRAND.emerald} label="camera pose (ground truth)" />
            <Legend color="rgba(255,255,255,0.5)" label="robot self-report (SLAM)" ring />
            <Legend color={BRAND.emerald} label="visual-nav path → waypoint" bar />
            <Legend color="#f59e0b" label="manual jog" ring />
            <Legend color="#3a3a3a" label="storage rack" square />
          </div>
        </div>
      )}

      {/* Control capabilities catalog — the operator/OEM control contract */}
      <div ref={reg("capabilities")} data-sec="capabilities" style={{ scrollMarginTop: 80 }}>
        <CapabilitiesPanel robots={fleet?.robots ?? []} oems={oems} vendorHasScope={vendorHasScope} cardBg={cardBg} border={border} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, marginTop: 20, alignItems: "start" }}>
        <div ref={reg("fleet")} data-sec="fleet" style={{ scrollMarginTop: 80 }}>
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
                    <BatteryCharging size={14} /> <span style={{ fontFamily: MONO }}>{r.battery_pct.toFixed(0)}%</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: driftColor(r.drift_delta_m) }} title="ARIA drift Δ (external vs internal pose)">
                    <ShieldAlert size={14} /> {r.drift_delta_m.toFixed(3)} m
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: ".72rem", color: MODE_COLOR[r.control_mode ?? "patrol"] }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", opacity: 0.85 }} />
                  {MODE_LABEL[r.control_mode ?? "patrol"]}
                  {typeof r.speed_mps === "number" && (
                    <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.55)", fontFamily: MONO }}>{r.speed_mps.toFixed(2)} m/s</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <ControlBtn label="Control" icon={<Gauge size={13} />} color={BRAND.emerald}
                    onClick={(e) => { e.stopPropagation(); setMapSel(r.id); }} />
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
        {/* Robot control panel (driven by map selection) */}
        {(() => {
          const r = fleet?.robots.find((x) => x.id === mapSel) ?? null;
          return (
            <ControlPanel
              key={r?.id ?? "none"} robot={r} grants={r ? vendorControl(r.vendor) : null} busy={r ? busy[r.id] : false}
              onSpeed={(mps) => r && setSpeed(r.id, mps)}
              onDrive={(h, mps) => r && drive(r.id, h, mps)}
              onStopDrive={() => r && stopDrive(r.id)}
              onClearRoute={() => r && clearRoute(r.id)}
              onEstop={() => r && control(r.id, "estop")}
              onResume={() => r && control(r.id, "resume")}
              onDetails={() => r && openRobot(r.id)}
              onDeselect={() => setMapSel(null)}
            />
          );
        })()}

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
        <div ref={reg("alerts")} data-sec="alerts" style={{ background: cardBg, border, borderRadius: 12, padding: 16, scrollMarginTop: 80 }}>
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

      {/* How the live simulation works */}
      <LogicPanel orchestrator={orchestrator} cardBg={cardBg} border={border} />

      {/* OEM governance */}
      <div ref={reg("partners")} data-sec="partners" style={{ background: cardBg, border, borderRadius: 12, padding: 16, marginTop: 20, scrollMarginTop: 80 }}>
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

function Legend({ color, label, ring, bar, square }: { color: string; label: string; ring?: boolean; bar?: boolean; square?: boolean }) {
  const swatch = bar
    ? <span style={{ width: 14, height: 2, background: color, display: "inline-block" }} />
    : square
      ? <span style={{ width: 10, height: 10, background: color, display: "inline-block" }} />
      : <span style={{ width: 10, height: 10, borderRadius: 999, background: ring ? "transparent" : color, border: ring ? `1px solid ${color}` : "none", display: "inline-block" }} />;
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{swatch}{label}</span>;
}

function WarehouseMapView({ map, robots, selectedId, onSelectRobot, onFloorClick }: {
  map: WarehouseMap; robots: RobotSummary[]; selectedId: string | null;
  onSelectRobot: (id: string) => void; onFloorClick: (x: number, y: number, append: boolean) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const W = map.width_m, H = map.height_m;
  const Y = (y: number) => H - y;
  const green = MC.green;
  const amber = MC.amber;
  const nav = MC.azure;

  const floorClick = (e: React.MouseEvent) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    onFloorClick(fx * W, (1 - fy) * H, e.shiftKey);
  };

  const grid: React.ReactNode[] = [];
  for (let gx = 2; gx < W; gx += 2) grid.push(<line key={`vx${gx}`} x1={gx} y1={0} x2={gx} y2={H} stroke="#141a26" strokeWidth={0.02} />);
  for (let gy = 2; gy < H; gy += 2) grid.push(<line key={`vy${gy}`} x1={0} y1={gy} x2={W} y2={gy} stroke="#141a26" strokeWidth={0.02} />);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onClick={floorClick}
      style={{ width: "100%", maxHeight: "60vh", aspectRatio: `${W} / ${H}`, background: MC.bg, borderRadius: 8, cursor: selectedId ? "crosshair" : "default", userSelect: "none", display: "block" }}>
      <rect x={0} y={0} width={W} height={H} fill="#0b0f18" stroke="#1b2230" strokeWidth={0.06} />
      {grid}
      {map.dock && (
        <>
          <rect x={map.dock.x} y={Y(map.dock.y + map.dock.h)} width={map.dock.w} height={map.dock.h} fill="#0b2e3a" stroke={MC.azure} strokeWidth={0.04} opacity={0.85} />
          <text x={map.dock.x + map.dock.w / 2} y={Y(map.dock.y + map.dock.h) + map.dock.h / 2 + 0.2} fill={MC.azureLight} fontSize={0.5} textAnchor="middle">DOCK</text>
        </>
      )}
      {map.racks.map((r) => (
        <g key={r.id}>
          <rect x={r.x} y={Y(r.y + r.h)} width={r.w} height={r.h} rx={0.08} fill="#161c28" stroke="#2f3a4c" strokeWidth={0.03} />
          <text x={r.x + r.w / 2} y={Y(r.y + r.h / 2) + 0.14} fill="#828c9b" fontSize={0.42} textAnchor="middle">{r.id}</text>
        </g>
      ))}
      {(map.charge_stations ?? []).map((c) => (
        <g key={c.id}>
          <circle cx={c.x} cy={Y(c.y)} r={0.42} fill={MC.azure} opacity={0.16} />
          <text x={c.x} y={Y(c.y) + 0.16} fill={MC.azureLight} fontSize={0.5} textAnchor="middle">⚡</text>
        </g>
      ))}
      {robots.map((r) => {
        const ex = r.pose_external, ins = r.pose_internal;
        const selected = r.id === selectedId;
        const fill = STATE_COLOR[r.state];
        const hx = ex.x + Math.cos(ex.theta) * 0.4, hy = ex.y + Math.sin(ex.theta) * 0.4;
        const wps = r.waypoints ?? [];
        return (
          <g key={r.id}>
            {wps.length > 0 && (
              <>
                <polyline points={[`${ex.x},${Y(ex.y)}`, ...wps.map((w) => `${w.x},${Y(w.y)}`)].join(" ")}
                  fill="none" stroke={nav} strokeWidth={0.05} strokeDasharray="0.25 0.18" opacity={0.9} />
                {wps.map((w, i) => {
                  const last = i === wps.length - 1;
                  return (
                    <circle key={i} cx={w.x} cy={Y(w.y)} r={last ? 0.24 : 0.16} fill={last ? nav : "#0b0f18"} stroke={nav} strokeWidth={0.05} />
                  );
                })}
              </>
            )}
            {r.control_mode === "manual" && (
              <circle cx={ex.x} cy={Y(ex.y)} r={0.42} fill="none" stroke={amber} strokeWidth={0.04} strokeDasharray="0.12 0.1" />
            )}
            {r.drift_delta_m > 0.05 && (
              <>
                <line x1={ins.x} y1={Y(ins.y)} x2={ex.x} y2={Y(ex.y)} stroke="#4a5568" strokeWidth={0.03} strokeDasharray="0.12 0.12" opacity={0.85} />
                <circle cx={ins.x} cy={Y(ins.y)} r={0.16} fill="none" stroke="#828c9b" strokeWidth={0.045} opacity={0.85} />
              </>
            )}
            {selected && <circle cx={ex.x} cy={Y(ex.y)} r={0.46} fill="none" stroke={MC.azure} strokeWidth={0.07} />}
            <g style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onSelectRobot(r.id); }}>
              {r.state === "active" && <circle cx={ex.x} cy={Y(ex.y)} r={0.4} fill={fill} opacity={0.16}><animate attributeName="opacity" values="0.22;0.06;0.22" dur="2.4s" repeatCount="indefinite" /></circle>}
              <circle cx={ex.x} cy={Y(ex.y)} r={0.22} fill={fill} stroke="#0b0f18" strokeWidth={0.05} />
              <line x1={ex.x} y1={Y(ex.y)} x2={hx} y2={Y(hy)} stroke="#e6eaef" strokeWidth={0.05} />
              <text x={ex.x + 0.32} y={Y(ex.y) - 0.24} fill="#aab4c1" fontSize={0.36}>{r.id}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

const RAIL_ITEMS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { id: "map", label: "Spatial Map", icon: <Map size={18} /> },
  { id: "fleet", label: "Fleet", icon: <Bot size={18} /> },
  { id: "alerts", label: "Alerts", icon: <AlertTriangle size={18} /> },
  { id: "capabilities", label: "Capabilities", icon: <Cpu size={18} /> },
  { id: "partners", label: "OEM Partners", icon: <Users size={18} /> },
];

function NavRail({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <nav style={{
      position: "fixed", left: 0, top: 0, bottom: 0, width: 56, zIndex: 40,
      background: "#08090e", borderRight: `1px solid ${MC.line}`,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: MC.azure, color: "#04121a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, boxShadow: "0 0 14px rgba(0,165,218,0.4)", marginBottom: 10 }}>◎</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {RAIL_ITEMS.map((it) => {
          const on = active === it.id;
          return (
            <button key={it.id} title={it.label} aria-label={it.label} onClick={() => onSelect(it.id)}
              style={{
                width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 9, cursor: "pointer",
                color: on ? MC.azure : MC.inkDim,
                background: on ? "rgba(0,165,218,0.15)" : "transparent",
                border: `1px solid ${on ? "rgba(0,165,218,0.4)" : "transparent"}`,
                transition: "color .14s, background .14s, border-color .14s",
              }}>
              {it.icon}
            </button>
          );
        })}
      </div>
      <button title="Settings — coming soon" aria-label="Settings"
        style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, cursor: "pointer", color: MC.inkDim, background: "transparent", border: "1px solid transparent" }}>
        <Settings size={18} />
      </button>
    </nav>
  );
}

function Header({ facilityName, lastSync, onRefresh }: { facilityName: string | null; lastSync: Date | null; onRefresh: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: MC.azure, color: "#04121a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, boxShadow: "0 0 12px rgba(0,165,218,0.4)" }}>◎</span>
          <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.01em" }}>Orbital<span style={{ color: MC.azure, fontWeight: 300 }}> AI</span> — Fleet Control</h1>
        </div>
        <p style={{ margin: "6px 0 0", color: MC.inkDim, fontSize: ".82rem", fontFamily: MONO, letterSpacing: ".02em" }}>
          {facilityName ? `${facilityName} · ` : ""}FLEET·CTRL · ARIA·EDGE · live monitor & control
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
    <div style={{ background: MC.card, border: `1px solid ${MC.line}`, borderRadius: 10, padding: "12px 18px", minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: MC.inkDim, fontSize: ".72rem" }}>{icon}{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: 4, color: accent ?? MC.ink, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{value}</div>
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

function ScopeTag({ scope, ok }: { scope: string; ok: boolean }) {
  return (
    <span style={{
      fontSize: ".6rem", fontFamily: "monospace", padding: "2px 6px", borderRadius: 5,
      background: ok ? emeraldAlpha(0.12) : "rgba(255,255,255,0.05)",
      color: ok ? BRAND.emerald : "rgba(255,255,255,0.4)",
    }}>{ok ? "" : "🔒 "}{scope}</span>
  );
}
function SectionHead({ title, scope, ok }: { title: string; scope: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <span style={{ fontSize: ".64rem", textTransform: "uppercase", letterSpacing: ".5px", color: "rgba(255,255,255,0.45)" }}>{title}</span>
      <ScopeTag scope={scope} ok={ok} />
    </div>
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
      <span style={{ color: MC.ink, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{v}</span>
    </div>
  );
  const secs = (s?: number | null) => (s == null ? "—" : s >= 3600 ? `${(s / 3600).toFixed(1)}h` : `${Math.round(s)}s`);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: MC.card, border: `1px solid ${MC.lineStrong}`, borderRadius: 14, padding: 24, width: 460, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}>
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
      <div onClick={(e) => e.stopPropagation()} style={{ background: MC.card, border: `1px solid ${MC.lineStrong}`, borderRadius: 14, padding: 24, width: 480, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto" }}>
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

function ControlPanel({ robot, grants, busy, onSpeed, onDrive, onStopDrive, onClearRoute, onEstop, onResume, onDetails, onDeselect }: {
  robot: RobotSummary | null; grants: ControlGrants | null; busy?: boolean;
  onSpeed: (mps: number) => void; onDrive: (heading: number, mps: number) => void; onStopDrive: () => void;
  onClearRoute: () => void; onEstop: () => void; onResume: () => void; onDetails: () => void; onDeselect: () => void;
}) {
  const cardBg = MC.card;
  const border = `1px solid ${MC.line}`;
  const [speed, setSpeedLocal] = useState<number>(robot?.speed_mps ?? 0.6);
  if (!robot) {
    return (
      <div style={{ background: cardBg, border, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Gauge size={16} color={BRAND.emerald} />
          <h3 style={{ margin: 0, fontSize: ".95rem" }}>Robot Control</h3>
        </div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".8rem", lineHeight: 1.5 }}>
          Select a robot on the map or a fleet card to drive it — set speed, jog a direction, or click the floor to set a waypoint.
        </div>
      </div>
    );
  }
  const canVel = !grants || grants.velocity;
  const canEstop = !grants || grants.estop;
  const halted = robot.state === "halted";
  const routing = !!(robot.waypoints?.length);
  const mode = robot.control_mode ?? "patrol";
  return (
    <div style={{ background: cardBg, border, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Gauge size={16} color={BRAND.emerald} />
            <h3 style={{ margin: 0, fontSize: ".95rem" }}>{robot.vendor} {robot.model}</h3>
          </div>
          <div style={{ fontSize: ".7rem", color: MODE_COLOR[mode], marginTop: 3 }}>{robot.id} · {MODE_LABEL[mode]}</div>
        </div>
        <button onClick={onDeselect} style={{ fontSize: ".7rem", padding: "3px 9px", borderRadius: 7, border, background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>Deselect</button>
      </div>

      {!canVel && (
        <div style={{ marginTop: 12, fontSize: ".72rem", color: "#fca5a5", lineHeight: 1.4 }}>
          Drive controls need <code style={{ color: "#fca5a5" }}>control.velocity</code> — grant it to {robot.vendor} in OEM Partners.
        </div>
      )}

      <div style={{ marginTop: 14, opacity: canVel ? 1 : 0.5 }}>
        <SectionHead title="Drive" scope="control.velocity" ok={canVel} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".72rem", color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
          <span>Speed</span><span>{speed.toFixed(2)} m/s</span>
        </div>
        <input type="range" min={0.05} max={MAX_SPEED} step={0.05} value={speed} disabled={!canVel}
          onChange={(e) => setSpeedLocal(+e.target.value)}
          onMouseUp={() => onSpeed(speed)} onTouchEnd={() => onSpeed(speed)}
          style={{ width: "100%", accentColor: BRAND.emerald }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".62rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
          <span>0.05</span><span>{MAX_SPEED.toFixed(1)} m/s</span>
        </div>
      </div>

      <div style={{ marginTop: 14, opacity: canVel ? 1 : 0.5 }}>
        <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Manual jog — drive along a heading</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, maxWidth: 168, margin: "0 auto" }}>
          {DIRS.map(([glyph, heading], i) => heading === null ? (
            <button key={i} disabled={!canVel} onClick={onStopDrive} title="Stop jog"
              style={{ aspectRatio: "1", borderRadius: 8, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.12)", color: "#f87171", cursor: canVel ? "pointer" : "not-allowed", fontSize: 14 }}>{glyph}</button>
          ) : (
            <button key={i} disabled={!canVel} onClick={() => onDrive(heading, speed)} title={`${heading}°`}
              style={{ aspectRatio: "1", borderRadius: 8, border, background: "rgba(255,255,255,0.04)", color: BRAND.white, cursor: canVel ? "pointer" : "not-allowed", fontSize: 15 }}>{glyph}</button>
          ))}
        </div>
        <div style={{ fontSize: ".64rem", color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 6 }}>overrides patrol · clears waypoints until stopped</div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: border }}>
        <SectionHead title="Navigate — visual waypoints" scope="control.velocity" ok={canVel} />
        {routing ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ".76rem", color: BRAND.emerald }}>en route · {robot.waypoints!.length} pt{robot.waypoints!.length > 1 ? "s" : ""}</span>
            <button onClick={onClearRoute} style={{ fontSize: ".72rem", padding: "4px 10px", borderRadius: 7, border, background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>Clear route</button>
          </div>
        ) : (
          <div style={{ fontSize: ".74rem", color: "rgba(255,255,255,0.45)" }}>Click the map to set a waypoint. Shift-click to chain multiple.</div>
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: border }}>
        <SectionHead title="Safety" scope="control.estop" ok={canEstop} />
        <div style={{ display: "flex", gap: 8 }}>
          {!canEstop ? (
            <ControlBtn label={halted ? "Resume" : "E-Stop"} locked icon={<CircleStop size={13} />} color="rgba(255,255,255,0.4)" title="OEM has not granted control.estop" onClick={() => {}} />
          ) : halted ? (
            <ControlBtn label="Resume" icon={<Play size={13} />} color={BRAND.emerald} busy={busy} onClick={onResume} />
          ) : (
            <ControlBtn label="E-Stop" icon={<CircleStop size={13} />} color="#ef4444" busy={busy} onClick={onEstop} />
          )}
          <ControlBtn label="Details" icon={<Bot size={13} />} color="rgba(255,255,255,0.7)" onClick={onDetails} />
        </div>
      </div>
    </div>
  );
}

function CapabilitiesPanel({ robots, oems, vendorHasScope, cardBg, border }: {
  robots: RobotSummary[]; oems: OEMProfile[]; vendorHasScope: (vendor: string, scope: string) => boolean;
  cardBg: string; border: string;
}) {
  const activeOems = oems.filter((o) => o.status === "active");
  return (
    <div style={{ background: cardBg, border, borderRadius: 12, padding: 16, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <SlidersHorizontal size={16} color={BRAND.emerald} />
        <h3 style={{ margin: 0, fontSize: ".95rem" }}>Control Capabilities</h3>
        <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.4)" }}>
          the operator control surface — each capability is unlocked per-OEM via an API scope
        </span>
        <span style={{ marginLeft: "auto", fontSize: ".66rem", color: "rgba(255,255,255,0.4)" }}>
          <span style={{ color: BRAND.emerald }}>■</span> live · <span style={{ color: "#38bdf8" }}>■</span> monitor · <span style={{ color: "#555" }}>■</span> not unlocked
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, marginTop: 12 }}>
        {CAPABILITIES.map((cap) => {
          const partners = activeOems.filter((o) => o.granted_scopes.includes(cap.scope)).length;
          const controllable = robots.filter((r) => vendorHasScope(r.vendor, cap.scope)).length;
          const live = controllable > 0;
          const accent = cap.kind === "control" ? MC.green : MC.azure;
          const dim = live ? accent : "rgba(255,255,255,0.35)";
          return (
            <div key={cap.scope} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${live ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${dim}`, color: dim }}>{cap.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: ".82rem", fontWeight: 600 }}>{cap.label}</div>
                  <div style={{ fontSize: ".62rem", fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>{cap.scope}</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: ".58rem", textTransform: "uppercase", letterSpacing: ".5px", padding: "2px 6px", borderRadius: 5, background: emeraldAlpha(cap.kind === "control" ? 0.14 : 0.0), color: accent, border: cap.kind === "monitor" ? "1px solid rgba(56,189,248,0.25)" : "none" }}>{cap.kind}</span>
              </div>
              <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.6)", marginTop: 8, lineHeight: 1.4 }}>{cap.desc}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: ".66rem", fontFamily: "monospace", color: "rgba(255,255,255,0.45)" }}>
                <span>{partners} partner{partners === 1 ? "" : "s"}</span>
                <span style={{ color: live ? BRAND.emerald : undefined }}>{controllable} robot{controllable === 1 ? "" : "s"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogicPanel({ orchestrator, cardBg, border }: { orchestrator: OrchestratorStatus | null; cardBg: string; border: string }) {
  const decisions = orchestrator?.decisions ?? [];
  const auto = decisions.filter((d) => d.auto_executed).length;
  const orchLine = orchestrator
    ? `${orchestrator.enabled ? "on" : "off"} · ${decisions.length} decision${decisions.length === 1 ? "" : "s"} · ${auto} auto-executed`
    : "—";
  const cards: [string, React.ReactNode][] = [
    ["1 · Control hierarchy", <>Each tick resolves one command source per robot in priority order: <b style={{ color: BRAND.emerald }}>visual-nav waypoints</b> → <b style={{ color: "#f59e0b" }}>manual jog</b> → <span style={{ color: "rgba(255,255,255,0.6)" }}>autonomous patrol</span>. Setting one supersedes the others.</>],
    ["2 · Drift & ARIA correction", <>Overhead cameras give the <b style={{ color: BRAND.emerald }}>ground-truth pose</b>; the robot's onboard SLAM <span style={{ color: "rgba(255,255,255,0.6)" }}>self-report</span> accumulates drift. ARIA decays it toward zero each tick — the dashed link on the map is the live gap.</>],
    ["3 · Safety halt", <>When drift crosses the halt threshold, ARIA fires an <b style={{ color: "#ef4444" }}>auto E-Stop</b> + alert. Sim-triggered halts auto-recover; a manual E-Stop waits for an operator Resume.</>],
    ["4 · Orchestrator", <>A supervisory loop scans the fleet on a fixed cadence and takes safety-first actions — proactive charge dispatch on low battery, auto E-Stop on critical anomalies. <span style={{ color: "rgba(255,255,255,0.5)" }}>{orchLine}</span></>],
  ];
  return (
    <div style={{ background: cardBg, border, borderRadius: 12, padding: 16, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Cpu size={16} color={BRAND.emerald} />
        <h3 style={{ margin: 0, fontSize: ".95rem" }}>How the live simulation works</h3>
        <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.4)" }}>the logic driving this fleet</span>
        {orchestrator && <span style={{ marginLeft: "auto", fontSize: ".68rem", color: "rgba(255,255,255,0.5)" }}>orchestrator {orchLine}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {cards.map(([title, body]) => (
          <div key={title} style={{ background: "rgba(255,255,255,0.03)", border, borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: ".82rem", marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
