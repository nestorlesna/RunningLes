'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Leaflet must be loaded client-side only (no SSR)
const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })

interface GpsPoint {
  id: string
  latitude: number
  longitude: number
  altitude: number | null
  speed_mps: number | null
  recorded_at: string
}

interface SessionDetail {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_pace_sec_per_km: number | null
  max_speed_mps: number | null
  avg_speed_mps: number | null
  elevation_gain_meters: number | null
  activity_type: string
  notes: string | null
  gpsPoints: GpsPoint[]
}

function formatDistance(meters: number | null) {
  if (!meters) return '—'
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
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

function formatSpeed(mps: number | null) {
  if (!mps) return '—'
  return `${(mps * 3.6).toFixed(1)} km/h`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session: authSession } } = await supabaseBrowser.auth.getSession()
      if (!authSession) {
        router.push('/login')
        return
      }

      const res = await fetch(`/api/sessions/${params.id}`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      })

      if (!res.ok) {
        setNotFound(true)
      } else {
        setSession(await res.json())
      }
      setLoading(false)
    }

    load()
  }, [params.id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm animate-pulse">Cargando…</div>
      </div>
    )
  }

  if (notFound || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Sesión no encontrada.</p>
        <Link href="/dashboard" className="text-brand text-sm hover:underline">
          Volver al dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-brand transition-colors mb-6 inline-block">
        ← Dashboard
      </Link>

      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{session.activity_type === 'run' ? '🏃' : '🚶'}</span>
          <h1 className="text-2xl font-bold capitalize">
            {session.activity_type === 'run' ? 'Carrera' : 'Caminata'}
          </h1>
        </div>
        <p className="text-gray-400 text-sm">{formatDate(session.started_at)}</p>
      </div>

      {/* Map */}
      {session.gpsPoints.length > 0 ? (
        <div className="h-72 sm:h-96 mb-6 rounded-xl overflow-hidden border border-gray-800">
          <RouteMap points={session.gpsPoints} />
        </div>
      ) : (
        <div className="h-32 mb-6 rounded-xl border border-gray-800 flex items-center justify-center text-gray-600 text-sm">
          Sin puntos GPS registrados
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Distancia" value={formatDistance(session.distance_meters)} />
        <StatCard label="Duración" value={formatDuration(session.duration_seconds)} />
        <StatCard label="Ritmo promedio" value={formatPace(session.avg_pace_sec_per_km)} />
        <StatCard label="Velocidad promedio" value={formatSpeed(session.avg_speed_mps)} />
        <StatCard label="Velocidad máxima" value={formatSpeed(session.max_speed_mps)} />
        <StatCard label="Puntos GPS" value={String(session.gpsPoints.length)} />
      </div>

      {/* Notes */}
      {session.notes && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Notas</p>
          <p className="text-sm text-gray-300">{session.notes}</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-brand">{value}</p>
    </div>
  )
}
