# RunningLes — Guía de instalación

## Prerrequisitos

| Herramienta | Versión mínima |
|---|---|
| Node.js | 20+ |
| pnpm | 9+ (`npm i -g pnpm`) |
| EAS CLI | última (`npm i -g eas-cli`) |
| Android SDK / adb | cualquier versión reciente |
| Cuenta Supabase | gratuita |
| Cuenta Vercel | gratuita |

---

## 1. Clonar e instalar dependencias

```bash
git clone <repo-url> runningl-es
cd runningl-es
pnpm install
```

---

## 2. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutar en orden:
   ```
   supabase/migrations/001_initial.sql
   supabase/migrations/002_weekly_distance_fn.sql
   ```
3. Ir a **Project Settings → API** y copiar:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (nunca exponer en la app)

---

## 3. Variables de entorno

### Backend (`apps/web/.env.local`)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Mobile (`apps/mobile/.env`)
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_API_BASE_URL=https://tu-app.vercel.app
```
> Durante desarrollo local podés usar `http://10.0.2.2:3000` (emulador Android → localhost).

---

## 4. Deploy del backend en Vercel

```bash
cd apps/web
vercel deploy --prod
```

Configurar las mismas variables de entorno en el dashboard de Vercel:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Copiar la URL del deploy a `EXPO_PUBLIC_API_BASE_URL` en el `.env` del mobile.

---

## 5. Configurar Mapbox (tiles offline)

1. Crear cuenta gratuita en [mapbox.com](https://mapbox.com).
2. Copiar el **Public access token**.
3. Después del `expo prebuild`, editar `apps/mobile/android/app/src/main/AndroidManifest.xml`:
   ```xml
   <application ...>
     <meta-data
       android:name="MAPBOX_ACCESS_TOKEN"
       android:value="pk.eyJ1IjoiTU..."
     />
   ```

---

## 6. Generar proyecto Android nativo

```bash
cd apps/mobile
pnpm prebuild
# Esto genera apps/mobile/android/ con el código nativo
```

> Requiere Java 17+ y Android SDK instalado.

---

## 7. Instalar en el dispositivo

### Opción A — Build local con EAS
```bash
cd apps/mobile
eas build --platform android --local
# Genera un .apk en la raíz del proyecto
adb install <nombre-del-archivo>.apk
```

### Opción B — Correr directo con cable USB
```bash
cd apps/mobile
pnpm android
# Requiere dispositivo con depuración USB activada
```

---

## 8. Permisos de ubicación en Android 13+

Al iniciar la primera sesión la app pedirá permisos automáticamente. Si fueron denegados:

1. Ir a **Ajustes → Aplicaciones → RunningLes → Permisos → Ubicación**.
2. Seleccionar **"Permitir siempre"** (no solo "Al usar la aplicación").
3. El permiso de **actividad física** (`ACTIVITY_RECOGNITION`) también se pedirá en el flujo.

---

## 9. Desarrollo local

```bash
# Terminal 1 — Backend API
cd apps/web && pnpm dev

# Terminal 2 — App móvil (requiere dispositivo o emulador)
cd apps/mobile && pnpm start
# luego presionar 'a' para abrir en Android
```

---

## Árbol de archivos generados

```
runningl-es/
├── apps/
│   ├── mobile/
│   │   ├── app/                    # pantallas Expo Router
│   │   │   ├── _layout.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx       # dashboard
│   │   │   │   ├── run.tsx         # sesión activa + mapa
│   │   │   │   ├── history.tsx     # historial
│   │   │   │   └── profile.tsx     # auth Supabase
│   │   │   └── session/[id].tsx    # detalle de sesión
│   │   └── src/
│   │       ├── components/         # RunMap, ActiveSessionHUD, etc.
│   │       ├── services/
│   │       │   ├── database/       # WatermelonDB schema, models, sync
│   │       │   └── location/       # backgroundTask, locationService
│   │       └── store/              # sessionStore, uiStore (Zustand)
│   └── web/
│       ├── app/api/
│       │   ├── sync/route.ts
│       │   ├── sessions/route.ts
│       │   ├── sessions/[id]/route.ts
│       │   └── stats/route.ts
│       └── lib/                    # supabase.ts, auth.ts
├── packages/shared/src/            # tipos, schemas Zod, haversine, formatTime
└── supabase/migrations/            # SQL inicial + función weekly_distance
```
