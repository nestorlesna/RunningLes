import type { ActivityType, GpsCoordinate } from './types'

export interface CalorieInput {
  activityType: ActivityType
  weightKg: number
  birthYear?: number | null
  sex?: 'male' | 'female' | null
  points: GpsCoordinate[]
  durationSeconds: number
  distanceMeters: number
  elevationGainMeters?: number | null
}

function metForSpeed(activityType: ActivityType, speedMps: number): number {
  const kmh = speedMps * 3.6
  if (activityType === 'run') {
    if (kmh < 6) return 6.0
    if (kmh < 8) return 8.3
    if (kmh < 10) return 9.8
    if (kmh < 12) return 11.0
    if (kmh < 14) return 12.5
    return 14.0
  }
  if (activityType === 'walk') {
    if (kmh < 3) return 2.5
    if (kmh < 4.5) return 3.0
    if (kmh < 6) return 3.5
    return 4.3
  }
  if (activityType === 'bike') {
    if (kmh < 16) return 4.0
    if (kmh < 20) return 6.0
    if (kmh < 24) return 8.0
    if (kmh < 30) return 10.0
    return 12.0
  }
  return 5.0
}

function ageSexFactor(
  birthYear: number | null | undefined,
  sex: 'male' | 'female' | null | undefined,
): number {
  let factor = 1.0
  if (sex === 'male') factor *= 1.05
  else if (sex === 'female') factor *= 0.95
  if (birthYear) {
    const age = new Date().getFullYear() - birthYear
    if (age > 40) factor *= Math.pow(0.98, Math.floor((age - 40) / 10))
  }
  return factor
}

/**
 * Estimates calories burned using MET values derived from actual GPS speed
 * at each segment. Falls back to average-speed MET when GPS coverage is sparse.
 * Adds an elevation correction (~0.5 kcal/kg/100 m gain).
 */
export function estimateCalories(input: CalorieInput): number {
  const { activityType, weightKg, birthYear, sex, points, durationSeconds, distanceMeters, elevationGainMeters } = input
  if (weightKg <= 0 || durationSeconds <= 0) return 0

  const factor = ageSexFactor(birthYear, sex)
  const avgSpeedMps = durationSeconds > 0 ? distanceMeters / durationSeconds : 0
  let calories = 0

  if (points.length >= 2) {
    let coveredSeconds = 0
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const segSec = (curr.recordedAt - prev.recordedAt) / 1000
      if (segSec <= 0 || segSec > 120) continue
      coveredSeconds += segSec
      const speed = (curr.speedMps != null && curr.speedMps >= 0)
        ? curr.speedMps
        : (prev.speedMps != null && prev.speedMps >= 0)
          ? prev.speedMps
          : avgSpeedMps
      calories += metForSpeed(activityType, speed) * weightKg * (segSec / 3600)
    }
    if (coveredSeconds < durationSeconds * 0.5) {
      // GPS coverage too sparse — use average speed
      calories = metForSpeed(activityType, avgSpeedMps) * weightKg * (durationSeconds / 3600)
    }
  } else {
    calories = metForSpeed(activityType, avgSpeedMps) * weightKg * (durationSeconds / 3600)
  }

  // Elevation: ~0.5 kcal per kg per 100 m of positive gain
  if (elevationGainMeters && elevationGainMeters > 0) {
    calories += 0.005 * weightKg * elevationGainMeters
  }

  return Math.round(calories * factor)
}
