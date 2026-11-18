param(
  [string]$OutputDirectory = "dist/windows/release",
  [string]$NodeVersion = "24.22.0",
  [string]$NodeExecutable = "",
  [string]$VCRuntimeDirectory = ""
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
$installerAssetsDirectory = Join-Path $repositoryRoot "installer\assets"
$releaseDirectory = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
$applicationDirectory = Join-Path $releaseDirectory "app"
$assetsDirectory = Join-Path $releaseDirectory "assets"
$launcherDirectory = Join-Path $releaseDirectory "launcher"
$runtimeDirectory = Join-Path $releaseDirectory "runtime"

function Copy-DirectoryContents([string]$Source, [string]$Destination) {
  New-Item $Destination -ItemType Directory -Force | Out-Null
  & robocopy.exe $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
  if ($LASTEXITCODE -ge 8) {
    throw "Failed to copy $Source to $Destination (robocopy exit code $LASTEXITCODE)."
  }
}

function Find-VisualCppRuntimeDirectory() {
  $candidates = @()

  if ($VCRuntimeDirectory) {
    $candidates += [System.IO.Path]::GetFullPath($VCRuntimeDirectory)
  }

  if ($env:VCToolsRedistDir) {
    $candidates += Join-Path $env:VCToolsRedistDir "x64\Microsoft.VC143.CRT"
    $candidates += Join-Path $env:VCToolsRedistDir "onecore\x64\Microsoft.VC143.CRT"
  }

  $visualStudioRoot = Join-Path $env:ProgramFiles "Microsoft Visual Studio"
  if (Test-Path $visualStudioRoot -PathType Container) {
    $redistVersions = @(Get-ChildItem $visualStudioRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $redistRoot = Join-Path $_.FullName "VC\Redist\MSVC"
        if (Test-Path $redistRoot -PathType Container) {
          Get-ChildItem $redistRoot -Directory -ErrorAction SilentlyContinue
        }
      }
    } | Sort-Object Name -Descending)

    foreach ($version in $redistVersions) {
      $candidates += Join-Path $version.FullName "x64\Microsoft.VC143.CRT"
      $candidates += Join-Path $version.FullName "onecore\x64\Microsoft.VC143.CRT"
    }
  }

  foreach ($candidate in $candidates | Select-Object -Unique) {
    if (
      (Test-Path (Join-Path $candidate "vcruntime140.dll") -PathType Leaf) -and
      (Test-Path (Join-Path $candidate "msvcp140.dll") -PathType Leaf)
    ) {
      return $candidate
    }
  }

  throw "Microsoft Visual C++ x64 runtime DLLs were not found on the packaging machine."
}

if (-not (Test-Path (Join-Path $standaloneDirectory "server.js"))) {
  throw "Missing .next\standalone\server.js. Run pnpm build before packaging."
}
if (-not (Test-Path $staticDirectory)) {
  throw "Missing .next\static. Run pnpm build before packaging."
}
if (-not (Test-Path (Join-Path $installerAssetsDirectory "quickpos.ico"))) {
  throw "Missing installer\assets\quickpos.ico."
}

if (Test-Path $releaseDirectory) {
  Remove-Item $releaseDirectory -Recurse -Force
}

New-Item $applicationDirectory -ItemType Directory -Force | Out-Null
New-Item $launcherDirectory -ItemType Directory -Force | Out-Null
New-Item $runtimeDirectory -ItemType Directory -Force | Out-Null

Copy-DirectoryContents $standaloneDirectory $applicationDirectory

# Next.js copies root environment files into standalone output. Runtime settings are
# supplied by the launcher, so no build-time environment file belongs in a release.
Get-ChildItem $applicationDirectory -Recurse -Force -File | Where-Object {
  $_.Name -match "^\.env($|\.)"
} | Remove-Item -Force

$packagedStaticDirectory = Join-Path $applicationDirectory ".next\static"
Copy-DirectoryContents $staticDirectory $packagedStaticDirectory

$packagedPublicDirectory = Join-Path $applicationDirectory "public"
Copy-DirectoryContents $publicDirectory $packagedPublicDirectory

Copy-DirectoryContents $installerAssetsDirectory $assetsDirectory

foreach ($launcherFile in @("quickpos-launcher.mjs", "quickpos-stop.mjs", "start.vbs", "stop.vbs")) {
  Copy-Item (Join-Path $PSScriptRoot $launcherFile) (Join-Path $launcherDirectory $launcherFile) -Force
}

$sourceNodePath = if ($NodeExecutable) {
  [System.IO.Path]::GetFullPath($NodeExecutable)
} else {
  (Get-Command node.exe -ErrorAction Stop).Source
}
$sourceNodeDirectory = Split-Path $sourceNodePath -Parent
$sourceNodeLicense = Join-Path $sourceNodeDirectory "LICENSE"
$sourceNodeVersion = (& $sourceNodePath -p "process.versions.node").Trim()
$sourceNodeArchitecture = (& $sourceNodePath -p "process.arch").Trim()

if ($sourceNodeVersion -ne $NodeVersion) {
  throw "Expected Node.js $NodeVersion but found $sourceNodeVersion at $sourceNodePath."
}
if ($sourceNodeArchitecture -ne "x64") {
  throw "Expected an x64 Node.js runtime but found $sourceNodeArchitecture at $sourceNodePath."
}
if (-not (Test-Path $sourceNodeLicense)) {
  throw "The Node.js runtime license is missing: $sourceNodeLicense"
}

Copy-Item $sourceNodePath (Join-Path $runtimeDirectory "node.exe") -Force
Copy-Item $sourceNodeLicense (Join-Path $runtimeDirectory "NODE-LICENSE.txt") -Force

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
  (Join-Path $applicationDirectory "public\web-app-manifest-192x192.png"),
  (Join-Path $applicationDirectory "public\web-app-manifest-512x512.png"),
  (Join-Path $assetsDirectory "quickpos.ico"),
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

# The native libSQL addon is built with the Microsoft C++ toolchain. GitHub's
# Windows runner already has that runtime installed, but shop PCs may not. Ship
# the redistributable DLLs app-locally beside both node.exe and the addon so the
# release remains self-contained and does not require an administrator install.
$visualCppRuntimeDirectory = Find-VisualCppRuntimeDirectory
$visualCppRuntimeFiles = @(Get-ChildItem $visualCppRuntimeDirectory -File -Filter "*.dll")
if ($visualCppRuntimeFiles.Count -eq 0) {
  throw "No Visual C++ runtime DLLs were found in $visualCppRuntimeDirectory."
}

$visualCppDestinations = @(
  @($runtimeDirectory) + @($nativeLibsql | ForEach-Object { $_.DirectoryName })
) | Select-Object -Unique
foreach ($destination in $visualCppDestinations) {
  foreach ($runtimeFile in $visualCppRuntimeFiles) {
    Copy-Item $runtimeFile.FullName (Join-Path $destination $runtimeFile.Name) -Force
  }
}

foreach ($nativeModule in $nativeLibsql) {
  foreach ($requiredRuntime in @("vcruntime140.dll", "msvcp140.dll")) {
    $runtimePath = Join-Path $nativeModule.DirectoryName $requiredRuntime
    if (-not (Test-Path $runtimePath -PathType Leaf)) {
      throw "The native libSQL runtime dependency is missing: $runtimePath"
    }
  }
}

& $runtimeNodePath -e "require(process.argv[1])" $nativeLibsql[0].FullName
if ($LASTEXITCODE -ne 0) {
  throw "The packaged native libSQL module failed to load (exit code $LASTEXITCODE)."
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
Write-Host "App-local Visual C++ runtime: $visualCppRuntimeDirectory"
