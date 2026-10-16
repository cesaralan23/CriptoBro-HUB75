#pragma once
#include <WebServer.h>
#include <Preferences.h>
#include <ESPmDNS.h>
WebServer control(8080);
Preferences prefs;
String deviceId,accessToken,pairCode;
uint32_t displayTestUntil=0;
uint32_t pairUntil=0,pairStarted=0,identifyUntil=0;
int pairAttempts=0,carouselIndex=0;
bool mdnsStarted=false;
bool pendingUntil(uint32_t deadline){return deadline && int32_t(deadline-millis())>0;}
void jsonReply(int status,JsonDocument &d){String body;serializeJson(d,body);control.send(status,"application/json",body);}
void apiError(int status,const char *message){StaticJsonDocument<192>d;d["error"]=message;jsonReply(status,d);}
bool authorized(){
  if(accessToken.length()&&control.header("Authorization")=="Bearer "+accessToken)return true;
  apiError(401,"Vincula este celular con el cartel");return false;
}
bool bodyJson(JsonDocument &d){
  if(control.arg("plain").length()>2048){apiError(413,"Configuracion demasiado grande");return false;}
  if(deserializeJson(d,control.arg("plain"))||!d.is<JsonObject>()){apiError(400,"JSON invalido");return false;}
  return true;
}
#include "animation.h"
#include "streaming.h"
void sendState(){
  DynamicJsonDocument d(3072);encodeSettings(d.createNestedObject("settings"),settings);
  JsonArray a=d.createNestedArray("quotes");Quote copy[3];
  portENTER_CRITICAL(&quoteLock);for(int i=0;i<3;i++)copy[i]=quotes[i];portEXIT_CRITICAL(&quoteLock);
  for(int i=0;i<3;i++){JsonObject q=a.createNestedObject();q["symbol"]=names[i];q["price"]=copy[i].price;q["change"]=copy[i].change;q["valid"]=copy[i].valid;q["closed"]=copy[i].closed;q["timestamp"]=int64_t(copy[i].timestamp);q["stale"]=copy[i].failed||(copy[i].valid&&millis()-copy[i].received>(i==2?180000:60000));}
  d["id"]=deviceId;d["version"]=FIRMWARE_VERSION;animationState(d.createNestedObject("animation"));jsonReply(200,d);
}
void setupControl(){
  uint8_t mac[6];esp_read_mac(mac,ESP_MAC_WIFI_STA);char id[13];
  snprintf(id,sizeof(id),"%02X%02X%02X%02X%02X%02X",mac[0],mac[1],mac[2],mac[3],mac[4],mac[5]);deviceId=id;
  prefs.begin("cbcontrol",false);accessToken=prefs.getString("token","");
  String saved=prefs.getString("settings","");DynamicJsonDocument d(2048);DisplaySettings candidate;
  if(saved.length()&&!deserializeJson(d,saved)&&decodeSettings(d.as<JsonObject>(),candidate))settings=candidate;
  setBrightnessPercent(settings.brightness);active=settings.coins[0];
  const char *headers[]={"Authorization"};control.collectHeaders(headers,1);
  control.on("/api/info",HTTP_GET,[]{StaticJsonDocument<512>d;d["id"]=deviceId;d["name"]=settings.name;d["version"]=FIRMWARE_VERSION;d["api"]=1;d["width"]=64;d["height"]=32;d["paired"]=accessToken.length()>0;d["animationApi"]=3;d["streamApi"]=1;d["flashBytes"]=ESP.getFlashChipSize();d["mediaMaxBytes"]=ANIMATION_LIMIT;d["wifiRssi"]=WiFi.RSSI();d["freeHeap"]=ESP.getFreeHeap();d["refreshHz"]=panel->calculated_refresh_rate;jsonReply(200,d);});
  control.on("/api/pair/start",HTTP_POST,[]{
    if(portal.getConfigPortalActive()||cloudUpdateProgress()>=0){apiError(409,"Espera a que termine la configuracion o actualizacion");return;}
    if(pairStarted&&millis()-pairStarted<60000){apiError(429,"Ya hay un codigo en pantalla; espera un minuto para otro");return;}
    char pin[7];snprintf(pin,sizeof(pin),"%06u",unsigned(esp_random()%1000000));pairCode=pin;
    pairStarted=millis();pairUntil=millis()+60000;pairAttempts=0;control.send(200,"application/json","{\"expiresIn\":60}");
  });
  control.on("/api/pair",HTTP_POST,[]{
    DynamicJsonDocument d(256);if(!bodyJson(d))return;
    if(!pendingUntil(pairUntil)||pairAttempts>=5){apiError(403,"Codigo vencido; solicita otro");return;}
    pairAttempts++;
    if(d["code"].as<String>()!=pairCode){apiError(403,"Codigo incorrecto");return;}
    char token[33];for(int i=0;i<4;i++)snprintf(token+i*8,9,"%08x",unsigned(esp_random()));
    if(prefs.putString("token",token)!=32){apiError(500,"No se pudo guardar la vinculacion");return;}
    accessToken=token;pairUntil=0;pairCode="";d.clear();d["token"]=accessToken;d["id"]=deviceId;jsonReply(200,d);
  });
  control.on("/api/state",HTTP_GET,[]{if(authorized())sendState();});
  control.on("/api/config",HTTP_POST,[]{
    if(!authorized())return;if(cloudUpdateProgress()>=0){apiError(409,"Actualizacion en curso");return;}
    DynamicJsonDocument d(2048);if(!bodyJson(d))return;DisplaySettings candidate;
    if(!decodeSettings(d["settings"],candidate)||!d["save"].is<bool>()){apiError(400,"Ajustes invalidos");return;}
    if(d["save"].as<bool>()){
      String saved;serializeJson(d["settings"],saved);
      if(prefs.putString("settings",saved)!=saved.length()){apiError(500,"No se pudo guardar");return;}
    }
    bool restart=settings.font!=candidate.font||settings.mode!=candidate.mode||settings.message!=candidate.message||settings.count!=candidate.count;
    for(int i=0;i<candidate.count;i++)if(settings.coins[i]!=candidate.coins[i])restart=true;
    settings=candidate;setBrightnessPercent(settings.brightness);
    if(restart){carouselIndex=0;active=settings.coins[0];newQuote();}
    sendState();
  });
  control.on("/api/identify",HTTP_POST,[]{if(!authorized())return;identifyUntil=millis()+5000;control.send(200,"application/json","{\"ok\":true}");});
  control.on("/api/display-test",HTTP_POST,[]{if(!authorized())return;displayTestUntil=millis()+20000;control.send(200,"application/json","{\"seconds\":20}");});
  setupAnimation();setupStreaming();
  control.onNotFound([]{apiError(404,"Ruta desconocida");});control.begin();
}
void processControl(){
  if(WiFi.status()==WL_CONNECTED&&!mdnsStarted){
    String host="criptobro-"+deviceId;host.toLowerCase();
    if(MDNS.begin(host.c_str())){MDNS.addService("criptobro","tcp",8080);MDNS.addServiceTxt("criptobro","tcp","id",deviceId.c_str());MDNS.addServiceTxt("criptobro","tcp","api","1");mdnsStarted=true;}
  }
  if(WiFi.status()!=WL_CONNECTED&&mdnsStarted){MDNS.end();mdnsStarted=false;}
  if(animationWriter&&millis()-animationUploadAt>120000)cancelAnimationUpload();
  control.handleClient();
}
