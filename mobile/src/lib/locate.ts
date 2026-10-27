import type { Device } from "./model";

export type Browse = (found: (d: Device) => void, error: (message: string) => void) => Promise<() => void>;
// Identity is checked before a caller may send its saved pairing token.
export async function locateDevice(saved: Device, probe: (address: string) => Promise<Device>,
  browse: Browse, timeoutMs = 12000): Promise<Device> {
  try {
    const current = await probe(saved.address);
    if (current.id === saved.id) return current;
  } catch { /* DHCP may have assigned another address. */ }
  return new Promise<Device>((resolve, reject) => {
    let finished = false, stop: (() => void) | undefined;
    const finish = (device?: Device, message?: string) => {
      if (finished) return;
      finished = true; clearTimeout(timer); stop?.();
      if (device) resolve(device);
      else reject(new Error(message || "No encontramos el cartel. Conectá el celular al mismo Wi-Fi y volvé a intentar."));
    };
    const timer = setTimeout(() => finish(), timeoutMs);
    browse(d => { if (d.id === saved.id) finish(d); }, message => finish(undefined, message))
      .then(cleanup => { stop = cleanup; if (finished) cleanup(); })
      .catch(error => finish(undefined, String(error)));
  });
}
