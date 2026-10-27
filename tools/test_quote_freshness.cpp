#include "../include/quote_freshness.h"
static_assert(!quoteIsStale(true,false,0,11000,11), "recent crypto stays fresh after a failed query");
static_assert(!quoteIsStale(true,false,0,60000,60), "freshness boundary");
static_assert(quoteIsStale(true,false,0,60001,60), "missing crypto updates expire");
static_assert(quoteIsStale(true,false,0,1000,181), "cached upstream crypto expires");
static_assert(!quoteIsStale(true,false,2,61000,61), "recent stock survives one failed query");
static_assert(quoteIsStale(true,false,2,180001,180), "missing stock updates expire");
static_assert(quoteIsStale(true,false,2,1000,1201), "old open market price expires");
static_assert(!quoteIsStale(true,true,2,1000,86400), "confirmed closed market price is valid");
static_assert(!quoteIsStale(false,false,0,999999,999999), "missing initial quote is loading");
