import fonts from './fonts.json';
export type Clip = { name: string; fps: number; frames: Uint8Array[]; bytes: Uint8Array };
export const MAX_BYTES = 307200;
export function encode(frames: Uint8Array[], fps: number): Uint8Array {
  if (!Number.isInteger(fps) || fps < 1 || fps > 10 || !frames.length || frames.length > Math.min(255, fps * 30)) throw new Error('Duración máxima: 30 segundos (255 cuadros)');
  const out = [67, 66, 65, 49, fps, frames.length, 0, 0];
  for (const frame of frames) {
    if (frame.length !== 2048) throw new Error('Resolución inválida');
    const runs: number[] = [];
    for (let i = 0; i < frame.length;) {
      let n = 1; while (n < 255 && i + n < frame.length && frame[i + n] === frame[i]) n++;
      runs.push(n, frame[i]); i += n;
    }
    const raw = runs.length >= 2048, data = raw ? frame : runs;
    const size = data.length | (raw ? 0x8000 : 0);
    out.push(size & 255, size >> 8, ...data);
  }
  return Uint8Array.from(out);
}
export function fitClip(name: string, frames: Uint8Array[], fps: number): Clip {
  if (!Number.isInteger(fps) || fps < 1 || fps > 30 || !frames.length || frames.length > fps * 30 || frames.some(f => f.length !== 2048)) throw new Error('Clip inválido: máximo 30 fps y 30 segundos');
  for (let rate = Math.min(10, fps, Math.floor(255 * fps / frames.length)); rate >= 1; rate--) {
    const selected = Array.from({length: Math.max(1, Math.floor(frames.length * rate / fps))}, (_, i) => frames[Math.floor(i * fps / rate)]);
    const bytes = encode(selected, rate);
    if (bytes.length <= MAX_BYTES) return {name, frames, fps, bytes};
  }
  throw new Error('El clip no entra en la memoria');
}
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function rgb332(r: number, g: number, b: number) { return ((r >> 5) << 5) | ((g >> 5) << 2) | (b >> 6); }
export function pixelColor(c: number) { return `rgb(${Math.round((c >> 5) * 255 / 7)},${Math.round(((c >> 2) & 7) * 255 / 7)},${(c & 3) * 85})`; }
export function resizePixels(data: ArrayLike<number>, width: number, height: number, channels = 4) {
  const out = new Uint8Array(2048), scale = Math.min(64 / width, 32 / height);
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const left = Math.floor((64 - w) / 2), top = Math.floor((32 - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (Math.min(height - 1, Math.floor(y / scale)) * width + Math.min(width - 1, Math.floor(x / scale))) * channels;
    const a = channels === 4 ? data[p + 3] / 255 : 1;
    out[(y + top) * 64 + x + left] = rgb332(data[p] * a, data[p + 1] * a, data[p + 2] * a);
  }
  return out;
}
export const memeNames = ['HODL', 'STONKS', 'TO THE MOON', 'BUY THE DIP'];
export function meme(name: string): Clip {
  const frames = Array.from({length: 24}, (_, phase) => {
    const p = new Uint8Array(2048);
    const rect = (x: number, y: number, w: number, h: number, c: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 2 && i < 62 && j >= 2 && j < 30) p[j * 64 + i] = c; };
    const width = name.length * 8 - 2;
    const offset = width <= 60 ? Math.floor((64 - width) / 2) : 62 - phase * (width + 60) / 24;
    [...name].forEach((letter, i) => {
      const rows = (fonts.compact as Record<string, number[]>)[letter] || [0,0,0,0,0];
      rows.forEach((row, y) => { for (let x = 0; x < 3; x++) if (row & (1 << (2 - x))) rect(Math.floor(offset) + i * 8 + x * 2, 18 + y * 2, 2, 2, 255); });
    });
    if (name === 'HODL') {
      for (let y = 0; y < 10; y++) rect(32 - Math.min(y + 2, 12 - y), 3 + y, Math.min(y + 2, 12 - y) * 2, 1, phase % 8 < 4 ? 31 : 159);
    } else if (name === 'TO THE MOON') {
      const x = 18 + phase; rect(x, 5, 10, 6, 255); rect(x + 8, 7, 4, 2, 28); rect(x - 4, 7, 4, 2, phase % 2 ? 224 : 252);
    } else {
      for (let x = 8; x < 56; x += 2) rect(x, name === 'STONKS' ? 14 - Math.floor((x + phase) / 8) : 4 + Math.floor((x + phase) % 40 / 5), 2, 2, name === 'STONKS' ? 28 : 224);
    }
    return p;
  });
  return fitClip(name, frames, 8);
}
