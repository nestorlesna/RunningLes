import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { RunMap } from '../../src/components/map/RunMap'
import { database } from '../../src/services/database'
import Session from '../../src/services/database/models/Session'
import GpsPoint from '../../src/services/database/models/GpsPoint'
import { formatDuration, formatPace } from '@runningl-es/shared'
import type { GpsCoordinate } from '@runningl-es/shared'

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [points, setPoints] = useState<GpsCoordinate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const sessionCol = database.get<Session>('sessions')
        const record = await sessionCol.find(id)
        const gpsRecords = await record.gpsPoints.fetch()

        setSession(record)
        setPoints(
          gpsRecords
            .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
            .map((p) => ({
              latitude: p.latitude,
              longitude: p.longitude,
              altitude: p.altitude,
              accuracy: p.accuracy,
              speedMps: p.speedMps,
              heading: p.heading,
              recordedAt: p.recordedAt.getTime(),
            })),
        )
      } catch {
        Alert.alert('Error', 'No se encontró la sesión.')
        router.back()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function handleDelete() {
    Alert.alert(
      'Eliminar sesión',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await database.write(async () => {
              await session?.destroyPermanently()
            })
            router.back()
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </View>
    )
  }

  if (!session) return null

  const distanceKm = session.distanceMeters
    ? (session.distanceMeters / 1000).toFixed(2)
    : '—'
  const duration = session.durationSeconds
    ? formatDuration(session.durationSeconds)
    : '—'
  const pace = session.avgPaceSecPerKm
    ? formatPace(session.avgPaceSecPerKm > 0 ? 1000 / session.avgPaceSecPerKm : 0)
    : '–:– /km'

  return (
    <View style={styles.root}>
      {/* Map — top half */}
      <View style={styles.mapContainer}>
        <RunMap points={points} isActive={false} />
      </View>

      {/* Back button overlay */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backLabel}>← Volver</Text>
      </TouchableOpacity>

      {/* Details panel */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.dateText}>
          {session.startedAt.toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
        <Text style={styles.typeText}>
          {session.activityType === 'run' ? '🏃 Carrera' : session.activityType === 'bike' ? '🚴 Ciclismo' : '🚶 Caminata'}
        </Text>

        <View style={styles.statsRow}>
          <Stat label="Distancia" value={`${distanceKm} km`} />
          <Stat label="Tiempo" value={duration} />
          <Stat label="Ritmo prom." value={pace} />
        </View>

        <View style={styles.statsRow}>
          {session.maxSpeedMps != null && (
            <Stat
              label="Vel. máx."
              value={`${(session.maxSpeedMps * 3.6).toFixed(1)} km/h`}
            />
          )}
          {session.caloriesBurned != null && (
            <Stat label="Calorías" value={`${session.caloriesBurned} kcal`} />
          )}
          <Stat label="Puntos GPS" value={String(points.length)} />
        </View>

        {session.notes ? (
          <Text style={styles.notes}>{session.notes}</Text>
        ) : null}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteLabel}>Eliminar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
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
  root: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  mapContainer: { flex: 1 },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    backgroundColor: 'rgba(15,23,42,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backLabel: { color: '#f1f5f9', fontWeight: '600' },
  panel: { maxHeight: '45%', backgroundColor: '#0f172a' },
  panelContent: { padding: 20, gap: 12 },
  dateText: { color: '#94a3b8', fontSize: 13 },
  typeText: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  notes: { color: '#94a3b8', fontSize: 14, fontStyle: 'italic', paddingHorizontal: 4 },
  deleteBtn: {
    marginTop: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteLabel: { color: '#f87171', fontWeight: '600' },
})
