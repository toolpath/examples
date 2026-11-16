# Links ToolpathCam into Fusion's AddIns folder. Usage: bin\install-addin.ps1 [-Uninstall]
param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'

$Source = Resolve-Path (Join-Path $PSScriptRoot '..\ToolpathCam')
$AddIns = Join-Path $env:APPDATA 'Autodesk\Autodesk Fusion 360\API\AddIns'
$Target = Join-Path $AddIns 'ToolpathCam'

if ($Uninstall) {
  if (Test-Path $Target) { (Get-Item $Target).Delete(); "Removed $Target" }
  exit 0
}

if (-not (Test-Path (Join-Path $Source 'web\index.html'))) { Write-Warning 'No web build yet; run pnpm build first.' }
New-Item -ItemType Directory -Force -Path $AddIns | Out-Null
if (Test-Path $Target) {
  if (-not ((Get-Item $Target).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "$Target exists and is not a link; remove it first." }
  (Get-Item $Target).Delete()
}
New-Item -ItemType Junction -Path $Target -Target $Source | Out-Null
"Linked $Target -> $Source"
'In Fusion: Utilities > Add-Ins > ToolpathCam > Run.'
