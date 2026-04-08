import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SessionCard } from '../../src/components/history/SessionCard'
import { database } from '../../src/services/database'
import Session from '../../src/services/database/models/Session'
import { Q } from '@nozbe/watermelondb'
import type { Session as SessionType } from '@runningl-es/shared'

export default function HistoryScreen() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionType[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadSessions() {
    const col = database.get<Session>('sessions')
    const records = await col
      .query(Q.sortBy('started_at', Q.desc))
      .fetch()

    setSessions(
      records.map((r) => ({
        id: r.id,
        localId: r.localId,
        userId: '',
        startedAt: r.startedAt.toISOString(),
        endedAt: r.endedAt?.toISOString() ?? null,
        durationSeconds: r.durationSeconds,
        distanceMeters: r.distanceMeters,
        avgPaceSecPerKm: r.avgPaceSecPerKm,
        maxSpeedMps: r.maxSpeedMps,
        avgSpeedMps: r.avgSpeedMps,
        elevationGainMeters: r.elevationGainMeters,
        activityType: r.activityType,
        notes: r.notes,
        syncedAt: null,
        createdAt: r.startedAt.toISOString(),
      })),
    )
  }

  useEffect(() => {
    loadSessions().finally(() => setLoading(false))
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await loadSessions()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Historial</Text>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() => router.push(`/session/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay sesiones registradas.</Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#22c55e"
          />
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a', paddingTop: 56 },
  center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800', paddingHorizontal: 20, marginBottom: 8 },
  list: { paddingBottom: 24 },
  empty: { color: '#475569', textAlign: 'center', marginTop: 60 },
})
