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

      return {
        currentPoints: [...state.currentPoints, point],
        totalDistanceMeters: state.totalDistanceMeters + delta,
        currentSpeedMps: point.speedMps ?? state.currentSpeedMps,
      }
    })
  },

  tickSecond() {
    if (get().isRunning) {
      set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }))
    }
  },

  reset() {
    set(initialState)
  },
}))
