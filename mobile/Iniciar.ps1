param([string]$DireccionPC='')
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if(!(Test-Path node_modules/expo/bin/cli)){throw 'Primero ejecutar npm ci en esta carpeta.'}
if($DireccionPC){$env:REACT_NATIVE_PACKAGER_HOSTNAME=$DireccionPC}
Remove-Item Env:CI -ErrorAction SilentlyContinue
& node node_modules/expo/bin/cli start --go --lan --port 8081
