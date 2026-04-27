-- ============================================================
-- Protocolo Edu · Whoop API + Briefs migration
-- Ejecuta en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Tokens de Whoop (single-user: 1 fila por usuario)
CREATE TABLE IF NOT EXISTS whoop_tokens (
  user_id        uuid PRIMARY KEY REFERENCES auth.users,
  access_token   text NOT NULL,
  refresh_token  text NOT NULL,
  expires_at     timestamptz NOT NULL,
  scope          text,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE whoop_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_whoop_tokens" ON whoop_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER whoop_tokens_updated_at
  BEFORE UPDATE ON whoop_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Briefs generados por Claude (morning / weekly / monthly)
CREATE TABLE IF NOT EXISTS briefs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('morning','weekly','monthly')),
  date        date NOT NULL,
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, kind, date)
);

ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_briefs" ON briefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_briefs_user_kind_date ON briefs(user_id, kind, date DESC);
