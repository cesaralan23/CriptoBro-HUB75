import { test } from 'node:test';
import assert from 'node:assert/strict';
test('PNG import and conversion work with Expo Go UTF8-only TextDecoder', async () => {
  const Original = globalThis.TextDecoder;
  class UTF8Only extends Original {
    constructor(label = 'utf-8', options?: TextDecoderOptions) {
      if (!['utf-8','utf8'].includes(label.toLowerCase())) throw new Error(`Unknown encoding: ${label}`);
      super(label, options);
    }
  }
  globalThis.TextDecoder = UTF8Only;
  try {
    const {pngFrame} = await import('../src/lib/png');
    const UPNG = (await import('upng-js')).default;
    const rgba = new Uint8Array(64 * 32 * 4);
    for (let i = 0; i < rgba.length; i += 4) {rgba[i] = 255; rgba[i + 3] = 255;}
    const encoded = UPNG.encode([rgba.buffer],64,32,0);
    const frame = pngFrame(new Uint8Array(encoded));
    assert.equal(frame.length,2048); assert.ok(frame.every(c=>c===224));
  } finally {globalThis.TextDecoder = Original;}
});
