import { fromByteArray } from 'base64-js';
import { ApiError, request } from './api';
import { FrameChannel, openFrameChannel } from './streamSocket';
import { QueueItem } from './playlist';

export async function streamQueue(address: string, token: string, items: QueueItem[],
  cancelled: () => boolean, progress: (text: string) => void,
  call: typeof request = request,
  wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
  now = Date.now, connect = openFrameChannel) {
  if (!items.length || items.some(x => !x.clip.frames.length || x.seconds < 1 || x.seconds > 300 || !Number.isInteger(x.seconds)))
    throw new Error('Elegí una cola con duraciones de 1 a 300 segundos.');
  let channel: FrameChannel | undefined, session = '', deviceId = '', retries = 0;
  const pending = new Set<Promise<void>>();
  let frameError: unknown;
  async function reconnect() {
    while (!cancelled()) {
      try {
        const info = await call<{streamApi?: number; streamWsApi?: number; id?: string}>(address, 'info');
        if (info.streamApi === 1 && !info.streamWsApi) return false;
        if (info.streamWsApi !== 1) throw new ApiError(422, 'Actualizá el firmware del cartel para transmitir.');
        if (deviceId && info.id !== deviceId) throw new ApiError(422, 'La IP ahora pertenece a otro cartel. Volvé a buscar tu pantalla.');
        deviceId = info.id || '';
        const start = await call<{session: string; wsPort: number}>(address, 'stream/start', token, {});
        session = start.session;
        channel = await connect(address, start.wsPort, session);
        retries = 0; return true;
      } catch (error) {
        channel?.close(); channel = undefined;
        if (error instanceof ApiError && [401,403,422].includes(error.status)) throw error;
        progress(`Reconectando al cartel… intento ${++retries}. Podés detener la transmisión.`);
        // Cancellable backoff; the screen uses its saved content while disconnected.
        for (let n = 0; n < Math.min(retries * 10, 30) && !cancelled(); n++) await wait(100);
      }
    }
    return true;
  }
  try {
    if (!await reconnect()) return await legacyStreamQueue(address, token, items, cancelled, progress, call, wait, now);
    while (!cancelled()) for (const item of items) {
      let start = now(), reportAt = start, sent = 0;
      progress(`EN VIVO · ${item.clip.name} · hasta ${Math.min(30,item.clip.fps)} fps`);
      while (!cancelled() && now() - start < item.seconds * 1000) {
        const tick = now();
        try {
          if (pending.size >= 3) await Promise.race(pending);
          if (frameError) throw frameError;
          if (cancelled()) break;
          const frame = item.clip.frames[Math.floor((now() - start) * item.clip.fps / 1000) % item.clip.frames.length];
          const target = channel!;
          const task = target.send(frame).then(() => { sent++; }, error => { frameError = error; })
            .finally(() => { pending.delete(task); });
          pending.add(task);
        } catch {
          channel?.close(); channel = undefined;
          await Promise.all(pending); frameError = undefined;
          progress('Se cortó el Wi-Fi. Reconectando automáticamente…');
          await reconnect(); start = now(); reportAt = start; sent = 0; continue;
        }
        if (now() - reportAt >= 1000) {
          progress(`EN VIVO · ${item.clip.name} · ${(sent * 1000 / (now()-reportAt)).toFixed(1)} fps`);
          reportAt = now(); sent = 0;
        }
        await wait(Math.max(0, 1000 / Math.min(30,item.clip.fps) - (now()-tick)));
      }
      if (cancelled()) break;
    }
  } finally {
    channel?.close();
    await Promise.all(pending);
    if (session) await call(address, 'stream/stop', token, {session}).catch(() => undefined);
  }
}

// Only one request in flight. Drop late frames instead of building a latency queue.
async function legacyStreamQueue(address: string, token: string, items: QueueItem[],
  cancelled: () => boolean, progress: (text: string) => void,
  call: typeof request = request,
  wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)),
  now = Date.now) {
  if (!items.length || items.some(x => !x.clip.frames.length || x.seconds < 1 || x.seconds > 300 || !Number.isInteger(x.seconds)))
    throw new Error('Elegí una cola con duraciones de 1 a 300 segundos.');
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
