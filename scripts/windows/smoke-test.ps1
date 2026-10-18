param(
  [string]$ReleaseDirectory = "dist/windows/release"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($env:OS -ne "Windows_NT") {
  throw "The packaged runtime smoke test must run on Windows."
}

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$releasePath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $ReleaseDirectory))
$nodePath = Join-Path $releasePath "runtime\node.exe"
$launcherPath = Join-Path $releasePath "launcher\quickpos-launcher.mjs"
$stopPath = Join-Path $releasePath "launcher\quickpos-stop.mjs"
$temporaryRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$smokeRoot = Join-Path $temporaryRoot "quickpos-smoke-$([guid]::NewGuid().ToString('N'))"
$localAppData = Join-Path $smokeRoot "LocalAppData"
$quickPosData = Join-Path $localAppData "QuickPOS"
$port = Get-Random -Minimum 42000 -Maximum 52000
$baseUrl = "http://127.0.0.1:$port"

New-Item $quickPosData -ItemType Directory -Force | Out-Null
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  (Join-Path $quickPosData "config.json"),
  ((@{ port = $port } | ConvertTo-Json) + [Environment]::NewLine),
  $utf8WithoutBom
)

$env:LOCALAPPDATA = $localAppData
$env:QUICKPOS_HEADLESS = "1"
$env:QUICKPOS_NO_BROWSER = "1"

function Wait-ForHealth([System.Diagnostics.Process]$LauncherProcess) {
  $deadline = [DateTime]::UtcNow.AddMinutes(2)
  while ([DateTime]::UtcNow -lt $deadline) {
    $LauncherProcess.Refresh()
    if ($LauncherProcess.HasExited) {
      throw "The packaged launcher exited before QuickPOS became healthy."
    }

    try {
      $health = Invoke-RestMethod "$baseUrl/api/quickpos/health" -TimeoutSec 2
      if ($health.app -eq "QuickPOS" -and $health.status -eq "ok" -and $health.database -eq "ready") {
        return $health
      }
    }
    catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "The packaged QuickPOS server did not become healthy within two minutes."
}

function Start-PackagedQuickPos([int]$Attempt) {
  $stdout = Join-Path $smokeRoot "launcher-$Attempt.stdout.log"
  $stderr = Join-Path $smokeRoot "launcher-$Attempt.stderr.log"
  $process = Start-Process `
    -FilePath $nodePath `
    -ArgumentList ('"{0}"' -f $launcherPath) `
    -WorkingDirectory $releasePath `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -PassThru

  return @{ Health = (Wait-ForHealth $process); Process = $process }
}

function Stop-PackagedQuickPos([System.Diagnostics.Process]$LauncherProcess) {
  & $nodePath $stopPath
  if ($LASTEXITCODE -ne 0) {
    throw "The packaged shutdown command failed with exit code $LASTEXITCODE."
  }

  if (-not $LauncherProcess.WaitForExit(20000)) {
    throw "The packaged launcher did not exit after a successful shutdown."
  }
}

try {
  $firstRun = Start-PackagedQuickPos 1
  $homeResponse = Invoke-WebRequest "$baseUrl/" -UseBasicParsing -TimeoutSec 10
  $appIcon = Invoke-WebRequest "$baseUrl/web-app-manifest-192x192.png" -UseBasicParsing -TimeoutSec 10
  $favicon = Invoke-WebRequest "$baseUrl/favicon.ico" -UseBasicParsing -TimeoutSec 10
  $manifest = Invoke-RestMethod "$baseUrl/manifest.webmanifest" -TimeoutSec 10

  if ($homeResponse.StatusCode -ne 200 -or $homeResponse.Content -notmatch "QuickPOS") {
    throw "The packaged Home page did not render QuickPOS."
  }
  if ($appIcon.StatusCode -ne 200 -or $appIcon.Headers["Content-Type"] -notmatch "^image/png") {
    throw "The packaged PWA icon did not load."
  }
  if ($favicon.StatusCode -ne 200 -or $favicon.RawContentLength -lt 1000) {
    throw "The packaged favicon did not load."
  }
  $manifestIconPaths = @($manifest.icons | ForEach-Object { $_.src })
  if (
    $manifest.name -ne "QuickPOS" -or
    $manifestIconPaths -notcontains "/web-app-manifest-192x192.png" -or
    $manifestIconPaths -notcontains "/web-app-manifest-512x512.png"
  ) {
    throw "The packaged web manifest did not load."
  }

  $duplicate = Start-Process `
    -FilePath $nodePath `
    -ArgumentList ('"{0}"' -f $launcherPath) `
    -WorkingDirectory $releasePath `
    -WindowStyle Hidden `
    -PassThru
  if (-not $duplicate.WaitForExit(10000) -or $duplicate.ExitCode -ne 0) {
    throw "A second launcher did not reuse the running QuickPOS instance."
  }
  if ($firstRun.Process.HasExited) {
    throw "The original QuickPOS instance stopped during the duplicate-instance test."
  }

  Stop-PackagedQuickPos $firstRun.Process

  $databasePath = Join-Path $quickPosData "data\pos.db"
  if (-not (Test-Path $databasePath) -or (Get-Item $databasePath).Length -eq 0) {
    throw "The packaged application did not initialize its persistent SQLite database."
  }

  $secondRun = Start-PackagedQuickPos 2
  if (
    $secondRun.Health.products -ne $firstRun.Health.products -or
    $secondRun.Health.invoices -ne $firstRun.Health.invoices
  ) {
    throw "Persisted database counts changed unexpectedly after restarting QuickPOS."
  }
  Stop-PackagedQuickPos $secondRun.Process

  $backups = @(Get-ChildItem (Join-Path $quickPosData "backups") -Directory -Filter "pre-migration-*")
  if (
    $backups.Count -eq 0 -or
    -not (Test-Path (Join-Path $backups[0].FullName "pos.db")) -or
    -not (Test-Path (Join-Path $backups[0].FullName "media") -PathType Container)
  ) {
    throw "The launcher did not create a complete database and media backup on restart."
  }

  Write-Host "Packaged QuickPOS runtime passed startup, migration, static asset, shutdown, restart, and database/media backup checks."
}
catch {
  Write-Host "QuickPOS packaged runtime diagnostics:" -ForegroundColor Yellow
  Get-ChildItem $smokeRoot -Recurse -File -Filter "*.log" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "--- $($_.FullName) ---" -ForegroundColor Yellow
    Get-Content $_.FullName -ErrorAction SilentlyContinue | Write-Host
  }
  throw
}
finally {
  Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -eq $nodePath
  } | Stop-Process -Force -ErrorAction SilentlyContinue
}
