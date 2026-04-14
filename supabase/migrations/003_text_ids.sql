-- Migration 003: Change primary keys from UUID to TEXT
-- WatermelonDB generates short alphanumeric IDs (e.g. "uAXPbrfgMYo9IU4f"),
-- not UUIDs. Keeping the UUID type caused upserts to fail with
-- "invalid input syntax for type uuid".

-- Drop RLS policies that reference the columns being altered
DROP POLICY IF EXISTS "users_own_sessions"   ON sessions;
DROP POLICY IF EXISTS "users_own_gps_points" ON gps_points;

-- Drop FK before altering referenced column
ALTER TABLE gps_points DROP CONSTRAINT gps_points_session_id_fkey;

-- Remove UUID defaults
ALTER TABLE sessions    ALTER COLUMN id DROP DEFAULT;
ALTER TABLE gps_points  ALTER COLUMN id DROP DEFAULT;

-- Widen column types
ALTER TABLE sessions    ALTER COLUMN id          TYPE text USING id::text;
ALTER TABLE gps_points  ALTER COLUMN id          TYPE text USING id::text;
ALTER TABLE gps_points  ALTER COLUMN session_id  TYPE text USING session_id::text;

-- local_id was NOT NULL but is not meaningful enough to enforce
ALTER TABLE sessions ALTER COLUMN local_id DROP NOT NULL;

-- Restore FK
ALTER TABLE gps_points ADD CONSTRAINT gps_points_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

-- Recreate RLS policies (same logic, columns are now TEXT)
CREATE POLICY "users_own_sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_gps_points" ON gps_points
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Update stored function: parameter was UUID, now TEXT
CREATE OR REPLACE FUNCTION update_session_route(p_session_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sessions
  SET route = (
    SELECT ST_MakeLine(point ORDER BY recorded_at)
    FROM gps_points
    WHERE session_id = p_session_id
      AND point IS NOT NULL
  )
  WHERE id = p_session_id;
END;
$$;
