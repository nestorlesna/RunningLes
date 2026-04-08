import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'

type Params = { params: { id: string } }

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req)

    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { data: gpsPoints, error: ptsError } = await supabase
      .from('gps_points')
      .select('id, session_id, recorded_at, latitude, longitude, altitude, accuracy, speed_mps, heading')
      .eq('session_id', params.id)
      .order('recorded_at', { ascending: true })

    if (ptsError) throw ptsError

    return NextResponse.json({ ...session, gpsPoints: gpsPoints ?? [] })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[GET /sessions/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getAuthenticatedUser(req)

    // Verify ownership before delete
    const { data: session } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[DELETE /sessions/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
