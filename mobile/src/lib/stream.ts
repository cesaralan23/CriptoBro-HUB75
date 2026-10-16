import { fromByteArray } from 'base64-js';
import { request } from './api';
import { QueueItem } from './playlist';

// Only one request in flight. Drop late frames instead of building a latency queue.
export async function streamQueue(address: string, token: string, items: QueueItem[],
  cancelled: () => boolean, progress: (text: string) => void,
  call: typeof request = request,
  wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
  now = Date.now) {
  if (!items.length || items.some(x => !x.clip.frames.length || x.seconds < 1 || x.seconds > 300 || !Number.isInteger(x.seconds)))
    throw new Error('Elegí una cola con duraciones de 1 a 300 segundos.');
  const info = await call<{streamApi?: number}>(address, 'info');
  if (info.streamApi !== 1) throw new Error('Streaming requiere firmware 1.4.0. Esperá la actualización del cartel.');
  const {session} = await call<{session: string}>(address, 'stream/start', token, {});
  let seq = 0;
  try {
    while (!cancelled()) for (const item of items) {
      const start = now();
      progress(`EN VIVO · ${item.clip.name}. Mantené la app abierta.`);
      while (!cancelled() && now() - start < item.seconds * 1000) {
        const sentAt = now();
        const frame = item.clip.frames[Math.floor((sentAt - start) * item.clip.fps / 1000) % item.clip.frames.length];
        if (frame.length !== 2048) throw new Error('Cuadro inválido');
        const ack = await call<{seq: number}>(address, 'stream/frame', token, {session, seq: ++seq, data: fromByteArray(frame)});
        if (ack.seq !== seq) throw new Error('El cartel no confirmó el cuadro.');
        await wait(Math.max(0, 1000 / Math.min(10, item.clip.fps) - (now() - sentAt)));
      }
      if (cancelled()) break;
    }
  } finally {
    // Device also falls back after 3 seconds if Wi-Fi vanishes.
    await call(address, 'stream/stop', token, {session}).catch(() => undefined);
  }
}
