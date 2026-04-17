'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { GpsChart } from '@/components/GpsChart'

const PointsMap = dynamic(() => import('@/components/PointsMap'), { ssr: false })

// ─── Types ───────────────────────────────────────────────────────────────────

interface GpsPoint {
  id: string
  session_id: string
  recorded_at: string
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speed_mps: number | null
  heading: number | null
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

// ─── Formatters ──────────────────────────────────────────────────────────────

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

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'Carrera',
  walk: 'Caminata',
  bike: 'Ciclismo',
  other: 'Otro',
}

const ACTIVITY_EMOJI: Record<string, string> = {
  run: '🏃',
  walk: '🚶',
  bike: '🚴',
  other: '🏋️',
}

// ─── Haversine ───────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Compute distance (in meters) from previous point for each point.
 *  Index 0 → 0. Returns distances array and the anomalous indices set.
 *  A gap is anomalous when dist > threshold × median of all gaps. */
function computeGaps(
  points: GpsPoint[],
  threshold = 2
): { distances: number[]; anomalousSet: Set<number> } {
  if (points.length < 2) {
    return { distances: points.map(() => 0), anomalousSet: new Set() }
  }

  const distances = points.map((p, i) => {
    if (i === 0) return 0
    return haversine(points[i - 1].latitude, points[i - 1].longitude, p.latitude, p.longitude)
  })

  const gaps = distances.slice(1) // exclude first (0)
  const sorted = [...gaps].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]

  const anomalousSet = new Set<number>()
  distances.forEach((d, i) => {
    if (i > 0 && d > threshold * median) anomalousSet.add(i)
  })

  return { distances, anomalousSet }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [token, setToken] = useState<string>('')

  // Edit session fields
  const [editMode, setEditMode] = useState(false)
  const [editActivityType, setEditActivityType] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // GPS point inline edit
  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')
  const [savingPoint, setSavingPoint] = useState(false)
  const [deletingPointId, setDeletingPointId] = useState<string | null>(null)
  const [pointError, setPointError] = useState<string | null>(null)

  // GPS table collapse
  const [gpsExpanded, setGpsExpanded] = useState(false)

  // Chart collapse states
  const [speedExpanded, setSpeedExpanded] = useState(false)
  const [distExpanded, setDistExpanded] = useState(false)
  const [altExpanded, setAltExpanded] = useState(false)

  // Map/table cross-highlight
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  // ── Load ──
  useEffect(() => {
    async function load() {
      const {
        data: { session: authSession },
      } = await supabaseBrowser.auth.getSession()
      if (!authSession) {
        router.push('/login')
        return
      }
      setToken(authSession.access_token)

      const res = await fetch(`/api/sessions/${params.id}`, {
        headers: { Authorization: `Bearer ${authSession.access_token}` },
      })

      if (!res.ok) {
        setNotFound(true)
      } else {
        const data: SessionDetail = await res.json()
        setSession(data)
        setEditActivityType(data.activity_type)
        setEditNotes(data.notes ?? '')
      }
      setLoading(false)
    }
    load()
  }, [params.id, router])

  // ── Anomaly computation ──
  const { distances, anomalousSet } = useMemo(
    () => computeGaps(session?.gpsPoints ?? []),
    [session?.gpsPoints]
  )

  // ── Chart data ──
  const t0 = session?.gpsPoints[0]
    ? new Date(session.gpsPoints[0].recorded_at).getTime()
    : 0

  const speedChartData = useMemo(() => {
    if (!session) return []
    return session.gpsPoints
      .filter((p) => p.speed_mps !== null && p.speed_mps >= 0)
      .map((p) => ({
        t: (new Date(p.recorded_at).getTime() - t0) / 1000,
        v: p.speed_mps! * 3.6,
      }))
  }, [session?.gpsPoints, t0])

  const distanceChartData = useMemo(() => {
    if (!session) return []
    let acc = 0
    return session.gpsPoints.map((p, i) => {
      acc += distances[i] ?? 0
      return {
        t: (new Date(p.recorded_at).getTime() - t0) / 1000,
        v: acc / 1000,
      }
    })
  }, [session?.gpsPoints, distances, t0])

  const altitudeChartData = useMemo(() => {
    if (!session) return []
    return session.gpsPoints
      .filter((p) => p.altitude !== null)
      .map((p) => ({
        t: (new Date(p.recorded_at).getTime() - t0) / 1000,
        v: p.altitude!,
      }))
  }, [session?.gpsPoints, t0])

  // ── Save session metadata ──
  async function handleSaveSession() {
    if (!session) return
    setSaving(true)
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ activity_type: editActivityType, notes: editNotes }),
    })
    if (res.ok) {
      const updated = await res.json()
      setSession((s) => s && { ...s, activity_type: updated.activity_type, notes: updated.notes })
      setEditMode(false)
    }
    setSaving(false)
  }

  // ── Get a fresh token (refreshes if expired) ──
  async function getFreshToken(): Promise<string> {
    const { data: { session: s } } = await supabaseBrowser.auth.getSession()
    return s?.access_token ?? token
  }

  // ── Delete GPS point ──
  async function handleDeletePoint(pointId: string) {
    if (!confirm('¿Eliminar este punto GPS?')) return
    setPointError(null)
    setDeletingPointId(pointId)
    const freshToken = await getFreshToken()
    try {
      const res = await fetch(`/api/gps-points/${pointId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${freshToken}` },
      })
      if (res.ok) {
        setSession((s) =>
          s ? { ...s, gpsPoints: s.gpsPoints.filter((p) => p.id !== pointId) } : s
        )
        setSelectedIndex(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setPointError(`Error al borrar (${res.status}): ${body?.error ?? 'Error desconocido'}`)
        console.error('[DELETE gps-point]', res.status, body)
      }
    } catch (err) {
      setPointError('Error de red al borrar el punto.')
      console.error('[DELETE gps-point] fetch error', err)
    }
    setDeletingPointId(null)
  }

  // ── Save edited GPS point ──
  async function handleSavePoint(pointId: string) {
    const lat = parseFloat(editLat)
    const lng = parseFloat(editLng)
    if (isNaN(lat) || isNaN(lng)) return
    setPointError(null)
    setSavingPoint(true)
    const freshToken = await getFreshToken()
    try {
      const res = await fetch(`/api/gps-points/${pointId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSession((s) =>
          s
            ? {
                ...s,
                gpsPoints: s.gpsPoints.map((p) =>
                  p.id === pointId
                    ? { ...p, latitude: updated.latitude, longitude: updated.longitude }
                    : p
                ),
              }
            : s
        )
        setEditingPointId(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setPointError(`Error al guardar (${res.status}): ${body?.error ?? 'Error desconocido'}`)
        console.error('[PATCH gps-point]', res.status, body)
      }
    } catch (err) {
      setPointError('Error de red al guardar el punto.')
      console.error('[PATCH gps-point] fetch error', err)
    }
    setSavingPoint(false)
  }

  // ── Select point from map → scroll table ──
  function handleMapSelect(index: number) {
    setSelectedIndex(index)
    const point = session?.gpsPoints[index]
    if (point && rowRefs.current[point.id]) {
      rowRefs.current[point.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

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

  const anomalyCount = anomalousSet.size

  function formatChartTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    if (m >= 60) {
      const h = Math.floor(m / 60)
      return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back */}
      <Link
        href="/dashboard"
        className="text-sm text-gray-400 hover:text-brand transition-colors mb-6 inline-block"
      >
        ← Dashboard
      </Link>

      {/* ── Header / Edit form ── */}
      {editMode ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6">
          <h2 className="text-sm text-gray-400 mb-4 font-medium">Editar sesión</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo de actividad</label>
              <select
                value={editActivityType}
                onChange={(e) => setEditActivityType(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-brand"
              >
                <option value="run">Carrera</option>
                <option value="walk">Caminata</option>
                <option value="bike">Ciclismo</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notas</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:border-brand resize-none"
                placeholder="Notas opcionales…"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveSession}
                disabled={saving}
                className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="text-gray-400 text-sm px-4 py-2 rounded-lg hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">
                {ACTIVITY_EMOJI[session.activity_type] ?? '🏋️'}
              </span>
              <h1 className="text-2xl font-bold">
                {ACTIVITY_LABELS[session.activity_type] ?? session.activity_type}
              </h1>
            </div>
            <p className="text-gray-400 text-sm">{formatDate(session.started_at)}</p>
            {session.notes && (
              <p className="text-gray-300 text-sm mt-2 max-w-lg">{session.notes}</p>
            )}
          </div>
          <button
            onClick={() => setEditMode(true)}
            className="text-xs text-gray-400 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 hover:text-white transition-colors"
          >
            Editar
          </button>
        </div>
      )}

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Distancia" value={formatDistance(session.distance_meters)} />
        <StatCard label="Duración" value={formatDuration(session.duration_seconds)} />
        <StatCard label="Ritmo promedio" value={formatPace(session.avg_pace_sec_per_km)} />
        <StatCard label="Vel. promedio" value={formatSpeed(session.avg_speed_mps)} />
        <StatCard label="Vel. máxima" value={formatSpeed(session.max_speed_mps)} />
        <StatCard label="Puntos GPS" value={String(session.gpsPoints.length)} />
      </div>

      {/* ── Map ── */}
      <div className="h-80 sm:h-96 mb-6 rounded-xl overflow-hidden border border-gray-800">
        {session.gpsPoints.length > 0 ? (
          <PointsMap
            points={session.gpsPoints}
            anomalousSet={anomalousSet}
            selectedIndex={selectedIndex}
            onSelect={handleMapSelect}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 text-sm">
            Sin puntos GPS registrados
          </div>
        )}
      </div>

      {/* ── GPS Points table ── */}
      {session.gpsPoints.length > 0 && (
        <div>
          <button
            onClick={() => setGpsExpanded((v) => !v)}
            className="w-full flex items-center justify-between mb-3 group"
          >
            <h2 className="text-base font-semibold group-hover:text-brand transition-colors">
              Puntos GPS
            </h2>
            <div className="flex items-center gap-3">
              {!gpsExpanded && anomalyCount > 0 && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  {anomalyCount} anomalía{anomalyCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-xs text-gray-500 flex items-center gap-1">
                {session.gpsPoints.length} puntos
                <span className="text-gray-500 text-base leading-none">
                  {gpsExpanded ? '▲' : '▼'}
                </span>
              </span>
            </div>
          </button>

          {gpsExpanded && (
            <>
              {pointError && (
                <div className="mb-3 px-3 py-2 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300 flex items-center justify-between gap-2">
                  <span>{pointError}</span>
                  <button onClick={() => setPointError(null)} className="text-red-400 hover:text-red-200 font-bold leading-none">✕</button>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                  Normal
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                  Anomalía ({anomalyCount})
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Hora</th>
                  <th className="px-3 py-2.5 font-medium">Latitud</th>
                  <th className="px-3 py-2.5 font-medium">Longitud</th>
                  <th className="px-3 py-2.5 font-medium">Alt (m)</th>
                  <th className="px-3 py-2.5 font-medium">Vel</th>
                  <th className="px-3 py-2.5 font-medium">Dist. prev</th>
                  <th className="px-3 py-2.5 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {session.gpsPoints.map((point, i) => {
                  const isAnomaly = anomalousSet.has(i)
                  const isSelected = i === selectedIndex
                  const distPrev = distances[i]
                  const isEditing = editingPointId === point.id

                  return (
                    <tr
                      key={point.id}
                      ref={(el) => { rowRefs.current[point.id] = el }}
                      onClick={() => !isEditing && setSelectedIndex(i)}
                      className={[
                        'border-b border-gray-800/60 cursor-pointer transition-colors',
                        isSelected ? 'bg-gray-700/60' : isAnomaly ? 'bg-red-950/30' : 'hover:bg-gray-800/40',
                      ].join(' ')}
                    >
                      <td className="px-3 py-2 text-gray-400">
                        {isAnomaly ? (
                          <span className="text-red-400 font-bold">{i + 1}</span>
                        ) : (
                          i + 1
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                        {new Date(point.recorded_at).toLocaleTimeString('es-AR')}
                      </td>

                      {/* Lat / Lng — editable */}
                      {isEditing ? (
                        <>
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.000001"
                              value={editLat}
                              onChange={(e) => setEditLat(e.target.value)}
                              className="w-28 bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-brand"
                            />
                          </td>
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              step="0.000001"
                              value={editLng}
                              onChange={(e) => setEditLng(e.target.value)}
                              className="w-28 bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-brand"
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-mono text-gray-300">
                            {point.latitude.toFixed(6)}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-300">
                            {point.longitude.toFixed(6)}
                          </td>
                        </>
                      )}

                      <td className="px-3 py-2 text-gray-400">
                        {point.altitude !== null ? Math.round(point.altitude) : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-400">
                        {point.speed_mps !== null ? `${(point.speed_mps * 3.6).toFixed(1)}` : '—'}
                      </td>

                      {/* Distance from previous */}
                      <td className="px-3 py-2">
                        {i === 0 ? (
                          <span className="text-gray-600">—</span>
                        ) : (
                          <span
                            className={
                              isAnomaly
                                ? 'text-red-400 font-bold'
                                : 'text-gray-400'
                            }
                          >
                            {distPrev >= 1000
                              ? `${(distPrev / 1000).toFixed(2)} km`
                              : `${Math.round(distPrev)} m`}
                            {isAnomaly && ' ⚠️'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-3 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSavePoint(point.id)}
                                disabled={savingPoint}
                                className="text-brand hover:text-green-400 font-medium disabled:opacity-50"
                              >
                                {savingPoint ? '…' : 'Guardar'}
                              </button>
                              <button
                                onClick={() => setEditingPointId(null)}
                                className="text-gray-500 hover:text-gray-300"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingPointId(point.id)
                                  setEditLat(String(point.latitude))
                                  setEditLng(String(point.longitude))
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDeletePoint(point.id)}
                                disabled={deletingPointId === point.id}
                                className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                              >
                                {deletingPointId === point.id ? '…' : 'Borrar'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Hacé click en un punto de la tabla o del mapa para resaltarlo.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Charts ── */}
      {session.gpsPoints.length > 1 && (
        <div className="flex flex-col gap-3 mt-6">

          {/* Speed */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setSpeedExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 group"
            >
              <span className="text-sm font-semibold group-hover:text-brand transition-colors">
                Velocidad
              </span>
              <span className="text-xs text-gray-500">
                {speedExpanded ? '▲' : '▼'}
              </span>
            </button>
            {speedExpanded && (
              <div className="px-2 pb-3">
                <GpsChart
                  data={speedChartData}
                  color="#22c55e"
                  formatY={(v) => `${v.toFixed(1)} km/h`}
                  formatX={formatChartTime}
                  yUnit="speed"
                  noDataMessage="Sin datos de velocidad"
                />
              </div>
            )}
          </div>

          {/* Distance */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setDistExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 group"
            >
              <span className="text-sm font-semibold group-hover:text-brand transition-colors">
                Distancia acumulada
              </span>
              <span className="text-xs text-gray-500">
                {distExpanded ? '▲' : '▼'}
              </span>
            </button>
            {distExpanded && (
              <div className="px-2 pb-3">
                <GpsChart
                  data={distanceChartData}
                  color="#3b82f6"
                  formatY={(v) => `${v.toFixed(2)} km`}
                  formatX={formatChartTime}
                  yUnit="distance"
                  noDataMessage="Sin datos de distancia"
                />
              </div>
            )}
          </div>

          {/* Altitude */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setAltExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 group"
            >
              <span className="text-sm font-semibold group-hover:text-brand transition-colors">
                Altitud
              </span>
              <span className="text-xs text-gray-500">
                {altExpanded ? '▲' : '▼'}
              </span>
            </button>
            {altExpanded && (
              <div className="px-2 pb-3">
                <GpsChart
                  data={altitudeChartData}
                  color="#f59e0b"
                  formatY={(v) => `${Math.round(v)} m`}
                  formatX={formatChartTime}
                  yUnit="altitude"
                  noDataMessage="Sin datos de altitud"
                />
              </div>
            )}
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
      <p className="text-lg font-bold text-brand">{value}</p>
    </div>
  )
}
