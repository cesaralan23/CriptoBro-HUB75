import UPNG from 'upng-js';
import { resizePixels } from './animation';
// UPNG uses byte operations, including metadata. No non-UTF8 TextDecoder
// constructors: Expo Go's decoder only supports UTF-8.
export function pngFrame(bytes: Uint8Array) {
  const buffer = new Uint8Array(bytes).buffer;
  const png = UPNG.decode(buffer);
  return resizePixels(new Uint8Array(UPNG.toRGBA8(png)[0]), png.width, png.height);
}
