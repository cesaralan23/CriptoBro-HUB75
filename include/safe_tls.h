#pragma once
#include <WiFiClientSecure.h>

// Arduino-ESP32 2.0.17 stop_ssl_socket() zeroes the context, including socket.
// A subsequent stop() calls close(0), which can close an unrelated VFS file.
// Preserve the invalid socket sentinel after EVERY stop, including destruction.
// Certificate and hostname verification remain handled by WiFiClientSecure.
class SafeWiFiClientSecure : public WiFiClientSecure {
public:
  void stop() override {
    WiFiClientSecure::stop();
    sslclient->socket=-1;
  }
  ~SafeWiFiClientSecure() override {stop();}
};
