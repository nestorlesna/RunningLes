import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import { database } from '../database'
import GpsPoint from '../database/models/GpsPoint'
import { useSessionStore } from '../../store/sessionStore'
import { haversineDistance } from '@runningl-es/shared'

export const LOCATION_TASK_NAME = 'LOCATION_TRACKING'

interface LocationTaskData {
  locations: Location.LocationObject[]
}

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error) {
      console.error('[GPS task] error:', error.message)
      return
    }

    const { locations } = data
    if (!locations?.length) return

    const store = useSessionStore.getState()
    if (!store.isRunning || !store.sessionId) return

    const gpsCollection = database.get<GpsPoint>('gps_points')

    await database.write(async () => {
      for (const loc of locations) {
        const { latitude, longitude } = loc.coords
        const point = {
          latitude,
          longitude,
          altitude: loc.coords.altitude ?? null,
          accuracy: loc.coords.accuracy ?? null,
          speedMps: loc.coords.speed ?? null,
          heading: loc.coords.heading ?? null,
          recordedAt: loc.timestamp,
        }

        await gpsCollection.create((record) => {
          record.sessionId = store.sessionId!
          record.latitude = point.latitude
          record.longitude = point.longitude
          record.altitude = point.altitude
          record.accuracy = point.accuracy
          record.speedMps = point.speedMps
          record.heading = point.heading
          record.recordedAt = new Date(point.recordedAt)
        })

        store.addPoint(point)
      }
    })
  },
)
