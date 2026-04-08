# Prompt para Claude Code — App de Running/Walking Android

> Copiá todo el contenido de este archivo y pegalo directamente en Claude Code.

---

## Prompt

Quiero construir una aplicación móvil de running/walking para Android personal (sin publicar en Play Store). A continuación detallo el stack, arquitectura y requerimientos completos para que generes toda la estructura del proyecto.

---

## Stack tecnológico

### App móvil
- React Native con Expo SDK 51+ (managed workflow con prebuild)
- TypeScript estricto
- expo-router para navegación
- Zustand para estado global
- WatermelonDB sobre SQLite para persistencia local y sync offline-first
- expo-location + expo-task-manager para GPS en background
- react-native-maps con proveedor OpenStreetMap (sin Google Maps, sin API key)
- Mapbox SDK (tier gratuito) para tiles offline descargables
- expo-sensors para podometría

### Backend
- Next.js 14+ con App Router y API Routes
- Deploy en Vercel (uso personal, tier gratuito)
- TypeScript
- Supabase JS client (@supabase/supabase-js)
- Zod para validación de schemas

### Base de datos
- Supabase (PostgreSQL + extensión PostGIS habilitada)
- Auth de Supabase para autenticación

---

## Arquitectura general

El dispositivo Android 13+ corre la app Expo. Durante una sesión de running, el GPS trackea en background mediante un Foreground Service (notificación persistente). Todos los datos se guardan localmente en WatermelonDB. Cuando hay conexión, WatermelonDB sincroniza contra la API en Vercel, que escribe en Supabase. El mapa funciona offline con tiles OSM descargados previamente.

---

## Estructura de carpetas

### Monorepo raíz

```
/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── web/             # Next.js backend (API only, no frontend)
├── packages/
│   └── shared/          # tipos TypeScript compartidos, utils, schemas Zod
└── package.json         # workspace raíz (pnpm workspaces)
```

### Mobile (`apps/mobile`)

```
apps/mobile/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx           # dashboard principal
│   │   ├── run.tsx             # sesión activa (mapa + stats en vivo)
│   │   ├── history.tsx         # historial de sesiones
│   │   └── profile.tsx
│   ├── session/[id].tsx        # detalle de sesión con mapa
│   └── _layout.tsx
├── src/
│   ├── components/
│   │   ├── map/
│   │   │   ├── RunMap.tsx
│   │   │   └── OfflineMapManager.tsx
│   │   ├── session/
│   │   │   ├── ActiveSessionHUD.tsx
│   │   │   ├── StartButton.tsx
│   │   │   └── StopButton.tsx
│   │   └── history/
│   │       └── SessionCard.tsx
│   ├── services/
│   │   ├── location/
│   │   │   ├── backgroundTask.ts
│   │   │   └── locationService.ts
│   │   ├── database/
│   │   │   ├── schema.ts
│   │   │   ├── models/
│   │   │   │   ├── Session.ts
│   │   │   │   └── GpsPoint.ts
│   │   │   └── sync.ts
│   │   └── mapbox/
│   │       └── offlineTiles.ts
│   ├── store/
│   │   ├── sessionStore.ts
│   │   └── uiStore.ts
│   └── utils/
│       ├── haversine.ts
│       ├── formatTime.ts
│       └── formatPace.ts
├── android/                     # generado por expo prebuild
├── app.json
├── app.config.ts
└── package.json
```

### Web/API (`apps/web`)

```
apps/web/
├── app/
│   └── api/
│       ├── sync/
│       │   └── route.ts
│       ├── sessions/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       └── stats/
│           └── route.ts
├── lib/
│   ├── supabase.ts
│   └── auth.ts
└── package.json
```

---

## Schema de base de datos Supabase (PostgreSQL + PostGIS)

Crear un archivo de migración SQL `supabase/migrations/001_initial.sql` con el siguiente contenido:

```sql
-- Habilitar PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de sesiones
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_meters FLOAT,
  avg_pace_sec_per_km FLOAT,
  max_speed_mps FLOAT,
  avg_speed_mps FLOAT,
  elevation_gain_meters FLOAT,
  activity_type TEXT DEFAULT 'run',
  route GEOMETRY(LINESTRING, 4326),
  notes TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de puntos GPS
CREATE TABLE gps_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  altitude FLOAT,
  accuracy FLOAT,
  speed_mps FLOAT,
  heading FLOAT,
  point GEOMETRY(POINT, 4326)
);

-- Índices
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_gps_points_session_id ON gps_points(session_id);
CREATE INDEX idx_sessions_route ON sessions USING GIST(route);
CREATE INDEX idx_gps_points_point ON gps_points USING GIST(point);

-- Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_gps_points" ON gps_points
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );
```

---

## WatermelonDB schema

Implementar `src/services/database/schema.ts` con dos tablas:

**`sessions`**: `local_id`, `started_at`, `ended_at`, `duration_seconds`, `distance_meters`, `avg_pace`, `max_speed`, `avg_speed`, `elevation_gain`, `activity_type`, `notes`, `synced` (boolean), `raw_points` (JSON string con array de coordenadas).

**`gps_points`**: `session_id` (relación a sessions), `latitude`, `longitude`, `altitude`, `accuracy`, `speed`, `heading`, `recorded_at`.

Implementar los modelos `Session.ts` y `GpsPoint.ts` con las relaciones correspondientes (`Session` hasMany `GpsPoint`, `GpsPoint` belongsTo `Session`).

---

## Lógica GPS en background

### `backgroundTask.ts`

- Registrar task con `TaskManager.defineTask('LOCATION_TRACKING', callback)`
- El callback recibe `{ data: { locations }, error }`
- Por cada location recibida: escribir en WatermelonDB, calcular distancia incremental con Haversine y actualizar el store Zustand (`sessionStore`)
- Manejar errores sin crashear el task

### `locationService.ts`

Exportar las siguientes funciones:

**`startTracking()`**:
1. Verificar y solicitar permiso `FOREGROUND`
2. Verificar y solicitar permiso `BACKGROUND`
3. Llamar `Location.startLocationUpdatesAsync('LOCATION_TRACKING', options)` con:
   - `accuracy: Location.Accuracy.BestForNavigation`
   - `timeInterval: 1000`
   - `distanceInterval: 5`
   - `foregroundService: { notificationTitle: 'Sesión activa', notificationBody: 'GPS registrando tu recorrido...' }`

**`stopTracking()`**:
1. Llamar `Location.stopLocationUpdatesAsync('LOCATION_TRACKING')`
2. Finalizar y guardar la sesión en WatermelonDB

**`isTracking()`**: devuelve `boolean` consultando `Location.hasStartedLocationUpdatesAsync`.

---

## Zustand store (`sessionStore.ts`)

Estado:

```typescript
interface SessionState {
  isRunning: boolean
  sessionId: string | null
  currentPoints: GpsCoordinate[]
  elapsedSeconds: number
  totalDistanceMeters: number
  currentSpeedMps: number
  activityType: 'run' | 'walk'

  startSession: (type: 'run' | 'walk') => void
  stopSession: () => void
  addPoint: (point: GpsCoordinate) => void
  tickSecond: () => void
  reset: () => void
}
```

`addPoint` debe actualizar `totalDistanceMeters` sumando la distancia Haversine entre el último punto y el nuevo.

---

## Componentes clave

### `RunMap.tsx`

- `react-native-maps` con `provider={undefined}` para usar OSM por defecto (sin Google Maps)
- Mostrar `Polyline` con todos los puntos de `sessionStore.currentPoints`
- Marcador especial en el punto más reciente (posición actual)
- `followsUserLocation` activado durante sesión activa
- Props: `points: GpsCoordinate[]`, `isActive: boolean`

### `ActiveSessionHUD.tsx`

Mostrar en tiempo real:
- Cronómetro formateado `HH:MM:SS` usando `elapsedSeconds` del store
- Distancia en km con 2 decimales
- Ritmo actual en `min/km` (calculado de `currentSpeedMps`)
- Botón de pausa/continuar y botón de finalizar
- Usar `useEffect` con `setInterval` de 1 segundo para llamar `tickSecond()`

---

## Utilidades

### `haversine.ts`

```typescript
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number // retorna metros
```

Implementar la fórmula Haversine completa. Radio de la Tierra: 6371000 metros.

### `formatTime.ts`

```typescript
export function formatDuration(seconds: number): string // "1:23:45"
export function formatPace(speedMps: number): string    // "5:32 /km"
```

---

## Sync offline-first (`sync.ts`)

Implementar usando el protocolo nativo de WatermelonDB `synchronize()`:

```typescript
export async function syncDatabase(database: Database): Promise<void>
```

- Endpoint: `POST ${API_BASE_URL}/api/sync`
- Headers: `Authorization: Bearer <supabase_access_token>`
- Body: `{ changes, lastPulledAt }`
- Response: `{ changes, timestamp }`
- Llamar a esta función automáticamente cuando:
  - La app pasa a foreground (`AppState`)
  - El estado de red cambia a conectado (`@react-native-community/netinfo`)
- Exportar estado de sync: `isSyncing`, `lastSyncedAt`, `syncError`

---

## API Routes Next.js

### `POST /api/sync`

- Validar JWT de Supabase en el header `Authorization`
- Recibir `{ changes, lastPulledAt }`
- Procesar inserts/updates/deletes de `sessions` y `gps_points`
- Para cada sesión nueva, construir la geometría PostGIS `LINESTRING` a partir de los puntos
- Devolver `{ changes: { sessions: {...}, gps_points: {...} }, timestamp: Date.now() }`

### `GET /api/sessions`

- Devolver lista de sesiones del usuario autenticado
- Ordenadas por `started_at DESC`
- Incluir stats pero no los puntos GPS individuales

### `GET /api/sessions/[id]`

- Devolver sesión completa incluyendo todos los `gps_points`
- Solo si pertenece al usuario autenticado

### `DELETE /api/sessions/[id]`

- Borrar sesión y sus puntos (cascade en DB)

### `GET /api/stats`

- Estadísticas agregadas del usuario:
  - Total de sesiones, distancia total, tiempo total
  - Promedio de ritmo, mejor ritmo
  - Distancia por semana (últimas 8 semanas)

---

## Configuración de permisos Android (`app.config.ts`)

```typescript
export default {
  expo: {
    name: "RunTracker",
    slug: "run-tracker",
    android: {
      package: "com.personal.runtracker",
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Esta app necesita acceso al GPS en background para registrar tu recorrido mientras corrés.",
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true
        }
      ]
    ]
  }
}
```

---

## Variables de entorno

**`apps/web/.env.local`**:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

**`apps/mobile/.env`**:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
```

---

## Lo que necesito que generes

Genera todos los archivos con código real y funcional, no placeholders. TypeScript estricto en todo. Comentarios solo donde la lógica no sea obvia.

1. **Configuración del monorepo**: `package.json` raíz con pnpm workspaces, `tsconfig.json` base y extendidos por app, `.gitignore`.

2. **`app.config.ts`** completo del móvil con todos los permisos, configuración del Foreground Service y variables de entorno.

3. **WatermelonDB**: `schema.ts` completo, modelos `Session.ts` y `GpsPoint.ts` con relaciones.

4. **GPS**: `locationService.ts` y `backgroundTask.ts` completos y funcionales.

5. **Migración SQL**: archivo completo para Supabase con PostGIS, índices y RLS.

6. **API Routes**: `sync/route.ts`, `sessions/route.ts`, `sessions/[id]/route.ts`, `stats/route.ts`. Todos con validación Zod y auth Supabase.

7. **`lib/supabase.ts`** y **`lib/auth.ts`** para el backend.

8. **`RunMap.tsx`**: mapa OSM con Polyline de la ruta y marcador de posición actual.

9. **`ActiveSessionHUD.tsx`**: cronómetro, distancia, ritmo en vivo con el store Zustand.

10. **`sessionStore.ts`**: store Zustand completo con toda la lógica de estado.

11. **`haversine.ts`**, **`formatTime.ts`**, **`formatPace.ts`**: utilidades completas.

12. **`sync.ts`**: implementación completa del protocolo WatermelonDB sync.

13. **`SETUP.md`**: instrucciones paso a paso para:
    - Requisitos previos (Node, pnpm, EAS CLI, cuenta Supabase, cuenta Vercel)
    - Configurar Supabase (ejecutar migración, habilitar PostGIS, obtener keys)
    - Configurar variables de entorno
    - `pnpm install` en el monorepo
    - `expo prebuild --platform android` para generar la carpeta `android/`
    - Configurar Mapbox (API key gratuita, agregar al manifest)
    - Instalar el APK en el dispositivo con `adb install` o `eas build --platform android --local`
    - Cómo dar los permisos de ubicación en background en Android 13+
