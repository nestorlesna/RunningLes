'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { UserStats } from '@runningl-es/shared'

interface Session {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_pace_sec_per_km: number | null
  activity_type: string
}

function formatDistance(meters: number | null) {
  if (!meters) return '—'
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(secPerKm: number | null) {
  if (!secPerKm) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  useEffect(() => {
    async function loadInitial() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setUserEmail(session.user.email ?? '')
      setToken(session.access_token)

      const [sessRes, statsRes] = await Promise.all([
        fetch(`/api/sessions?limit=${LIMIT}&page=1`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/stats', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ])

      if (sessRes.ok) {
        const json = await sessRes.json()
        setSessions(json.sessions)
        setTotal(json.total)
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }

      setLoading(false)
    }

    loadInitial()
  }, [router])

  useEffect(() => {
    if (!token || page === 1) return
    async function loadPage() {
      setSessionsLoading(true)
      const res = await fetch(`/api/sessions?limit=${LIMIT}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setSessions(json.sessions)
        setTotal(json.total)
      }
      setSessionsLoading(false)
    }
    loadPage()
  }, [page, token])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    setDeletingId(id)

    const res = await fetch(`/api/sessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setTotal((t) => t - 1)
    }
    setDeletingId(null)
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm animate-pulse">Cargando…</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-2xl font-bold text-brand">RunningLes</span>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{userEmail}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Sesiones" value={String(stats.totalSessions)} />
          <StatCard label="Distancia total" value={formatDistance(stats.totalDistanceMeters)} />
          <StatCard label="Tiempo total" value={formatDuration(stats.totalDurationSeconds)} />
          <StatCard label="Mejor ritmo" value={formatPace(stats.bestPaceSecPerKm)} />
        </div>
      )}

      {/* Sessions list */}
      <h2 className="text-lg font-semibold mb-4">Historial</h2>

      {sessions.length === 0 && !sessionsLoading ? (
        <p className="text-gray-500 text-sm">No hay sesiones todavía.</p>
      ) : (
        <div className={`flex flex-col gap-3 transition-opacity duration-150 ${sessionsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <Link href={`/dashboard/sessions/${s.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-gray-800 text-gray-300 rounded px-2 py-0.5 uppercase tracking-wide">
                    {s.activity_type === 'run' ? '🏃 Carrera' : '🚶 Caminata'}
                  </span>
                  <span className="text-xs text-gray-500">{formatDate(s.started_at)}</span>
                </div>
                <div className="flex gap-4 text-sm mt-1">
                  <span className="text-white font-medium">{formatDistance(s.distance_meters)}</span>
                  <span className="text-gray-400">{formatDuration(s.duration_seconds)}</span>
                  <span className="text-gray-400">{formatPace(s.avg_pace_sec_per_km)}</span>
                </div>
              </Link>
              <button
                onClick={() => handleDelete(s.id)}
                disabled={deletingId === s.id}
                className="text-gray-600 hover:text-red-400 transition-colors text-lg disabled:opacity-40 shrink-0"
                title="Eliminar sesión"
              >
                {deletingId === s.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-gray-500">
            Página {page} de {totalPages} · {total} sesiones
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1 || sessionsLoading}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages || sessionsLoading}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-brand">{value}</p>
    </div>
  )
}
