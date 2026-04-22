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
| Mapa móvil | react-native-maps con Google Maps (requiere API key) |
| Build APK | GitHub Actions + Gradle (firma automática, APK en GitHub Releases) |
| Build APK manual | Android Studio (Generate Signed APK) |
| Actualizaciones OTA | EAS Update (expo-updates) — sin nuevo APK |
| Sesión persistente | AsyncStorage (@react-native-async-storage/async-storage) |
| Web frontend | Next.js 14 (landing, login, dashboard, mapa de rutas) |
| Mapa web | Leaflet + OpenStreetMap (sin API key) |
| Backend API | Next.js 14 (API Routes) |
| Deploy web + API | Vercel (free tier) |
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
│   │   └── android/          # Proyecto Android nativo (commiteado en el repo)
│   └── web/                  # Next.js (frontend + backend)
│       ├── app/
│       │   ├── page.tsx      # Landing page (/)
│       │   ├── login/        # Login con Supabase (/login)
│       │   ├── dashboard/    # Stats + historial (/dashboard)
│       │   │   └── sessions/[id]  # Detalle + mapa de ruta
│       │   └── api/
│       │       ├── sync/     # POST /api/sync — WatermelonDB sync
│       │       ├── sessions/ # GET/DELETE /api/sessions
│       │       └── stats/    # GET /api/stats
│       ├── components/
│       │   └── RouteMap.tsx  # Mapa Leaflet (carga dinámica, sin SSR)
│       └── lib/
│           ├── supabase.ts        # Cliente service-role (server only)
│           ├── supabase-browser.ts # Cliente anon (browser)
│           └── auth.ts            # Validación JWT
├── packages/
│   └── shared/               # Tipos TS, schemas Zod, haversine, formatTime
└── supabase/
    └── migrations/           # SQL para Supabase
```

---

## URLs de producción

| Servicio | URL |
|---|---|
| Web (landing) | https://runningles-api.vercel.app |
| Web (login) | https://runningles-api.vercel.app/login |
| Web (dashboard) | https://runningles-api.vercel.app/dashboard |
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

Crear `apps/web/.env.local`:
```
# Solo servidor (API routes) — nunca exponer al browser
SUPABASE_URL=https://uladjlfafzcrnrrnbkpa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key de Supabase>

# Browser (login, dashboard) — seguro exponer
NEXT_PUBLIC_SUPABASE_URL=https://uladjlfafzcrnrrnbkpa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key de Supabase>
```

> Las keys están en **Supabase → Settings → API**.
> `anon public` = pública (browser + app móvil). `service_role secret` = solo backend/Vercel.

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
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Marcar todas como **Production**.

> Alternativa rápida: `cd apps/web && vercel env pull` descarga las variables automáticamente.

### 7. Configurar EAS CLI

```bash
npm install -g eas-cli
cd apps/mobile
eas login    # cuenta Expo (nestorcode)
```

---

## Prueba local (web)

```bash
cd apps/web
pnpm dev
```

Abre http://localhost:3000 en el browser.

| Ruta | Qué muestra |
|---|---|
| `/` | Landing page |
| `/login` | Login con email/password |
| `/dashboard` | Stats + historial de sesiones |
| `/dashboard/sessions/[id]` | Detalle con mapa de ruta |

> Requiere que `apps/web/.env.local` tenga las 4 variables configuradas. Ver sección **Variables de entorno**.

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
- Root Directory en Vercel dashboard → `apps/web`

> El `vercel.json` en `apps/web/` ya configura el install y build command para el monorepo pnpm.

### Deploys futuros (nuevas versiones)

```bash
# Desde la raíz del monorepo
git add .
git commit -m "feat: descripción del cambio"
git push origin develop

# Merge a main
git checkout main
git merge develop
git push origin main
git checkout develop

# Deploy
vercel deploy --prod
```

O conectar el repo a Vercel para **deploy automático en cada push a main**:
- Vercel dashboard → proyecto → Settings → Git → conectar repositorio GitHub.

### Verificar que funciona

```bash
# Landing page (debe cargar sin auth)
curl -s -o /dev/null -w "%{http_code}" https://runningles-api.vercel.app
# Esperado: 200

# API (debe requerir auth)
curl https://runningles-api.vercel.app/api/stats
# Esperado: {"error":"Missing or invalid Authorization header"}
```

O abrir directamente en el browser:
- https://runningles-api.vercel.app → landing page
- https://runningles-api.vercel.app/login → login
- https://runningles-api.vercel.app/dashboard → redirige a login si no estás autenticado

---

## Build de la app Android

### Método automático: GitHub Actions (recomendado para distribución)

Al crear un tag `v*`, GitHub Actions compila el APK firmado y lo publica en GitHub Releases automáticamente. Ver sección [Release — Distribución automática](#release--distribución-automática-github-actions).

### Build manual desde Android Studio

Para builds de prueba o cuando se quiere el APK sin publicar una release:

1. Desde la raíz del monorepo, instalar dependencias:
   ```bash
   pnpm install
   ```

2. Abrir Android Studio → **Open** → seleccionar la carpeta `apps/mobile/android/`

3. Esperar que Gradle sincronice (primera vez tarda varios minutos)

4. Menú **Build → Generate Signed Bundle / APK**

5. Elegir **APK** → Next

6. En *Key store path* apuntar a `KEY/release.keystore`
   - *Key store password*: contraseña del keystore
   - *Key alias*: `runningl_es`
   - *Key password*: contraseña de la clave

7. Elegir variante **release** → Next → **Finish**

El APK firmado queda en `apps/mobile/android/app/release/RunningLes.apk`.

> El JS bundle se compila automáticamente durante el build de Gradle (Metro bundler se invoca internamente). No hace falta un paso separado de build web.

---

## Release — Distribución automática (GitHub Actions)

El APK se genera y publica automáticamente mediante **GitHub Actions** al crear un tag con prefijo `v`.

### Secrets de GitHub (configurar una sola vez)

En **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Contenido |
|--------|-----------|
| `KEYSTORE_BASE64` | Keystore en base64 — ver comando abajo |
| `KEYSTORE_PASSWORD` | Contraseña del keystore |
| `KEY_ALIAS` | Alias de la clave (`runningl_es`) |
| `KEY_PASSWORD` | Contraseña de la clave |
| `EXPO_PUBLIC_SUPABASE_URL` | URL de Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `EXPO_PUBLIC_API_BASE_URL` | URL del backend (`https://runningles-api.vercel.app`) |

Para generar el valor de `KEYSTORE_BASE64`:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("KEY\release.keystore")) | Set-Clipboard
```

También activar **Settings → Actions → General → Workflow permissions → Read and write permissions**.

### Publicar una nueva versión

```powershell
# Desde la raíz del monorepo — actualiza build.gradle, hace commit, tag y push
.\scripts\release.ps1 1.0.1
```

El script:
1. Incrementa `versionCode` en `apps/mobile/android/app/build.gradle`
2. Actualiza `versionName` al valor indicado
3. Hace commit, crea el tag `v1.0.1` y hace push

GitHub Actions construye el APK firmado y lo publica como GitHub Release con `RunningLes.apk` adjunto.

### Flujo resumido

```
.\scripts\release.ps1 X.Y.Z
  → bump versionCode/versionName en build.gradle
  → git commit + tag vX.Y.Z + push
  → GitHub Actions: pnpm install → gradle assembleRelease (Metro bundlea el JS internamente)
  → firma APK con keystore desde secrets
  → GitHub Release con RunningLes.apk adjunto
```

> El keystore vive en `KEY/` (ignorado por git). No subir al repositorio.

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

### Publicar un update OTA (solo JS/TS)

```bash
# Desde la raíz del monorepo
git add .
git commit -m "feat: descripción del cambio"
git push origin develop

git checkout main
git merge develop
git push origin main
git checkout develop

cd apps/mobile
eas update --branch production --message "descripción del cambio"
```

Los usuarios reciben el update la próxima vez que abren la app (en background, sin interrupciones).

### Nuevo APK (cambios nativos)

```bash
# Desde la raíz del monorepo
git add .
git commit -m "feat: descripción del cambio"
git push origin develop

git checkout main
git merge develop
git push origin main
git checkout develop

cd apps/mobile
eas build --platform android --profile production --non-interactive
# Al terminar: link directo al APK para descargar e instalar
```

---

## Proceso completo para una nueva versión

| Qué cambió | Comando de deploy |
|---|---|
| `apps/web/` (backend) | `vercel deploy --prod` |
| JS/TS en la app | `eas update --branch production --message "..."` |
| Nuevo APK para distribución | `.\scripts\release.ps1 X.Y.Z` |

---

## Deploy completo (git + producción)

Secuencia completa desde commit hasta producción:

```bash
# 1. Staging y commit
git add .
git commit -m "feat: descripción del cambio"

# 2. Push a develop
git push origin develop

# 3. Merge a main
git checkout main
git merge develop
git push origin main

# 4. Volver a develop
git checkout develop

# 5. Deploy backend (si hay cambios en apps/web)
vercel deploy --prod

# 6a. Deploy app — solo cambios JS/TS (rápido, sin nuevo APK)
cd apps/mobile
eas update --branch production --message "descripción del cambio"

# 6b. Nuevo APK — desde la raíz del monorepo (PowerShell)
.\scripts\release.ps1 X.Y.Z
# GitHub Actions compila y publica RunningLes.apk en GitHub Releases
```

---

## Solución de problemas conocidos

### "pnpm: no se reconoce"
```bash
npm install -g pnpm
```

### "No Next.js version detected" en Vercel
Verificar que el Root Directory en Vercel esté configurado como `apps/web` (Settings → General → Root Directory).

### Build local falla en Windows (path demasiado largo)
Gradle en Windows puede superar el límite de 260 caracteres. Usar **Android Studio** para builds locales (maneja las rutas internamente) o publicar via `.\scripts\release.ps1` para que compile en GitHub Actions (Linux).

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
| EAS CLI | 10.0+ (solo para OTA updates, no para builds de APK) |
| expo-updates | 0.25.28 (OTA updates activo, canal `production`) |
| AsyncStorage | 1.23.1 (sesión Supabase persiste entre reinicios) |
| WatermelonDB JSI | **false** (JSI nativo causa crash en EAS builds) |
| Proveedor de mapas | `PROVIDER_GOOGLE` (OSM bloqueado en producción) |
| Metro config | monorepo-aware (`watchFolders` + `nodeModulesPaths`) |
| Supabase proyecto | `uladjlfafzcrnrrnbkpa` (proyecto dedicado, sin captcha) |
| Supabase deep link | Site URL = `running-les://` (emails abren la app) |
