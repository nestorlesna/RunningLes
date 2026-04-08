import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useSessionStore } from '../../src/store/sessionStore'
import { RunMap } from '../../src/components/map/RunMap'
import { ActiveSessionHUD } from '../../src/components/session/ActiveSessionHUD'
import { StartButton } from '../../src/components/session/StartButton'
import { stopTracking } from '../../src/services/location/locationService'

export default function RunScreen() {
  const { isRunning, currentPoints } = useSessionStore()

  async function handleStop() {
    await stopTracking()
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapContainer}>
        <RunMap points={currentPoints} isActive={isRunning} />
      </View>

      {isRunning ? (
        <ActiveSessionHUD onStop={handleStop} />
      ) : (
        <StartButton />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  mapContainer: { flex: 1 },
})
