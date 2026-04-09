import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
// Mapbox offline tile management
// Requires @mapbox/react-native-mapbox-gl configured with a free API key in android/app/src/main/AndroidManifest.xml

interface DownloadRegion {
  name: string
  minLon: number
  minLat: number
  maxLon: number
  maxLat: number
  minZoom: number
  maxZoom: number
}

interface Props {
  currentRegion?: {
    latitude: number
    longitude: number
    latitudeDelta: number
    longitudeDelta: number
  }
}

export function OfflineMapManager({ currentRegion }: Props) {
  const [downloading, setDownloading] = useState(false)

  async function downloadCurrentArea() {
    if (!currentRegion) {
      Alert.alert('Sin región', 'Primero navega al área que querés descargar.')
      return
    }

    const region: DownloadRegion = {
      name: `region_${Date.now()}`,
      minLon: currentRegion.longitude - currentRegion.longitudeDelta / 2,
      minLat: currentRegion.latitude - currentRegion.latitudeDelta / 2,
      maxLon: currentRegion.longitude + currentRegion.longitudeDelta / 2,
      maxLat: currentRegion.latitude + currentRegion.latitudeDelta / 2,
      minZoom: 10,
      maxZoom: 16,
    }

    setDownloading(true)
    try {
      // Dynamic import to avoid crashing if Mapbox isn't configured
      const MapboxGL = await import('@rnmapbox/maps').then(
        (m) => m.default,
      )

      await MapboxGL.offlineManager.createPack(
        {
          name: region.name,
          styleURL: MapboxGL.StyleURL.Street,
          bounds: [
            [region.minLon, region.minLat],
            [region.maxLon, region.maxLat],
          ],
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
        },
        (_, status) => {
          if (status?.percentage === 100) {
            setDownloading(false)
            Alert.alert('Listo', 'Mapa descargado para uso offline.')
          }
        },
        (_, err) => {
          setDownloading(false)
          Alert.alert('Error', err?.message ?? 'No se pudo descargar el mapa.')
        },
      )
    } catch {
      setDownloading(false)
      Alert.alert(
        'Mapbox no configurado',
        'Configurá tu API key de Mapbox para descargar mapas offline.',
      )
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, downloading && styles.buttonDisabled]}
        onPress={downloadCurrentArea}
        disabled={downloading}
      >
        {downloading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.label}>⬇ Descargar mapa offline</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  button: {
    backgroundColor: '#0ea5e9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  label: { color: '#fff', fontWeight: '600', fontSize: 14 },
})
