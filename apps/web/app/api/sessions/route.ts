import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const { searchParams } = req.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('sessions')
      .select(
        'id, local_id, started_at, ended_at, duration_seconds, distance_meters, avg_pace_sec_per_km, max_speed_mps, avg_speed_mps, elevation_gain_meters, activity_type, notes, synced_at, created_at',
        { count: 'exact' },
      )
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      sessions: data,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[GET /sessions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
