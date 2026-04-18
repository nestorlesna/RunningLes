import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations'

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'sessions',
          columns: [
            { name: 'calories_burned', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
})
