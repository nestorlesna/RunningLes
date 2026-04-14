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
      local_id: (s.local_id as string) ?? null,
      started_at: new Date(s.started_at as number).toISOString(),
      ended_at: s.ended_at ? new Date(s.ended_at as number).toISOString() : null,
      duration_seconds: (s.duration_seconds as number) ?? null,
      distance_meters: (s.distance_meters as number) ?? null,
      avg_pace_sec_per_km: (s.avg_pace_sec_per_km as number) ?? null,
      max_speed_mps: (s.max_speed_mps as number) ?? null,
      avg_speed_mps: (s.avg_speed_mps as number) ?? null,
      elevation_gain_meters: (s.elevation_gain_meters as number) ?? null,
      activity_type: (s.activity_type as string) ?? 'run',
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
    const sessionIds = [...new Set(toUpsert.map((p) => p.session_id as string))]
    const { data: ownedSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .in('id', sessionIds)
    const ownedIds = new Set((ownedSessions ?? []).map((s: { id: string }) => s.id))

    const rows = toUpsert
      .filter((p) => ownedIds.has(p.session_id as string))
      .map((p) => ({
        id: p.id as string,
        session_id: p.session_id as string,
        recorded_at: new Date(p.recorded_at as number).toISOString(),
        latitude: p.latitude as number,
        longitude: p.longitude as number,
        altitude: (p.altitude as number) ?? null,
        accuracy: (p.accuracy as number) ?? null,
        speed_mps: (p.speed_mps as number) ?? null,
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

// WatermelonDB expects number type columns as Unix ms timestamps.
// Supabase returns timestamps as ISO strings — convert them before sending to the client.
function sessionToWatermelonRaw(s: Record<string, unknown>) {
  return {
    id: s.id,
    local_id: s.local_id ?? null,
    started_at: s.started_at ? new Date(s.started_at as string).getTime() : 0,
    ended_at: s.ended_at ? new Date(s.ended_at as string).getTime() : null,
    duration_seconds: s.duration_seconds ?? null,
    distance_meters: s.distance_meters ?? null,
    avg_pace_sec_per_km: s.avg_pace_sec_per_km ?? null,
    max_speed_mps: s.max_speed_mps ?? null,
    avg_speed_mps: s.avg_speed_mps ?? null,
    elevation_gain_meters: s.elevation_gain_meters ?? null,
    activity_type: (s.activity_type as string) ?? 'run',
    notes: s.notes ?? null,
    // 'synced', 'raw_points', 'user_id', 'synced_at', 'route' are local-only or server-only — omitted
  }
}

function gpsPointToWatermelonRaw(p: Record<string, unknown>) {
  return {
    id: p.id,
    session_id: p.session_id,
    recorded_at: p.recorded_at ? new Date(p.recorded_at as string).getTime() : 0,
    latitude: p.latitude,
    longitude: p.longitude,
    altitude: p.altitude ?? null,
    accuracy: p.accuracy ?? null,
    speed_mps: p.speed_mps ?? null,
    heading: p.heading ?? null,
  }
}

async function pullChanges(userId: string, lastPulledAt: number | null) {
  const since = lastPulledAt
    ? new Date(lastPulledAt).toISOString()
    : new Date(0).toISOString()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, local_id, started_at, ended_at, duration_seconds, distance_meters, avg_pace_sec_per_km, max_speed_mps, avg_speed_mps, elevation_gain_meters, activity_type, notes')
    .eq('user_id', userId)
    .gt('synced_at', since)

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id)

  const { data: gpsPoints } = sessionIds.length > 0
    ? await supabase
        .from('gps_points')
        .select('id, session_id, recorded_at, latitude, longitude, altitude, accuracy, speed_mps, heading')
        .in('session_id', sessionIds)
        .gt('recorded_at', since)
    : { data: [] }

  return {
    sessions: {
      created: (sessions ?? []).map(sessionToWatermelonRaw),
      updated: [],
      deleted: [],
    },
    gps_points: {
      created: (gpsPoints ?? []).map(gpsPointToWatermelonRaw),
      updated: [],
      deleted: [],
    },
  }
}
