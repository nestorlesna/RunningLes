import { useEffect, Component, ReactNode } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { supabase } from '../src/lib/supabase'
import { checkForUpdate } from '../src/services/updateChecker'

SplashScreen.preventAutoHideAsync().catch(() => {})

// Error boundary to show crashes on screen instead of hanging on splash
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) {
    return { error: e.message + '\n\n' + e.stack }
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorRoot}>
          <Text style={styles.errorTitle}>Error al iniciar</Text>
          <ScrollView>
            <Text style={styles.errorText}>{this.state.error}</Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

// Procesa el deep link de confirmación de email de Supabase.
// El link llega como: running-les://#access_token=...&refresh_token=...&type=signup
async function handleAuthDeepLink(url: string) {
  const hash = url.split('#')[1]
  if (!hash) return
  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  }
}

function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {})

    // Deep link: app abierta en frío desde el link del email
    Linking.getInitialURL().then((url) => { if (url) handleAuthDeepLink(url) })
    // Deep link: app ya abierta y llega el link
    const linkSub = Linking.addEventListener('url', ({ url }) => handleAuthDeepLink(url))

    checkForUpdate()

    Promise.resolve()
      .then(() => {
        require('../src/services/location/backgroundTask')
        const { syncDatabase } = require('../src/services/database/sync')
        syncDatabase()
      })
      .catch((e) => console.warn('[layout] service init error:', e))

    return () => { linkSub.remove() }
  }, [])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}

export default function Root() {
  return (
    <ErrorBoundary>
      <RootLayout />
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  errorRoot: { flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 60 },
  errorTitle: { color: '#f87171', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  errorText: { color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' },
})
