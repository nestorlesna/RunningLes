import { cacheDirectory, writeAsStringAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { Q } from '@nozbe/watermelondb'
import { database } from './index'
import Session from './models/Session'
import GpsPoint from './models/GpsPoint'
import { useProfileStore } from '../../store/profileStore'
import type { ActivityType } from '@runningl-es/shared'

interface BackupGpsPoint {
  id: string
  session_id: string
  recorded_at: string
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number | null
  speed_mps: number | null
  heading: number | null
}

interface BackupSession {
  id: string
  local_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_pace_sec_per_km: number | null
  max_speed_mps: number | null
  avg_speed_mps: number | null
  elevation_gain_meters: number | null
  calories_burned: number | null
  activity_type: string
  notes: string | null
  gps_points: BackupGpsPoint[]
}

interface BackupData {
  version: string
  exportedAt: string
  profile: {
    weight_kg: number | null
    birth_year: number | null
    sex: 'male' | 'female' | null
  } | null
  sessions: BackupSession[]
}

export async function exportBackup(): Promise<void> {
  const { weightKg, birthYear, sex } = useProfileStore.getState()

  const sessions = await database.get<Session>('sessions').query().fetch()
  const allPoints = await database.get<GpsPoint>('gps_points').query().fetch()

  const pointsBySession = new Map<string, GpsPoint[]>()
  for (const p of allPoints) {
    if (!pointsBySession.has(p.sessionId)) pointsBySession.set(p.sessionId, [])
    pointsBySession.get(p.sessionId)!.push(p)
  }

  const backupSessions: BackupSession[] = sessions.map((s) => ({
    id: s.id,
    local_id: s.localId ?? null,
    started_at: s.startedAt ? s.startedAt.toISOString() : new Date(0).toISOString(),
    ended_at: s.endedAt ? s.endedAt.toISOString() : null,
    duration_seconds: s.durationSeconds ?? null,
    distance_meters: s.distanceMeters ?? null,
    avg_pace_sec_per_km: s.avgPaceSecPerKm ?? null,
    max_speed_mps: s.maxSpeedMps ?? null,
    avg_speed_mps: s.avgSpeedMps ?? null,
    elevation_gain_meters: s.elevationGainMeters ?? null,
    calories_burned: s.caloriesBurned ?? null,
    activity_type: s.activityType,
    notes: s.notes ?? null,
    gps_points: (pointsBySession.get(s.id) ?? [])
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
      .map((p) => ({
        id: p.id,
        session_id: p.sessionId,
        recorded_at: p.recordedAt.toISOString(),
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude ?? null,
        accuracy: p.accuracy ?? null,
        speed_mps: p.speedMps ?? null,
        heading: p.heading ?? null,
      })),
  }))

  const backup: BackupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    profile: { weight_kg: weightKg, birth_year: birthYear, sex },
    sessions: backupSessions,
  }

  const json = JSON.stringify(backup, null, 2)
  const dateStr = new Date().toISOString().split('T')[0]
  const fileUri = `${cacheDirectory}runningl-es-backup-${dateStr}.json`

  await writeAsStringAsync(fileUri, json, { encoding: EncodingType.UTF8 })

  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) throw new Error('Compartir archivos no está disponible en este dispositivo')

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar copia de seguridad',
  })
}

export interface ImportResult {
  sessionsImported: number
  sessionsUpdated: number
  profileUpdated: boolean
}

export async function importBackup(): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  })

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('Cancelado')
  }

  const raw = await readAsStringAsync(result.assets[0].uri, { encoding: EncodingType.UTF8 })

  let backup: BackupData
  try {
    backup = JSON.parse(raw)
  } catch {
    throw new Error('El archivo no es un JSON válido')
  }

  if (!backup.version || !Array.isArray(backup.sessions)) {
    throw new Error('Archivo de backup inválido — falta version o sessions')
  }

  let sessionsImported = 0
  let sessionsUpdated = 0
  let profileUpdated = false

  if (backup.profile) {
    useProfileStore.getState().setProfile({
      weightKg: backup.profile.weight_kg ?? null,
      birthYear: backup.profile.birth_year ?? null,
      sex: backup.profile.sex ?? null,
    })
    profileUpdated = true
  }

  const sessionsCollection = database.get<Session>('sessions')
  const pointsCollection = database.get<GpsPoint>('gps_points')

  for (const sessionData of backup.sessions) {
    await database.write(async () => {
      const existing = await sessionsCollection
        .query(Q.where('id', sessionData.id))
        .fetch()

      if (existing.length > 0) {
        const local = existing[0]
        const changed =
          local.activityType !== sessionData.activity_type ||
          (local.notes ?? null) !== (sessionData.notes ?? null) ||
          local.durationSeconds !== (sessionData.duration_seconds ?? null) ||
          local.distanceMeters !== (sessionData.distance_meters ?? null) ||
          local.avgPaceSecPerKm !== (sessionData.avg_pace_sec_per_km ?? null) ||
          local.caloriesBurned !== (sessionData.calories_burned ?? null)

        if (changed) {
          await local.update((s) => {
            s.activityType = sessionData.activity_type as ActivityType
            s.notes = sessionData.notes ?? null
            if (sessionData.duration_seconds != null) s.durationSeconds = sessionData.duration_seconds
            if (sessionData.distance_meters != null) s.distanceMeters = sessionData.distance_meters
            if (sessionData.avg_pace_sec_per_km != null) s.avgPaceSecPerKm = sessionData.avg_pace_sec_per_km
            if (sessionData.max_speed_mps != null) s.maxSpeedMps = sessionData.max_speed_mps
            if (sessionData.avg_speed_mps != null) s.avgSpeedMps = sessionData.avg_speed_mps
            if (sessionData.elevation_gain_meters != null) s.elevationGainMeters = sessionData.elevation_gain_meters
            if (sessionData.calories_burned != null) s.caloriesBurned = sessionData.calories_burned
          })
          sessionsUpdated++
        }
      } else {
        await sessionsCollection.create((s) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(s as any)._raw.id = sessionData.id
          s.localId = sessionData.local_id ?? ''
          s.startedAt = new Date(sessionData.started_at)
          s.endedAt = sessionData.ended_at ? new Date(sessionData.ended_at) : null
          s.durationSeconds = sessionData.duration_seconds ?? null
          s.distanceMeters = sessionData.distance_meters ?? null
          s.avgPaceSecPerKm = sessionData.avg_pace_sec_per_km ?? null
          s.maxSpeedMps = sessionData.max_speed_mps ?? null
          s.avgSpeedMps = sessionData.avg_speed_mps ?? null
          s.elevationGainMeters = sessionData.elevation_gain_meters ?? null
          s.caloriesBurned = sessionData.calories_burned ?? null
          s.activityType = sessionData.activity_type as ActivityType
          s.notes = sessionData.notes ?? null
          s.synced = false
          s.rawPoints = null
        })
        sessionsImported++
      }

      for (const pt of sessionData.gps_points ?? []) {
        const existingPts = await pointsCollection
          .query(Q.where('id', pt.id))
          .fetch()

        if (existingPts.length > 0) {
          const changed =
            existingPts[0].latitude !== pt.latitude ||
            existingPts[0].longitude !== pt.longitude

          if (changed) {
            await existingPts[0].update((p) => {
              p.latitude = pt.latitude
              p.longitude = pt.longitude
              if (pt.altitude != null) p.altitude = pt.altitude
              if (pt.accuracy != null) p.accuracy = pt.accuracy
              if (pt.speed_mps != null) p.speedMps = pt.speed_mps
              if (pt.heading != null) p.heading = pt.heading
            })
          }
        } else {
          await pointsCollection.create((p) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(p as any)._raw.id = pt.id
            p.sessionId = sessionData.id
            p.recordedAt = new Date(pt.recorded_at)
            p.latitude = pt.latitude
            p.longitude = pt.longitude
            p.altitude = pt.altitude ?? null
            p.accuracy = pt.accuracy ?? null
            p.speedMps = pt.speed_mps ?? null
            p.heading = pt.heading ?? null
          })
        }
      }
    })
  }

  return { sessionsImported, sessionsUpdated, profileUpdated }
}
