import { create } from 'zustand'

interface UIState {
  isSyncing: boolean
  lastSyncedAt: number | null
  syncError: string | null
  setSyncing: (value: boolean) => void
  setSyncSuccess: (timestamp: number) => void
  setSyncError: (error: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,

  setSyncing(value) {
    set({ isSyncing: value, syncError: null })
  },

  setSyncSuccess(timestamp) {
    set({ isSyncing: false, lastSyncedAt: timestamp, syncError: null })
  },

  setSyncError(error) {
    set({ isSyncing: false, syncError: error })
  },
}))
