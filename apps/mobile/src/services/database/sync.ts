import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from './index'
import Session from './models/Session'
import { supabase } from '../../lib/supabase'
import { useUIStore } from '../../store/uiStore'

const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function syncDatabase(): Promise<void> {
  const { setSyncing, setSyncSuccess, setSyncError } = useUIStore.getState()

  // Avoid concurrent syncs
  if (useUIStore.getState().isSyncing) return

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
        setSyncSuccess(json.timestamp)
      },

      migrationsEnabledAtVersion: 1,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync error'
    setSyncError(message)
    console.warn('[sync] error:', message)
  }
}

// ---------------------------------------------------------------------------
// Pull from server — updates only sessions that already exist locally
// ---------------------------------------------------------------------------

interface ServerSession {
  id: string
  activity_type: string
  notes: string | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_pace_sec_per_km: number | null
  max_speed_mps: number | null
  avg_speed_mps: number | null
}

export async function pullFromServer(): Promise<void> {
  const { setPulling, setPullSuccess, setPullError } = useUIStore.getState()

  if (useUIStore.getState().isPulling) return

  if (!API_BASE_URL) {
    setPullError('URL del servidor no configurada — rebuild la app')
    return
  }

  const token = await getAccessToken()
  if (!token) {
    setPullError('Sin sesión activa — iniciá sesión para sincronizar')
    return
  }

  setPulling(true)

  try {
    // 1. Collect IDs of all sessions already on this device that have been synced
    //    (synced === true means the server knows about them)
    const sessionCollection = database.get<Session>('sessions')
    const localSessions = await sessionCollection.query().fetch()
    const syncedIds = localSessions.filter((s) => s.synced).map((s) => s.id)

    if (syncedIds.length === 0) {
      setPullSuccess(0)
      return
    }

    // 2. Fetch current server state for those IDs only
    const res = await fetch(`${API_BASE_URL}/api/sessions/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: syncedIds }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Pull failed: ${res.status} ${body}`)
    }

    const { sessions: serverSessions }: { sessions: ServerSession[] } = await res.json()

    if (serverSessions.length === 0) {
      setPullSuccess(0)
      return
    }

    // 3. Build a lookup map for fast access
    const serverMap = new Map<string, ServerSession>(
      serverSessions.map((s) => [s.id, s]),
    )

    // 4. Update only local sessions whose server data differs
    let updatedCount = 0
    await database.write(async () => {
      for (const local of localSessions) {
        const server = serverMap.get(local.id)
        if (!server) continue

        const changed =
          local.activityType !== server.activity_type ||
          (local.notes ?? null) !== (server.notes ?? null) ||
          local.durationSeconds !== server.duration_seconds ||
          local.distanceMeters !== server.distance_meters ||
          local.avgPaceSecPerKm !== server.avg_pace_sec_per_km ||
          local.maxSpeedMps !== server.max_speed_mps ||
          local.avgSpeedMps !== server.avg_speed_mps

        if (!changed) continue

        await local.update((record) => {
          record.activityType = server.activity_type as Session['activityType']
          record.notes = server.notes
          record.durationSeconds = server.duration_seconds
          record.distanceMeters = server.distance_meters
          record.avgPaceSecPerKm = server.avg_pace_sec_per_km
          record.maxSpeedMps = server.max_speed_mps
          record.avgSpeedMps = server.avg_speed_mps
        })
        updatedCount++
      }
    })

    setPullSuccess(updatedCount)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    setPullError(message)
    console.warn('[pullFromServer] error:', message)
  }
}

