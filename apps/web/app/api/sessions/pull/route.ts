import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { ids } = parsed.data

    const { data, error } = await supabase
      .from('sessions')
      .select(
        'id, activity_type, notes, duration_seconds, distance_meters, avg_pace_sec_per_km, max_speed_mps, avg_speed_mps',
      )
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) throw error

    return NextResponse.json({ sessions: data ?? [] })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[POST /sessions/pull]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
