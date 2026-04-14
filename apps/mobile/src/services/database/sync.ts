import { synchronize } from '@nozbe/watermelondb/sync'
import { AppState, AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { database } from './index'
import { supabase } from '../../lib/supabase'
import { useUIStore } from '../../store/uiStore'

const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

// Minimum ms to wait after a failed sync before retrying via listeners.
// Prevents hundreds of rapid retries when the network is unstable.
const SYNC_ERROR_COOLDOWN_MS = 30_000
let lastSyncErrorAt: number | null = null

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function syncDatabase(): Promise<void> {
  const { setSyncing, setSyncSuccess, setSyncError } = useUIStore.getState()

  // Avoid concurrent syncs
  if (useUIStore.getState().isSyncing) return

  // Don't retry within cooldown window after a failure
  if (lastSyncErrorAt !== null && Date.now() - lastSyncErrorAt < SYNC_ERROR_COOLDOWN_MS) return

  if (!API_BASE_URL) {
    setSyncError('URL del servidor no configurada — rebuild la app')
    console.warn('[sync] EXPO_PUBLIC_API_BASE_URL is not set')
    return
  }

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
        // Strip local-only fields before sending: raw_points (huge JSON string),
        // synced flag, and WatermelonDB internal fields (_changed, _status).
        const stripSession = ({ raw_points, synced, _changed, _status, ...s }: Record<string, unknown>) => s
        const stripPoint = ({ _changed, _status, ...p }: Record<string, unknown>) => p
        const sanitizedChanges = {
          sessions: {
            created: (changes.sessions?.created ?? []).map(stripSession),
            updated: (changes.sessions?.updated ?? []).map(stripSession),
            deleted: changes.sessions?.deleted ?? [],
          },
          gps_points: {
            created: (changes.gps_points?.created ?? []).map(stripPoint),
            updated: (changes.gps_points?.updated ?? []).map(stripPoint),
            deleted: changes.gps_points?.deleted ?? [],
          },
        }

        const res = await fetch(`${API_BASE_URL}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ changes: sanitizedChanges, lastPulledAt }),
        })

        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Sync push failed: ${res.status} ${body}`)
        }

        const json = await res.json()
        lastSyncErrorAt = null
        setSyncSuccess(json.timestamp)
      },

      migrationsEnabledAtVersion: 1,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync error'
    lastSyncErrorAt = Date.now()
    setSyncError(message)
    console.warn('[sync] error:', message)
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
