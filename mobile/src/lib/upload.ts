import { fromByteArray } from "base64-js";
import { crc32 } from "./animation";
import { ApiError, request } from "./api";
export async function retryTransfer<T>(
  work: () => Promise<T>,
  progress: (text: string) => void,
  cancelled: () => boolean,
  wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
) {
  for (let attempt = 0; ; attempt++) {
    if (cancelled())
      throw new Error("Envío cancelado. Consultá el cartel para confirmar el contenido activo.");
    try {
      return await work();
    } catch (error) {
      if ((error instanceof ApiError && error.status < 500) || attempt >= 10)
        throw error;
      progress(
        `Reconectando… intento ${attempt + 1}/10. Conservá el Wi-Fi y la app abierta.`,
      );
      await wait(Math.min(1000 * (attempt + 1), 5000));
    }
  }
}
export async function uploadQueue(
  address: string,
  token: string,
  bytes: Uint8Array,
  progress: (text: string) => void,
  cancelled: () => boolean,
) {
  const call = <T>(path: string, body?: unknown) =>
    retryTransfer(
      () => request<T>(address, path, token, body),
      progress,
      cancelled,
    );
  const info = await call<{ animationApi?: number; version: string }>("info");
  if ((info.animationApi || 0) < 2)
    throw new Error(
      `El cartel tiene ${info.version}. La cola necesita firmware 1.3.0; esperá la actualización OTA.`,
    );
  const transfer = await call<{ upload: string; received: number }>(
    "animation/start",
    { size: bytes.length, crc: crc32(bytes), name: "Mi cola" },
  );
  for (let offset = transfer.received; offset < bytes.length; ) {
    const end = Math.min(offset + 768, bytes.length);
    const result = await call<{ received: number }>("animation/chunk", {
      upload: transfer.upload,
      offset,
      data: fromByteArray(bytes.slice(offset, end)),
    });
    if (result.received !== end)
      throw new Error(
        "El cartel informó una posición inesperada. Volvé a enviar para retomar.",
      );
    offset = end;
    progress(`Enviando cola · ${Math.round((offset * 100) / bytes.length)}%`);
  }
  await call("animation/finish", { upload: transfer.upload });
}
