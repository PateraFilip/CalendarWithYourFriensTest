# Build + install development client na připojený Android telefon.
# Řeší častý Windows problém: cesta Gradle cache > 260 znaků.

$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'C:\g')) {
  New-Item -ItemType Directory -Path 'C:\g' | Out-Null
}

$env:GRADLE_USER_HOME = 'C:\g'

# Fyzické telefony = téměř vždy arm64
$arch = 'arm64-v8a'

Write-Host "GRADLE_USER_HOME=$env:GRADLE_USER_HOME"
Write-Host "Architectures=$arch"
Write-Host 'Checking adb devices...'
adb devices -l

Set-Location (Join-Path $PSScriptRoot '..\android')
.\gradlew.bat :app:assembleDebug "-PreactNativeArchitectures=$arch"

$apk = Join-Path (Get-Location) 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apk)) {
  throw "APK not found: $apk"
}

Write-Host "Installing $apk ..."
adb install -r $apk

Write-Host ''
Write-Host 'Hotovo. Spusť v druhém terminálu: npx expo start --dev-client'
Write-Host 'Pak otevři appku CalendarWithFriends na telefonu.'
