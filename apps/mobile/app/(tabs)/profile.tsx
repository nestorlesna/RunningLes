import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native'
import { supabase } from '../../src/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

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

  if (user) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Perfil</Text>
        <View style={styles.card}>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.uid}>ID: {user.id.slice(0, 8)}…</Text>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutLabel}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.root}>
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
  root: { flex: 1, backgroundColor: '#0f172a', padding: 20, paddingTop: 56 },
  title: { color: '#f8fafc', fontSize: 26, fontWeight: '800', marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, gap: 6 },
  email: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  uid: { color: '#64748b', fontSize: 12 },
  signOutBtn: {
    marginTop: 24,
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
