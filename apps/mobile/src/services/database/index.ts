import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { dbSchema } from './schema'
import Session from './models/Session'
import GpsPoint from './models/GpsPoint'

const adapter = new SQLiteAdapter({
  schema: dbSchema,
  dbName: 'RunningLes',
  // migrations would go here for future schema changes
  jsi: true, // use JSI for better performance on Android
  onSetUpError: (error) => {
    console.error('[WatermelonDB] setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Session, GpsPoint],
})
