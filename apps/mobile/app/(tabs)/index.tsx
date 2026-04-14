import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useUIStore } from '../../src/store/uiStore'
import { syncDatabase } from '../../src/services/database/sync'
import { formatDuration } from '@runningl-es/shared'
import type { UserStats } from '@runningl-es/shared'
import Constants from 'expo-constants'
import { supabase } from '../../src/lib/supabase'
import { database } from '../../src/services/database'
import Session from '../../src/services/database/models/Session'
import { Q } from '@nozbe/watermelondb'

const API_BASE_URL: string = Constants.expoConfig?.extra?.apiBaseUrl ?? ''

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

async function computeLocalStats(): Promise<UserStats> {
  const col = database.get<Session>('sessions')
  const records = await col.query(Q.where('ended_at', Q.notEq(null))).fetch()

  let totalDistanceMeters = 0
  let totalDurationSeconds = 0
  let bestPaceSecPerKm: number | null = null
  const weekMap: Record<string, number> = {}

  for (const r of records) {
    totalDistanceMeters += r.distanceMeters ?? 0
    totalDurationSeconds += r.durationSeconds ?? 0

    if (r.avgPaceSecPerKm && r.avgPaceSecPerKm > 0) {
      if (bestPaceSecPerKm === null || r.avgPaceSecPerKm < bestPaceSecPerKm) {
        bestPaceSecPerKm = r.avgPaceSecPerKm
      }
    }

    const week = getWeekStart(r.startedAt)
    weekMap[week] = (weekMap[week] ?? 0) + (r.distanceMeters ?? 0)
  }

  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)
  const weeklyDistance = Object.entries(weekMap)
    .filter(([w]) => w >= eightWeeksAgo.toISOString().slice(0, 10))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, distanceMeters]) => ({ weekStart, distanceMeters }))

  const pacedSessions = records.filter((r) => r.avgPaceSecPerKm && r.avgPaceSecPerKm > 0)
  const avgPaceSecPerKm =
    pacedSessions.length > 0
      ? pacedSessions.reduce((sum, r) => sum + (r.avgPaceSecPerKm ?? 0), 0) / pacedSessions.length
      : null

  return {
    totalSessions: records.length,
    totalDistanceMeters,
    totalDurationSeconds,
    avgPaceSecPerKm,
    bestPaceSecPerKm,
    weeklyDistance,
  }
}

export default function DashboardScreen() {
  const { isSyncing, lastSyncedAt, syncError } = useUIStore()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function loadStats() {
    // Load local stats first so the screen always shows data
    const local = await computeLocalStats()
    setStats(local)

    // Try to refresh from API in the background
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch(`${API_BASE_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setStats(await res.json())
    } catch {
      // Fail silently — local stats are already shown
    }
  }

  useEffect(() => {
    loadStats().finally(() => setLoading(false))
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await syncDatabase()
    await loadStats()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#22c55e"
        />
      }
    >
      <Text style={styles.title}>RunningLes</Text>

      {/* Sync status */}
      <View style={styles.syncRow}>
        {isSyncing && <ActivityIndicator size="small" color="#22c55e" />}
        {syncError && <Text style={styles.syncError}>⚠ {syncError}</Text>}
        {lastSyncedAt && !isSyncing && (
          <Text style={styles.syncOk}>
            ✓ Sync {new Date(lastSyncedAt).toLocaleTimeString('es-AR')}
          </Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#22c55e" />
      ) : stats ? (
        <>
          <View style={styles.statGrid}>
            <StatTile
              label="Sesiones"
              value={String(stats.totalSessions)}
            />
            <StatTile
              label="Distancia total"
              value={`${(stats.totalDistanceMeters / 1000).toFixed(1)} km`}
            />
            <StatTile
              label="Tiempo total"
              value={formatDuration(stats.totalDurationSeconds)}
            />
            <StatTile
              label="Mejor ritmo"
              value={
                stats.bestPaceSecPerKm
                  ? formatPaceFromSecPerKm(stats.bestPaceSecPerKm)
                  : '–'
              }
            />
          </View>

          {stats.weeklyDistance.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Últimas 8 semanas</Text>
              {stats.weeklyDistance.map((w) => (
                <WeekBar key={w.weekStart} item={w} />
              ))}
            </View>
          )}
        </>
      ) : (
        <Text style={styles.empty}>Sin datos. Iniciá tu primera sesión.</Text>
      )}
    </ScrollView>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function WeekBar({ item }: { item: { weekStart: string; distanceMeters: number } }) {
  const km = (item.distanceMeters / 1000).toFixed(1)
  const date = new Date(item.weekStart).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
  return (
    <View style={styles.weekRow}>
      <Text style={styles.weekDate}>{date}</Text>
      <Text style={styles.weekKm}>{km} km</Text>
    </View>
  )
}

function formatPaceFromSecPerKm(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingTop: 56, gap: 20 },
  title: { color: '#f8fafc', fontSize: 28, fontWeight: '800' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 },
  syncError: { color: '#f87171', fontSize: 12 },
  syncOk: { color: '#4ade80', fontSize: 12 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statTile: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  statValue: { color: '#f1f5f9', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 12 },
  section: { gap: 8 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  weekDate: { color: '#94a3b8', fontSize: 13 },
  weekKm: { color: '#f1f5f9', fontSize: 13, fontWeight: '600' },
  empty: { color: '#475569', textAlign: 'center', marginTop: 40 },
})
