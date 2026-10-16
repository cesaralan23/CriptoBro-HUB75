#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h>
#include "safe_tls.h"
#include <HTTPClient.h>
#include <Update.h>
#include <esp_ota_ops.h>
#include <mbedtls/sha256.h>
#include "cloud_ota.h"
#include "root_ca.h"
#include "version.h"

static portMUX_TYPE otaLock=portMUX_INITIALIZER_UNLOCKED;
static int progress=-1;
static void setProgress(int p) {portENTER_CRITICAL(&otaLock);progress=p;portEXIT_CRITICAL(&otaLock);}
int cloudUpdateProgress() {portENTER_CRITICAL(&otaLock);int p=progress;portEXIT_CRITICAL(&otaLock);return p;}
static void setupHttp(HTTPClient &http,WiFiClientSecure &tls) {
  tls.setCACert(ROOT_CA); tls.setHandshakeTimeout(10);
  http.setConnectTimeout(7000); http.setTimeout(10000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setRedirectLimit(5); http.useHTTP10(true);
  http.setUserAgent("CriptoBro64/" FIRMWARE_VERSION);
}
static bool download(const String &url,size_t expected,const String &sha) {
  SafeWiFiClientSecure tls; HTTPClient http; setupHttp(http,tls);
  if(!http.begin(tls,url)) return false;
  int code=http.GET();
  if(code!=200 || http.getSize()!=int(expected)) {
    Serial.printf("[OTA] Descarga rechazada HTTP=%d tamano=%d\n",code,http.getSize()); http.end();return false;
  }
  if(!Update.begin(expected,U_FLASH)) {Serial.printf("[OTA] %s\n",Update.errorString());http.end();return false;}
  setProgress(0);
  mbedtls_sha256_context ctx; mbedtls_sha256_init(&ctx);
  bool ok=mbedtls_sha256_starts_ret(&ctx,0)==0;
  auto *stream=http.getStreamPtr();
  uint8_t buffer[2048];size_t total=0;
  uint32_t began=millis(),lastData=began;
  while(ok && total<expected) {
    int available=stream->available();
    if(available>0) {
      size_t count=min(sizeof(buffer),min(size_t(available),expected-total));
      int got=stream->read(buffer,count);
      if(got<=0) {ok=false;break;}
      if(Update.write(buffer,got)!=size_t(got) || mbedtls_sha256_update_ret(&ctx,buffer,got)!=0) {ok=false;break;}
      total+=got;lastData=millis();setProgress(int(total*100/expected));
    } else {
      if(!http.connected() || millis()-lastData>15000) {ok=false;break;}
      vTaskDelay(pdMS_TO_TICKS(5));
    }
    if(millis()-began>300000) {ok=false;break;}
    vTaskDelay(pdMS_TO_TICKS(1));
  }
  uint8_t digest[32]; char hex[65];
  ok=ok && total==expected && mbedtls_sha256_finish_ret(&ctx,digest)==0;
  mbedtls_sha256_free(&ctx);http.end();
  if(ok) {
    for(int i=0;i<32;i++) snprintf(hex+i*2,3,"%02x",digest[i]);
    ok=sha.equalsIgnoreCase(hex);
  }
  if(!ok) {
    Update.abort();setProgress(-1);Serial.println("[OTA] Archivo incompleto o SHA256 incorrecto; se conserva firmware actual.");return false;
  }
  if(!Update.end()) {Serial.printf("[OTA] No activado: %s\n",Update.errorString());Update.abort();setProgress(-1);return false;}
  Serial.println("[OTA] SHA256 correcto. Firmware activado, reiniciando.");
  delay(500);ESP.restart();return true;
}
void checkCloudUpdate() {
  String firmwareUrl,expectedHash;
  size_t size=0;
  // Destroy manifest TLS buffers before allocating the firmware-download connection.
  {
    SafeWiFiClientSecure tls; HTTPClient http;setupHttp(http,tls);
    if(!http.begin(tls,"https://github.com/" UPDATE_REPO "/releases/latest/download/manifest.json")) return;
    int code=http.GET();
    if(code!=200) {Serial.printf("[OTA] Manifiesto HTTP=%d (404: aun sin release)\n",code);http.end();return;}
    if(http.getSize()<0 || http.getSize()>2048) {http.end();return;}
    DynamicJsonDocument doc(2048);
    auto error=deserializeJson(doc,http.getStream());http.end();
    if(error || !doc["version_code"].is<uint32_t>() || !doc["size"].is<uint32_t>()) {Serial.println("[OTA] Manifiesto invalido");return;}
    uint32_t version=doc["version_code"].as<uint32_t>();
    if(strcmp(doc["target"]|"",FIRMWARE_TARGET) || version<=FIRMWARE_VERSION_CODE) {Serial.println("[OTA] Sin actualizacion compatible");return;}
    firmwareUrl=doc["url"].as<String>();expectedHash=doc["sha256"].as<String>();size=doc["size"].as<uint32_t>();
    String prefix="https://github.com/" UPDATE_REPO "/releases/download/";
    const esp_partition_t *next=esp_ota_get_next_update_partition(nullptr);
    bool valid=firmwareUrl.startsWith(prefix)&&firmwareUrl.endsWith("/firmware.bin")&&expectedHash.length()==64&&next&&size>10000&&size<=next->size;
    for(size_t i=0;i<expectedHash.length();i++) if(!isxdigit((unsigned char)expectedHash[i])) valid=false;
    if(!valid) {Serial.println("[OTA] Destino, tamano o hash invalido");return;}
    Serial.printf("[OTA] Nueva version %lu: %u bytes\n",(unsigned long)version,unsigned(size));
  }
  download(firmwareUrl,size,expectedHash);
}
