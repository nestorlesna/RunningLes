-- Returns the total distance per week for the last N weeks for a given user.
CREATE OR REPLACE FUNCTION weekly_distance(p_user_id UUID, p_weeks INTEGER DEFAULT 8)
RETURNS TABLE(week_start DATE, distance_meters FLOAT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    date_trunc('week', started_at)::DATE AS week_start,
    COALESCE(SUM(distance_meters), 0)    AS distance_meters
  FROM sessions
  WHERE user_id = p_user_id
    AND started_at >= date_trunc('week', NOW()) - (p_weeks - 1) * INTERVAL '1 week'
    AND ended_at IS NOT NULL
  GROUP BY date_trunc('week', started_at)
  ORDER BY week_start DESC;
$$;
