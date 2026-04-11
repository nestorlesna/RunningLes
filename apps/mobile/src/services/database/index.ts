import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { dbSchema } from './schema'
import { migrations } from './migrations'
import Session from './models/Session'
import GpsPoint from './models/GpsPoint'

const adapter = new SQLiteAdapter({
  schema: dbSchema,
  migrations,
  dbName: 'RunningLes',
  jsi: false,
  onSetUpError: (error) => {
    console.error('[WatermelonDB] setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Session, GpsPoint],
})
