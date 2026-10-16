import { GifReader } from 'omggif';
import { fitClip, resizePixels } from './animation';
export function decodeGif(bytes: Uint8Array, name: string, seconds: number, fps = 30) {
  const gif = new GifReader(bytes);
  if (gif.width * gif.height > 1048576 || gif.numFrames() > 500) throw new Error('GIF demasiado grande: usá hasta 1 megapíxel y 500 cuadros');
  const canvas = new Uint8Array(gif.width * gif.height * 4), frames: Uint8Array[] = [];
  let elapsed = 0, sample = 0;
  for (let i = 0; i < gif.numFrames() && sample < seconds; i++) {
    const info = gif.frameInfo(i), before = info.disposal === 3 ? canvas.slice() : null;
    gif.decodeAndBlitFrameRGBA(i, canvas);
    elapsed += Math.max(0.02, info.delay / 100 || 0.1);
    const frame = resizePixels(canvas, gif.width, gif.height);
    while (sample < elapsed && sample < seconds && frames.length < seconds * fps) { frames.push(frame); sample += 1 / fps; }
    if (info.disposal === 2) for (let y = info.y; y < info.y + info.height; y++) canvas.fill(0, (y * gif.width + info.x) * 4, (y * gif.width + info.x + info.width) * 4);
    if (before) canvas.set(before);
  }
  return fitClip(name, frames, fps);
}
