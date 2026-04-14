import { synchronize } from '@nozbe/watermelondb/sync'
import { AppState, AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { database } from './index'
import { supabase } from '../../lib/supabase'
import { useUIStore } from '../../store/uiStore'
import Constants from 'expo-constants'

const API_BASE_URL: string = Constants.expoConfig?.extra?.apiBaseUrl ?? ''

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function syncDatabase(): Promise<void> {
  const { setSyncing, setSyncSuccess, setSyncError } = useUIStore.getState()

  // Avoid concurrent syncs
  if (useUIStore.getState().isSyncing) return

  const token = await getAccessToken()
  if (!token) {
    setSyncError('Sin sesión activa — iniciá sesión para sincronizar')
    return
  }

  setSyncing(true)

  try {
    await synchronize({
      database,

      pullChanges: async ({ lastPulledAt }) => {
        const res = await fetch(`${API_BASE_URL}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            changes: {
              sessions: { created: [], updated: [], deleted: [] },
              gps_points: { created: [], updated: [], deleted: [] },
            },
            lastPulledAt,
          }),
        })

        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Sync pull failed: ${res.status} ${body}`)
        }

        const json = await res.json()
        return { changes: json.changes, timestamp: json.timestamp }
      },

      pushChanges: async ({ changes, lastPulledAt }) => {
        const res = await fetch(`${API_BASE_URL}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ changes, lastPulledAt }),
        })

        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Sync push failed: ${res.status} ${body}`)
        }

        const json = await res.json()
        setSyncSuccess(json.timestamp)
      },

      migrationsEnabledAtVersion: 1,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync error'
    setSyncError(message)
    console.warn('[sync]', message)
  }
}

// ---------------------------------------------------------------------------
// Auto-sync listeners
// ---------------------------------------------------------------------------

let unsubscribeNetInfo: (() => void) | null = null
let appStateListener: { remove: () => void } | null = null

export function startSyncListeners(): void {
  // Sync when network becomes available
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      syncDatabase()
    }
  })

  // Sync when app comes to foreground
  appStateListener = AppState.addEventListener(
    'change',
    (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        syncDatabase()
      }
    },
  )
}

export function stopSyncListeners(): void {
  unsubscribeNetInfo?.()
  appStateListener?.remove()
  unsubscribeNetInfo = null
  appStateListener = null
}
