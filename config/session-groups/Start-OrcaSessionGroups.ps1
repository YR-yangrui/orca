param([switch]$Build)

$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$profileDirectory = Join-Path $env:APPDATA 'orca-session-groups'
$logDirectory = Join-Path $env:LOCALAPPDATA 'OrcaSessionGroups/logs'
New-Item -ItemType Directory -Force $logDirectory | Out-Null
Set-Location -LiteralPath $sourceRoot

# Keep custom workspaces and sessions separate from the installed upstream app.
$env:ORCA_DEV_USER_DATA_PATH = $profileDirectory
if ($Build -or -not (Test-Path 'out/main/index.js')) {
    node config/scripts/workspace-package-build/build-workspace-packages.mjs
    if ($LASTEXITCODE) { throw 'Workspace package build failed.' }
    node config/scripts/cli-build/build-cli.mjs
    if ($LASTEXITCODE) { throw 'CLI build failed.' }
    node config/scripts/desktop-build/execution/run-electron-vite-build.mjs
    if ($LASTEXITCODE) { throw 'Desktop build failed.' }
}
$electron = Join-Path $sourceRoot 'node_modules/electron/dist/electron.exe'
if (-not (Test-Path -LiteralPath $electron)) { throw 'Run pnpm install --frozen-lockfile first.' }
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
# Dev Electron monitors its parent. Keep this launcher alive until the window exits.
Start-Process -FilePath $electron -ArgumentList @($sourceRoot) -WorkingDirectory $sourceRoot -WindowStyle Hidden -Wait `
    -RedirectStandardOutput (Join-Path $logDirectory 'development.log') `
    -RedirectStandardError (Join-Path $logDirectory 'development-error.log')
