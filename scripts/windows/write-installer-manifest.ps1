param(
  [string]$InstallerPath = "dist/windows/installer/QuickPOS-Setup.exe",
  [string]$ReleaseMetadataPath = "dist/windows/release/release.json",
  [string]$SourceCommit = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$resolvedInstallerPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $InstallerPath))
$resolvedReleaseMetadataPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $ReleaseMetadataPath))

if (-not (Test-Path $resolvedInstallerPath -PathType Leaf)) {
  throw "QuickPOS installer was not created: $resolvedInstallerPath"
}
if (-not (Test-Path $resolvedReleaseMetadataPath -PathType Leaf)) {
  throw "QuickPOS release metadata was not created: $resolvedReleaseMetadataPath"
}

$package = Get-Content (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json
$release = Get-Content $resolvedReleaseMetadataPath -Raw | ConvertFrom-Json
if ($release.version -ne $package.version) {
  throw "Release version $($release.version) does not match package.json version $($package.version)."
}

$installer = Get-Item $resolvedInstallerPath
$installerHash = (Get-FileHash $resolvedInstallerPath -Algorithm SHA256).Hash.ToLowerInvariant()
$installerDirectory = $installer.DirectoryName
$manifestPath = Join-Path $installerDirectory "manifest.json"
$checksumPath = Join-Path $installerDirectory "SHA256SUMS.txt"
$manifest = [ordered]@{
  schemaVersion = 1
  application = $release.application
  version = $release.version
  platform = $release.platform
  nodeVersion = $release.nodeVersion
  installer = $installer.Name
  installerSizeBytes = $installer.Length
  sha256 = $installerHash
}
if ($SourceCommit) {
  $manifest.sourceCommit = $SourceCommit
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
  $manifestPath,
  (($manifest | ConvertTo-Json) + [Environment]::NewLine),
  $utf8WithoutBom
)
[System.IO.File]::WriteAllText(
  $checksumPath,
  ("$installerHash  $($installer.Name)" + [Environment]::NewLine),
  $utf8WithoutBom
)

Write-Host "QuickPOS installer manifest: $manifestPath"
Write-Host "QuickPOS installer SHA-256: $installerHash"
