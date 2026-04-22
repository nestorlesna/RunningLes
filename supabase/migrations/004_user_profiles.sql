-- Add calories_burned to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS calories_burned FLOAT;

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg   FLOAT,
  birth_year  INTEGER,
  sex         TEXT CHECK (sex IN ('male', 'female')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile"
  ON user_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
