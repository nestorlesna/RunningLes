# RunningLes

App personal de running/walking para Android. Registra recorridos con GPS en background, almacena datos localmente y sincroniza con la nube cuando hay conexión.

---

## Stack

| Capa | Tecnología |
|---|---|
| App móvil | React Native + Expo SDK 51, expo-router, TypeScript |
| Estado | Zustand |
| DB local | WatermelonDB (SQLite) |
| GPS | expo-location + expo-task-manager (Foreground Service) |
| Mapa | react-native-maps con OpenStreetMap (sin API key) |
| Backend API | Next.js 14 (API Routes only) |
| Deploy API | Vercel (free tier) |
| Base de datos | Supabase (PostgreSQL + PostGIS) |
| Autenticación | Supabase Auth |
| Tipos compartidos | `packages/shared` (Zod schemas, utilidades) |

---

## Estructura del monorepo

```
runningl-es/
├── apps/
│   ├── mobile/               # App Expo React Native
│   │   ├── app/              # Pantallas (expo-router)
│   │   │   ├── (tabs)/       # Dashboard, Run, Historial, Perfil
│   │   │   └── session/[id]  # Detalle de sesión
│   │   ├── src/
│   │   │   ├── components/   # RunMap, ActiveSessionHUD, SessionCard, etc.
│   │   │   ├── services/
│   │   │   │   ├── database/ # WatermelonDB schema, modelos, sync
│   │   │   │   └── location/ # GPS background task y service
│   │   │   └── store/        # Zustand (sessionStore, uiStore)
│   │   └── android/          # Generado por expo prebuild (no committear)
│   └── web/                  # Backend Next.js
│       ├── app/api/
│       │   ├── sync/         # POST /api/sync — WatermelonDB sync
│       │   ├── sessions/     # GET/DELETE /api/sessions
│       │   └── stats/        # GET /api/stats
│       └── lib/
│           ├── supabase.ts   # Cliente service-role
│           └── auth.ts       # Validación JWT
├── packages/
│   └── shared/               # Tipos TS, schemas Zod, haversine, formatTime
└── supabase/
    └── migrations/           # SQL para Supabase
```

---

## URLs de producción

| Servicio | URL |
|---|---|
| API (Vercel) | https://runningles-api.vercel.app |
| API /stats | https://runningles-api.vercel.app/api/stats |
| API /sessions | https://runningles-api.vercel.app/api/sessions |
| Supabase proyecto | https://twdruhhhnsbrpyzlfxmg.supabase.co |
| Vercel dashboard | https://vercel.com/nestor-lesnas-projects/runningles-api |
| GitHub repo | https://github.com/nestorlesna/RunningLes |

---

## Configuración inicial (primera vez)

### Prerrequisitos

- Node.js 20+
- pnpm 9+ → `npm i -g pnpm`
- Android Studio (con Android SDK instalado)
- Java 17+
- Cuenta Supabase (free tier)
- Cuenta Vercel (free tier)

### 1. Clonar e instalar

```bash
git clone https://github.com/nestorlesna/RunningLes.git
cd RunningLes
pnpm install
```

### 2. Variables de entorno

Crear `apps/mobile/.env` (copiar desde `.env.example`):
```
EXPO_PUBLIC_SUPABASE_URL=https://twdruhhhnsbrpyzlfxmg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key de Supabase>
EXPO_PUBLIC_API_BASE_URL=https://runningles-api.vercel.app
```

Crear `apps/web/.env.local` (copiar desde `.env.local.example`):
```
SUPABASE_URL=https://twdruhhhnsbrpyzlfxmg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key de Supabase>
```

> Las keys están en **Supabase → Settings → API**.
> `anon` key = pública (va en la app). `service_role` key = secreta (solo en el backend/Vercel).

### 3. Migraciones Supabase

En **Supabase → SQL Editor**, ejecutar en orden:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_weekly_distance_fn.sql`

### 4. Variables de entorno en Vercel

En **vercel.com → runningles-api → Settings → Environment Variables** agregar:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Marcar ambas como **Production**.

---

## Deploy del backend (Vercel)

### Primera vez

```bash
npm install -g vercel
cd C:\...\RunningLes    # raíz del monorepo
vercel deploy --prod
```

Responder:
- Set up and deploy? → `Y`
- Which scope? → cuenta personal
- Link to existing project? → `N` (primera vez) o `Y` si ya existe
- Root Directory en Vercel dashboard → dejar **vacío** (raíz del monorepo)

> El archivo `apps/web/vercel.json` ya no existe — Vercel detecta automáticamente Next.js desde `apps/web` gracias a la configuración del proyecto.

### Deploys futuros (nuevas versiones)

```bash
# Desde la raíz del monorepo
git add .
git commit -m "feat: descripción del cambio"
git push
vercel deploy --prod
```

O conectar el repo a Vercel para **deploy automático en cada push a main**:
- Vercel dashboard → proyecto → Settings → Git → conectar repositorio GitHub.

### Verificar que funciona

```bash
curl https://runningles-api.vercel.app/api/stats
# Respuesta esperada: {"error":"Missing or invalid Authorization header"}
# Eso significa que la API responde correctamente (requiere auth).
```

---

## Build de la app Android

### Configuración única (ya hecha)

El archivo `apps/mobile/android/local.properties` **no se committea** y debe existir localmente con:
```
sdk.dir=C\:\\Users\\nesto\\AppData\\Local\\Android\\Sdk
```

Si se borra (al hacer `prebuild --clean`), recrearlo con ese contenido.

### Generar el proyecto nativo

Solo necesario cuando cambian dependencias nativas o `app.config.ts`:

```bash
cd apps/mobile
npx expo prebuild --platform android --clean

# Restaurar local.properties después del --clean:
echo "sdk.dir=C\:\\Users\\nesto\\AppData\\Local\\Android\\Sdk" > android/local.properties
```

### Build APK debug (para pruebas, standalone)

El APK debug incluye el bundle JS gracias a `bundleInDebug=true` en `gradle.properties`, no necesita Metro server corriendo.

```bash
cd apps/mobile/android
.\gradlew assembleDebug
```

APK generado en:
```
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Instalar en el dispositivo:
```bash
adb install apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

O copiar el APK manualmente al teléfono y abrirlo desde el gestor de archivos (activar "Instalar desde fuentes desconocidas").

### Build APK release (distribución, pesa ~50MB)

```bash
cd apps/mobile/android
.\gradlew assembleRelease
```

APK en:
```
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

> El release requiere firma. Si no está configurada, generará un APK sin firmar que no se puede instalar directamente. Ver sección de firma más abajo.

---

## Proceso completo para una nueva versión

```
1. Cambiar código
      ↓
2. git commit + git push
      ↓
3. ¿Cambios en el backend?
   → vercel deploy --prod
      ↓
4. ¿Cambios en dependencias nativas o app.config.ts?
   → expo prebuild --clean  (y restaurar local.properties)
   → .\gradlew assembleDebug
      ↓
5. ¿Solo cambios en JS/TS de la app?
   → .\gradlew assembleDebug  (sin prebuild)
      ↓
6. Instalar APK en el dispositivo
```

---

## Solución de problemas conocidos

### "Could not connect to development server"
El APK debug por defecto busca Metro en `localhost:8081`. Solución: asegurarse de que `bundleInDebug=true` está en `apps/mobile/android/gradle.properties` y rebuildar.

### "pnpm: no se reconoce"
```bash
npm install -g pnpm
```

### "No Next.js version detected" en Vercel
Verificar que el Root Directory en Vercel esté **vacío** (no `apps/web`).

### "SDK location not found" en Gradle
Recrear `apps/mobile/android/local.properties`:
```
sdk.dir=C\:\\Users\\nesto\\AppData\\Local\\Android\\Sdk
```

### JVM crash durante Gradle build
El heap es insuficiente. En `gradle.properties`:
```
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
```

### pnpm install falla con ERR_PNPM_WORKSPACE_PKG_NOT_FOUND
Verificar que existe `pnpm-workspace.yaml` en la raíz con:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Supabase project pausado (free tier)
Los proyectos free se pausan tras 7 días sin actividad. Se reanudan solos al primer request (puede tardar ~30 segundos). Para evitarlo, activar un ping periódico o upgradear a Pro.

---

## Arquitectura de datos

### Flujo offline-first

```
GPS (background) → WatermelonDB (SQLite local)
                         ↓
              [cuando hay red o app vuelve al frente]
                         ↓
              POST /api/sync (Vercel)
                         ↓
              Supabase (PostgreSQL + PostGIS)
```

### Tablas Supabase

**`sessions`**: id, user_id, local_id, started_at, ended_at, duration_seconds, distance_meters, avg_pace_sec_per_km, max_speed_mps, avg_speed_mps, elevation_gain_meters, activity_type, route (GEOMETRY LINESTRING), notes

**`gps_points`**: id, session_id, recorded_at, latitude, longitude, altitude, accuracy, speed_mps, heading, point (GEOMETRY POINT)

Ambas tablas tienen RLS activo — cada usuario solo ve sus propios datos.

---

## Permisos Android requeridos

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION` → en Ajustes > Ubicación > "Permitir siempre"
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `ACTIVITY_RECOGNITION`

---

## Configuración verificada que funciona

| Componente | Versión |
|---|---|
| Expo SDK | 51.0.0 |
| React Native | 0.74.2 |
| Next.js | 14.2.35 |
| Gradle | 8.6 |
| AGP (Android Gradle Plugin) | según expo prebuild |
| pnpm | 9.x |
| Node.js | 20+ |
| Java | 17+ |
| `bundleInDebug` | true |
| `reactNativeArchitectures` | arm64-v8a |
