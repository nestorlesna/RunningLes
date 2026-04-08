import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'RunningLes',
  slug: 'runningl-es',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a',
  },
  android: {
    package: 'com.personal.runningl_es',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'ACTIVITY_RECOGNITION',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'RunningLes necesita acceso al GPS en segundo plano para registrar tu recorrido mientras corrés.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-sensors',
      {
        motionPermission:
          'RunningLes usa el podómetro para contar tus pasos.',
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: { projectId: '' },
  },
  scheme: 'runningl-es',
})
