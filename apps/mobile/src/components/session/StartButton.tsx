import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { startTracking } from '../../services/location/locationService'
import type { ActivityType } from '@runningl-es/shared'

interface Props {
  onStarted?: () => void
}

export function StartButton({ onStarted }: Props) {
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<ActivityType>('run')

  async function handleStart() {
    setLoading(true)
    try {
      await startTracking(selectedType)
      onStarted?.()
    } catch (err) {
      Alert.alert(
        'No se pudo iniciar',
        err instanceof Error ? err.message : 'Error desconocido',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.typeSelector}>
        {(['run', 'walk', 'bike'] as ActivityType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeBtn, selectedType === type && styles.typeBtnActive]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[
                styles.typeBtnText,
                selectedType === type && styles.typeBtnTextActive,
              ]}
            >
              {type === 'run' ? '🏃 Correr' : type === 'walk' ? '🚶 Caminar' : '🚴 Ciclismo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.startBtn, loading && styles.startBtnDisabled]}
        onPress={handleStart}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.startLabel}>INICIAR</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  typeBtnActive: {
    backgroundColor: '#166534',
  },
  typeBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  typeBtnTextActive: {
    color: '#bbf7d0',
  },
  startBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnDisabled: {
    opacity: 0.6,
  },
  startLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 1.5,
  },
})
