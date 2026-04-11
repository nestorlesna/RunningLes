import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

// Mapbox offline tiles are not configured yet.
// To enable: install @rnmapbox/maps, configure the Maven repo with your Mapbox API key,
// and run expo prebuild --clean again.
export function OfflineMapManager() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Descarga offline no disponible aún.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: '#64748b', fontSize: 14, textAlign: 'center' },
})
