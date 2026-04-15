import * as Location from 'expo-location'
import { LOCATION_TASK_NAME } from './backgroundTask'
import { database } from '../database'
import Session from '../database/models/Session'
import { useSessionStore } from '../../store/sessionStore'
import type { ActivityType } from '@runningl-es/shared'

const LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 5,
  foregroundService: {
    notificationTitle: 'Sesión activa',
    notificationBody: 'GPS registrando tu recorrido…',
    notificationColor: '#22c55e',
  },
  // Keep tracking when screen is off
  pausesUpdatesAutomatically: false,
}

export async function startTracking(activityType: ActivityType): Promise<void> {
  // 1. Foreground permission
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
  if (fgStatus !== 'granted') {
    throw new Error('Se requiere permiso de ubicación para iniciar la sesión.')
  }

  // 2. Background permission
  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync()
  if (bgStatus !== 'granted') {
    throw new Error(
      'Se requiere permiso de ubicación en segundo plano. Activalo en Ajustes > Aplicaciones > RunningLes > Ubicación > Permitir siempre.',
    )
  }

  // 3. Create session record in WatermelonDB
  const sessionCollection = database.get<Session>('sessions')
  const localId = `local_${Date.now()}`

  let sessionId: string | null = null
  await database.write(async () => {
    const session = await sessionCollection.create((record) => {
      record.localId = localId
      record.startedAt = new Date()
      record.activityType = activityType
      record.synced = false
      record.rawPoints = '[]'
    })
    sessionId = session.id
  })

  // 4. Start Zustand session (before GPS so first point is captured correctly)
  useSessionStore.getState().startSession(sessionId!, activityType)

  // 5. Start background GPS
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_OPTIONS)
}

export async function stopTracking(): Promise<void> {
  const store = useSessionStore.getState()
  if (!store.sessionId) return

  // 1. Stop GPS
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
  }

  // 2. Finalize session in WatermelonDB
  const {
    sessionId,
    totalDistanceMeters,
    currentSpeedMps,
    currentPoints,
  } = store

  const sessionCollection = database.get<Session>('sessions')
  const session = await sessionCollection.find(sessionId!)

  // Calculate duration from real wall-clock timestamps instead of JS interval ticks,
  // which can drift or pause when the app is backgrounded or the HUD unmounts.
  const durationSeconds = Math.round((Date.now() - session.startedAt.getTime()) / 1000)

  const speeds = currentPoints
    .map((p) => p.speedMps)
    .filter((s): s is number => s != null && s > 0)
  const avgSpeedMps =
    speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0
  const maxSpeedMps = speeds.length > 0 ? Math.max(...speeds) : 0
  const avgPaceSecPerKm = avgSpeedMps > 0 ? 1000 / avgSpeedMps : null

  await session.finalize(
    durationSeconds,
    totalDistanceMeters,
    avgPaceSecPerKm ?? 0,
    maxSpeedMps,
    avgSpeedMps,
  )

  // 3. Reset store
  store.stopSession()
}

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
}
