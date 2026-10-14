CriptoBro HUB75 64x32
====================
Cartel ESP32 con precios desplazables, logos pequenos y variacion verde/roja.
BTC y SOL: Binance spot, USDT, variacion movil 24H, consulta cada 10 segundos.
MSTR: accion Strategy, USD, variacion respecto al cierre anterior, cada minuto.
Yahoo Finance chart es una fuente publica no oficial y puede tener demora.
CER indica mercado cerrado. DATO VIEJO indica que la consulta fallo o vencio.
La vista previa GIF usa valores ilustrativos; no es una captura del hardware.

PRIMER USO
1. Instalar una vez por USB el firmware y la tabla min_spiffs de 4 MB.
2. Conectar el celular a CriptoBro64, clave HUB75B32. Abrir 192.168.4.1.
3. Abrir http://192.168.4.1 y configurar la red Wi-Fi de 2,4 GHz.
4. El cartel guarda la red, sincroniza la hora y consulta datos por HTTPS.
No requiere GO; comienza al encender. El programa no contiene claves Wi-Fi.
El panel necesita fuente externa de 5 V y GND comun con la ESP32.
Brillo inicial: 50% (128/255), limitado por codigo a 80% (204/255).
Todos los textos usan trazos de 2 pixeles, dos renglones desplazables y logo fijo de 20 pixeles. Pinout validado con el programa de colores:
R1=25 G1=26 B1=27 R2=14 G2=13 B2=32 A=23 B=19 C=18 D=33
LAT=21 OE=4 CLK=22; E no usado.

ACTUALIZAR DESDE CUALQUIER LUGAR
1. Editar el codigo en este repositorio, incluso desde el navegador de GitHub.
2. Subir FIRMWARE_VERSION y FIRMWARE_VERSION_CODE en include/version.h.
   Ejemplo: 1.0.1 y 1000001. Formula: mayor*1000000 + menor*1000 + parche.
3. Abrir Actions > Publicar firmware del cartel > Run workflow.
4. Esperar a que compile y publique la release. Un commit por si solo NO publica.
5. El cartel consulta releases/latest/download/manifest.json cada cinco minutos.
   Descarga firmware.bin, muestra OTA y reinicia al terminar.
No hace falta abrir puertos del router ni guardar tokens GitHub en la placa.
El repositorio y los archivos de la release deben permanecer publicos.

COMPROBACIONES OTA
- TLS verifica hostname y raices publicas de GitHub y su CDN.
- Solo acepta versiones mayores, target compatible, URL del repositorio
  configurado, tamano que cabe en la segunda particion y SHA256 coincidente.
- Ante descarga cortada o hash incorrecto aborta y mantiene el firmware actual.
- La integridad depende de HTTPS y del control de la cuenta/repositorio GitHub;
  no es Secure Boot ni una firma offline independiente.
- Una version que compila pero falla al arrancar podria requerir recuperacion
  USB. No se implementa rollback automatico por fallo de arranque.
- Para volver a un codigo anterior, publicarlo con un numero de version mayor.
- No cambiar particiones, target ni pines del cartel mediante una actualizacion
  ordinaria. OTA actualiza la aplicacion, no la tabla de particiones.

CODIGO Y COMPILACION
PlatformIO: pio run -e esp32dev
Tabla min_spiffs: dos aplicaciones de 1966080 bytes y datos OTA.
src/main.cpp: pantalla, Wi-Fi, cotizaciones y estado.
src/cloud_ota.cpp: descarga HTTPS, SHA256 y activacion de la nueva aplicacion.
include/version.h: version, target y repositorio de actualizaciones.
tools/release_manifest.py: genera el manifest desde el binario compilado.
.github/workflows/release.yml: compilacion y publicacion manual desde GitHub.
Serial 115200 con DTR/RTS desactivados: WIFI abre portal; STATUS informa IP.

ESTADO
v1.0.0: compilacion local y GitHub Actions correctas; cuatro pruebas pasaron.
Release publica descargada sin autenticar y SHA256 verificado desde PC.
Instalacion USB inicial completada en CH340 COM8, todos los hashes correctos.
Wi-Fi y cotizaciones BTC, SOL y MSTR verificadas desde la ESP32.
OTA v1.0.0 -> v1.0.1 comprobado: deteccion automatica, descarga HTTPS,
SHA256 correcto, activacion, reinicio y recuperacion de las tres cotizaciones.
STATUS confirmo version=1.0.1 y conexion Wi-Fi tras actualizar sin grabar por USB.

REFERENCIAS
https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md
https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/ota.html
https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

ACTUALIZACION v1.0.2
OTA v1.0.1 -> v1.0.2 verificado: SHA256 correcto, reinicio, Wi-Fi y tres cotizaciones.
STATUS confirmo brightness=50% max=80% text=2px. GitHub Actions 38615644462 correcto.

WIFI GUARDADO
La red configurada se conserva al apagar y durante las actualizaciones OTA.
Si al encender no conecta, abre WiFiManager; si pierde conexion en uso, lo abre tras 30 segundos.
Configurar otra red sustituye la anterior. Clave del portal: HUB75B32.
