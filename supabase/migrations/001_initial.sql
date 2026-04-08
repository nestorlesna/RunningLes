-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id             TEXT        NOT NULL,
  started_at           TIMESTAMPTZ NOT NULL,
  ended_at             TIMESTAMPTZ,
  duration_seconds     INTEGER,
  distance_meters      FLOAT,
  avg_pace_sec_per_km  FLOAT,
  max_speed_mps        FLOAT,
  avg_speed_mps        FLOAT,
  elevation_gain_meters FLOAT,
  activity_type        TEXT        NOT NULL DEFAULT 'run' CHECK (activity_type IN ('run', 'walk')),
  route                GEOMETRY(LINESTRING, 4326),
  notes                TEXT,
  synced_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GPS POINTS
-- ============================================================
CREATE TABLE gps_points (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  recorded_at  TIMESTAMPTZ NOT NULL,
  latitude     FLOAT       NOT NULL,
  longitude    FLOAT       NOT NULL,
  altitude     FLOAT,
  accuracy     FLOAT,
  speed_mps    FLOAT,
  heading      FLOAT,
  point        GEOMETRY(POINT, 4326)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_local_id   ON sessions(user_id, local_id);
CREATE INDEX idx_gps_session_id      ON gps_points(session_id);
CREATE INDEX idx_gps_recorded_at     ON gps_points(session_id, recorded_at);
CREATE INDEX idx_sessions_route      ON sessions USING GIST(route);
CREATE INDEX idx_gps_points_point    ON gps_points USING GIST(point);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_points ENABLE ROW LEVEL SECURITY;

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

-- ============================================================
-- FUNCTION: build route geometry from gps_points
-- Called after bulk insert of gps_points during sync
-- ============================================================
CREATE OR REPLACE FUNCTION update_session_route(p_session_id UUID)
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
