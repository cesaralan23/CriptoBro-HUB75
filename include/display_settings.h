#pragma once
#include <ArduinoJson.h>
struct DisplaySettings {
  String name="CriptoBro", font="compact", mode="ticker", message="HOLA CRIPTOBRO";
  int brightness=50, interval=140, top=4, bottom=18, inset=2, textX=20;
  bool showLogo=true;
  String priceColor="DCEBFF", positiveColor="00FF46", negativeColor="FF191E";
  int coins[3]={0,1,2}, count=3;
};
DisplaySettings settings;
void encodeSettings(JsonObject o,const DisplaySettings &s) {
  o["name"]=s.name;o["font"]=s.font;o["mode"]=s.mode;o["message"]=s.message;
  o["brightness"]=s.brightness;o["interval"]=s.interval;o["top"]=s.top;o["bottom"]=s.bottom;
  o["inset"]=s.inset;o["textX"]=s.textX;o["showLogo"]=s.showLogo;
  o["priceColor"]=s.priceColor;o["positiveColor"]=s.positiveColor;o["negativeColor"]=s.negativeColor;
  JsonArray a=o.createNestedArray("coins");for(int i=0;i<s.count;i++) a.add(s.coins[i]);
}
bool validColor(const String &s) {
  if(s.length()!=6)return false;
  for(char c:s)if(!isxdigit(c))return false;
  return true;
}
// Validate into a temporary copy; malformed requests never partly change the display.
bool decodeSettings(JsonObject o,DisplaySettings &s) {
  const char *numbers[]={"brightness","interval","top","bottom","inset","textX"};
  for(auto k:numbers)if(!o[k].is<int>())return false;
  const char *strings[]={"name","font","mode","message","priceColor","positiveColor","negativeColor"};
  for(auto k:strings)if(!o[k].is<const char*>())return false;
  if(!o["showLogo"].is<bool>() || !o["coins"].is<JsonArray>())return false;
  s.name=o["name"].as<String>();s.font=o["font"].as<String>();s.mode=o["mode"].as<String>();s.message=o["message"].as<String>();
  s.brightness=o["brightness"];s.interval=o["interval"];s.top=o["top"];s.bottom=o["bottom"];
  s.inset=o["inset"];s.textX=o["textX"];s.showLogo=o["showLogo"];
  s.priceColor=o["priceColor"].as<String>();s.positiveColor=o["positiveColor"].as<String>();s.negativeColor=o["negativeColor"].as<String>();
  if(s.name.length()<1||s.name.length()>24||s.message.length()>80)return false;
  for(char c:s.name)if(c<32||c>126)return false;
  for(char c:s.message)if(!(c==' '||c=='.'||c=='+'||c=='-'||c=='%'||(c>='0'&&c<='9')||(c>='A'&&c<='Z')))return false;
  if(s.font!="compact"&&s.font!="classic")return false;
  if(s.mode!="ticker"&&s.mode!="text")return false;
  if(s.brightness<0||s.brightness>80||s.interval<40||s.interval>1000)return false;
  int h=s.font=="compact"?10:14;
  if(s.top<0||s.bottom<0||s.top+h>32||s.bottom+h>32||s.top%2||s.bottom%2)return false;
  if(s.inset<0||s.inset>8||s.inset%2||s.textX<0||s.textX>40||s.textX%2)return false;
  if(!validColor(s.priceColor)||!validColor(s.positiveColor)||!validColor(s.negativeColor))return false;
  JsonArray coins=o["coins"];s.count=coins.size();if(s.count<1||s.count>3)return false;
  bool seen[3]={false,false,false};int i=0;
  for(JsonVariant v:coins){if(!v.is<int>())return false;int c=v;if(c<0||c>2||seen[c])return false;seen[c]=true;s.coins[i++]=c;}
  return true;
}
