import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'
import { SyncRequestSchema } from '@runningl-es/shared'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const body = await req.json()
    const parsed = SyncRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid sync payload', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { changes, lastPulledAt } = parsed.data
    const now = Date.now()

    // ---- PUSH: process client changes ----
    await pushSessions(user.id, changes.sessions)
    await pushGpsPoints(user.id, changes.gps_points)

    // ---- PULL: fetch server changes since lastPulledAt ----
    const serverChanges = await pullChanges(user.id, lastPulledAt)

    return NextResponse.json({ changes: serverChanges, timestamp: now })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[sync] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------

type TableChanges<T> = {
  created: T[]
  updated: T[]
  deleted: string[]
}

async function pushSessions(
  userId: string,
  changes: TableChanges<Record<string, unknown>>,
) {
  // Upsert created + updated
  const toUpsert = [...changes.created, ...changes.updated]
  if (toUpsert.length > 0) {
    const rows = toUpsert.map((s) => ({
      id: s.id as string,
      user_id: userId,
      local_id: s.localId as string,
      started_at: s.startedAt as string,
      ended_at: (s.endedAt as string) ?? null,
      duration_seconds: (s.durationSeconds as number) ?? null,
      distance_meters: (s.distanceMeters as number) ?? null,
      avg_pace_sec_per_km: (s.avgPaceSecPerKm as number) ?? null,
      max_speed_mps: (s.maxSpeedMps as number) ?? null,
      avg_speed_mps: (s.avgSpeedMps as number) ?? null,
      elevation_gain_meters: (s.elevationGainMeters as number) ?? null,
      activity_type: (s.activityType as string) ?? 'run',
      notes: (s.notes as string) ?? null,
      synced_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('sessions')
      .upsert(rows, { onConflict: 'id' })
    if (error) throw new Error(`sessions upsert failed: ${error.message}`)
  }

  // Delete
  if (changes.deleted.length > 0) {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .in('id', changes.deleted)
      .eq('user_id', userId)
    if (error) throw new Error(`sessions delete failed: ${error.message}`)
  }
}

async function pushGpsPoints(
  userId: string,
  changes: TableChanges<Record<string, unknown>>,
) {
  const toUpsert = [...changes.created, ...changes.updated]
  if (toUpsert.length > 0) {
    // Verify all referenced sessions belong to this user
    const sessionIds = [...new Set(toUpsert.map((p) => p.sessionId as string))]
    const { data: ownedSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .in('id', sessionIds)
    const ownedIds = new Set((ownedSessions ?? []).map((s: { id: string }) => s.id))

    const rows = toUpsert
      .filter((p) => ownedIds.has(p.sessionId as string))
      .map((p) => ({
        id: p.id as string,
        session_id: p.sessionId as string,
        recorded_at: p.recordedAt as string,
        latitude: p.latitude as number,
        longitude: p.longitude as number,
        altitude: (p.altitude as number) ?? null,
        accuracy: (p.accuracy as number) ?? null,
        speed_mps: (p.speedMps as number) ?? null,
        heading: (p.heading as number) ?? null,
        // Store as PostGIS point: ST_SetSRID(ST_MakePoint(lon, lat), 4326)
        point: `SRID=4326;POINT(${p.longitude} ${p.latitude})`,
      }))

    if (rows.length > 0) {
      const { error } = await supabase
        .from('gps_points')
        .upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(`gps_points upsert failed: ${error.message}`)

      // Rebuild route geometries for affected sessions
      for (const sessionId of ownedIds) {
        await supabase.rpc('update_session_route', { p_session_id: sessionId })
      }
    }
  }

  if (changes.deleted.length > 0) {
    const { error } = await supabase
      .from('gps_points')
      .delete()
      .in('id', changes.deleted)
    if (error) throw new Error(`gps_points delete failed: ${error.message}`)
  }
}

async function pullChanges(userId: string, lastPulledAt: number | null) {
  const since = lastPulledAt
    ? new Date(lastPulledAt).toISOString()
    : new Date(0).toISOString()

  const [{ data: sessions }, { data: gpsPoints }] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('synced_at', since),
    supabase
      .from('gps_points')
      .select('gps_points.*')
      .gt('gps_points.recorded_at', since)
      .in(
        'session_id',
        supabase.from('sessions').select('id').eq('user_id', userId),
      ),
  ])

  return {
    sessions: {
      created: sessions ?? [],
      updated: [],
      deleted: [],
    },
    gps_points: {
      created: gpsPoints ?? [],
      updated: [],
      deleted: [],
    },
  }
}
