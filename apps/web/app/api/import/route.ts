import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'
import { z } from 'zod'

const GpsPointSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  recorded_at: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  speed_mps: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
})

const SessionSchema = z.object({
  id: z.string(),
  local_id: z.string().nullable().optional(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  duration_seconds: z.number().nullable().optional(),
  distance_meters: z.number().nullable().optional(),
  avg_pace_sec_per_km: z.number().nullable().optional(),
  max_speed_mps: z.number().nullable().optional(),
  avg_speed_mps: z.number().nullable().optional(),
  elevation_gain_meters: z.number().nullable().optional(),
  calories_burned: z.number().nullable().optional(),
  activity_type: z.enum(['run', 'walk', 'bike']),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  gps_points: z.array(GpsPointSchema).optional().default([]),
})

const BackupSchema = z.object({
  version: z.string(),
  profile: z
    .object({
      weight_kg: z.number().nullable().optional(),
      birth_year: z.number().nullable().optional(),
      sex: z.enum(['male', 'female']).nullable().optional(),
    })
    .nullable()
    .optional(),
  sessions: z.array(SessionSchema).optional().default([]),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const body = await req.json()
    const parsed = BackupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Formato de backup inválido', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { profile, sessions } = parsed.data

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    let profileUpdated = false
    let sessionsUpserted = 0
    let pointsUpserted = 0

    if (profile) {
      const profilePayload: Record<string, unknown> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }
      if (profile.weight_kg != null) profilePayload.weight_kg = profile.weight_kg
      if (profile.birth_year != null) profilePayload.birth_year = profile.birth_year
      if (profile.sex != null) profilePayload.sex = profile.sex

      const { error } = await supabase
        .from('user_profiles')
        .upsert(profilePayload, { onConflict: 'user_id' })
      if (error) throw error
      profileUpdated = true
    }

    for (const session of sessions) {
      const { gps_points: points, ...sessionData } = session

      const { error: sessErr } = await supabase.from('sessions').upsert(
        {
          ...sessionData,
          user_id: user.id,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      if (sessErr) throw sessErr
      sessionsUpserted++

      if (points.length > 0) {
        const BATCH = 500
        for (let i = 0; i < points.length; i += BATCH) {
          const batch = points.slice(i, i + BATCH).map((p) => ({
            ...p,
            session_id: session.id,
          }))
          const { error: ptErr } = await supabase
            .from('gps_points')
            .upsert(batch, { onConflict: 'id' })
          if (ptErr) throw ptErr
          pointsUpserted += batch.length
        }

        await supabase.rpc('update_session_route', { p_session_id: session.id })
      }
    }

    return NextResponse.json({ profileUpdated, sessionsUpserted, pointsUpserted })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[import]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
