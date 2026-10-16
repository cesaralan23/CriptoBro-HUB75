#include <Arduino.h>
#include <esp_debug_helpers.h>
volatile int mediaProtectedFd=-1;
extern "C" int __real__close_r(struct _reent *r,int fd);
extern "C" int __wrap__close_r(struct _reent *r,int fd){
  if(fd==mediaProtectedFd){
    Serial.printf("[MEDIA] unexpected close fd=%d task=%s\n",fd,pcTaskGetName(nullptr));
    esp_backtrace_print(10);
  }
  return __real__close_r(r,fd);
}
