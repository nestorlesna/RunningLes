import { create } from 'zustand'
import { haversineDistance } from '@runningl-es/shared'
import type { GpsCoordinate, ActivityType } from '@runningl-es/shared'

interface SessionState {
  isRunning: boolean
  sessionId: string | null
  activityType: ActivityType
  currentPoints: GpsCoordinate[]
  elapsedSeconds: number
  totalDistanceMeters: number
  currentSpeedMps: number
  lastKmAnnounced: number
  lastMinAnnounced: number

  startSession: (sessionId: string, type: ActivityType) => void
  stopSession: () => void
  addPoint: (point: GpsCoordinate) => void
  tickSecond: () => void
  reset: () => void
}

const initialState = {
  isRunning: false,
  sessionId: null,
  activityType: 'run' as ActivityType,
  currentPoints: [] as GpsCoordinate[],
  elapsedSeconds: 0,
  totalDistanceMeters: 0,
  currentSpeedMps: 0,
  lastKmAnnounced: 0,
  lastMinAnnounced: 0,
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  startSession(sessionId, type) {
    set({
      ...initialState,
      isRunning: true,
      sessionId,
      activityType: type,
    })
  },

  stopSession() {
    set({ isRunning: false })
  },

  addPoint(point) {
    set((state) => {
      const prev = state.currentPoints.at(-1)
      const delta =
        prev != null
          ? haversineDistance(
              prev.latitude,
              prev.longitude,
              point.latitude,
              point.longitude,
            )
          : 0

      const newDistance = state.totalDistanceMeters + delta
      const newKm = Math.floor(newDistance / 1000)
      const kmAnnounced = newKm > state.lastKmAnnounced && newKm > 0
        ? newKm
        : state.lastKmAnnounced

      return {
        currentPoints: [...state.currentPoints, point],
        totalDistanceMeters: newDistance,
        currentSpeedMps: point.speedMps ?? state.currentSpeedMps,
        lastKmAnnounced: kmAnnounced,
      }
    })
  },

  tickSecond() {
    if (get().isRunning) {
      set((state) => {
        const newSeconds = state.elapsedSeconds + 1
        const newMinutes = Math.floor(newSeconds / 60)
        const isHalfHour = newMinutes > 0 && newMinutes % 30 === 0
        const minAnnounced = isHalfHour && newMinutes !== state.lastMinAnnounced
          ? newMinutes
          : state.lastMinAnnounced

        return { elapsedSeconds: newSeconds, lastMinAnnounced: minAnnounced }
      })
    }
  },

  reset() {
    set(initialState)
  },
}))
