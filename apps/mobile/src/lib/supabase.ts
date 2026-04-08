import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const supabaseUrl: string = Constants.expoConfig?.extra?.supabaseUrl ?? ''
const supabaseAnonKey: string = Constants.expoConfig?.extra?.supabaseAnonKey ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})
