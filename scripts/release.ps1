# Uso: .\scripts\release.ps1 1.0.3
# Uso (sin deploy web): .\scripts\release.ps1 1.0.3 -SkipWeb
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n→ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

# ── 1. Commitear cambios pendientes ──────────────────────────────────────────
$uncommitted = git status --porcelain
if ($uncommitted) {
    Write-Host ""
    Write-Warn "Cambios sin commitear:"
    git status --short
    Write-Host ""
    $answer = Read-Host "  ¿Commitear todo ahora? (s/n)"
    if ($answer -ieq 's') {
        $msg = Read-Host "  Mensaje del commit (Enter = 'chore: pre-release changes')"
        if (-not $msg) { $msg = "chore: pre-release changes" }
        git add .
        git commit -m $msg
        Write-Ok "Commit creado"
    } else {
        Write-Host "  Commiteá los cambios antes de continuar." -ForegroundColor Red
        exit 1
    }
}

# ── 2. Push develop ───────────────────────────────────────────────────────────
Write-Step "Pusheando develop..."
git push origin develop
Write-Ok "develop actualizado"

# ── 3. Merge develop → main ───────────────────────────────────────────────────
Write-Step "Mergeando develop → main..."
git checkout main
git pull origin main
git merge develop --no-ff -m "chore: merge develop for v$Version"
git push origin main
git checkout develop
Write-Ok "main actualizado"

# ── 4. Deploy web (Vercel) ────────────────────────────────────────────────────
if ($SkipWeb) {
    Write-Warn "Web deploy omitido (-SkipWeb)"
} else {
    Write-Step "Deploying web en Vercel..."
    vercel deploy --prod --force
    Write-Ok "Web deployado → https://runningles-api.vercel.app"
}

# ── 5. Bump versión APK + tag ─────────────────────────────────────────────────
Write-Step "Bumpeando versión APK..."
$GradlePath = "apps/mobile/android/app/build.gradle"
$Content = Get-Content $GradlePath -Raw

$CurrentCode = [regex]::Match($Content, 'versionCode\s+(\d+)').Groups[1].Value
$NewCode = [int]$CurrentCode + 1

Write-Host "  versionCode $CurrentCode → $NewCode, versionName → $Version"

$Content = $Content -replace "versionCode\s+$CurrentCode", "versionCode $NewCode"
$Content = $Content -replace 'versionName\s+"[^"]*"', "versionName `"$Version`""
Set-Content $GradlePath $Content -NoNewline

$AppConfigPath = "apps/mobile/app.config.ts"
$AppConfig = Get-Content $AppConfigPath -Raw
$AppConfig = $AppConfig -replace "version: '[^']*'", "version: '$Version'"
Set-Content $AppConfigPath $AppConfig -NoNewline

git add apps/mobile/android/app/build.gradle apps/mobile/app.config.ts
git commit -m "chore: bump version to $Version"
git tag "v$Version"
git push origin HEAD
git push origin "v$Version"

# ── Resultado ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "─────────────────────────────────────────────" -ForegroundColor Green
Write-Host " Release v$Version en progreso" -ForegroundColor Green
Write-Host "─────────────────────────────────────────────" -ForegroundColor Green
Write-Host " APK (en ~10 min): github.com/nestorlesna/RunningLes/releases"
if (-not $SkipWeb) {
    Write-Host " Web:              https://runningles-api.vercel.app"
}
Write-Host ""
