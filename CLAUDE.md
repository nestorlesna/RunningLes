# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Monorepo implementado con estructura completa. Ver `SETUP.md` para instrucciones de instalación y deploy.

## Commands

Once the monorepo is scaffolded with pnpm workspaces:

```bash
# Root
pnpm install

# Mobile
cd apps/mobile
pnpm start                    # Expo dev server
expo prebuild --platform android
eas build --platform android --local
adb install <apk-path>

# Web/API
cd apps/web
pnpm dev                      # Next.js dev server
pnpm build && pnpm start      # Production
```

## Architecture

**Monorepo** with pnpm workspaces:
- `apps/mobile/` — Expo React Native (Android only)
- `apps/web/` — Next.js 14+ (API routes only, no frontend)
- `packages/shared/` — Shared TypeScript types, Zod schemas, utilities

**Core pattern: Offline-First GPS Tracking**

```
Android device
  └── Expo Foreground Service (GPS background task)
        └── WatermelonDB (SQLite, local-first)
              └── sync (when network available)
                    └── Next.js API (Vercel)
                          └── Supabase (PostgreSQL + PostGIS)
```

### Mobile (`apps/mobile`)

- **Routing**: `expo-router` file-based — tabs at `app/(tabs)/`, dynamic session detail at `app/session/[id].tsx`
- **State**: Zustand `sessionStore` tracks live session (`isRunning`, `currentPoints`, `elapsedSeconds`, `totalDistanceMeters`, `currentSpeedMps`, `activityType`)
- **GPS**: `expo-location` + `expo-task-manager` — task named `'LOCATION_TRACKING'` runs as Foreground Service with persistent notification; `timeInterval: 1000ms`, `distanceInterval: 5m`, accuracy `BestForNavigation`
- **Database**: WatermelonDB with two tables — `sessions` and `gps_points`; `Session` hasMany `GpsPoint`, `GpsPoint` belongsTo `Session`
- **Map**: `react-native-maps` with `provider={undefined}` (OpenStreetMap, no Google Maps API key); Mapbox SDK for offline tile downloads
- **Sync triggers**: `AppState` foreground event + `@react-native-community/netinfo` connectivity change

### Web/API (`apps/web`)

API routes under `app/api/`:
- `POST /api/sync` — WatermelonDB sync protocol; validates Supabase JWT, processes inserts/updates/deletes, builds PostGIS LINESTRING from GPS points
- `GET /api/sessions` — paginated list, no GPS points
- `GET /api/sessions/[id]` — full session with all GPS points
- `DELETE /api/sessions/[id]` — cascade delete
- `GET /api/stats` — aggregated stats: totals + 8-week weekly distance

All routes validate JWT via `lib/auth.ts` and use Zod for request validation.

### Database (Supabase)

Two tables with PostGIS geometry columns:
- `sessions.route` — `GEOMETRY(LINESTRING, 4326)` built from GPS points on sync
- `gps_points.point` — `GEOMETRY(POINT, 4326)`

RLS enabled on both tables; users access only their own data. Migration at `supabase/migrations/001_initial.sql`.

## Key Implementation Details

- **Distance calculation**: Haversine formula in `packages/shared/src/haversine.ts` (Earth radius 6,371,000 m); called in both `backgroundTask.ts` (incremental update) and `sessionStore.addPoint()`
- **Pace display**: `currentSpeedMps` → min/km in `formatPace.ts`; `elapsedSeconds` → `HH:MM:SS` in `formatTime.ts`
- **WatermelonDB sync body**: `{ changes: { sessions: { created, updated, deleted }, gps_points: { created, updated, deleted } }, lastPulledAt }` → response: `{ changes, timestamp }`
- **Android permissions required**: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`
- **App package**: `com.personal.runtracker`

## Environment Variables

`apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
```

`apps/web/.env.local`:
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```
