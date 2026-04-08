import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSessionStore } from '../../store/sessionStore'
import { formatDuration, formatPace } from '@runningl-es/shared'

interface Props {
  onStop: () => void
}

export function ActiveSessionHUD({ onStop }: Props) {
  const { elapsedSeconds, totalDistanceMeters, currentSpeedMps, tickSecond } =
    useSessionStore()

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(tickSecond, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [tickSecond])

  const distanceKm = (totalDistanceMeters / 1000).toFixed(2)
  const pace = formatPace(currentSpeedMps)
  const duration = formatDuration(elapsedSeconds)

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <Stat label="Tiempo" value={duration} />
        <Stat label="Distancia" value={`${distanceKm} km`} />
        <Stat label="Ritmo" value={pace} />
      </View>

      <TouchableOpacity style={styles.stopButton} onPress={onStop} activeOpacity={0.8}>
        <Text style={styles.stopLabel}>DETENER</Text>
      </TouchableOpacity>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },
})
