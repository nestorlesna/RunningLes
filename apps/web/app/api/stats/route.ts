import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'
import type { UserStats, WeeklyDistance } from '@runningl-es/shared'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const [aggregateResult, weeklyResult] = await Promise.all([
      // Aggregate totals + best pace
      supabase
        .from('sessions')
        .select(
          'duration_seconds, distance_meters, avg_pace_sec_per_km, avg_speed_mps, calories_burned',
        )
        .eq('user_id', user.id)
        .not('ended_at', 'is', null),

      // Weekly distance: last 8 weeks
      supabase.rpc('weekly_distance', {
        p_user_id: user.id,
        p_weeks: 8,
      }),
    ])

    if (aggregateResult.error) throw aggregateResult.error

    const rows = aggregateResult.data ?? []
    const totalSessions = rows.length
    const totalDistanceMeters = rows.reduce(
      (sum, r) => sum + (r.distance_meters ?? 0),
      0,
    )
    const totalDurationSeconds = rows.reduce(
      (sum, r) => sum + (r.duration_seconds ?? 0),
      0,
    )

    const paces = rows
      .map((r) => r.avg_pace_sec_per_km)
      .filter((p): p is number => p != null && p > 0)

    const avgPaceSecPerKm =
      paces.length > 0 ? paces.reduce((a, b) => a + b, 0) / paces.length : null
    const bestPaceSecPerKm = paces.length > 0 ? Math.min(...paces) : null

    // weeklyResult may be null if the RPC isn't set up yet — fall back to empty
    const weeklyDistance: WeeklyDistance[] = Array.isArray(weeklyResult.data)
      ? weeklyResult.data
      : []

    const totalCaloriesBurned = rows.reduce(
      (sum, r) => sum + ((r as Record<string, unknown>).calories_burned as number ?? 0),
      0,
    )

    const stats: UserStats & { totalCaloriesBurned: number } = {
      totalSessions,
      totalDistanceMeters,
      totalDurationSeconds,
      avgPaceSecPerKm,
      bestPaceSecPerKm,
      weeklyDistance,
      totalCaloriesBurned,
    }

    return NextResponse.json(stats)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[GET /stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
