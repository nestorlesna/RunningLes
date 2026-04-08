import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { startSyncListeners, stopSyncListeners } from '../src/services/database/sync'
// Import background task definition so it's registered on app start
import '../src/services/location/backgroundTask'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync()
    startSyncListeners()
    return () => stopSyncListeners()
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
