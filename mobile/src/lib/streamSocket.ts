import { localAddress } from './model';

export type FrameChannel = { send(frame: Uint8Array): Promise<void>; close(): void };
// Persistent RFC6455 binary transport. One acknowledged frame at a time bounds latency.
export function openFrameChannel(address: string, port: number, session: string,
  makeSocket = (url: string) => new WebSocket(url)): Promise<FrameChannel> {
  const host = localAddress(address).split(':')[0];
  if (port !== 8081) return Promise.reject(new Error('Puerto de streaming inválido'));
  return new Promise((resolve, reject) => {
    const socket = makeSocket(`ws://${host}:${port}/`);
    socket.binaryType = 'arraybuffer';
    let seq = 0, ready = false, closed = false;
    let pending: { resolve(): void; reject(e: Error): void } | undefined;
    let timer = setTimeout(() => fail(new Error('El cartel no abrió el streaming')), 4000);
    function fail(error: Error) {
      clearTimeout(timer);
      pending?.reject(error); pending = undefined;
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
            if (pending || frame.length !== 2048) return Promise.reject(new Error('Cuadro inválido o pendiente'));
            const bytes = new Uint8Array(2052);
            new DataView(bytes.buffer).setUint32(0, ++seq, true); bytes.set(frame, 4);
            return new Promise<void>((ok, bad) => {
              pending = { resolve: ok, reject: bad };
              timer = setTimeout(() => fail(new Error('El cartel dejó de confirmar cuadros')), 2000);
              try { socket.send(bytes.buffer); } catch { fail(new Error('No se pudo enviar el cuadro')); }
            });
          },
        });
      } else if (pending) {
        if (!(event.data instanceof ArrayBuffer) || event.data.byteLength !== 4 ||
            new DataView(event.data).getUint32(0, true) !== seq)
          return fail(new Error('Confirmación de cuadro inválida'));
        clearTimeout(timer); const done = pending; pending = undefined; done.resolve();
      }
    };
  });
}
