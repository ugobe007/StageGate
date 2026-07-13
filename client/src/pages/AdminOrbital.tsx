import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BatteryCharging, Bot, Check, CircleStop, Copy, Cpu, Crosshair, Gauge, Heart,
  KeyRound, LayoutDashboard, Loader2, Lock, Map, Navigation, Play, Plus, RefreshCw, Radio, Send,
  Settings, ShieldAlert, SlidersHorizontal, Thermometer, Trash2, Users, Video, X,
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
type ControlMode = "patrol" | "visual_nav" | "manual" | "charging" | "halted" | "idle" | "cooldown";
interface RobotSummary {
  id: string; vendor: string; model: string; industry: string;
  state: "active" | "idle" | "charging" | "cooldown" | "halted" | "offline";
  battery_pct: number; pose_external: Pose; pose_internal: Pose;
  drift_delta_m: number; current_task?: string | null; error_code?: string | null;
  handoff_partner?: string | null;
  visual_nav?: boolean; nav_goal?: Point | null; waypoints?: Point[];
  path?: Point[];  // camera-planned route (bends around racks)
  speed_mps?: number; manual_drive?: boolean; control_mode?: ControlMode;
  mission?: string | null;        // "Move tote: Aisle AB → Dock"
  mission_phase?: string | null;  // en_route_pickup | working | carrying | idle
}
interface WarehouseRack { id: string; x: number; y: number; w: number; h: number }
interface WarehouseStation { id: string; x: number; y: number; kind?: string }
interface WarehouseCamera { id: string; x: number; y: number; coverage_m?: number }
interface WarehouseMap {
  name: string; width_m: number; height_m: number;
  racks: WarehouseRack[];
  charge_stations: { id: string; x: number; y: number }[];
  stations?: WarehouseStation[];
  cameras?: WarehouseCamera[];
  dock?: { x: number; y: number; w: number; h: number };
}
interface FleetSequence {
  id: number; theme: string; label: string; objective: string;
  started_at: number; period_s: number; ends_in_s?: number;
  assignments?: { robot_id: string; goal: string | null; phase: string | null }[];
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
interface OEMPolicies {
  max_speed_mps: number; drift_halt_threshold_m: number;
  auto_estop_on_critical: boolean; require_approval_for_teleop: boolean; geofence: string;
}
interface OEMProfile {
  oem_id: string; company_name: string; vendor: string; transport: string;
  status: "pending" | "active" | "suspended";
  ceiling_scopes: string[]; granted_scopes: string[]; missing_scopes: string[];
  policies?: OEMPolicies;
  control_ready: boolean; monitor_ready: boolean;
}
interface OEMCatalog {
  vendors: { vendor: string; ceiling_scopes: string[] }[];
  transports: string[];
  scopes: { value: string; label: string }[];
  default_policies: OEMPolicies;
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
  sequence?: FleetSequence;
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
  cooldown: MC.crimson,
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
  charging: "Charging", halted: "Halted", idle: "Idle", cooldown: "Between tasks",
};
const MODE_COLOR: Record<ControlMode, string> = {
  patrol: "rgba(255,255,255,0.55)", visual_nav: MC.azure, manual: MC.amber,
  charging: MC.azure, halted: MC.crimson, idle: MC.amber, cooldown: MC.crimson,
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

// Fleet states, ordered for the overview distribution bar + interactive filter chips.
const STATUS_META: { key: RobotSummary["state"]; label: string; color: string }[] = [
  { key: "active", label: "Working", color: MC.green },
  { key: "cooldown", label: "Between tasks", color: MC.crimson },
  { key: "idle", label: "Idle", color: MC.amber },
  { key: "charging", label: "Charging", color: MC.azure },
  { key: "halted", label: "Halted", color: "#ff3b6b" },
  { key: "offline", label: "Offline", color: "#5b667a" },
];
const SCOPE_LABELS: Record<string, string> = {
  "telemetry.read": "Stream pose, battery, and health telemetry",
  "state.read": "Read task/state machine and mission status",
  "control.velocity": "Command velocity (visual-nav, jog, speed)",
  "control.estop": "Trigger and clear emergency stop",
  "control.teleop": "Full teleoperation hand-on control",
  "mission.dispatch": "Dispatch and cancel missions",
  "camera.read": "Read onboard camera frames",
  "map.read": "Read the robot's onboard map / SLAM graph",
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
  const [catalog, setCatalog] = useState<OEMCatalog | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RobotSummary["state"] | null>(null);
  const [map, setMap] = useState<WarehouseMap | null>(null);
  const [mapSel, setMapSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [lastSync, setLastSync] = useState<Date | null>(null);
  // Current mission sequence + the wall-clock time we received it, so the countdown ticks
  // smoothly between the 4s polls.
  const [seq, setSeq] = useState<{ data: FleetSequence; rcvd: number } | null>(null);
  const [nowSec, setNowSec] = useState(() => Date.now() / 1000);
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
      if (f.sequence) setSeq({ data: f.sequence, rcvd: Date.now() / 1000 });
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

  // Smooth per-second countdown for the mission-sequence banner.
  useEffect(() => {
    const t = setInterval(() => setNowSec(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!configured) return;
    orbitalFetch<WarehouseMap>("/map").then(setMap).catch(() => {});
    orbitalFetch<OEMCatalog>("/oem-catalog").then(setCatalog).catch(() => {});
  }, [configured]);

  const onboardOem = useCallback(async (body: Record<string, unknown>) => {
    const out = await orbitalFetch<{ profile: OEMProfile; credential: { api_key: string; key_prefix: string } }>(
      "/oems", { method: "POST", body: JSON.stringify(body) });
    await refresh();
    return out;
  }, [refresh]);

  const removeOem = useCallback(async (oem: OEMProfile) => {
    try { await orbitalFetch(`/oems/${encodeURIComponent(oem.oem_id)}`, { method: "DELETE" }); setManageOem(null); await refresh(); }
    catch (e) { setError((e as Error).message); }
  }, [refresh]);

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

  const robots = (fleet?.robots ?? [])
    .filter((r) => industry === "All" || r.industry === industry)
    .filter((r) => !statusFilter || r.state === statusFilter);
  const tabs = ["All", ...(fleet?.industries ?? [])];
  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const allRobots = fleet?.robots ?? [];
  const stateCounts = STATUS_META.reduce((acc, s) => {
    acc[s.key] = allRobots.filter((r) => r.state === s.key).length; return acc;
  }, {} as Record<string, number>);
  const metrics = {
    total: allRobots.length,
    navCount: allRobots.filter((r) => r.control_mode === "visual_nav").length,
    avgDrift: allRobots.length ? allRobots.reduce((s, r) => s + (r.drift_delta_m || 0), 0) / allRobots.length : 0,
    avgBatt: allRobots.length ? allRobots.reduce((s, r) => s + (r.battery_pct || 0), 0) / allRobots.length : 0,
    openAlerts: activeAlerts.length,
  };
  const toggleStatusFilter = (k: RobotSummary["state"]) => {
    setStatusFilter((cur) => (cur === k ? null : k));
    sectionRefs.current["fleet"]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ padding: "2rem", paddingLeft: "calc(2rem + 56px)", color: MC.ink, background: MC.bg, minHeight: "100vh", fontFamily: SG }}>
      <NavRail active={activeSec} onSelect={scrollToSec} />
      <Header facilityName={fleet?.facility?.name ?? null} lastSync={lastSync} onRefresh={refresh} onOnboard={() => setWizardOpen(true)} />

      <Ticker metrics={metrics} stateCounts={stateCounts} facility={fleet?.facility?.name ?? null}
        oems={oems} live={!error} />

      {error && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#fca5a5", fontSize: ".85rem" }}>
          {error}
        </div>
      )}

      {/* Live overview — headline metrics + interactive status distribution */}
      <div ref={reg("overview")} data-sec="overview" style={{ scrollMarginTop: 80, marginTop: 18 }}>
        <Overview metrics={metrics} stateCounts={stateCounts} statusFilter={statusFilter}
          onToggle={toggleStatusFilter} cardBg={cardBg} border={border} />
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
          <SequenceBar seq={seq?.data ?? null} robots={fleet?.robots ?? []}
            secondsLeft={seq ? Math.max(0, Math.round((seq.data.ends_in_s ?? 0) - (nowSec - seq.rcvd))) : 0}
            border={border} />
          <WarehouseMapView map={map} robots={fleet?.robots ?? []} selectedId={mapSel}
            onSelectRobot={setMapSel} onFloorClick={handleFloorClick} />
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: ".68rem", color: "rgba(255,255,255,0.5)" }}>
            <Legend color={BRAND.emerald} label="robot (camera-tracked)" />
            <Legend color="#7c5cff" label="overhead camera" square />
            <Legend color="#3dbfe2" label="named station (pick / drop)" square />
            <Legend color={BRAND.emerald} label="visual-nav path → waypoint" bar />
            <Legend color="rgba(255,255,255,0.5)" label="SLAM self-report (drift)" ring />
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
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setIndustry(t)} style={{
                padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: ".8rem",
                border: industry === t ? `1px solid ${BRAND.emerald}` : border,
                background: industry === t ? emeraldAlpha(0.14) : "transparent",
                color: industry === t ? BRAND.emerald : "rgba(255,255,255,0.7)",
              }}>{t}</button>
            ))}
            {statusFilter && (() => {
              const s = STATUS_META.find((x) => x.key === statusFilter);
              return (
                <button onClick={() => setStatusFilter(null)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontSize: ".76rem", border, background: MC.input, color: MC.inkMut }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: s?.color, boxShadow: `0 0 6px ${s?.color}` }} />
                  {s?.label} <span style={{ color: MC.inkDim }}>✕ clear</span>
                </button>
              );
            })()}
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
                {r.mission && (
                  <div style={{ marginTop: 6, fontSize: ".68rem", color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.mission}>
                    <span style={{ color: PHASE_COLOR[r.mission_phase ?? "idle"] ?? "rgba(255,255,255,0.35)" }}>●</span> {r.mission}
                    {r.current_task ? <span style={{ color: "rgba(255,255,255,0.4)" }}> · {r.current_task}</span> : null}
                  </div>
                )}

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
          <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.4)" }}>
            control Orbital exercises is bounded by what each OEM unlocks
          </span>
          <button onClick={() => setWizardOpen(true)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: ".76rem", fontWeight: 600, background: "#0e2230", border: "1px solid rgba(0,165,218,0.5)", color: "#7fd6f2" }}>
            <Plus size={13} /> Onboard robot API
          </button>
        </div>
        {oems.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: ".82rem", marginTop: 10 }}>
            No OEM partners registered yet. Use <button onClick={() => setWizardOpen(true)} style={{ color: MC.azure, background: "transparent", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Onboard robot API</button> to register one.
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
          onSave={(want) => saveOemScopes(manageOem, want)} onToggleStatus={() => toggleOemStatus(manageOem)}
          onRemove={() => removeOem(manageOem)} />
      )}
      {wizardOpen && catalog && (
        <OnboardWizard catalog={catalog} onClose={() => setWizardOpen(false)} onCreate={onboardOem} />
      )}
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  en_route_pickup: "→ pickup", working: "working", carrying: "carrying", idle: "idle",
};
const PHASE_COLOR: Record<string, string> = {
  en_route_pickup: "#00a5da", working: "#f59e0b", carrying: MC.green, idle: "rgba(255,255,255,0.35)",
};

function SequenceBar({ seq, robots, secondsLeft, border }: {
  seq: FleetSequence | null; robots: RobotSummary[]; secondsLeft: number; border: string;
}) {
  const goals = robots.filter((r) => r.mission).slice(0, 9);
  return (
    <div style={{ border, borderRadius: 10, padding: "10px 12px", marginBottom: 12, background: "#12101f" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: ".62rem", fontFamily: MONO, letterSpacing: ".06em", padding: "2px 8px", borderRadius: 5, background: "#1b1533", color: "#b7a6ff", border: "1px solid #7c5cff" }}>
          SEQUENCE {seq?.id ?? ""}
        </span>
        <span style={{ fontSize: ".9rem", fontWeight: 600 }}>{seq?.label ?? "Warming up"}</span>
        <span style={{ fontSize: ".76rem", color: "rgba(255,255,255,0.55)" }}>{seq?.objective ?? "Bringing the fleet online…"}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: ".7rem", fontFamily: MONO, color: "rgba(255,255,255,0.5)" }}>
          new sequence in <span style={{ color: "#b7a6ff" }}>{secondsLeft}s</span>
        </span>
      </div>
      {goals.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {goals.map((r) => {
            const ph = r.mission_phase ?? "idle";
            return (
              <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: ".64rem", padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border }}>
                <span style={{ fontFamily: MONO, color: "rgba(255,255,255,0.55)" }}>{r.id}</span>
                <span style={{ color: "rgba(255,255,255,0.75)" }}>{r.mission}</span>
                <span style={{ fontFamily: MONO, fontSize: ".58rem", color: PHASE_COLOR[ph] ?? "rgba(255,255,255,0.35)" }}>{PHASE_LABEL[ph] ?? ph}</span>
              </span>
            );
          })}
        </div>
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
      {/* Named work stations — the pick/drop points missions reference by name. */}
      {(map.stations ?? []).map((s) => (
        <g key={`st-${s.id}`}>
          <rect x={s.x - 0.34} y={Y(s.y) - 0.34} width={0.68} height={0.68} rx={0.1} fill="#0b2e3a" stroke="#2f6d82" strokeWidth={0.035} />
          <text x={s.x} y={Y(s.y) + 0.5} fill="#5f7486" fontSize={0.3} textAnchor="middle">{s.id}</text>
        </g>
      ))}
      {/* Overhead camera rig — ground-truth localization; violet camera glyph + coverage halo. */}
      {(map.cameras ?? []).map((cam) => {
        const cov = cam.coverage_m ?? 4.0;
        return (
          <g key={`cam-${cam.id}`}>
            <circle cx={cam.x} cy={Y(cam.y)} r={cov} fill="#7c5cff" opacity={0.05} />
            <circle cx={cam.x} cy={Y(cam.y)} r={cov} fill="none" stroke="#7c5cff" strokeWidth={0.02} strokeDasharray="0.2 0.22" opacity={0.35} />
            <g transform={`translate(${cam.x},${Y(cam.y)})`}>
              <rect x={-0.26} y={-0.19} width={0.52} height={0.38} rx={0.08} fill="#1b1533" stroke="#7c5cff" strokeWidth={0.045} />
              <circle cx={0} cy={0} r={0.11} fill="none" stroke="#b7a6ff" strokeWidth={0.05} />
              <rect x={0.2} y={-0.1} width={0.14} height={0.2} rx={0.04} fill="#7c5cff" />
            </g>
          </g>
        );
      })}
      {robots.map((r) => {
        const ex = r.pose_external, ins = r.pose_internal;
        const selected = r.id === selectedId;
        const fill = STATE_COLOR[r.state];
        const hx = ex.x + Math.cos(ex.theta) * 0.4, hy = ex.y + Math.sin(ex.theta) * 0.4;
        const wps = r.waypoints ?? [];
        const partner = r.handoff_partner ? robots.find((x) => x.id === r.handoff_partner) : null;
        return (
          <g key={r.id}>
            {partner && (
              <>
                <line x1={ex.x} y1={Y(ex.y)} x2={partner.pose_external.x} y2={Y(partner.pose_external.y)}
                  stroke={amber} strokeWidth={0.05} strokeDasharray="0.2 0.16" opacity={0.85} />
                <circle cx={partner.pose_external.x} cy={Y(partner.pose_external.y)} r={0.16} fill={amber} opacity={0.9} />
              </>
            )}
            {wps.length > 0 && (
              <>
                <polyline points={[`${ex.x},${Y(ex.y)}`, ...((r.path && r.path.length ? r.path : wps)).map((w) => `${w.x},${Y(w.y)}`)].join(" ")}
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
      <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", background: "#0c1119", border: "1px solid rgba(0,165,218,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(0,165,218,0.25)", marginBottom: 10 }}>
        <img src="/orbital-logo.png" alt="Orbital AI" style={{ width: 30, height: 30, objectFit: "contain" }} />
      </div>
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

function Header({ facilityName, lastSync, onRefresh, onOnboard }: { facilityName: string | null; lastSync: Date | null; onRefresh: () => void; onOnboard?: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", background: "#0c1119", border: "1px solid rgba(0,165,218,0.5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(0,165,218,0.3)" }}>
            <img src="/orbital-logo.png" alt="Orbital AI" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </span>
          <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.01em" }}>Orbital<span style={{ color: MC.azure, fontWeight: 300 }}> AI</span> — Fleet Control</h1>
        </div>
        <p style={{ margin: "6px 0 0", color: MC.inkDim, fontSize: ".82rem", fontFamily: MONO, letterSpacing: ".02em" }}>
          {facilityName ? `${facilityName} · ` : ""}FLEET·CTRL · ARIA·EDGE · live monitor & control
          {lastSync ? ` · synced ${lastSync.toLocaleTimeString()}` : ""}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {onOnboard && (
          <button onClick={onOnboard} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,165,218,0.5)", background: "#0e2230", color: "#7fd6f2", cursor: "pointer", fontSize: ".82rem", fontWeight: 600, boxShadow: "0 0 12px rgba(0,165,218,0.25)" }}>
            <Plus size={14} /> Onboard robot API
          </button>
        )}
        <button onClick={onRefresh} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: ".82rem" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
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

function OEMModal({ oem, onClose, onSave, onToggleStatus, onRemove }: {
  oem: OEMProfile; onClose: () => void; onSave: (want: Set<string>) => void; onToggleStatus: () => void; onRemove: () => void;
}) {
  const ceiling = new Set(oem.ceiling_scopes);
  const [want, setWant] = useState<Set<string>>(new Set(oem.granted_scopes));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const suspended = oem.status === "suspended";
  const p = oem.policies;
  const toggle = (s: string) => setWant((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const policyChip = (label: string, on = true) => (
    <span style={{ fontSize: ".68rem", fontFamily: MONO, padding: "2px 7px", borderRadius: 5, background: MC.input, color: on ? MC.inkMut : MC.inkDim }}>{label}</span>
  );
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
        {p && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${MC.line}` }}>
            <div style={{ fontSize: ".64rem", textTransform: "uppercase", letterSpacing: ".5px", color: MC.inkDim, marginBottom: 8 }}>Governance policies</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {policyChip(`max ${p.max_speed_mps.toFixed(2)} m/s`)}
              {policyChip(`drift halt ${p.drift_halt_threshold_m.toFixed(2)} m`)}
              {policyChip(`auto-estop ${p.auto_estop_on_critical ? "on" : "off"}`, p.auto_estop_on_critical)}
              {policyChip(`teleop approval ${p.require_approval_for_teleop ? "on" : "off"}`, p.require_approval_for_teleop)}
              {policyChip(`zone: ${p.geofence}`)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onToggleStatus} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: suspended ? BRAND.emerald : "#fca5a5", cursor: "pointer", fontSize: ".78rem" }}>
              {suspended ? "Reactivate access" : "Suspend access"}
            </button>
            <button onClick={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: confirmRemove ? "#fca5a5" : "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: ".78rem" }}>
              <Trash2 size={13} /> {confirmRemove ? "Click to confirm" : "Remove"}
            </button>
          </div>
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

      {(() => {
        const missionText = robot.mission
          ?? (robot.state === "charging" ? "Charging at the dock"
            : robot.state === "halted" ? "Safety stop engaged — awaiting resume"
            : robot.state === "idle" ? "Idle — will join the next sequence"
            : "Autonomous patrol");
        const activity = robot.current_task ?? PHASE_LABEL[robot.mission_phase ?? "idle"] ?? MODE_LABEL[mode];
        return (
          <div style={{ marginTop: 12, borderRadius: 10, border: "1px solid #2a2440", padding: 10, background: "#12101f" }}>
            <div style={{ fontSize: ".56rem", textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,0.4)" }}>What it's doing now</div>
            <div style={{ fontSize: ".8rem", fontWeight: 500, marginTop: 3, lineHeight: 1.3 }}>{missionText}</div>
            {activity && (
              <div style={{ fontSize: ".68rem", marginTop: 3, color: "rgba(255,255,255,0.6)" }}>
                <span style={{ color: PHASE_COLOR[robot.mission_phase ?? "idle"] ?? "rgba(255,255,255,0.35)" }}>●</span> {activity}
              </div>
            )}
          </div>
        );
      })()}

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

function battColor(pct: number): string {
  return pct < 25 ? MC.crimson : pct < 50 ? MC.amber : MC.green;
}

// Scrolling live-monitoring ticker — mirrors the standalone "Mission Control" strip.
function Ticker({ metrics, stateCounts, facility, oems, live }: {
  metrics: { total: number; navCount: number; avgDrift: number; avgBatt: number; openAlerts: number };
  stateCounts: Record<string, number>; facility: string | null; oems: OEMProfile[]; live: boolean;
}) {
  const activeOems = oems.filter((o) => o.status === "active").length;
  const items: { dot: string; label: string; val: React.ReactNode }[] = [
    { dot: live ? MC.green : MC.crimson, label: "Link", val: live ? "LIVE" : "RECONNECTING" },
    { dot: MC.azure, label: "Monitoring", val: `${metrics.total} robots` },
    { dot: MC.green, label: "Working", val: stateCounts.active ?? 0 },
    { dot: MC.crimson, label: "Between tasks", val: stateCounts.cooldown ?? 0 },
    { dot: MC.azureLight, label: "Visual-nav", val: metrics.navCount },
    { dot: MC.amber, label: "Idle", val: stateCounts.idle ?? 0 },
    { dot: "#ff3b6b", label: "Halted", val: stateCounts.halted ?? 0 },
    { dot: MC.amber, label: "Open alerts", val: metrics.openAlerts },
    { dot: MC.azure, label: "Avg drift Δ", val: `${metrics.avgDrift.toFixed(3)} m` },
    { dot: battColor(metrics.avgBatt), label: "Fleet battery", val: `${Math.round(metrics.avgBatt)}%` },
    { dot: "#7fd6f2", label: "OEM partners", val: `${activeOems}/${oems.length}` },
    { dot: MC.inkDim, label: "Facility", val: facility || "—" },
  ];
  const strip = (prefix: string) => items.map((it, i) => (
    <span key={`${prefix}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "0 20px", borderRight: `1px solid ${MC.line}`, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: it.dot, boxShadow: `0 0 7px ${it.dot}` }} />
      <span style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".06em", color: MC.inkDim }}>{it.label}</span>
      <span style={{ fontSize: ".76rem", fontFamily: MONO, color: MC.ink, fontVariantNumeric: "tabular-nums" }}>{it.val}</span>
    </span>
  ));
  return (
    <div style={{ marginTop: 14, background: MC.panel, border: `1px solid ${MC.line}`, borderRadius: 10, overflow: "hidden", position: "relative", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)", maskImage: "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)" }}>
      <style>{`@keyframes orbital-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}} .orbital-ticker-track{animation:orbital-ticker 46s linear infinite} .orbital-ticker-track:hover{animation-play-state:paused}`}</style>
      <div className="orbital-ticker-track" style={{ display: "inline-flex", alignItems: "center", padding: "9px 0" }}>
        {strip("a")}{strip("b")}
      </div>
    </div>
  );
}

// Live fleet overview — headline metrics + an interactive status distribution bar whose
// segments/chips filter the fleet grid below.
function Overview({ metrics, stateCounts, statusFilter, onToggle, cardBg, border }: {
  metrics: { total: number; navCount: number; avgDrift: number; avgBatt: number; openAlerts: number };
  stateCounts: Record<string, number>; statusFilter: RobotSummary["state"] | null;
  onToggle: (k: RobotSummary["state"]) => void; cardBg: string; border: string;
}) {
  const total = Math.max(1, metrics.total);
  const tiles: { label: string; value: React.ReactNode; color: string }[] = [
    { label: "Fleet", value: metrics.total, color: MC.ink },
    { label: "Avg drift Δ", value: `${metrics.avgDrift.toFixed(3)} m`, color: driftColor(metrics.avgDrift) },
    { label: "Fleet battery", value: `${Math.round(metrics.avgBatt)}%`, color: battColor(metrics.avgBatt) },
    { label: "Open alerts", value: metrics.openAlerts, color: metrics.openAlerts ? MC.amber : MC.ink },
  ];
  const present = STATUS_META.filter((s) => (stateCounts[s.key] ?? 0) > 0);
  return (
    <div style={{ background: cardBg, border, borderRadius: 12, padding: 14, display: "grid", gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)", gap: 14, alignItems: "stretch" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ background: MC.panel, border, borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ fontSize: ".64rem", textTransform: "uppercase", letterSpacing: ".06em", color: MC.inkDim }}>{t.label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: 3, color: t.color, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{t.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: MC.panel, border, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Activity size={14} color={MC.azure} />
          <span style={{ fontSize: ".64rem", textTransform: "uppercase", letterSpacing: ".06em", color: MC.inkDim }}>Fleet status</span>
          <span style={{ marginLeft: "auto", fontSize: ".64rem", color: MC.inkDim }}>{statusFilter ? "filtering — click again to clear" : "click a state to filter"}</span>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: MC.input, marginBottom: 10 }}>
          {present.map((s) => (
            <div key={s.key} onClick={() => onToggle(s.key)} title={`${s.label}: ${stateCounts[s.key]}`}
              style={{ width: `${((stateCounts[s.key] ?? 0) / total) * 100}%`, background: s.color, cursor: "pointer", opacity: statusFilter && statusFilter !== s.key ? 0.3 : 1, transition: "opacity .15s" }} />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {STATUS_META.map((s) => {
            const n = stateCounts[s.key] ?? 0;
            const on = statusFilter === s.key;
            return (
              <button key={s.key} onClick={() => onToggle(s.key)} disabled={n === 0}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 9px", borderRadius: 999, cursor: n ? "pointer" : "default",
                  border: `1px solid ${on ? s.color : MC.line}`, background: on ? `${s.color}22` : "transparent",
                  color: n ? MC.inkMut : MC.inkDim, fontSize: ".72rem", opacity: n ? 1 : 0.45 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />
                {s.label} <span style={{ fontFamily: MONO, color: MC.ink }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// OEM onboarding wizard — register a partner, grant scopes (bounded by protocol ceiling),
// and set governance policies; returns a one-time API credential. Mirrors the standalone flow.
function OnboardWizard({ catalog, onClose, onCreate }: {
  catalog: OEMCatalog; onClose: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<{ profile: OEMProfile; credential: { api_key: string; key_prefix: string } }>;
}) {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState("");
  const [vendor, setVendor] = useState("");
  const [customVendor, setCustomVendor] = useState("");
  const [transport, setTransport] = useState(catalog.transports[0] ?? "ros2");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set(["telemetry.read", "state.read"]));
  const [policies, setPolicies] = useState<OEMPolicies>({ ...catalog.default_policies });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ profile: OEMProfile; credential: { api_key: string; key_prefix: string } } | null>(null);
  const [copied, setCopied] = useState(false);

  const vendorName = vendor === "__other__" ? customVendor.trim() : vendor;
  const allScopeValues = catalog.scopes.map((s) => s.value);
  const ceiling = new Set<string>(
    vendor && vendor !== "__other__"
      ? (catalog.vendors.find((v) => v.vendor === vendor)?.ceiling_scopes ?? allScopeValues)
      : allScopeValues,
  );
  const step1Valid = !!company.trim() && !!vendorName && /.+@.+\..+/.test(email.trim());
  const inp: React.CSSProperties = { width: "100%", background: MC.input, border: `1px solid ${MC.line}`, borderRadius: 8, padding: "9px 11px", color: MC.ink, fontSize: ".84rem", fontFamily: SG };
  const lbl: React.CSSProperties = { fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".06em", color: MC.inkDim, marginBottom: 5, display: "block" };

  // Drop scopes that fall outside the chosen vendor's ceiling when the vendor changes.
  useEffect(() => { setScopes((prev) => new Set(Array.from(prev).filter((s) => ceiling.has(s)))); /* eslint-disable-next-line */ }, [vendor]);

  const toggleScope = (s: string) => setScopes((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const submit = async () => {
    setCreating(true); setErr(null);
    try {
      const out = await onCreate({
        company_name: company.trim(), vendor: vendorName, contact_email: email.trim(),
        transport, website: website.trim() || null, scopes: Array.from(scopes), policies,
      });
      setResult(out);
    } catch (e) { setErr((e as Error).message); } finally { setCreating(false); }
  };

  const copyKey = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result.credential.api_key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  const Switch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{ width: 38, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: on ? MC.green : MC.input, position: "relative", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: "#fff", transition: "left .15s" }} />
    </button>
  );

  const steps = ["Partner", "Scopes", "Policies", "Review"];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: MC.card, border: `1px solid ${MC.lineStrong}`, borderRadius: 16, padding: 24, width: 620, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <KeyRound size={18} color={MC.azure} />
              <h2 style={{ margin: 0, fontSize: "1.15rem", color: BRAND.white }}>{result ? "Partner onboarded" : "Onboard a robot API"}</h2>
            </div>
            <div style={{ fontSize: ".74rem", color: MC.inkDim, marginTop: 3 }}>
              {result ? "Share the API key securely — it is shown only once." : "Register an OEM, grant API scopes, and set governance policies."}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: MC.inkDim, cursor: "pointer" }}><X size={18} /></button>
        </div>

        {!result && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "16px 0 18px" }}>
            {steps.map((s, i) => {
              const n = i + 1; const done = n < step; const on = n === step;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, flex: i < steps.length - 1 ? 1 : "0 0 auto" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", fontWeight: 700, background: on ? MC.azure : done ? emeraldAlpha(0.2) : MC.input, color: on ? "#04121a" : done ? MC.green : MC.inkDim, border: `1px solid ${on ? MC.azure : done ? MC.green : MC.line}` }}>{done ? "✓" : n}</span>
                    <span style={{ fontSize: ".72rem", color: on ? MC.ink : MC.inkDim }}>{s}</span>
                  </span>
                  {i < steps.length - 1 && <span style={{ flex: 1, height: 1, background: MC.line }} />}
                </div>
              );
            })}
          </div>
        )}

        {err && <div style={{ padding: "9px 12px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, color: "#fca5a5", fontSize: ".8rem", marginBottom: 14 }}>{err}</div>}

        {result ? (
          <div style={{ marginTop: 4 }}>
            <div style={{ background: MC.panel, border: `1px solid ${MC.line}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".8rem", color: MC.inkMut }}>
                <span>{result.profile.company_name}</span>
                <span style={{ fontFamily: MONO, color: MC.inkDim }}>{result.profile.oem_id}</span>
              </div>
              <div style={{ ...lbl, marginTop: 14 }}>API key (shown once)</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <code style={{ flex: 1, background: MC.input, border: `1px solid ${MC.line}`, borderRadius: 8, padding: "9px 11px", color: MC.green, fontFamily: MONO, fontSize: ".8rem", wordBreak: "break-all" }}>{result.credential.api_key}</code>
                <button onClick={copyKey} style={{ display: "flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 8, border: `1px solid ${MC.line}`, background: MC.input, color: MC.inkMut, cursor: "pointer", fontSize: ".76rem" }}>
                  {copied ? <Check size={13} color={MC.green} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div style={{ fontSize: ".72rem", color: MC.inkDim, marginTop: 8 }}>Granted {result.profile.granted_scopes.length} scope(s). Manage anytime from OEM Partners.</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: MC.azure, color: "#04121a", cursor: "pointer", fontSize: ".82rem", fontWeight: 700 }}>Done</button>
            </div>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div style={{ display: "grid", gap: 14 }}>
                <div><label style={lbl}>Company name</label><input style={inp} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Robotics" /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Vendor / protocol</label>
                    <select style={inp} value={vendor} onChange={(e) => setVendor(e.target.value)}>
                      <option value="">Select…</option>
                      {catalog.vendors.map((v) => <option key={v.vendor} value={v.vendor}>{v.vendor}</option>)}
                      <option value="__other__">Other…</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Transport</label>
                    <select style={inp} value={transport} onChange={(e) => setTransport(e.target.value)}>
                      {catalog.transports.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                {vendor === "__other__" && (
                  <div><label style={lbl}>Vendor name</label><input style={inp} value={customVendor} onChange={(e) => setCustomVendor(e.target.value)} placeholder="New robot OEM" /></div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div><label style={lbl}>Contact email</label><input style={inp} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ops@acme.dev" /></div>
                  <div><label style={lbl}>Website (optional)</label><input style={inp} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="acme.dev" /></div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <div style={{ fontSize: ".78rem", color: MC.inkMut, marginBottom: 12 }}>Grant the API scopes this partner unlocks. Scopes outside <b>{vendorName || "the"}</b>'s protocol ceiling are locked.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {catalog.scopes.map((s) => {
                    const locked = !ceiling.has(s.value);
                    const on = scopes.has(s.value);
                    return (
                      <button key={s.value} disabled={locked} onClick={() => toggleScope(s.value)}
                        style={{ textAlign: "left", padding: "9px 11px", borderRadius: 9, cursor: locked ? "not-allowed" : "pointer",
                          border: `1px solid ${on ? MC.azure : MC.line}`, background: on ? "rgba(0,165,218,0.12)" : MC.panel, opacity: locked ? 0.4 : 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {locked && <Lock size={11} color={MC.inkDim} />}
                          <span style={{ fontFamily: MONO, fontSize: ".74rem", color: on ? MC.azureLight : MC.ink }}>{s.value}</span>
                        </div>
                        <div style={{ fontSize: ".68rem", color: MC.inkDim, marginTop: 3 }}>{SCOPE_LABELS[s.value] ?? s.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={lbl}>Max speed — {policies.max_speed_mps.toFixed(2)} m/s</label>
                    <input type="range" min={0.1} max={MAX_SPEED} step={0.05} value={policies.max_speed_mps}
                      onChange={(e) => setPolicies((p) => ({ ...p, max_speed_mps: +e.target.value }))} style={{ width: "100%", accentColor: MC.azure }} />
                  </div>
                  <div>
                    <label style={lbl}>Drift halt threshold — {policies.drift_halt_threshold_m.toFixed(2)} m</label>
                    <input type="range" min={0.1} max={1.5} step={0.05} value={policies.drift_halt_threshold_m}
                      onChange={(e) => setPolicies((p) => ({ ...p, drift_halt_threshold_m: +e.target.value }))} style={{ width: "100%", accentColor: MC.azure }} />
                  </div>
                </div>
                <div><label style={lbl}>Geofence zone</label><input style={inp} value={policies.geofence} onChange={(e) => setPolicies((p) => ({ ...p, geofence: e.target.value }))} placeholder="facility-wide" /></div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${MC.line}` }}>
                  <span style={{ fontSize: ".82rem", color: MC.ink }}>Auto E-Stop on critical anomaly</span>
                  <Switch on={policies.auto_estop_on_critical} onClick={() => setPolicies((p) => ({ ...p, auto_estop_on_critical: !p.auto_estop_on_critical }))} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${MC.line}` }}>
                  <span style={{ fontSize: ".82rem", color: MC.ink }}>Require operator approval for teleop</span>
                  <Switch on={policies.require_approval_for_teleop} onClick={() => setPolicies((p) => ({ ...p, require_approval_for_teleop: !p.require_approval_for_teleop }))} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div style={{ display: "grid", gap: 10, fontSize: ".82rem" }}>
                {[["Company", company], ["Vendor", vendorName], ["Transport", transport], ["Contact", email],
                  ["Scopes", Array.from(scopes).join(", ") || "none"], ["Max speed", `${policies.max_speed_mps.toFixed(2)} m/s`],
                  ["Drift halt", `${policies.drift_halt_threshold_m.toFixed(2)} m`], ["Geofence", policies.geofence],
                  ["Auto E-Stop", policies.auto_estop_on_critical ? "on" : "off"], ["Teleop approval", policies.require_approval_for_teleop ? "required" : "off"],
                ].map(([k, v]) => (
                  <div key={k as string} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${MC.line}` }}>
                    <span style={{ color: MC.inkDim }}>{k}</span>
                    <span style={{ color: MC.ink, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
              <button onClick={() => (step === 1 ? onClose() : setStep(step - 1))} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${MC.line}`, background: "transparent", color: MC.inkMut, cursor: "pointer", fontSize: ".82rem" }}>
                {step === 1 ? "Cancel" : "Back"}
              </button>
              {step < 4 ? (
                <button disabled={step === 1 && !step1Valid} onClick={() => setStep(step + 1)}
                  style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: step === 1 && !step1Valid ? MC.input : MC.azure, color: step === 1 && !step1Valid ? MC.inkDim : "#04121a", cursor: step === 1 && !step1Valid ? "not-allowed" : "pointer", fontSize: ".82rem", fontWeight: 700 }}>
                  Continue
                </button>
              ) : (
                <button disabled={creating} onClick={submit} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, border: "none", background: MC.green, color: "#04121a", cursor: creating ? "wait" : "pointer", fontSize: ".82rem", fontWeight: 700 }}>
                  {creating && <Loader2 size={14} className="animate-spin" />} Create partner
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
