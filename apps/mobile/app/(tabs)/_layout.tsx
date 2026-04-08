import { Tabs } from 'expo-router'
import { Text } from 'react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
        },
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#475569',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="run"
        options={{
          title: 'Correr',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏃</Text>,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  )
}
