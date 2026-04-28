-- ============================================================
-- Protocolo Edu · Apple Health pillar
-- Campos para iOS Shortcut sync (peso, glucosa, presión, etc.)
-- Ejecuta en: Supabase SQL Editor → New query
-- ============================================================

ALTER TABLE daily_logs
  -- Antropometría
  ADD COLUMN IF NOT EXISTS weight_kg              numeric(5,2),
  ADD COLUMN IF NOT EXISTS body_fat_pct           numeric(4,1),
  ADD COLUMN IF NOT EXISTS lean_mass_kg           numeric(5,2),
  ADD COLUMN IF NOT EXISTS waist_cm               numeric(5,1),
  -- Metabólicas
  ADD COLUMN IF NOT EXISTS glucose_avg            numeric(5,1),  -- mg/dL
  ADD COLUMN IF NOT EXISTS glucose_min            numeric(5,1),
  ADD COLUMN IF NOT EXISTS glucose_max            numeric(5,1),
  ADD COLUMN IF NOT EXISTS glucose_time_in_range  integer,       -- 0-100% en 70-140 mg/dL
  -- Cardiovasculares
  ADD COLUMN IF NOT EXISTS bp_systolic            integer,       -- mmHg
  ADD COLUMN IF NOT EXISTS bp_diastolic           integer,       -- mmHg
  ADD COLUMN IF NOT EXISTS vo2_max                numeric(4,1),  -- mL/kg/min
  -- Actividad / mente
  ADD COLUMN IF NOT EXISTS active_kcal            integer,
  ADD COLUMN IF NOT EXISTS exercise_min           integer,       -- Apple "Exercise" ring
  ADD COLUMN IF NOT EXISTS stand_hours            integer,
  ADD COLUMN IF NOT EXISTS mindfulness_min        integer,
  ADD COLUMN IF NOT EXISTS flights_climbed        integer,
  ADD COLUMN IF NOT EXISTS distance_km            numeric(6,2);
