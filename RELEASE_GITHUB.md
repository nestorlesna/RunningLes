# GitHub Releases — APK Distribution Guide

> Guía de implementación para proyectos React + Capacitor + Android.
> Exportable a cualquier proyecto de características similares.

---

## Contexto de referencia

Este documento está basado en el proyecto **PencaLes 2026** con las siguientes características:

| Parámetro | Valor de referencia |
|-----------|---------------------|
| Framework | React 18 + TypeScript + Vite |
| Mobile wrapper | Capacitor 8 |
| App ID | `com.pencales.app` |
| Nombre del APK | `Penca2026uy.apk` |
| Java target | JDK 21 |
| `versionCode` actual | 6 |
| `versionName` actual | `1.0.6` |
| Archivo de versión | `android/app/build.gradle` |

Adaptar estos valores al proyecto destino antes de implementar.

---

## 1. Cómo funciona el flujo

```
Developer                GitHub                  Usuario final
    │                       │                         │
    ├─ git tag v1.0.7 ─────►│                         │
    ├─ git push --tags ─────►│                         │
    │                       │ GitHub Actions dispara   │
    │                       ├─ npm install             │
    │                       ├─ npm run build           │
    │                       ├─ npx cap sync            │
    │                       ├─ ./gradlew assembleRelease│
    │                       ├─ Firma APK               │
    │                       ├─ Crea GitHub Release     │
    │                       └─ Sube APK al Release ───►│
    │                                                  ├─ Descarga APK
    │                                                  └─ Instala en Android
```

El trigger es un **tag de git con prefijo `v`**. Cada vez que se hace push de un tag `v*`, el workflow construye y publica automáticamente.

---

## 2. Prerrequisitos

### 2.1 Keystore para firma del APK

Los APKs de Android deben estar firmados. Se necesita un archivo keystore. Si el proyecto ya tiene uno (por ejemplo, para publicar en Play Store), se reutiliza ese mismo.

**Generar un keystore nuevo** (solo si no existe):

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias <ALIAS_NAME> \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Guardar el archivo `.keystore` de forma segura. **No subir al repositorio.**

**Convertir a base64** para almacenarlo como secret de GitHub:

```bash
# Linux/Mac
base64 -i release.keystore | tr -d '\n'

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore"))
```

### 2.2 Secrets de GitHub requeridos

En el repositorio: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Contenido |
|--------|-----------|
| `KEYSTORE_BASE64` | Contenido del `.keystore` en base64 |
| `KEYSTORE_PASSWORD` | Password del keystore |
| `KEY_ALIAS` | Alias de la clave dentro del keystore |
| `KEY_PASSWORD` | Password de la clave (puede ser igual al del keystore) |

### 2.3 Carpeta `android/` en el repositorio

La carpeta `android/` generada por Capacitor **debe estar commiteada** en el repositorio. GitHub Actions hace checkout del repo y luego ejecuta `npx cap sync android` para copiar los assets web, pero no puede crear la carpeta desde cero.

Verificar que `.gitignore` **no excluya** la raíz de `android/`. Solo deben ignorarse los artefactos de build:

```
# Correcto — solo ignorar outputs de build
android/app/build/
android/.gradle/
android/build/

# Incorrecto — esto rompe el workflow
android/
```

Commitear la carpeta si aún no está en el repo:

```bash
git add android/
git commit -m "feat: add android native project"
git push
```

### 2.4 Permisos del workflow

En **Settings → Actions → General → Workflow permissions**: activar **"Read and write permissions"** para que el workflow pueda crear releases.

---

## 3. Configurar firma en build.gradle

Editar `android/app/build.gradle` para agregar `signingConfigs` que lean las variables de entorno inyectadas por el workflow:

```groovy
android {
    // ... configuración existente ...

    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE") ?: "debug.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
            keyAlias System.getenv("KEY_ALIAS") ?: ""
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release  // ← agregar esta línea
        }
    }
}
```

> **Nota:** En desarrollo local sin esas variables de entorno, el build de release fallará la firma pero el debug seguirá funcionando normalmente. Para builds locales de release, setear las variables de entorno manualmente o usar un keystore de debug.

---

## 4. El workflow de GitHub Actions

Crear el archivo `.github/workflows/release-apk.yml`:

```yaml
name: Build & Release APK

on:
  push:
    tags:
      - 'v*'          # Dispara en cualquier tag que empiece con "v"

permissions:
  contents: write     # Necesario para crear GitHub Releases

jobs:
  build-apk:
    name: Build APK and Create Release
    runs-on: ubuntu-latest

    steps:
      # 1. Checkout del código en el tag
      - name: Checkout code
        uses: actions/checkout@v4

      # 2. Configurar Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # 3. Instalar dependencias web
      - name: Install dependencies
        run: npm ci

      # 4. Build del proyecto web (Vite)
      - name: Build web app
        run: npm run build

      # 5. Sincronizar Capacitor (copia dist/ a android/app/src/main/assets)
      - name: Sync Capacitor
        run: npx cap sync android

      # 6. Configurar JDK 21
      - name: Setup Java JDK
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'

      # 7. Cache de Gradle para acelerar builds posteriores
      - name: Cache Gradle packages
        uses: actions/cache@v4
        with:
          path: |
            ~/.gradle/caches
            ~/.gradle/wrapper
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
          restore-keys: |
            ${{ runner.os }}-gradle-

      # 8. Dar permisos de ejecución a Gradle wrapper
      - name: Make Gradle executable
        run: chmod +x android/gradlew

      # 9. Decodificar el keystore desde el secret
      - name: Decode Keystore
        run: |
          echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > android/app/release.keystore

      # 10. Build del APK release (firmado)
      - name: Build Release APK
        working-directory: android
        env:
          KEYSTORE_FILE: release.keystore
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: ./gradlew assembleRelease --no-daemon

      # 11. Encontrar el APK generado y renombrar si hace falta
      #     Se excluye el nombre destino del find para evitar "same file" error
      - name: Find and rename APK
        id: find_apk
        run: |
          APK_DEST="android/app/build/outputs/apk/release/CrossFitLes.apk"
          APK_SOURCE=$(find android/app/build/outputs/apk/release/ -name "*.apk" ! -name "CrossFitLes.apk" | head -1)
          if [ -n "$APK_SOURCE" ]; then
            mv "$APK_SOURCE" "$APK_DEST"
          fi
          echo "apk_path=$APK_DEST" >> $GITHUB_OUTPUT

      # 12. Extraer versión del tag (quita el prefijo "v")
      - name: Extract version
        id: version
        run: echo "version=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      # 13. Crear GitHub Release y subir el APK
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          name: "v${{ steps.version.outputs.version }}"
          tag_name: ${{ github.ref_name }}
          body: |
            ## Instalación

            1. Descargar el archivo `.apk` desde los assets de abajo
            2. En Android: **Configuración → Seguridad → Instalar apps desconocidas** (activar para el navegador/explorador usado)
            3. Abrir el APK descargado e instalar
            4. Si ya tenías la app instalada, se actualizará automáticamente manteniendo tus datos

            ---
            *Build generado automáticamente desde el tag `${{ github.ref_name }}`*
          files: ${{ steps.find_apk.outputs.apk_path }}
          draft: false
          prerelease: false
```

---

## 5. Gestión de versiones

### Dónde vive la versión

El archivo canónico es `android/app/build.gradle`:

```groovy
defaultConfig {
    versionCode 6        // ← entero, incrementar en cada release
    versionName "1.0.6"  // ← string visible al usuario
}
```

**Reglas:**
- `versionCode` debe ser siempre mayor al anterior (Android no instala un APK con versionCode igual o menor al instalado)
- `versionName` es libre, pero seguir semver: `MAJOR.MINOR.PATCH`

### Proceso de release

```bash
# 1. Actualizar versión en android/app/build.gradle
#    versionCode 6 → 7
#    versionName "1.0.6" → "1.0.7"

# 2. Commit del cambio de versión
git add android/app/build.gradle
git commit -m "chore: bump version to 1.0.7"

# 3. Crear y subir el tag
git tag v1.0.7
git push origin v1.0.7

# El workflow se dispara automáticamente en GitHub
```

> El nombre del tag debe coincidir con `versionName` por convención, pero técnicamente son independientes.

---

## 6. Script de release local (opcional)

Para no olvidar pasos, crear `scripts/release.sh` en el proyecto:

```bash
#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Uso: ./scripts/release.sh 1.0.7"
  exit 1
fi

# Extraer versionCode actual e incrementar
CURRENT_CODE=$(grep 'versionCode' android/app/build.gradle | tr -dc '0-9')
NEW_CODE=$((CURRENT_CODE + 1))

echo "Bumping: versionCode $CURRENT_CODE → $NEW_CODE, versionName → $VERSION"

# Actualizar build.gradle (requiere sed compatible)
sed -i "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" android/app/build.gradle
sed -i "s/versionName \".*\"/versionName \"$VERSION\"/" android/app/build.gradle

# Commit y tag
git add android/app/build.gradle
git commit -m "chore: bump version to $VERSION"
git tag "v$VERSION"
git push origin HEAD
git push origin "v$VERSION"

echo "Release v$VERSION iniciado. Ver progreso en GitHub Actions."
```

```bash
# Dar permisos y usar:
chmod +x scripts/release.sh
./scripts/release.sh 1.0.7
```

---

## 7. Variables de entorno adicionales (si aplica)

Si la app usa variables de entorno en el build web (por ejemplo, Supabase keys en `.env`), agregarlas como secrets y pasarlas en el step de build:

```yaml
# En el step "Build web app" del workflow:
- name: Build web app
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: npm run build
```

Agregar los secrets correspondientes en GitHub igual que los del keystore.

---

## 8. Notificación de nueva versión en la app (opcional pero recomendado)

Para que los usuarios sepan que hay una actualización disponible, la app puede consultar la última release de GitHub y mostrar un banner.

### 8.1 Endpoint de GitHub API (sin autenticación, público)

```
GET https://api.github.com/repos/{owner}/{repo}/releases/latest
```

### 8.2 Hook de React

```typescript
// src/hooks/useLatestRelease.ts
import { useEffect, useState } from 'react'

const REPO = 'owner/repo-name'  // ← reemplazar

interface ReleaseInfo {
  version: string
  downloadUrl: string
  releaseUrl: string
}

export function useLatestRelease(currentVersion: string) {
  const [update, setUpdate] = useState<ReleaseInfo | null>(null)

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then(r => r.json())
      .then(data => {
        const latestTag = data.tag_name?.replace(/^v/, '') // "v1.0.7" → "1.0.7"
        if (latestTag && latestTag !== currentVersion) {
          const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'))
          setUpdate({
            version: latestTag,
            downloadUrl: apkAsset?.browser_download_url ?? data.html_url,
            releaseUrl: data.html_url,
          })
        }
      })
      .catch(() => {})  // silencioso si no hay red
  }, [currentVersion])

  return update
}
```

### 8.3 Uso en la app

```typescript
// Versión hardcodeada que se actualiza con cada release
const APP_VERSION = '1.0.6'

function App() {
  const update = useLatestRelease(APP_VERSION)

  return (
    <>
      {update && (
        <div className="update-banner">
          Nueva versión {update.version} disponible.{' '}
          <a href={update.downloadUrl}>Descargar</a>
        </div>
      )}
      {/* ... resto de la app ... */}
    </>
  )
}
```

> Mantener `APP_VERSION` sincronizado con `versionName` en `build.gradle`. Se puede automatizar leyendo el valor desde un archivo compartido, pero para proyectos pequeños la actualización manual al momento del release es suficiente.

---

## 9. Checklist de implementación

```
[ ] Keystore generado y guardado en lugar seguro
[ ] Keystore convertido a base64
[ ] 4 secrets cargados en GitHub (KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD)
[ ] Secrets de variables de entorno cargados (VITE_SUPABASE_URL, etc.)
[ ] Permisos del workflow configurados (Read and write)
[ ] signingConfigs agregado a android/app/build.gradle
[ ] Carpeta android/ commiteada en el repositorio (verificar .gitignore — ver sección 2.3)
[ ] Archivo .github/workflows/release-apk.yml creado
[ ] Primer release de prueba ejecutado (git tag v0.0.1 && git push --tags)
[ ] APK verificado: descargado e instalado en Android físico
[ ] (Opcional) Hook useLatestRelease implementado con REPO correcto
[ ] (Opcional) APP_VERSION hardcodeada coincide con versionName
[ ] (Opcional) script scripts/release.sh creado y funcional
```

---

## 10. Troubleshooting frecuente

### "cannot access 'android/gradlew': No such file or directory"

La carpeta `android/` no está commiteada en el repositorio. El workflow hace checkout del repo y si `android/` no existe, `chmod +x android/gradlew` falla.

Solución: ver sección 2.3 — commitear la carpeta `android/` completa.

### "'CrossFitLes.apk' and 'CrossFitLes.apk' are the same file"

El APK ya salió del build con ese nombre exacto, por lo que el `mv` intenta renombrarlo a sí mismo. La solución es excluir el nombre destino del `find`:

```bash
# En lugar de:
APK_SOURCE=$(find ... -name "*.apk" | head -1)

# Usar:
APK_SOURCE=$(find ... -name "*.apk" ! -name "CrossFitLes.apk" | head -1)
if [ -n "$APK_SOURCE" ]; then mv "$APK_SOURCE" "$APK_DEST"; fi
```

El workflow del paso 4 ya incluye esta versión corregida.

### El APK no se instala ("App no instalada")
- El `versionCode` del APK nuevo debe ser **mayor** al instalado
- Si hubo un build de debug anterior, desinstalar la app primero

### El workflow falla en el paso de firma
- Verificar que `signingConfigs.release` esté en `buildTypes.release` en `build.gradle`
- Verificar que las variables de entorno `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` estén seteadas en el step de Gradle
- El path del keystore en el step es relativo a `android/app/` (donde se ejecuta Gradle)

### "Permission denied" al crear el release
- Verificar **Settings → Actions → General → Workflow permissions → Read and write permissions**

### El APK no tiene el contenido web actualizado
- Verificar que el step `npx cap sync android` esté **después** del build de Vite (`npm run build`)
- Capacitor copia `dist/` a los assets de Android en ese step

### Variables de entorno VITE_ no disponibles en el build
- Las variables `VITE_*` deben pasarse como `env:` en el step específico de build, no solo como secrets

### Build lento (más de 10 minutos)
- El cache de Gradle (step 7) reduce builds posteriores de ~8 min a ~3 min
- Verificar que el cache key incluya los archivos `.gradle` correctos
