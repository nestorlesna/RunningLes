import React, { useRef, useEffect, Component, ReactNode } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import type { GpsCoordinate } from '@runningl-es/shared'

interface Props {
  points: GpsCoordinate[]
  isActive: boolean
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) {
      return (
        <View style={styles.mapFallback}>
          <Text style={styles.mapFallbackText}>Mapa no disponible</Text>
          <Text style={styles.mapFallbackSub}>GPS activo — recorrido guardado igual</Text>
        </View>
      )
    }
    return this.props.children
  }
}

function MapViewInner({ points, isActive }: Props) {
  // Lazy-require to avoid crash at module load time
  const {
    default: MapView,
    Polyline,
    Marker,
    PROVIDER_GOOGLE,
  } = require('react-native-maps')

  const mapRef = useRef<any>(null)
  const latLngs = points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
  const currentPosition = points.at(-1)

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
      provider={PROVIDER_GOOGLE}
      initialRegion={initialRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      rotateEnabled={false}
    >
      {latLngs.length > 1 && (
        <Polyline coordinates={latLngs} strokeColor="#22c55e" strokeWidth={4} />
      )}
      {currentPosition && (
        <Marker
          coordinate={{ latitude: currentPosition.latitude, longitude: currentPosition.longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat
        />
      )}
    </MapView>
  )
}

export function RunMap(props: Props) {
  return (
    <MapErrorBoundary>
      <MapViewInner {...props} />
    </MapErrorBoundary>
  )
}

const styles = StyleSheet.create({
  map: { flex: 1, width: '100%' },
  mapFallback: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapFallbackText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  mapFallbackSub: { color: '#334155', fontSize: 13 },
})
