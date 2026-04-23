import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'
import { estimateCalories } from '@runningl-es/shared'
import type { GpsCoordinate, ActivityType } from '@runningl-es/shared'

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req)

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: gpsPoints, error: ptsError } = await supabase
      .from('gps_points')
      .select('recorded_at, latitude, longitude, altitude, accuracy, speed_mps, heading')
      .eq('session_id', params.id)
      .order('recorded_at', { ascending: true })

    if (ptsError) throw ptsError

    const points = gpsPoints ?? []

    // Recalculate duration from timestamps
    let newDuration = session.duration_seconds
    if (session.started_at && session.ended_at) {
      newDuration = Math.round(
        (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
      )
    } else if (points.length >= 2) {
      newDuration = Math.round(
        (new Date(points[points.length - 1].recorded_at).getTime() -
          new Date(points[0].recorded_at).getTime()) /
          1000
      )
    }

    // Recalculate calories if user has a weight on file
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('weight_kg, birth_year, sex')
      .eq('user_id', user.id)
      .maybeSingle()

    let newCalories = session.calories_burned
    if (profile?.weight_kg && newDuration && session.distance_meters) {
      const coords: GpsCoordinate[] = points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        accuracy: p.accuracy,
        speedMps: p.speed_mps,
        heading: p.heading,
        recordedAt: new Date(p.recorded_at).getTime(),
      }))

      newCalories = estimateCalories({
        activityType: (session.activity_type as ActivityType) ?? 'run',
        weightKg: profile.weight_kg,
        birthYear: profile.birth_year,
        sex: profile.sex as 'male' | 'female' | null,
        points: coords,
        durationSeconds: newDuration,
        distanceMeters: session.distance_meters,
        elevationGainMeters: session.elevation_gain_meters,
      })
    }

    const updates: Record<string, unknown> = {}
    if (newDuration !== session.duration_seconds) updates.duration_seconds = newDuration
    if (newCalories !== session.calories_burned) updates.calories_burned = newCalories

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: 'No changes needed', session })
    }

    const { data: updated, error: updateError } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ message: 'Recalculated', session: updated, changes: updates })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[POST /sessions/:id/recalculate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
