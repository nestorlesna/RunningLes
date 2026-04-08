import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const dbSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'sessions',
      columns: [
        { name: 'local_id', type: 'string', isIndexed: true },
        { name: 'started_at', type: 'number' },       // Unix ms
        { name: 'ended_at', type: 'number', isOptional: true },
        { name: 'duration_seconds', type: 'number', isOptional: true },
        { name: 'distance_meters', type: 'number', isOptional: true },
        { name: 'avg_pace_sec_per_km', type: 'number', isOptional: true },
        { name: 'max_speed_mps', type: 'number', isOptional: true },
        { name: 'avg_speed_mps', type: 'number', isOptional: true },
        { name: 'elevation_gain_meters', type: 'number', isOptional: true },
        { name: 'activity_type', type: 'string' },     // 'run' | 'walk'
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'synced', type: 'boolean' },
        // JSON-serialised GpsCoordinate[] for quick map rendering before sync
        { name: 'raw_points', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'gps_points',
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'altitude', type: 'number', isOptional: true },
        { name: 'accuracy', type: 'number', isOptional: true },
        { name: 'speed_mps', type: 'number', isOptional: true },
        { name: 'heading', type: 'number', isOptional: true },
        { name: 'recorded_at', type: 'number' },       // Unix ms
      ],
    }),
  ],
})
