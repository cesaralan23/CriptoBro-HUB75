param([string]$DireccionPC='')
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
if(!(Test-Path node_modules/expo/bin/cli)){throw 'Faltan las dependencias de la app. Ejecutar npm ci en esta carpeta.'}
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
$nodePath=if($nodeCommand){$nodeCommand.Source}else{Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){throw 'No se encontro Node.js. Instala Node.js LTS y volve a abrir este archivo.'}
if(!$DireccionPC){
  $addresses=@(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)' -and $_.AddressState -eq 'Preferred' })
  if($addresses.Count -eq 1){$DireccionPC=$addresses[0].IPAddress}
}
if($DireccionPC){$env:REACT_NATIVE_PACKAGER_HOSTNAME=$DireccionPC}
Write-Host 'CriptoBro Studio - servidor para Expo Go' -ForegroundColor Magenta
Write-Host 'Deja esta ventana abierta mientras uses Expo Go. La APK instalada no necesita la PC.'
if($DireccionPC){Write-Host "Direccion del proyecto: exp://${DireccionPC}:8081" -ForegroundColor Green}
$listener=Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if($listener){
  Write-Host 'El puerto 8081 ya esta en uso. Si el servidor de CriptoBro ya esta abierto, usa su QR. Si no, cerra ese servidor y volve a abrir este archivo.'
  exit 0
}
Remove-Item Env:CI -ErrorAction SilentlyContinue
& $nodePath node_modules/expo/bin/cli start --go --lan --port 8081
