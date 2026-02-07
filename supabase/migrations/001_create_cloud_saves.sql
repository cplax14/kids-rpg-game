-- Cloud Saves Table for Monster Quest RPG
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cloud_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number >= 0 AND slot_number < 3),
  save_data JSONB NOT NULL,
  version TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_level INTEGER NOT NULL,
  play_time INTEGER NOT NULL DEFAULT 0,
  current_area_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, slot_number)
);

-- Row Level Security (users can only access own saves)
ALTER TABLE cloud_saves ENABLE ROW LEVEL SECURITY;

-- Policy: Users can CRUD their own saves
CREATE POLICY "Users can CRUD own saves" ON cloud_saves
  FOR ALL USING (auth.uid() = user_id);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_cloud_saves_user_id ON cloud_saves(user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function on update
DROP TRIGGER IF EXISTS update_cloud_saves_updated_at ON cloud_saves;
CREATE TRIGGER update_cloud_saves_updated_at
  BEFORE UPDATE ON cloud_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
