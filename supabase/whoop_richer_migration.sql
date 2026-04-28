-- ============================================================
-- Protocolo Edu · Tier 1 + Tier 2 de Whoop
-- Sleep stages, eficiencia, respiratoria, skin temp, SpO2, calorías
-- Ejecuta en: Supabase SQL Editor → New query
-- ============================================================

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS sleep_total_min        integer,  -- minutos dormidos (sin despertares)
  ADD COLUMN IF NOT EXISTS sleep_in_bed_min       integer,  -- minutos totales en cama
  ADD COLUMN IF NOT EXISTS sleep_light_min        integer,
  ADD COLUMN IF NOT EXISTS sleep_deep_min         integer,
  ADD COLUMN IF NOT EXISTS sleep_rem_min          integer,
  ADD COLUMN IF NOT EXISTS sleep_awake_min        integer,
  ADD COLUMN IF NOT EXISTS sleep_efficiency       integer,  -- 0-100
  ADD COLUMN IF NOT EXISTS sleep_consistency      integer,  -- 0-100
  ADD COLUMN IF NOT EXISTS sleep_need_min         integer,
  ADD COLUMN IF NOT EXISTS sleep_disturbances     integer,
  ADD COLUMN IF NOT EXISTS respiratory_rate       numeric(4,1),
  ADD COLUMN IF NOT EXISTS skin_temp_celsius      numeric(4,2),
  ADD COLUMN IF NOT EXISTS spo2                   numeric(4,1),
  ADD COLUMN IF NOT EXISTS kilojoules             integer,  -- ÷ 4.184 = kcal
  ADD COLUMN IF NOT EXISTS avg_hr                 integer,
  ADD COLUMN IF NOT EXISTS max_hr                 integer;
