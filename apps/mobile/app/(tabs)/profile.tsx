import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { useUIStore } from '../../src/store/uiStore'
import { syncDatabase, pullFromServer } from '../../src/services/database/sync'
import type { User } from '@supabase/supabase-js'

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const { isSyncing, lastSyncedAt, syncError, isPulling, pullError, pullUpdatedCount } = useUIStore()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleAuth() {
    setLoading(true)
    try {
      const { error } = isSignUp
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

      if (error) Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function formatSyncTime(ts: number | null) {
    if (!ts) return 'Nunca'
    const d = new Date(ts)
    return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })
  }

  if (user) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Perfil</Text>
        <View style={styles.card}>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.uid}>ID: {user.id.slice(0, 8)}…</Text>
        </View>

        {/* Sync panel */}
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Sincronización con servidor</Text>

          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Último sync:</Text>
            <Text style={styles.syncValue}>{formatSyncTime(lastSyncedAt)}</Text>
          </View>

          <View style={styles.syncRow}>
            <Text style={styles.syncLabel}>Estado:</Text>
            <Text style={[styles.syncValue, isSyncing && styles.syncingText, syncError ? styles.errorText : !isSyncing && lastSyncedAt ? styles.okText : undefined]}>
              {isSyncing ? 'Sincronizando…' : syncError ? 'Error' : lastSyncedAt ? 'OK' : 'Pendiente'}
            </Text>
          </View>

          {syncError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxLabel}>Detalle del error:</Text>
              <Text style={styles.errorBoxText} selectable>{syncError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
            onPress={syncDatabase}
            disabled={isSyncing}
          >
            {isSyncing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.syncBtnLabel}>Sincronizar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Pull from server panel */}
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Actualizar desde servidor</Text>
          <Text style={styles.pullDescription}>
            Trae los cambios que hayas hecho desde la web (tipo de actividad, notas, duración) hacia este dispositivo. No importa sesiones nuevas.
          </Text>

          {pullError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxLabel}>Error:</Text>
              <Text style={styles.errorBoxText} selectable>{pullError}</Text>
            </View>
          ) : pullUpdatedCount !== null ? (
            <View style={styles.pullResultBox}>
              <Text style={styles.pullResultText}>
                {pullUpdatedCount === 0
                  ? 'Todo al día, sin cambios.'
                  : `${pullUpdatedCount} sesión${pullUpdatedCount !== 1 ? 'es' : ''} actualizada${pullUpdatedCount !== 1 ? 's' : ''}.`}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.pullBtn, (isPulling || isSyncing) && styles.syncBtnDisabled]}
            onPress={pullFromServer}
            disabled={isPulling || isSyncing}
          >
            {isPulling
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.syncBtnLabel}>Actualizar desde servidor</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutLabel}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  return (
    <View style={[styles.root, styles.content]}>
      <Text style={styles.title}>{isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#475569"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#475569"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.authBtn, loading && styles.authBtnDisabled]}
          onPress={handleAuth}
          disabled={loading}
        >
          <Text style={styles.authLabel}>
            {loading ? 'Cargando…' : isSignUp ? 'Registrarse' : 'Entrar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.toggleText}>
            {isSignUp ? '¿Ya tenés cuenta? Iniciá sesión' : '¿Sin cuenta? Registrate'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingTop: 56, gap: 16 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 6 },
  email: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  uid: { color: '#64748b', fontSize: 12 },
  // Sync panel
  syncCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 12 },
  syncTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  syncRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncLabel: { color: '#94a3b8', fontSize: 13 },
  syncValue: { color: '#cbd5e1', fontSize: 13, fontWeight: '500' },
  syncingText: { color: '#facc15' },
  okText: { color: '#22c55e' },
  errorText: { color: '#f87171' },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 8,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#7f1d1d',
  },
  errorBoxLabel: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  errorBoxText: { color: '#fecaca', fontSize: 12, fontFamily: 'monospace' },
  syncBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  pullDescription: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  pullBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  pullResultBox: {
    backgroundColor: '#0f2a1a',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#166534',
  },
  pullResultText: { color: '#86efac', fontSize: 13 },
  signOutBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutLabel: { color: '#f87171', fontWeight: '600' },
  form: { gap: 14 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  authBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  authBtnDisabled: { opacity: 0.6 },
  authLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  toggleText: { color: '#3b82f6', textAlign: 'center', fontSize: 14 },
})
