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
  localId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
  distanceMeters: z.number().nullable().optional(),
  avgPaceSecPerKm: z.number().nullable().optional(),
  maxSpeedMps: z.number().nullable().optional(),
  avgSpeedMps: z.number().nullable().optional(),
  elevationGainMeters: z.number().nullable().optional(),
  activityType: z.enum(['run', 'walk']).optional(),
  notes: z.string().nullable().optional(),
})

const GpsPointChangeSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  recordedAt: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  speedMps: z.number().nullable().optional(),
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
