#pragma once
// Call only from the network worker, never concurrently with another update.
void checkCloudUpdate();
// -1 means idle; 0..100 is a verified-size download in progress.
int cloudUpdateProgress();
