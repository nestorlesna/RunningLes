import { Alert, Linking } from 'react-native'
import Constants from 'expo-constants'

const GITHUB_API = 'https://api.github.com/repos/nestorlesna/RunningLes/releases/latest'
const RELEASES_URL = 'https://github.com/nestorlesna/RunningLes/releases/latest'

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number)
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest)
  const c = parseVersion(current)
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false
  }
  return false
}

export async function checkForUpdate(): Promise<void> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return

    const data = await res.json()
    const latestTag: string = data.tag_name ?? ''
    const current = Constants.nativeAppVersion ?? '0.0.0'

    if (latestTag && isNewer(latestTag, current)) {
      Alert.alert(
        'Nueva versión disponible',
        `Versión actual: v${current}\nDisponible: ${latestTag}`,
        [
          { text: 'Más tarde', style: 'cancel' },
          { text: 'Descargar', onPress: () => Linking.openURL(RELEASES_URL) },
        ]
      )
    }
  } catch {
    // Error de red — se ignora silenciosamente
  }
}
