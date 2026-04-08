import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Validates the Bearer JWT from the Authorization header using Supabase's
 * anon key (so it respects RLS). Returns the authenticated user or throws.
 */
export async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401)
  }
  const token = authHeader.slice(7)

  // Use a per-request client with the user's JWT to verify identity
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    throw new AuthError('Invalid or expired token', 401)
  }

  return data.user
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
