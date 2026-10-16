#pragma once
// Acknowledged whole frames, RAM only. No partially received frame is displayed.
uint8_t streamPixels[2048];
String streamSession;
uint32_t streamAt=0,streamSequence=0;
bool streamHasFrame=false;
bool streamActive(){return streamHasFrame&&millis()-streamAt<3000;}
bool drawStream(){
  if(!streamActive())return false;
  for(int y=0;y<32;y++)for(int x=0;x<64;x++){
    uint8_t c=streamPixels[y*64+x];
    panel->drawPixel(x,y,panel->color565((c>>5)*255/7,((c>>2)&7)*255/7,(c&3)*85));
  }
  return true;
}
void setupStreaming(){
  control.on("/api/stream/start",HTTP_POST,[]{
    if(!authorized())return;
    if(cloudUpdateProgress()>=0){apiError(409,"Actualizacion en curso");return;}
    if(streamActive()){apiError(409,"Ya hay una transmision activa");return;}
    streamSession=String(esp_random(),HEX)+String(esp_random(),HEX);
    streamHasFrame=false;streamSequence=0;
    StaticJsonDocument<192>d;d["session"]=streamSession;d["maxFps"]=10;jsonReply(200,d);
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
    if(d["session"].as<String>()==streamSession){streamHasFrame=false;streamSession="";}
    d.clear();d["stopped"]=true;jsonReply(200,d);
  });
}
