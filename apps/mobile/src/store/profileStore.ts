import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface ProfileData {
  weightKg: number | null
  birthYear: number | null
  sex: 'male' | 'female' | null
}

interface ProfileState extends ProfileData {
  setProfile: (data: Partial<ProfileData>) => void
  reset: () => void
}

const defaults: ProfileData = {
  weightKg: null,
  birthYear: null,
  sex: null,
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...defaults,
      setProfile(data) {
        set((s) => ({ ...s, ...data }))
      },
      reset() {
        set(defaults)
      },
    }),
    {
      name: 'user-profile',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
