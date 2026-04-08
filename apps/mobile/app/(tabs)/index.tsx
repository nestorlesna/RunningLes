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

const API_BASE_URL: string = Constants.expoConfig?.extra?.apiBaseUrl ?? ''

export default function DashboardScreen() {
  const { isSyncing, lastSyncedAt, syncError } = useUIStore()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchStats() {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch(`${API_BASE_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setStats(await res.json())
    } catch {
      // Fail silently — data comes from local DB otherwise
    }
  }

  useEffect(() => {
    fetchStats().finally(() => setLoading(false))
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await syncDatabase()
    await fetchStats()
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
