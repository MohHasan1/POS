param(
  [string]$OutputDirectory = "dist/windows/release",
  [string]$NodeVersion = "24.22.0"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($env:OS -ne "Windows_NT") {
  throw "Windows release packaging must run on Windows so native SQLite files match the client platform."
}

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$standaloneDirectory = Join-Path $repositoryRoot ".next\standalone"
$staticDirectory = Join-Path $repositoryRoot ".next\static"
$publicDirectory = Join-Path $repositoryRoot "public"
$releaseDirectory = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
$applicationDirectory = Join-Path $releaseDirectory "app"
$launcherDirectory = Join-Path $releaseDirectory "launcher"
$runtimeDirectory = Join-Path $releaseDirectory "runtime"
$temporaryRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$temporaryDirectory = Join-Path $temporaryRoot "quickpos-node-runtime"

if (-not (Test-Path (Join-Path $standaloneDirectory "server.js"))) {
  throw "Missing .next\standalone\server.js. Run pnpm build before packaging."
}
if (-not (Test-Path $staticDirectory)) {
  throw "Missing .next\static. Run pnpm build before packaging."
}

if (Test-Path $releaseDirectory) {
  Remove-Item $releaseDirectory -Recurse -Force
}
if (Test-Path $temporaryDirectory) {
  Remove-Item $temporaryDirectory -Recurse -Force
}

New-Item $applicationDirectory -ItemType Directory -Force | Out-Null
New-Item $launcherDirectory -ItemType Directory -Force | Out-Null
New-Item $runtimeDirectory -ItemType Directory -Force | Out-Null
New-Item $temporaryDirectory -ItemType Directory -Force | Out-Null

Get-ChildItem $standaloneDirectory -Force | Copy-Item -Destination $applicationDirectory -Recurse -Force

# Next.js copies root environment files into standalone output. Runtime settings are
# supplied by the launcher, so no build-time environment file belongs in a release.
Get-ChildItem $applicationDirectory -Recurse -Force -File | Where-Object {
  $_.Name -match "^\.env($|\.)"
} | Remove-Item -Force

$packagedStaticDirectory = Join-Path $applicationDirectory ".next\static"
New-Item $packagedStaticDirectory -ItemType Directory -Force | Out-Null
Get-ChildItem $staticDirectory -Force | Copy-Item -Destination $packagedStaticDirectory -Recurse -Force

$packagedPublicDirectory = Join-Path $applicationDirectory "public"
New-Item $packagedPublicDirectory -ItemType Directory -Force | Out-Null
Get-ChildItem $publicDirectory -Force | Copy-Item -Destination $packagedPublicDirectory -Recurse -Force

foreach ($launcherFile in @("quickpos-launcher.mjs", "quickpos-stop.mjs", "start.vbs", "stop.vbs")) {
  Copy-Item (Join-Path $PSScriptRoot $launcherFile) (Join-Path $launcherDirectory $launcherFile) -Force
}

$archiveName = "node-v$NodeVersion-win-x64.zip"
$nodeBaseUrl = "https://nodejs.org/dist/v$NodeVersion"
$archivePath = Join-Path $temporaryDirectory $archiveName
$checksumPath = Join-Path $temporaryDirectory "SHASUMS256.txt"

try {
  Invoke-WebRequest "$nodeBaseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
  Invoke-WebRequest "$nodeBaseUrl/SHASUMS256.txt" -OutFile $checksumPath -UseBasicParsing

  $checksumLine = Get-Content $checksumPath | Where-Object { $_ -match "\s+$([regex]::Escape($archiveName))$" }
  if (-not $checksumLine) {
    throw "The Node.js checksum list does not contain $archiveName."
  }

  $expectedHash = ($checksumLine -split "\s+")[0].ToLowerInvariant()
  $actualHash = (Get-FileHash $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    throw "Node.js runtime checksum mismatch. Expected $expectedHash but received $actualHash."
  }

  Expand-Archive $archivePath -DestinationPath $temporaryDirectory -Force
  $expandedRuntime = Join-Path $temporaryDirectory "node-v$NodeVersion-win-x64"
  Copy-Item (Join-Path $expandedRuntime "node.exe") $runtimeDirectory -Force
  Copy-Item (Join-Path $expandedRuntime "LICENSE") (Join-Path $runtimeDirectory "NODE-LICENSE.txt") -Force
}
finally {
  if (Test-Path $temporaryDirectory) {
    Remove-Item $temporaryDirectory -Recurse -Force
  }
}

$package = Get-Content (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json
$release = [ordered]@{
  application = "QuickPOS"
  version = $package.version
  nodeVersion = $NodeVersion
  platform = "win32-x64"
}
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  (Join-Path $releaseDirectory "release.json"),
  (($release | ConvertTo-Json) + [Environment]::NewLine),
  $utf8WithoutBom
)

$runtimeNodePath = Join-Path $runtimeDirectory "node.exe"
$requiredFiles = @(
  (Join-Path $applicationDirectory "server.js"),
  (Join-Path $applicationDirectory ".next\static"),
  (Join-Path $applicationDirectory "public\icon.svg"),
  $runtimeNodePath,
  (Join-Path $launcherDirectory "quickpos-launcher.mjs"),
  (Join-Path $launcherDirectory "quickpos-stop.mjs")
)
foreach ($requiredFile in $requiredFiles) {
  if (-not (Test-Path $requiredFile)) {
    throw "The Windows release is incomplete: $requiredFile is missing."
  }
}

# The release copy must remain runnable without pnpm's development-time
# symlink graph. Loading a Next.js runtime module here catches broken or
# incomplete standalone dependency layouts before the launcher smoke test.
Push-Location $applicationDirectory
try {
  & $runtimeNodePath -e "require('./node_modules/next/dist/shared/lib/constants.js')"
  if ($LASTEXITCODE -ne 0) {
    throw "The packaged Next.js runtime dependency check failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}

$nativeLibsql = @(Get-ChildItem $applicationDirectory -Recurse -File -Filter "*.node" | Where-Object {
  $_.FullName -match "libsql" -and $_.FullName -match "win32-x64"
})
if ($nativeLibsql.Count -eq 0) {
  throw "The standalone release does not contain the Windows x64 libSQL native module."
}

$sensitiveFiles = @(Get-ChildItem $releaseDirectory -Recurse -Force -File | Where-Object {
  $_.Name -match "^\.env($|\.)" -or
  $_.Extension -in @(".db", ".pem") -or
  $_.Name -match "^(pos|test-pos)\.db(-wal|-shm)?$"
})
if ($sensitiveFiles.Count -gt 0) {
  throw "Refusing to package database, environment, or credential files: $($sensitiveFiles.FullName -join ', ')"
}

Write-Host "QuickPOS Windows release assembled at $releaseDirectory"
Write-Host "Windows native SQLite module: $($nativeLibsql[0].FullName)"
