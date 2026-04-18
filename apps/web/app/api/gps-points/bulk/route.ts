import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)
    const body = await req.json()

    const { ids } = body as { ids: unknown }
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'ids must be a non-empty string array' }, { status: 400 })
    }

    // Verify all points belong to sessions owned by this user
    const { data: points, error: fetchError } = await supabase
      .from('gps_points')
      .select('id, session_id')
      .in('id', ids)

    if (fetchError) throw fetchError
    if (!points || points.length === 0) {
      return NextResponse.json({ error: 'No points found' }, { status: 404 })
    }

    const sessionIds = [...new Set(points.map((p) => p.session_id))]

    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .in('id', sessionIds)
      .eq('user_id', user.id)

    if (sessionError) throw sessionError

    const ownedSessionIds = new Set(sessions?.map((s) => s.id) ?? [])
    const allOwned = points.every((p) => ownedSessionIds.has(p.session_id))

    if (!allOwned) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('gps_points')
      .delete()
      .in('id', ids)

    if (deleteError) throw deleteError

    // Rebuild route for each affected session
    await Promise.all(
      sessionIds.map((sid) => supabase.rpc('update_session_route', { p_session_id: sid }))
    )

    return NextResponse.json({ deleted: points.length })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[DELETE /gps-points/bulk]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
