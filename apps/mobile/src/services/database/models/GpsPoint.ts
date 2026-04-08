import { Model } from '@nozbe/watermelondb'
import { field, relation, date } from '@nozbe/watermelondb/decorators'
import type Session from './Session'

export default class GpsPoint extends Model {
  static table = 'gps_points'
  static associations = {
    sessions: { type: 'belongs_to' as const, key: 'session_id' },
  }

  @field('session_id') sessionId!: string
  @field('latitude') latitude!: number
  @field('longitude') longitude!: number
  @field('altitude') altitude!: number | null
  @field('accuracy') accuracy!: number | null
  @field('speed_mps') speedMps!: number | null
  @field('heading') heading!: number | null
  @date('recorded_at') recordedAt!: Date

  @relation('sessions', 'session_id') session!: Session
}
