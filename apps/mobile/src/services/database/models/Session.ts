import { Model, Query } from '@nozbe/watermelondb'
import { field, text, children, date, writer } from '@nozbe/watermelondb/decorators'
import type GpsPoint from './GpsPoint'
import type { ActivityType } from '@runningl-es/shared'

export default class Session extends Model {
  static table = 'sessions'
  static associations = {
    gps_points: { type: 'has_many' as const, foreignKey: 'session_id' },
  }

  @text('local_id') localId!: string
  @date('started_at') startedAt!: Date
  @date('ended_at') endedAt!: Date | null
  @field('duration_seconds') durationSeconds!: number | null
  @field('distance_meters') distanceMeters!: number | null
  @field('avg_pace_sec_per_km') avgPaceSecPerKm!: number | null
  @field('max_speed_mps') maxSpeedMps!: number | null
  @field('avg_speed_mps') avgSpeedMps!: number | null
  @field('elevation_gain_meters') elevationGainMeters!: number | null
  @text('activity_type') activityType!: ActivityType
  @text('notes') notes!: string | null
  @field('synced') synced!: boolean
  @text('raw_points') rawPoints!: string | null

  @children('gps_points') gpsPoints!: Query<GpsPoint>

  @writer async finalize(
    durationSeconds: number,
    distanceMeters: number,
    avgPaceSecPerKm: number,
    maxSpeedMps: number,
    avgSpeedMps: number,
  ) {
    await this.update((record) => {
      record.endedAt = new Date()
      record.durationSeconds = durationSeconds
      record.distanceMeters = distanceMeters
      record.avgPaceSecPerKm = avgPaceSecPerKm
      record.maxSpeedMps = maxSpeedMps
      record.avgSpeedMps = avgSpeedMps
    })
  }
}
