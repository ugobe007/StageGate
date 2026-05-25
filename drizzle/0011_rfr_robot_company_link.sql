-- Link StageGate prospects to ReadyForRobots robot_companies (canonical OEM pipeline)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS "rfrRobotCompanyId" integer;
CREATE UNIQUE INDEX IF NOT EXISTS prospects_rfr_robot_company_id_key ON prospects ("rfrRobotCompanyId");
