import React, { useRef, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import MapView, { Polyline, Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps'
import type { GpsCoordinate } from '@runningl-es/shared'

interface Props {
  points: GpsCoordinate[]
  isActive: boolean
}

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export function RunMap({ points, isActive }: Props) {
  const mapRef = useRef<MapView>(null)

  const latLngs = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
  const currentPosition = points.at(-1)

  // Auto-center on latest point during active session
  useEffect(() => {
    if (!isActive || !currentPosition) return
    mapRef.current?.animateToRegion(
      {
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      300,
    )
  }, [currentPosition?.latitude, currentPosition?.longitude, isActive])

  const initialRegion = currentPosition
    ? {
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: -34.6037,
        longitude: -58.3816,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation={false}
      showsMyLocationButton={false}
      rotateEnabled={false}
    >
      {/* OpenStreetMap tiles — no API key required */}
      <UrlTile
        urlTemplate={OSM_TILE_URL}
        maximumZ={19}
        flipY={false}
        tileSize={256}
      />

      {latLngs.length > 1 && (
        <Polyline
          coordinates={latLngs}
          strokeColor="#22c55e"
          strokeWidth={4}
        />
      )}

      {currentPosition && (
        <Marker
          coordinate={{
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat
        />
      )}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
  },
})
