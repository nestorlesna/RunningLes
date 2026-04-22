import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const [{ data: profile }, { data: sessions, error: sessErr }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('weight_kg, birth_year, sex')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('sessions')
        .select('id, local_id, started_at, ended_at, duration_seconds, distance_meters, avg_pace_sec_per_km, max_speed_mps, avg_speed_mps, elevation_gain_meters, calories_burned, activity_type, notes, created_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false }),
    ])

    if (sessErr) throw sessErr

    const sessionIds = (sessions ?? []).map((s) => s.id)
    let gpsPoints: Record<string, unknown>[] = []

    if (sessionIds.length > 0) {
      const { data: points } = await supabase
        .from('gps_points')
        .select('id, session_id, recorded_at, latitude, longitude, altitude, accuracy, speed_mps, heading')
        .in('session_id', sessionIds)
        .order('recorded_at', { ascending: true })
      gpsPoints = points ?? []
    }

    const pointsBySession = new Map<string, Record<string, unknown>[]>()
    for (const p of gpsPoints) {
      const sid = p.session_id as string
      if (!pointsBySession.has(sid)) pointsBySession.set(sid, [])
      pointsBySession.get(sid)!.push(p)
    }

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      profile: profile ?? null,
      sessions: (sessions ?? []).map((s) => ({
        ...s,
        gps_points: pointsBySession.get(s.id) ?? [],
      })),
    }

    const dateStr = new Date().toISOString().split('T')[0]
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="runningl-es-backup-${dateStr}.json"`,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[export]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
