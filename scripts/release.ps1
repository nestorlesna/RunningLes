# Uso: .\scripts\release.ps1 1.0.1
param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$GradlePath = "apps/mobile/android/app/build.gradle"
$Content = Get-Content $GradlePath -Raw

# Extraer versionCode actual
$CurrentCode = [regex]::Match($Content, 'versionCode\s+(\d+)').Groups[1].Value
$NewCode = [int]$CurrentCode + 1

Write-Host "Bumping: versionCode $CurrentCode → $NewCode, versionName → $Version"

# Actualizar build.gradle
$Content = $Content -replace "versionCode\s+$CurrentCode", "versionCode $NewCode"
$Content = $Content -replace 'versionName\s+"[^"]*"', "versionName `"$Version`""
Set-Content $GradlePath $Content -NoNewline

# Commit y tag
git add apps/mobile/android/app/build.gradle
git commit -m "chore: bump version to $Version"
git tag "v$Version"
git push origin HEAD
git push origin "v$Version"

Write-Host "Release v$Version iniciado. Ver progreso en GitHub Actions."
