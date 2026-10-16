#pragma once
#include <SPIFFS.h>
#include <mbedtls/base64.h>
// Two slots preserve the active clip until a complete new file is validated.
constexpr size_t ANIMATION_LIMIT=40960;
bool animationStorage=false,animationPlaying=false,animationEnabled=false;
int animationSlot=0,animationLoops=2,animationRounds=1,animationRound=0;
uint8_t animationFps=8,animationFrames=0,animationIndex=0,animationRepeat=0;
String animationName;
File animationReader,animationWriter;
size_t animationExpected=0,animationReceived=0;
uint32_t animationCrc=0xffffffff,animationExpectedCrc=0,animationUploadAt=0;
String animationUploadId,animationPendingName;
uint8_t animationPixels[2048];
const char *animationPath(int slot){return slot?"/anim1.bin":"/anim0.bin";}
uint32_t crcBytes(uint32_t crc,const uint8_t *p,size_t size){for(size_t i=0;i<size;i++){crc^=p[i];for(int b=0;b<8;b++)crc=(crc>>1)^((crc&1)?0xedb88320:0);}return crc;}
bool readAnimationFrame(File &f,uint8_t *out){
  int lo=f.read(),hi=f.read();if(lo<0||hi<0)return false;
  uint16_t header=lo|(hi<<8);size_t size=header&0x7fff;
  if(header&0x8000){if(size!=2048)return false;return f.read(out,2048)==2048;}
  if(size<2||size>4096||size%2)return false;size_t n=0;
  for(size_t i=0;i<size;i+=2){int run=f.read(),color=f.read();if(run<=0||color<0||n+run>2048)return false;memset(out+n,color,run);n+=run;}
  return n==2048;
}
bool validateAnimation(File &f,uint8_t &fps,uint8_t &frames){
  if(!f||f.size()<12||f.size()>ANIMATION_LIMIT)return false;
  uint8_t h[8];if(f.read(h,8)!=8||memcmp(h,"CBA1",4)||h[6]||h[7])return false;
  fps=h[4];frames=h[5];if(fps<1||fps>10||frames<1||frames>50||frames>fps*5)return false;
  for(int i=0;i<frames;i++)if(!readAnimationFrame(f,animationPixels))return false;
  return f.position()==f.size();
}
void stopAnimation(){animationReader.close();animationPlaying=false;}
void beginAnimation(){
  if(!animationEnabled||!animationFrames||!animationStorage)return;
  animationReader=SPIFFS.open(animationPath(animationSlot),"r");
  if(!animationReader||!animationReader.seek(8)){stopAnimation();return;}
  animationPlaying=true;animationIndex=0;animationRepeat=0;
}
bool drawAnimation(){
  if(!animationPlaying||!animationEnabled){stopAnimation();return false;}
  if(animationIndex>=animationFrames){
    if(++animationRepeat>=animationLoops){stopAnimation();return false;}
    animationIndex=0;if(!animationReader.seek(8)){stopAnimation();return false;}
  }
  if(!readAnimationFrame(animationReader,animationPixels)){stopAnimation();return false;}
  for(int y=0;y<32;y++)for(int x=0;x<64;x++){
    uint8_t c=animationPixels[y*64+x];
    panel->drawPixel(x,y,panel->color565(((c>>5)&7)*255/7,((c>>2)&7)*255/7,(c&3)*85));
  }
  animationIndex++;return true;
}
void animationState(JsonObject o){
  o["available"]=animationFrames>0;o["enabled"]=animationEnabled;o["name"]=animationName;
  o["fps"]=animationFps;o["frames"]=animationFrames;o["loops"]=animationLoops;o["rounds"]=animationRounds;
  o["maxBytes"]=ANIMATION_LIMIT;o["storageReady"]=animationStorage;o["playing"]=animationPlaying;
}
void sendAnimationState(){StaticJsonDocument<512>d;animationState(d.to<JsonObject>());jsonReply(200,d);}
void cancelAnimationUpload(){animationWriter.close();animationUploadId="";animationExpected=0;}
void setupAnimation(){
  animationStorage=SPIFFS.begin(false);
  // This partition was unused before 1.2. Never format automatically after first initialization.
  if(!animationStorage&&!prefs.getBool("animInit",false)){if(SPIFFS.format())animationStorage=SPIFFS.begin(false);}
  if(animationStorage)prefs.putBool("animInit",true);
  animationSlot=prefs.getUChar("animSlot",0)==1?1:0;
  animationLoops=constrain(prefs.getUChar("animLoops",2),1,5);animationRounds=constrain(prefs.getUChar("animRounds",1),1,5);
  animationEnabled=prefs.getBool("animEnabled",false);animationName=prefs.getString("animName","");
  if(animationStorage){File f=SPIFFS.open(animationPath(animationSlot),"r");uint8_t fps,frames;if(validateAnimation(f,fps,frames)){animationFps=fps;animationFrames=frames;}f.close();}
  control.on("/api/animation",HTTP_GET,[]{if(authorized())sendAnimationState();});
  control.on("/api/animation/settings",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(256);if(!bodyJson(d))return;
    if(!d["enabled"].is<bool>()||!d["loops"].is<int>()||!d["rounds"].is<int>()){apiError(400,"Configuracion invalida");return;}
    int loops=d["loops"],rounds=d["rounds"];if(loops<1||loops>5||rounds<1||rounds>5){apiError(400,"Usa 1 a 5 repeticiones o vueltas");return;}
    bool enabled=d["enabled"];if(enabled&&!animationFrames){apiError(409,"Primero carga un clip");return;}
    prefs.putUChar("animLoops",loops);prefs.putUChar("animRounds",rounds);prefs.putBool("animEnabled",enabled);
    animationLoops=loops;animationRounds=rounds;animationEnabled=enabled;animationRound=0;
    if(!enabled)stopAnimation();sendAnimationState();
  });
  control.on("/api/animation/play",HTTP_POST,[]{if(!authorized())return;if(!animationFrames||!animationEnabled){apiError(409,"Carga y activa el clip primero");return;}beginAnimation();sendAnimationState();});
  control.on("/api/animation/start",HTTP_POST,[]{
    if(!authorized())return;if(!animationStorage){apiError(503,"Almacenamiento no disponible");return;}
    if(cloudUpdateProgress()>=0){apiError(409,"Actualizacion de firmware en curso");return;}
    DynamicJsonDocument d(512);if(!bodyJson(d))return;
    if(!d["size"].is<uint32_t>()||!d["crc"].is<uint32_t>()||!d["name"].is<const char*>()){apiError(400,"Datos invalidos");return;}
    size_t size=d["size"];String name=d["name"].as<String>();if(size<12||size>ANIMATION_LIMIT||name.length()>64){apiError(400,"Clip demasiado grande");return;}
    cancelAnimationUpload();const char *path=animationPath(1-animationSlot);SPIFFS.remove(path);
    if(SPIFFS.totalBytes()-SPIFFS.usedBytes()<size+8192){apiError(507,"Sin espacio para conservar el clip anterior");return;}
    animationWriter=SPIFFS.open(path,"w");if(!animationWriter){apiError(500,"No se pudo abrir el archivo");return;}
    animationExpected=size;animationReceived=0;animationExpectedCrc=d["crc"];animationCrc=0xffffffff;
    animationPendingName=name;animationUploadAt=millis();animationUploadId=String(esp_random(),HEX)+String(esp_random(),HEX);
    d.clear();d["upload"]=animationUploadId;d["chunkBytes"]=768;jsonReply(200,d);
  });
  control.on("/api/animation/chunk",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(2048);if(!bodyJson(d))return;
    if(!animationWriter||d["upload"].as<String>()!=animationUploadId||!d["offset"].is<uint32_t>()||d["offset"].as<uint32_t>()!=animationReceived){apiError(409,"Transferencia o posicion invalida");return;}
    String data=d["data"].as<String>();uint8_t bytes[768];size_t count=0;
    if(data.length()>1024||mbedtls_base64_decode(bytes,sizeof(bytes),&count,(const unsigned char*)data.c_str(),data.length())||!count||animationReceived+count>animationExpected){apiError(400,"Bloque invalido");return;}
    if(animationWriter.write(bytes,count)!=count){cancelAnimationUpload();apiError(500,"Error al guardar");return;}
    animationCrc=crcBytes(animationCrc,bytes,count);animationReceived+=count;animationUploadAt=millis();
    d.clear();d["received"]=animationReceived;jsonReply(200,d);
  });
  control.on("/api/animation/finish",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(256);if(!bodyJson(d))return;
    if(!animationWriter||d["upload"].as<String>()!=animationUploadId){apiError(409,"Transferencia invalida");return;}
    animationWriter.close();
    bool valid=animationReceived==animationExpected&&(animationCrc^0xffffffff)==animationExpectedCrc;
    File f=SPIFFS.open(animationPath(1-animationSlot),"r");uint8_t fps=0,frames=0;valid=valid&&validateAnimation(f,fps,frames);f.close();
    if(!valid){cancelAnimationUpload();apiError(400,"Archivo incompleto o invalido; se conserva el anterior");return;}
    int slot=1-animationSlot;if(prefs.putUChar("animSlot",slot)!=1){cancelAnimationUpload();apiError(500,"No se pudo activar");return;}
    stopAnimation();animationSlot=slot;animationFps=fps;animationFrames=frames;animationName=animationPendingName;
    prefs.putString("animName",animationName);cancelAnimationUpload();sendAnimationState();
  });
}
