/** HEIR 2026 — Humanoid Engineering Intelligence Report (ReadyForRobots research). */

export const HEIR_REPORTS = [
  {
    title: "Full report",
    href: "/reports/HEIR_2026_Humanoid_Engineering_Intelligence_Report.pdf",
  },
  {
    title: "Executive summary",
    href: "/reports/HEIR_2026_Report_Final.pdf",
  },
] as const;

export const HEIR_PULL_QUOTES = [
  "Walking gets attention. Manipulation creates economic value.",
  "The next humanoid moat may be the dataset, not the chassis.",
  "Humanoid intelligence compounds only when the fleet learns from failure.",
] as const;

export type HeifRow = {
  company: string;
  mobility: number;
  manipulation: number;
  cognition: number;
  safety: number;
  dataPipeline: number;
  production: number;
};

export const HEIF_BENCHMARK: HeifRow[] = [
  { company: "Boston Dynamics", mobility: 4.0, manipulation: 2.5, cognition: 2.0, safety: 2.5, dataPipeline: 2.0, production: 2.0 },
  { company: "EngineAI", mobility: 3.5, manipulation: 1.5, cognition: 1.5, safety: 1.0, dataPipeline: 2.0, production: 2.0 },
  { company: "AgiBot", mobility: 3.0, manipulation: 3.5, cognition: 3.0, safety: 2.0, dataPipeline: 4.0, production: 3.0 },
  { company: "Tesla Optimus", mobility: 3.0, manipulation: 2.5, cognition: 3.0, safety: 2.0, dataPipeline: 3.5, production: 4.0 },
  { company: "Figure AI", mobility: 2.5, manipulation: 3.0, cognition: 3.5, safety: 2.0, dataPipeline: 3.5, production: 2.0 },
  { company: "Unitree", mobility: 3.5, manipulation: 2.0, cognition: 1.5, safety: 1.5, dataPipeline: 2.0, production: 3.5 },
  { company: "Agility Robotics", mobility: 2.5, manipulation: 2.5, cognition: 2.0, safety: 2.5, dataPipeline: 2.0, production: 3.0 },
];
