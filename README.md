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
| Mapa | react-native-maps con Google Maps (requiere API key) |
| Build APK | EAS Build (cloud, evita límite de 260 chars en Windows) |
| Actualizaciones OTA | EAS Update (expo-updates) — sin nuevo APK |
| Sesión persistente | AsyncStorage (@react-native-async-storage/async-storage) |
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
| Supabase proyecto | https://uladjlfafzcrnrrnbkpa.supabase.co |
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
EXPO_PUBLIC_SUPABASE_URL=https://uladjlfafzcrnrrnbkpa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key de Supabase>
EXPO_PUBLIC_API_BASE_URL=https://runningles-api.vercel.app
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<API key de Google Maps>
```

Crear `apps/web/.env.local` (copiar desde `.env.local.example`):
```
SUPABASE_URL=https://uladjlfafzcrnrrnbkpa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key de Supabase>
```

> Las keys están en **Supabase → Settings → API**.
> `anon` key = pública (va en la app). `service_role` key = secreta (solo en el backend/Vercel).

### 3. Migraciones Supabase

En **Supabase → SQL Editor**, ejecutar en orden:

1. `supabase/migrations/001_initial.sql`
2. `supabase/migrations/002_weekly_distance_fn.sql`

### 4. Variables de entorno en EAS (para builds de la app)

En **expo.dev → proyecto running-les → Environment Variables** agregar:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

Environment: **Production**.

### 5. Configurar Supabase para deep links (emails de confirmación)

En **Supabase → Authentication → URL Configuration**:
- **Site URL** → `running-les://`
- **Redirect URLs** → agregar `running-les://`

Esto hace que el link del email de verificación abra la app directamente en lugar de redirigir a `localhost`.

### 6. Variables de entorno en Vercel

En **vercel.com → runningles-api → Settings → Environment Variables** agregar:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Marcar ambas como **Production**.

### 7. Configurar EAS CLI

```bash
npm install -g eas-cli
cd apps/mobile
eas login    # cuenta Expo (nestorcode)
```

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

### Método recomendado: EAS Build (cloud)

En Windows, el límite de 260 caracteres en rutas impide compilar con Gradle local. Usamos **EAS Build** para compilar en la nube.

#### Prerrequisitos únicos

```bash
npm install -g eas-cli
cd apps/mobile
eas login          # cuenta Expo
```

#### Build APK (production)

```bash
cd apps/mobile
eas build --platform android --profile production --non-interactive
```

Al terminar, EAS entrega un link directo al APK:
```
🤖 Android app:
https://expo.dev/artifacts/eas/....apk
```

Descargar e instalar:
```bash
# En el dispositivo: descargar desde el link y abrir el APK
# (activar "Instalar desde fuentes desconocidas" en Ajustes)

# O via adb:
adb install <ruta-local-al-apk>
```

#### Variables de entorno en EAS

Las variables `EXPO_PUBLIC_*` deben cargarse en el dashboard de EAS:
- **expo.dev → proyecto running-les → Environment Variables**
- Cargar: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL`
- Environment: **Production**

#### Google Maps API Key

La API key de Google Maps va directamente en `app.config.ts` (campo `android.config.googleMaps.apiKey`). No hace falta variable de entorno ya que se embebe en el manifest nativo durante el build.

Para restringir la key (recomendado):
- Google Cloud Console → API key → Restricciones de aplicación → **Apps Android**
- Package name: `com.personal.runningl_es`
- SHA-1: obtener con `eas credentials`

### Build local (alternativa, solo en Linux/Mac)

```bash
cd apps/mobile
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease
```

> En Windows, el path de Gradle supera los 260 chars y el build falla. Usar EAS Build en su lugar.

---

## Actualizaciones OTA (EAS Update)

La app tiene `expo-updates` integrado. Cuando hay cambios **solo en JS/TS** (pantallas, lógica, estilos), no hace falta un nuevo APK — se publica un update y los usuarios lo reciben automáticamente la próxima vez que abran la app.

### ¿Cuándo usar EAS Update vs EAS Build?

| Tipo de cambio | Qué hacer |
|---|---|
| Código JS/TS (pantallas, lógica, estilos) | `eas update` — segundos, sin APK nuevo |
| Nueva dependencia nativa | `eas build` — nuevo APK (~20-30 min en cola free) |
| Cambio en `app.config.ts` (permisos, plugins) | `eas build` — nuevo APK |
| Cambio en backend | `vercel deploy --prod` |

### Publicar un update OTA

```bash
cd apps/mobile
eas update --branch production --message "fix: descripción del cambio"
```

Los usuarios reciben el update la próxima vez que abren la app (en background, sin interrupciones).

### Forzar un nuevo APK (cambios nativos)

```bash
cd apps/mobile
eas build --platform android --profile production --non-interactive
# Al terminar: link directo al APK para descargar e instalar
```

---

## Proceso completo para una nueva versión

```
1. Cambiar código
      ↓
2. git commit + git push
      ↓
3. ¿Cambios en el backend (apps/web)?
   → vercel deploy --prod
      ↓
4. ¿Cambios en la app?
   → Solo JS/TS:
      eas update --branch production --message "descripción"
      (usuarios lo reciben automáticamente)
   → Dependencias nativas / app.config.ts:
      eas build --platform android --profile production --non-interactive
      (descargar e instalar el nuevo APK)
```

---

## Solución de problemas conocidos

### "pnpm: no se reconoce"
```bash
npm install -g pnpm
```

### "No Next.js version detected" en Vercel
Verificar que el Root Directory en Vercel esté **vacío** (no `apps/web`).

### Build local falla en Windows (path demasiado largo)
Gradle en Windows supera el límite de 260 caracteres. Solución: usar **EAS Build** (cloud).

### App se queda en splash / crash al iniciar
- Revisar que WatermelonDB esté con `jsi: false` en `src/services/database/index.ts`.
- Verificar que `react-native-safe-area-context`, `react-native-gesture-handler` y `react-native-reanimated` están en las dependencias de `apps/mobile/package.json`.

### Mapa en blanco o "Access blocked"
- OpenStreetMap bloquea requests desde emuladores. La app usa **Google Maps** (`PROVIDER_GOOGLE`).
- Verificar que la Google Maps API key esté en `app.config.ts` → `android.config.googleMaps.apiKey`.

### "captcha verification failed" en registro/login
El proyecto de Supabase puede tener captcha activado. Verificar en **Supabase → Authentication → Settings → Enable captcha protection** y desactivarlo si es para desarrollo, o asegurarse de que el proyecto es el correcto (`uladjlfafzcrnrrnbkpa`).

### Email de confirmación redirige a localhost
Configurar en **Supabase → Authentication → URL Configuration**:
- Site URL: `running-les://`
- Redirect URLs: agregar `running-les://`

### `eas update` no llega a los usuarios
Verificar que el build fue compilado con el canal `production` (`channel: "production"` en `eas.json`). Un APK compilado sin canal no puede recibir updates OTA.

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

| Componente | Versión / Detalle |
|---|---|
| Expo SDK | 51.0.0 |
| React Native | 0.74.2 |
| expo-router | 3.5.x |
| Next.js | 14.2.35 |
| pnpm | 9.x |
| Node.js | 20+ |
| EAS CLI | 10.0+ |
| expo-updates | 0.25.28 (OTA updates activo, canal `production`) |
| AsyncStorage | 1.23.1 (sesión Supabase persiste entre reinicios) |
| WatermelonDB JSI | **false** (JSI nativo causa crash en EAS builds) |
| Proveedor de mapas | `PROVIDER_GOOGLE` (OSM bloqueado en producción) |
| Metro config | monorepo-aware (`watchFolders` + `nodeModulesPaths`) |
| Supabase proyecto | `uladjlfafzcrnrrnbkpa` (proyecto dedicado, sin captcha) |
| Supabase deep link | Site URL = `running-les://` (emails abren la app) |
