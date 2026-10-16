#pragma once
#include <WebSocketsServer.h>
WebSocketsServer streamSocket(8081);
int streamClient=-1;
uint32_t streamAccepted=0,streamRendered=0,streamDrawnSequence=0;
// Acknowledged whole frames, RAM only. No partially received frame is displayed.
uint8_t streamPixels[2048];
String streamSession;
uint32_t streamAt=0,streamSequence=0;
bool streamHasFrame=false;
bool streamActive(){return streamHasFrame&&millis()-streamAt<3000;}
bool drawStream(){
  if(!streamActive())return false;
  if(streamDrawnSequence!=streamSequence){streamDrawnSequence=streamSequence;streamRendered++;}
  for(int y=0;y<32;y++)for(int x=0;x<64;x++){
    uint8_t c=streamPixels[y*64+x];
    panel->drawPixel(x,y,panel->color565((c>>5)*255/7,((c>>2)&7)*255/7,(c&3)*85));
  }
  return true;
}
void setupStreaming(){
  streamSocket.begin();
  streamSocket.onEvent([](uint8_t client,WStype_t type,uint8_t *payload,size_t length){
    if(type==WStype_DISCONNECTED){if(streamClient==client)streamClient=-1;return;}
    if(type==WStype_TEXT){
      // The short-lived session comes from the authenticated HTTP start endpoint.
      if(length!=streamSession.length()||!length||memcmp(payload,streamSession.c_str(),length)||
         (streamClient>=0&&streamClient!=client&&streamActive())){streamSocket.disconnect(client);return;}
      if(streamClient>=0&&streamClient!=client)streamSocket.disconnect(streamClient);
      streamClient=client;streamSocket.sendTXT(client,"ready");return;
    }
    if(type!=WStype_BIN)return;
    if(client!=streamClient||!streamSession.length()||length!=2052||cloudUpdateProgress()>=0){streamSocket.disconnect(client);return;}
    uint32_t seq=uint32_t(payload[0])|(uint32_t(payload[1])<<8)|(uint32_t(payload[2])<<16)|(uint32_t(payload[3])<<24);
    if(seq<=streamSequence){streamSocket.disconnect(client);return;}
    memcpy(streamPixels,payload+4,2048);streamSequence=seq;streamAt=millis();streamHasFrame=true;streamAccepted++;
    streamSocket.sendBIN(client,payload,4);
  });
  control.on("/api/stream/start",HTTP_POST,[]{
    if(!authorized())return;
    if(cloudUpdateProgress()>=0){apiError(409,"Actualizacion en curso");return;}
    if(streamActive()){apiError(409,"Ya hay una transmision activa");return;}
    if(streamClient>=0){streamSocket.disconnect(streamClient);streamClient=-1;}
    streamSession=String(esp_random(),HEX)+String(esp_random(),HEX);
    streamHasFrame=false;streamSequence=0;streamDrawnSequence=0;streamLoopMaxUs=0;
    StaticJsonDocument<192>d;d["session"]=streamSession;d["maxFps"]=30;d["wsPort"]=8081;jsonReply(200,d);
  });
  control.on("/api/stream/frame",HTTP_POST,[]{
    if(!authorized())return;
    if(cloudUpdateProgress()>=0){apiError(409,"Actualizacion en curso");return;}
    String body=control.arg("plain");
    if(body.length()>3100){apiError(413,"Cuadro demasiado grande");return;}
    DynamicJsonDocument d(3400);
    if(deserializeJson(d,body)||!d["seq"].is<uint32_t>()||!streamSession.length()||d["session"].as<String>()!=streamSession){apiError(409,"Sesion invalida");return;}
    uint32_t seq=d["seq"];
    if(seq<=streamSequence){apiError(409,"Cuadro fuera de orden");return;}
    String data=d["data"].as<String>();uint8_t decoded[2048];size_t count=0;
    if(data.length()!=2732||mbedtls_base64_decode(decoded,sizeof(decoded),&count,(const unsigned char*)data.c_str(),data.length())||count!=2048){apiError(400,"Cuadro invalido");return;}
    memcpy(streamPixels,decoded,2048);streamSequence=seq;streamAt=millis();streamHasFrame=true;
    d.clear();d["seq"]=seq;jsonReply(200,d);
  });
  control.on("/api/stream/stop",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(256);if(!bodyJson(d))return;
    if(d["session"].as<String>()==streamSession){streamHasFrame=false;streamSession="";if(streamClient>=0){streamSocket.disconnect(streamClient);streamClient=-1;}}
    d.clear();d["stopped"]=true;jsonReply(200,d);
  });
}
