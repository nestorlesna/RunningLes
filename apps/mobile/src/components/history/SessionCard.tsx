import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { formatDuration, formatPace } from '@runningl-es/shared'
import type { Session } from '@runningl-es/shared'

interface Props {
  session: Session
  onPress?: () => void
}

export function SessionCard({ session, onPress }: Props) {
  const date = new Date(session.startedAt)
  const dateStr = date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeStr = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const distanceKm = session.distanceMeters
    ? (session.distanceMeters / 1000).toFixed(2)
    : '—'

  const duration = session.durationSeconds
    ? formatDuration(session.durationSeconds)
    : '—'

  const pace = session.avgPaceSecPerKm
    ? formatPace(session.avgPaceSecPerKm > 0 ? 1000 / session.avgPaceSecPerKm : 0)
    : '–:– /km'

  const isRun = session.activityType === 'run'

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.header}>
        <View style={[styles.badge, isRun ? styles.badgeRun : styles.badgeWalk]}>
          <Text style={styles.badgeText}>{isRun ? '🏃 Carrera' : '🚶 Caminata'}</Text>
        </View>
        <Text style={styles.dateText}>
          {dateStr} · {timeStr}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Metric label="Distancia" value={`${distanceKm} km`} />
        <Metric label="Tiempo" value={duration} />
        <Metric label="Ritmo" value={pace} />
      </View>
    </TouchableOpacity>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeRun: { backgroundColor: '#166534' },
  badgeWalk: { backgroundColor: '#1e3a5f' },
  badgeText: { color: '#d1fae5', fontSize: 12, fontWeight: '600' },
  dateText: { color: '#64748b', fontSize: 12 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: { alignItems: 'center', gap: 2 },
  metricValue: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  metricLabel: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
