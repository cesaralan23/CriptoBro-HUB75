#include <Arduino.h>
#include <esp_debug_helpers.h>
volatile int mediaProtectedFd=-1;
extern "C" int __real_esp_vfs_close(int fd);
extern "C" int __wrap_esp_vfs_close(int fd){
  if(fd==mediaProtectedFd){
    Serial.printf("[MEDIA] unexpected close fd=%d task=%s\n",fd,pcTaskGetName(nullptr));
    esp_backtrace_print(10);
  }
  return __real_esp_vfs_close(fd);
}
