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
  calories_burned: number | null
  activity_type: string
}

interface UserProfile {
  weight_kg: number | null
  birth_year: number | null
  sex: 'male' | 'female' | null
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
  const [stats, setStats] = useState<(UserStats & { totalCaloriesBurned?: number }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 20
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({ weight_kg: null, birth_year: null, sex: null })
  const [profileWeight, setProfileWeight] = useState('')
  const [profileBirthYear, setProfileBirthYear] = useState('')
  const [profileSex, setProfileSex] = useState<'male' | 'female' | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    async function loadInitial() {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setUserEmail(session.user.email ?? '')
      setToken(session.access_token)

      const [sessRes, statsRes, profileRes] = await Promise.all([
        fetch(`/api/sessions?limit=${LIMIT}&page=1`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/stats', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/profile', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ])

      if (sessRes.ok) {
        const json = await sessRes.json()
        setSessions(json.sessions)
        setTotal(json.total)
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
      if (profileRes.ok) {
        const p: UserProfile = await profileRes.json()
        setProfile(p)
        setProfileWeight(p.weight_kg != null ? String(p.weight_kg) : '')
        setProfileBirthYear(p.birth_year != null ? String(p.birth_year) : '')
        setProfileSex(p.sex)
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

  async function handleSaveProfile() {
    const w = parseFloat(profileWeight)
    const by = parseInt(profileBirthYear, 10)
    if (profileWeight && (isNaN(w) || w < 20 || w > 300)) {
      setProfileMsg('Peso inválido (20–300 kg)')
      return
    }
    if (profileBirthYear && (isNaN(by) || by < 1920 || by > new Date().getFullYear() - 5)) {
      setProfileMsg('Año de nacimiento inválido')
      return
    }

    setSavingProfile(true)
    setProfileMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        weight_kg: profileWeight ? w : null,
        birth_year: profileBirthYear ? by : null,
        sex: profileSex,
      }),
    })
    setSavingProfile(false)
    if (res.ok) {
      const updated: UserProfile = await res.json()
      setProfile(updated)
      setProfileMsg('Perfil guardado')
      setTimeout(() => setProfileMsg(''), 2500)
    } else {
      setProfileMsg('Error al guardar')
    }
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Sesiones" value={String(stats.totalSessions)} />
          <StatCard label="Distancia total" value={formatDistance(stats.totalDistanceMeters)} />
          <StatCard label="Tiempo total" value={formatDuration(stats.totalDurationSeconds)} />
          <StatCard label="Mejor ritmo" value={formatPace(stats.bestPaceSecPerKm)} />
          {(stats.totalCaloriesBurned ?? 0) > 0 && (
            <StatCard label="Calorías totales" value={`${stats.totalCaloriesBurned?.toLocaleString('es-AR')} kcal`} />
          )}
        </div>
      )}

      {/* Profile panel */}
      <div className="mb-8">
        <button
          onClick={() => setShowProfile((v) => !v)}
          className="text-sm text-gray-400 hover:text-white transition-colors mb-3 flex items-center gap-1"
        >
          {showProfile ? '▲' : '▼'} Datos físicos {!profile.weight_kg && <span className="text-yellow-500 text-xs ml-1">· Sin configurar (calorías desactivadas)</span>}
        </button>
        {showProfile && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
            <p className="text-xs text-gray-500">Se usan para estimar las calorías de cada sesión. Se sincroniza automáticamente con la app móvil.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Peso (kg)</label>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={profileWeight}
                  onChange={(e) => setProfileWeight(e.target.value)}
                  placeholder="Ej: 72"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Año de nacimiento</label>
                <input
                  type="number"
                  min={1920}
                  max={new Date().getFullYear() - 5}
                  value={profileBirthYear}
                  onChange={(e) => setProfileBirthYear(e.target.value)}
                  placeholder="Ej: 1990"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Sexo biológico</label>
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setProfileSex(profileSex === s ? null : s)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${profileSex === s ? 'border-brand text-brand bg-green-950' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                    >
                      {s === 'male' ? 'Masculino' : 'Femenino'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="bg-brand text-black font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {savingProfile ? 'Guardando…' : 'Guardar'}
              </button>
              {profileMsg && (
                <span className={`text-sm ${profileMsg.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
                  {profileMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

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
                <div className="flex gap-4 text-sm mt-1 flex-wrap">
                  <span className="text-white font-medium">{formatDistance(s.distance_meters)}</span>
                  <span className="text-gray-400">{formatDuration(s.duration_seconds)}</span>
                  <span className="text-gray-400">{formatPace(s.avg_pace_sec_per_km)}</span>
                  {s.calories_burned != null && (
                    <span className="text-orange-400">{s.calories_burned} kcal</span>
                  )}
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
