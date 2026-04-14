import { z } from 'zod'

export const GpsCoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable(),
  accuracy: z.number().nullable(),
  speedMps: z.number().nullable(),
  heading: z.number().nullable(),
  recordedAt: z.number(), // Unix ms
})

const SessionChangeSchema = z.object({
  id: z.string(),
  local_id: z.string().nullable().optional(),
  started_at: z.number(),           // Unix ms — WatermelonDB date columns
  ended_at: z.number().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  distance_meters: z.number().nullable().optional(),
  avg_pace_sec_per_km: z.number().nullable().optional(),
  max_speed_mps: z.number().nullable().optional(),
  avg_speed_mps: z.number().nullable().optional(),
  elevation_gain_meters: z.number().nullable().optional(),
  activity_type: z.enum(['run', 'walk']).catch('run'),
  notes: z.string().nullable().optional(),
})

const GpsPointChangeSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  recorded_at: z.number(),          // Unix ms — WatermelonDB date columns
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  speed_mps: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
})

const TableChangesSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    created: z.array(schema).optional().default([]),
    updated: z.array(schema).optional().default([]),
    deleted: z.array(z.string()).optional().default([]),
  })

export const SyncRequestSchema = z.object({
  changes: z.object({
    sessions: TableChangesSchema(SessionChangeSchema),
    gps_points: TableChangesSchema(GpsPointChangeSchema),
  }),
  lastPulledAt: z.number().nullable(),
})

export type SyncRequest = z.infer<typeof SyncRequestSchema>
