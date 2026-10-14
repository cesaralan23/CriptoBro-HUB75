#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>
#include <time.h>
#include <math.h>
#include "root_ca.h"
#include "version.h"
#include "cloud_ota.h"

MatrixPanel_I2S_DMA *panel;
WiFiManager portal;
struct Quote {
  double price=0, change=0;
  uint32_t received=0;
  time_t timestamp=0;
  bool valid=false, closed=false, failed=false;
};
Quote quotes[3];
portMUX_TYPE quoteLock=portMUX_INITIALIZER_UNLOCKED;
const char *names[]={"BTC","SOL","MSTR"};
char apPassword[13];
uint32_t frameAt=0, lostAt=0;
int active=0, scrollX=64;
Quote shown;
char priceText[24]="...";
String serialCommand;
uint16_t white,green,red,orange,cyan,purple,grey;

void publish(int index,const Quote &q) {
  portENTER_CRITICAL(&quoteLock); quotes[index]=q; portEXIT_CRITICAL(&quoteLock);
  Serial.printf("[QUOTE] %s %.2f %+.2f%% %s timestamp=%lld\n",names[index],q.price,q.change,q.closed?"CERRADO":"ACTIVO",(long long)q.timestamp);
}
void failure(int first,int last) {
  portENTER_CRITICAL(&quoteLock);
  for(int i=first;i<=last;i++) quotes[i].failed=true;
  portEXIT_CRITICAL(&quoteLock);
}
bool request(const char *url,DynamicJsonDocument &doc) {
  WiFiClientSecure tls;
  tls.setCACert(ROOT_CA);
  tls.setHandshakeTimeout(8);
  HTTPClient http;
  http.setConnectTimeout(5000); http.setTimeout(5000);
  http.setUserAgent("Mozilla/5.0 CriptoBro/1.0");
  http.useHTTP10(true);
  if(!http.begin(tls,url)) return false;
  int code=http.GET();
  bool ok=false;
  if(code==200) {
    auto error=deserializeJson(doc,http.getStream());
    ok=!error;
    if(error) Serial.printf("[JSON] %s\n",error.c_str());
  } else Serial.printf("[HTTP] %d\n",code);
  http.end();
  return ok;
}
bool fetchCrypto() {
  DynamicJsonDocument doc(8192);
  if(!request("https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22SOLUSDT%22%5D",doc)) return false;
  Quote incoming[2];
  for(JsonObject item:doc.as<JsonArray>()) {
    const char *symbol=item["symbol"]|"";
    int index=strcmp(symbol,"BTCUSDT")==0?0:strcmp(symbol,"SOLUSDT")==0?1:-1;
    if(index<0) continue;
    if(item["lastPrice"].isNull() || item["priceChangePercent"].isNull()) continue;
    Quote &q=incoming[index];
    q.price=item["lastPrice"].as<double>(); q.change=item["priceChangePercent"].as<double>();
    q.timestamp=item["closeTime"].as<int64_t>()/1000;
    q.valid=isfinite(q.price)&&q.price>0&&isfinite(q.change)&&q.timestamp>1700000000&&llabs((long long)time(nullptr)-q.timestamp)<180;
    q.received=millis();
  }
  if(!incoming[0].valid || !incoming[1].valid) return false;
  publish(0,incoming[0]); publish(1,incoming[1]); return true;
}
bool fetchStock() {
  // Yahoo's public chart endpoint is unofficial; errors retain an explicitly stale quote.
  DynamicJsonDocument doc(16384);
  if(!request("https://query1.finance.yahoo.com/v8/finance/chart/MSTR?interval=1d&range=5d",doc)) return false;
  JsonObject result=doc["chart"]["result"][0];
  JsonObject meta=result["meta"];
  if(strcmp(meta["symbol"]|"","MSTR") || strcmp(meta["currency"]|"","USD")) return false;
  Quote q;
  q.price=meta["regularMarketPrice"].as<double>();
  q.timestamp=meta["regularMarketTime"].as<int64_t>();
  double previous=0;
  // chartPreviousClose refers to the beginning of the requested range, not yesterday.
  if(!meta["regularMarketChangePercent"].isNull()) q.change=meta["regularMarketChangePercent"].as<double>();
  else {
    JsonArray times=result["timestamp"], closes=result["indicators"]["quote"][0]["close"];
    long offset=meta["gmtoffset"]|0;
    int64_t quoteDay=(q.timestamp+offset)/86400;
    for(size_t i=0;i<times.size();i++) {
      int64_t day=(times[i].as<int64_t>()+offset)/86400;
      if(day<quoteDay && !closes[i].isNull()) previous=closes[i].as<double>();
    }
    if(!isfinite(previous)||previous<=0) return false;
    q.change=(q.price/previous-1)*100;
  }
  time_t start=meta["currentTradingPeriod"]["regular"]["start"].as<int64_t>();
  time_t end=meta["currentTradingPeriod"]["regular"]["end"].as<int64_t>();
  if(!start || end<=start) return false;
  time_t now=time(nullptr);
  q.closed=now<start || now>=end;
  q.valid=isfinite(q.price)&&q.price>0&&isfinite(q.change)&&q.timestamp>1700000000&&q.timestamp<=now+180;
  q.failed=!q.closed && now-q.timestamp>1200;
  q.received=millis();
  if(!q.valid) return false;
  publish(2,q); return true;
}
void pricesTask(void*) {
  uint32_t cryptoAt=0,stockAt=0,cryptoWait=10000,stockWait=60000;
  uint32_t otaAt=millis();bool firstOta=true;
  bool firstCrypto=true,firstStock=true;
  for(;;) {
    if(WiFi.status()!=WL_CONNECTED || time(nullptr)<1700000000) {vTaskDelay(pdMS_TO_TICKS(300));continue;}
    uint32_t now=millis();
    if(firstCrypto || now-cryptoAt>=cryptoWait) {
      firstCrypto=false;
      bool ok=fetchCrypto();
      if(!ok) failure(0,1);
      cryptoWait=ok?10000: min(cryptoWait*2,uint32_t(120000)); cryptoAt=millis();
    }
    if(firstStock || millis()-stockAt>=stockWait) {
      firstStock=false;
      bool ok=fetchStock();
      if(!ok) failure(2,2);
      stockWait=ok?60000:min(stockWait*2,uint32_t(300000)); stockAt=millis();
    }
    if(millis()-otaAt >= (firstOta?30000UL:300000UL)) {
      firstOta=false;checkCloudUpdate();otaAt=millis();
    }
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}
constexpr uint8_t MAX_BRIGHTNESS_PERCENT=80;
uint8_t brightnessPercent=50;
void setBrightnessPercent(uint8_t requested) {
  brightnessPercent=min(requested,MAX_BRIGHTNESS_PERCENT);
  panel->setBrightness8((brightnessPercent*255U+50U)/100U);
}
// All text uses 2x2 physical pixels. Even scrolling coordinates preserve
// complete two-pixel strokes at the edges of the viewport.
void text(int x,int y,const char *s,uint16_t color) {
  panel->setTextSize(2); panel->setTextColor(color); panel->setCursor(x,y); panel->print(s);
}
void marquee(int y,const char *s,uint16_t color) {
  int width=strlen(s)*12;
  int x=width<=64?0:64-int((millis()/70) % ((width+80)/2))*2;
  text(x,y,s,color);
}
void logo(int coin) {
  if(coin==0) {
    panel->fillCircle(10,16,10,orange);
    text(6,10,"B",white);
    panel->fillRect(8,8,2,2,white);panel->fillRect(8,24,2,2,white);
  } else if(coin==1) {
    for(int row=0;row<3;row++)
      panel->fillRect(row==1?0:4,8+row*6,16,4,row==0?cyan:row==1?purple:green);
  } else {
    panel->fillRoundRect(0,6,20,20,4,orange);text(6,10,"S",white);
  }
}
void newQuote() {
  portENTER_CRITICAL(&quoteLock); shown=quotes[active]; portEXIT_CRITICAL(&quoteLock);
  if(shown.valid) snprintf(priceText,sizeof(priceText),"%.2f",shown.price);
  else strcpy(priceText,"--.--");
  scrollX=64;
}
void drawFrame() {
  panel->fillScreen(0);
  int otaProgress=cloudUpdateProgress();
  if(otaProgress>=0) {
    text(0,0,"OTA",cyan);
    char progressText[12];snprintf(progressText,sizeof(progressText),"%d%%",otaProgress);
    text(0,18,progressText,white);
  } else if(portal.getConfigPortalActive()) {
    uint32_t page=(millis()/16000)%3;
    text(0,0,page==1?"CLAVE":"WIFI",cyan);
    marquee(18,page==0?"CriptoBro64":page==1?apPassword:"192.168.4.1",white);
  } else {
    char top[64],bottom[64];
    snprintf(top,sizeof(top),"%s %s %s",names[active],priceText,active==2?"USD":"USDT");
    bool stale=shown.valid&&(millis()-shown.received>(active==2?180000:60000));
    const char *state=nullptr;
    if(WiFi.status()!=WL_CONNECTED) state="SIN WIFI";
    else if(time(nullptr)<1700000000) state="RELOJ...";
    else if(stale || shown.failed) state="DATO VIEJO";
    else if(!shown.valid) state="CARGANDO";
    if(state) snprintf(bottom,sizeof(bottom),"%s",state);
    else snprintf(bottom,sizeof(bottom),"%+.2f%% %s%s",shown.change,active<2?"24H":"DIA",active==2&&shown.closed?" CER":"");
    text(scrollX,0,top,white);
    text(scrollX,18,bottom,state?orange:shown.change>0?green:shown.change<0?red:grey);
    // Fixed 20px logo and 2px separation, masking both scrolling lines.
    panel->fillRect(0,0,22,32,0);logo(active);
    scrollX-=2;
    if(scrollX < 22-int(max(strlen(top),strlen(bottom))*12)-8) {active=(active+1)%3;newQuote();}
  }
  panel->flipDMABuffer();
}
void setup() {
  Serial.begin(115200);
  HUB75_I2S_CFG::i2s_pins pins={25,26,27,14,13,32,23,19,18,33,-1,21,4,22};
  HUB75_I2S_CFG config(64,32,1,pins);
  config.double_buff=true;
  panel=new MatrixPanel_I2S_DMA(config);
  if(!panel->begin()) {Serial.println("[ERROR] DMA");while(true) delay(1000);}
  setBrightnessPercent(50); panel->setTextWrap(false);
  white=panel->color565(220,235,255); green=panel->color565(0,255,70);
  red=panel->color565(255,25,30); orange=panel->color565(255,125,0);
  cyan=panel->color565(0,220,255); purple=panel->color565(170,50,255); grey=panel->color565(90,105,120);
  text(0,0,"BOOT",orange);text(0,18,"64X32",white);panel->flipDMABuffer();
  snprintf(apPassword,sizeof(apPassword),"CB%06X",unsigned(ESP.getEfuseMac()&0xFFFFFF));
  WiFi.mode(WIFI_STA); WiFi.setHostname("criptobro64"); WiFi.setAutoReconnect(true);
  portal.setDebugOutput(false); portal.setConfigPortalBlocking(false); portal.setConnectTimeout(12);
  portal.setTitle("CriptoBro 64 - WiFi");
  portal.setAPCallback([](WiFiManager*) {Serial.printf("[WIFI] Red=CriptoBro64 clave=%s URL=http://192.168.4.1\n",apPassword);});
  portal.autoConnect("CriptoBro64",apPassword);
  configTime(0,0,"pool.ntp.org","time.google.com");
  if(xTaskCreate(pricesTask,"prices",16384,nullptr,1,nullptr)!=pdPASS) Serial.println("[ERROR] Tarea precios");
  Serial.println("[CriptoBro64] Version " FIRMWARE_VERSION ". OTA HTTPS cada 5 minutos. WIFI configura; STATUS informa conexion.");
  newQuote();
}
void loop() {
  portal.process();
  uint32_t now=millis();
  if(WiFi.status()!=WL_CONNECTED) {
    if(!lostAt) lostAt=now;
    if(now-lostAt>30000&&!portal.getConfigPortalActive()) portal.startConfigPortal("CriptoBro64",apPassword);
  } else lostAt=0;
  while(Serial.available()) {
    char c=Serial.read();
    if(c=='\n') {
      serialCommand.trim();
      if(serialCommand=="WIFI"&&!portal.getConfigPortalActive()) portal.startConfigPortal("CriptoBro64",apPassword);
      if(serialCommand=="STATUS") Serial.printf("[STATUS] version=" FIRMWARE_VERSION " wifi=%d ip=%s heap=%u brightness=%u%% max=%u%% text=2px\n",WiFi.status(),WiFi.localIP().toString().c_str(),ESP.getFreeHeap(),brightnessPercent,MAX_BRIGHTNESS_PERCENT);
      serialCommand="";
    } else if(serialCommand.length()<64) serialCommand+=c;
  }
  if(now-frameAt>=70) {frameAt=now;drawFrame();}
  delay(2);
}
