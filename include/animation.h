#pragma once
#include <SPIFFS.h>
#include <mbedtls/base64.h>
#include <errno.h>
// Two slots preserve the active clip until a complete new file is validated.
size_t ANIMATION_LIMIT=40960;
bool animationStorage=false,animationPlaying=false,animationEnabled=false,animationOnly=false;
struct AnimationItem {uint32_t offset; uint16_t seconds; uint8_t fps,frames;};
AnimationItem animationItems[32];
uint8_t animationCount=0,animationItem=0;
uint32_t animationItemAt=0;
String animationCompletedUpload;
bool animationPlaylist=false;
int animationSlot=0,animationLoops=2,animationRounds=1,animationRound=0;
uint8_t animationFps=8,animationFrames=0,animationIndex=0,animationRepeat=0;
String animationName;
File animationReader;
bool animationUploading=false;
const char *animationStoreStage="";
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
bool readClip(File &f,AnimationItem &item){
  uint8_t h[8];if(f.read(h,8)!=8||memcmp(h,"CBA1",4)||h[6]||h[7])return false;
  item.fps=h[4];item.frames=h[5];item.offset=f.position();
  if(item.fps<1||item.fps>10||item.frames<1||item.frames>item.fps*30)return false;
  for(int i=0;i<item.frames;i++)if(!readAnimationFrame(f,animationPixels))return false;
  return true;
}
bool validateAnimation(File &f,uint8_t &fps,uint8_t &frames,bool activate=false){
  if(!f||f.size()<12||f.size()>ANIMATION_LIMIT)return false;
  uint8_t magic[5];if(f.read(magic,5)!=5)return false;f.seek(0);
  AnimationItem items[32];uint8_t count=1;bool playlist=!memcmp(magic,"CBQ1",4);
  if(playlist){
    count=magic[4];if(!count||count>32)return false;f.seek(5);
    for(int i=0;i<count;i++){
      int lo=f.read(),hi=f.read();if(lo<0||hi<0)return false;
      items[i].seconds=lo|(hi<<8);if(items[i].seconds<1||items[i].seconds>300)return false;
      if(!readClip(f,items[i]))return false;
    }
  }else{items[0].seconds=0;if(!readClip(f,items[0]))return false;}
  if(f.position()!=f.size())return false;
  fps=items[0].fps;frames=items[0].frames;
  if(activate){memcpy(animationItems,items,count*sizeof(AnimationItem));animationCount=count;animationPlaylist=playlist;}
  return true;
}
void stopAnimation(){animationReader.close();animationPlaying=false;}
bool selectAnimationItem(uint8_t index){
  animationItem=index;animationIndex=0;animationRepeat=0;animationItemAt=millis();
  animationFps=animationItems[index].fps;animationFrames=animationItems[index].frames;
  return animationReader.seek(animationItems[index].offset);
}
void beginAnimation(){
  if(!animationEnabled||!animationCount||!animationStorage)return;
  stopAnimation();animationReader=SPIFFS.open(animationPath(animationSlot),"r");
  if(!animationReader||!selectAnimationItem(0)){stopAnimation();return;}
  animationPlaying=true;
}
bool drawAnimation(){
  if(!animationPlaying&&animationOnly)beginAnimation();
  if(!animationPlaying||!animationEnabled){stopAnimation();return false;}
  if(animationPlaylist&&millis()-animationItemAt>=uint32_t(animationItems[animationItem].seconds)*1000){
    uint8_t next=animationItem+1;
    if(next>=animationCount){if(animationOnly)next=0;else{stopAnimation();return false;}}
    if(!selectAnimationItem(next)){stopAnimation();return false;}
  }
  if(animationIndex>=animationFrames){
    if(!animationPlaylist&&!animationOnly&&++animationRepeat>=animationLoops){stopAnimation();return false;}
    animationIndex=0;if(!animationReader.seek(animationItems[animationItem].offset)){stopAnimation();return false;}
  }
  if(!readAnimationFrame(animationReader,animationPixels)){stopAnimation();return false;}
  for(int y=0;y<32;y++)for(int x=0;x<64;x++){
    uint8_t c=animationPixels[y*64+x];
    panel->drawPixel(x,y,panel->color565(((c>>5)&7)*255/7,((c>>2)&7)*255/7,(c&3)*85));
  }
  animationIndex++;return true;
}
void animationState(JsonObject o){
  o["count"]=animationCount;o["onlyMedia"]=animationOnly;o["playlist"]=animationPlaylist;o["current"]=animationItem;o["maxItems"]=32;o["uploadReceived"]=animationReceived;
  o["available"]=animationFrames>0;o["enabled"]=animationEnabled;o["name"]=animationName;
  o["fps"]=animationFps;o["frames"]=animationFrames;o["loops"]=animationLoops;o["rounds"]=animationRounds;
  o["storageTotal"]=animationStorage?SPIFFS.totalBytes():0;o["storageUsed"]=animationStorage?SPIFFS.usedBytes():0;o["maxBytes"]=ANIMATION_LIMIT;o["storageReady"]=animationStorage;o["playing"]=animationPlaying;
}
void sendAnimationState(){StaticJsonDocument<512>d;animationState(d.to<JsonObject>());jsonReply(200,d);}
void cancelAnimationUpload(){animationUploading=false;animationUploadId="";animationExpected=0;}
// Do not retain a buffered FILE across network requests. Confirm each block
// only after closing it and reading back the bytes from the inactive slot.
bool storeAnimationBlock(const uint8_t *bytes,size_t count){
  String path=String("/spiffs")+animationPath(1-animationSlot);
  animationStoreStage="open";FILE *file=fopen(path.c_str(),"r+b");
  if(!file)return false;
  setvbuf(file,nullptr,_IONBF,0);
  bool ok=false;
  do {
    animationStoreStage="length";
    if(fseek(file,0,SEEK_END)||ftell(file)!=long(animationReceived))break;
    animationStoreStage="write";errno=0;
    if(fwrite(bytes,1,count,file)!=count)break;
    animationStoreStage="flush";if(fflush(file))break;
    animationStoreStage="seek";if(fseek(file,animationReceived,SEEK_SET))break;
    uint8_t saved[768];animationStoreStage="read";
    if(fread(saved,1,count,file)!=count)break;
    animationStoreStage="compare";if(memcmp(bytes,saved,count))break;
    ok=true;
  }while(false);
  int error=errno;int closed=fclose(file);
  if(ok&&closed){animationStoreStage="close";return false;}
  errno=error;return ok;
}
void setupAnimation(){
  animationStorage=SPIFFS.begin(false);
  // This partition was unused before 1.2. Never format automatically after first initialization.
  if(!animationStorage&&!prefs.getBool("animInit",false)){if(SPIFFS.format())animationStorage=SPIFFS.begin(false);}
  if(animationStorage){prefs.putBool("animInit",true);if(SPIFFS.totalBytes()>500000)ANIMATION_LIMIT=307200;}
  animationSlot=prefs.getUChar("animSlot",0)==1?1:0;
  animationLoops=constrain(prefs.getUChar("animLoops",2),1,5);animationRounds=constrain(prefs.getUChar("animRounds",1),1,5);
  animationOnly=prefs.getBool("animOnly",false);animationEnabled=prefs.getBool("animEnabled",false);animationName=prefs.getString("animName","");
  if(animationStorage){File f=SPIFFS.open(animationPath(animationSlot),"r");uint8_t fps,frames;if(validateAnimation(f,fps,frames,true)){animationFps=fps;animationFrames=frames;}f.close();}
  control.on("/api/animation",HTTP_GET,[]{if(authorized())sendAnimationState();});
  control.on("/api/animation/settings",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(256);if(!bodyJson(d))return;
    if(!d["enabled"].is<bool>()||!d["loops"].is<int>()||!d["rounds"].is<int>()){apiError(400,"Configuracion invalida");return;}
    int loops=d["loops"],rounds=d["rounds"];if(loops<1||loops>5||rounds<1||rounds>5){apiError(400,"Usa 1 a 5 repeticiones o vueltas");return;}
    bool only=d["onlyMedia"]|false;bool enabled=d["enabled"];if(enabled&&!animationFrames){apiError(409,"Primero carga un clip");return;}
    prefs.putUChar("animLoops",loops);prefs.putUChar("animRounds",rounds);prefs.putBool("animEnabled",enabled);
    animationOnly=only;prefs.putBool("animOnly",only);animationLoops=loops;animationRounds=rounds;animationEnabled=enabled;animationRound=0;
    if(!enabled)stopAnimation();else if(only&&!animationPlaying)beginAnimation();sendAnimationState();
  });
  control.on("/api/animation/play",HTTP_POST,[]{if(!authorized())return;if(!animationFrames||!animationEnabled){apiError(409,"Carga y activa el clip primero");return;}beginAnimation();sendAnimationState();});
  control.on("/api/animation/start",HTTP_POST,[]{
    if(!authorized())return;if(!animationStorage){apiError(503,"Almacenamiento no disponible");return;}
    if(cloudUpdateProgress()>=0){apiError(409,"Actualizacion de firmware en curso");return;}
    DynamicJsonDocument d(512);if(!bodyJson(d))return;
    if(!d["size"].is<uint32_t>()||!d["crc"].is<uint32_t>()||!d["name"].is<const char*>()){apiError(400,"Datos invalidos");return;}
    size_t size=d["size"];String name=d["name"].as<String>();if(size<12||size>ANIMATION_LIMIT||name.length()>64){apiError(400,"Clip demasiado grande");return;}
    if(animationUploading&&animationExpected==size&&animationExpectedCrc==d["crc"].as<uint32_t>()&&animationPendingName==name){
      animationUploadAt=millis();d.clear();d["upload"]=animationUploadId;d["received"]=animationReceived;d["chunkBytes"]=768;jsonReply(200,d);return;
    }
    cancelAnimationUpload();const char *path=animationPath(1-animationSlot);SPIFFS.remove(path);
    if(SPIFFS.totalBytes()-SPIFFS.usedBytes()<size+8192){apiError(507,"Sin espacio para conservar el clip anterior");return;}
    File writer=SPIFFS.open(path,"w");if(!writer){apiError(500,"No se pudo abrir el archivo");return;}writer.close();animationUploading=true;
    animationExpected=size;animationReceived=0;animationExpectedCrc=d["crc"];animationCrc=0xffffffff;
    animationPendingName=name;animationUploadAt=millis();animationUploadId=String(esp_random(),HEX)+String(esp_random(),HEX);
    d.clear();d["upload"]=animationUploadId;d["received"]=animationReceived;d["chunkBytes"]=768;jsonReply(200,d);
  });
  control.on("/api/animation/chunk",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(2048);if(!bodyJson(d))return;
    if(!animationUploading||d["upload"].as<String>()!=animationUploadId||!d["offset"].is<uint32_t>()){apiError(409,"Transferencia o posicion invalida");return;}
    String data=d["data"].as<String>();uint8_t bytes[768];size_t count=0;
    if(data.length()>1024||mbedtls_base64_decode(bytes,sizeof(bytes),&count,(const unsigned char*)data.c_str(),data.length())||!count){apiError(400,"Bloque invalido");return;}
    uint32_t offset=d["offset"];
    if(offset<animationReceived&&offset+count==animationReceived){
      animationUploadAt=millis();d.clear();d["received"]=animationReceived;jsonReply(200,d);return;
    }
    if(offset!=animationReceived||animationReceived+count>animationExpected){apiError(409,"Posicion invalida");return;}
    errno=0;bool stored=storeAnimationBlock(bytes,count);int writeError=errno;
    if(!stored){
      Serial.printf("[MEDIA] block stage=%s offset=%u expected=%u errno=%d heap=%u\n",animationStoreStage,unsigned(animationReceived),unsigned(count),writeError,ESP.getFreeHeap());
      cancelAnimationUpload();d.clear();d["error"]="Error al guardar; se conserva el contenido anterior";d["errno"]=writeError;d["stage"]=animationStoreStage;jsonReply(500,d);return;
    }
    animationCrc=crcBytes(animationCrc,bytes,count);animationReceived+=count;animationUploadAt=millis();
    d.clear();d["received"]=animationReceived;jsonReply(200,d);
  });
  control.on("/api/animation/finish",HTTP_POST,[]{
    if(!authorized())return;DynamicJsonDocument d(256);if(!bodyJson(d))return;
    if(animationCompletedUpload.length()&&d["upload"].as<String>()==animationCompletedUpload){sendAnimationState();return;}
    if(!animationUploading||d["upload"].as<String>()!=animationUploadId){apiError(409,"Transferencia invalida");return;}
    bool valid=animationReceived==animationExpected&&(animationCrc^0xffffffff)==animationExpectedCrc;
    File f=SPIFFS.open(animationPath(1-animationSlot),"r");uint8_t fps=0,frames=0;valid=valid&&validateAnimation(f,fps,frames);f.close();
    if(!valid){cancelAnimationUpload();apiError(400,"Archivo incompleto o invalido; se conserva el anterior");return;}
    int slot=1-animationSlot;if(prefs.putUChar("animSlot",slot)!=1){cancelAnimationUpload();apiError(500,"No se pudo activar");return;}
    stopAnimation();File loaded=SPIFFS.open(animationPath(slot),"r");validateAnimation(loaded,fps,frames,true);loaded.close();
    animationCompletedUpload=animationUploadId;animationSlot=slot;animationFps=fps;animationFrames=frames;animationName=animationPendingName;
    prefs.putString("animName",animationName);cancelAnimationUpload();sendAnimationState();
  });
}
