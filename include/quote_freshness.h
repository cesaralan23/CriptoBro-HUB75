#pragma once
#include <stdint.h>
// Query failures and quote age are separate: one timeout does not age a price.
constexpr bool quoteIsStale(bool valid, bool closed, int index, uint32_t ageMs,
                         int64_t sourceAgeSeconds) {
  return valid && (ageMs > (index == 2 ? 180000U : 60000U) ||
    (index == 2 ? (!closed && sourceAgeSeconds > 1200) : sourceAgeSeconds > 180));
}
