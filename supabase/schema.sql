-- ============================================================
-- Protocolo Edu · Supabase Schema
-- Ejecuta esto en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tabla: ayunos
CREATE TABLE IF NOT EXISTS fasts (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users NOT NULL,
  started_at    timestamptz NOT NULL,
  ended_at      timestamptz,
  goal_reached  boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- Tabla: registros diarios (arcoíris + WHOOP + nota + energía)
CREATE TABLE IF NOT EXISTS daily_logs (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid REFERENCES auth.users NOT NULL,
  date                date NOT NULL,
  -- Arcoíris: array de IDs de colores comidos
  colors              text[] DEFAULT '{}',
  -- WHOOP (entrada manual)
  hrv                 integer,              -- milisegundos
  recovery_score      integer,              -- 0-100
  sleep_performance   integer,              -- 0-100
  strain              numeric(4,1),         -- 0-21
  -- Subjetivo
  energy              integer,              -- 1-5
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  -- Solo un registro por usuario por día
  UNIQUE(user_id, date)
);

-- Trigger: actualiza updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security: cada usuario solo ve sus propios datos
-- ============================================================

ALTER TABLE fasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- Fasts: el usuario solo puede operar sus propios ayunos
CREATE POLICY "users_own_fasts" ON fasts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Daily logs: el usuario solo puede operar sus propios registros
CREATE POLICY "users_own_daily_logs" ON daily_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Índices para queries frecuentes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fasts_user_ended ON fasts(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_fasts_user_started ON fasts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date DESC);
