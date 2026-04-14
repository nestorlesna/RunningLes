'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface GpsPoint {
  id: string
  latitude: number
  longitude: number
  recorded_at: string
}

interface Props {
  points: GpsPoint[]
  anomalousSet: Set<number>
  selectedIndex: number | null
  onSelect: (index: number) => void
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    fitted.current = true
    if (positions.length === 1) {
      map.setView(positions[0], 15)
    } else {
      map.fitBounds(positions, { padding: [32, 32] })
    }
  }, [map, positions])
  return null
}

function ScrollToSelected({
  positions,
  selectedIndex,
}: {
  positions: [number, number][]
  selectedIndex: number | null
}) {
  const map = useMap()
  useEffect(() => {
    if (selectedIndex !== null && positions[selectedIndex]) {
      map.panTo(positions[selectedIndex])
    }
  }, [map, positions, selectedIndex])
  return null
}

export default function PointsMap({ points, anomalousSet, selectedIndex, onSelect }: Props) {
  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude])
  const center: [number, number] = positions.length > 0 ? positions[0] : [-34.6, -58.4]

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route polyline */}
      {positions.length > 1 && (
        <Polyline positions={positions} color="#22c55e" weight={3} opacity={0.5} />
      )}

      {/* Individual points */}
      {points.map((point, i) => {
        const isAnomaly = anomalousSet.has(i)
        const isSelected = i === selectedIndex

        const color = isSelected ? '#ffffff' : isAnomaly ? '#ef4444' : '#22c55e'
        const radius = isSelected ? 9 : isAnomaly ? 6 : 4
        const weight = isSelected ? 3 : 1

        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight }}
            eventHandlers={{ click: () => onSelect(i) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs">
                #{i + 1} — {new Date(point.recorded_at).toLocaleTimeString('es-AR')}
                {isAnomaly && ' ⚠️ anomalía'}
              </span>
            </Tooltip>
          </CircleMarker>
        )
      })}

      <FitBounds positions={positions} />
      <ScrollToSelected positions={positions} selectedIndex={selectedIndex} />
    </MapContainer>
  )
}
