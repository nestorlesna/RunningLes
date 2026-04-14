import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'

type Params = { params: { id: string } }

async function verifyPointOwnership(pointId: string, userId: string) {
  const { data: point } = await supabase
    .from('gps_points')
    .select('id, session_id')
    .eq('id', pointId)
    .single()

  if (!point) return null

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', point.session_id)
    .eq('user_id', userId)
    .single()

  if (!session) return null
  return point
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req)

    const point = await verifyPointOwnership(params.id, user.id)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('gps_points')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    await supabase.rpc('update_session_route', { p_session_id: point.session_id })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[DELETE /gps-points/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req)
    const body = await req.json()

    const point = await verifyPointOwnership(params.id, user.id)
    if (!point) {
      return NextResponse.json({ error: 'Point not found' }, { status: 404 })
    }

    const { latitude, longitude } = body
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(
        { error: 'latitude and longitude must be numbers' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('gps_points')
      .update({
        latitude,
        longitude,
        point: `SRID=4326;POINT(${longitude} ${latitude})`,
      })
      .eq('id', params.id)
      .select('id, session_id, recorded_at, latitude, longitude, altitude, accuracy, speed_mps, heading')
      .single()

    if (error) throw error

    await supabase.rpc('update_session_route', { p_session_id: point.session_id })

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[PATCH /gps-points/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
