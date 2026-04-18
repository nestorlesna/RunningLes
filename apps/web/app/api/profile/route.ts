import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser, AuthError } from '@/lib/auth'
import { z } from 'zod'

const ProfileUpdateSchema = z.object({
  weight_kg: z.number().min(20).max(300).nullable().optional(),
  birth_year: z.number().int().min(1920).max(new Date().getFullYear() - 5).nullable().optional(),
  sex: z.enum(['male', 'female']).nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)

    const { data } = await supabase
      .from('user_profiles')
      .select('weight_kg, birth_year, sex, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json(data ?? { weight_kg: null, birth_year: null, sex: null })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req)
    const body = await req.json()

    const parsed = ProfileUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile data', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('weight_kg' in parsed.data) updates.weight_kg = parsed.data.weight_kg ?? null
    if ('birth_year' in parsed.data) updates.birth_year = parsed.data.birth_year ?? null
    if ('sex' in parsed.data) updates.sex = parsed.data.sex ?? null

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select('weight_kg, birth_year, sex, updated_at')
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('[PATCH /profile]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
