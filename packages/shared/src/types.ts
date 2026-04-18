export type ActivityType = 'run' | 'walk' | 'bike'

export interface UserProfile {
  weightKg: number | null
  birthYear: number | null
  sex: 'male' | 'female' | null
}

export interface GpsCoordinate {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speedMps: number | null
  heading: number | null
  recordedAt: number // Unix ms
}

export interface Session {
  id: string
  localId: string
  userId: string
  startedAt: string // ISO 8601
  endedAt: string | null
  durationSeconds: number | null
  distanceMeters: number | null
  avgPaceSecPerKm: number | null
  maxSpeedMps: number | null
  avgSpeedMps: number | null
  elevationGainMeters: number | null
  caloriesBurned: number | null
  activityType: ActivityType
  notes: string | null
  syncedAt: string | null
  createdAt: string
}

export interface SessionWithPoints extends Session {
  gpsPoints: GpsPoint[]
}

export interface GpsPoint {
  id: string
  sessionId: string
  recordedAt: string // ISO 8601
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speedMps: number | null
  heading: number | null
}

export interface UserStats {
  totalSessions: number
  totalDistanceMeters: number
  totalDurationSeconds: number
  avgPaceSecPerKm: number | null
  bestPaceSecPerKm: number | null
  weeklyDistance: WeeklyDistance[]
}

export interface WeeklyDistance {
  weekStart: string // ISO 8601 date
  distanceMeters: number
}
