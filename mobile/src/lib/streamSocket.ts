import { localAddress } from './model';

export type FrameChannel = { send(frame: Uint8Array): Promise<void>; close(): void };
// Persistent RFC6455 transport. At most three frames in flight bounds latency.
export function openFrameChannel(address: string, port: number, session: string,
  makeSocket = (url: string) => new WebSocket(url)): Promise<FrameChannel> {
  const host = localAddress(address).split(':')[0];
  if (port !== 8081) return Promise.reject(new Error('Puerto de streaming inválido'));
  return new Promise((resolve, reject) => {
    const socket = makeSocket(`ws://${host}:${port}/`);
    socket.binaryType = 'arraybuffer';
    let seq = 0, ready = false, closed = false;
    const pending = new Map<number, { resolve(): void; reject(e: Error): void; timer: ReturnType<typeof setTimeout> }>();
    const timer = setTimeout(() => fail(new Error('El cartel no abrió el streaming')), 4000);
    function fail(error: Error) {
      clearTimeout(timer);
      for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear();
      if (!ready) reject(error);
      if (!closed) { closed = true; socket.close(); }
    }
    socket.onopen = () => socket.send(session);
    socket.onerror = () => fail(new Error('Se perdió la conexión del streaming'));
    socket.onclose = () => fail(new Error('El cartel cerró el streaming'));
    socket.onmessage = event => {
      if (!ready) {
        if (event.data !== 'ready') return fail(new Error('Respuesta de streaming inválida'));
        clearTimeout(timer); ready = true;
        resolve({
          close: () => fail(new Error('Transmisión detenida')),
          send(frame) {
            if (closed) return Promise.reject(new Error('Streaming desconectado'));
            if (pending.size >= 3 || frame.length !== 2048) return Promise.reject(new Error('Cuadro inválido o ventana llena'));
            const bytes = new Uint8Array(2052);
            new DataView(bytes.buffer).setUint32(0, ++seq, true); bytes.set(frame, 4);
            return new Promise<void>((ok, bad) => {
              pending.set(seq, { resolve: ok, reject: bad,
                timer: setTimeout(() => fail(new Error('El cartel dejó de confirmar cuadros')), 2000) });
              try { socket.send(bytes.buffer); } catch { fail(new Error('No se pudo enviar el cuadro')); }
            });
          },
        });
      } else {
        if (!(event.data instanceof ArrayBuffer) || event.data.byteLength !== 4)
          return fail(new Error('Confirmación de cuadro inválida'));
        const ack = new DataView(event.data).getUint32(0, true), done = pending.get(ack);
        if (!done) return fail(new Error('Confirmación de cuadro desconocida'));
        clearTimeout(done.timer); pending.delete(ack); done.resolve();
      }
    };
  });
}
